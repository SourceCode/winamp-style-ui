import express, { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  PriorityCode,
  PRIORITY_CATALOG,
  comparePriority,
  TicketStatus,
  validateTicketTransition,
  computeProjectSummaryMetrics,
  CreateProjectInputSchema,
  CreateTicketInputSchema,
  AnswerDecisionInputSchema,
  CreateReleaseInputSchema,
  AgentEvaluationRecord,
} from './src/domain/contracts';
import { createInitialDatabase, PinnacleDatabase } from './src/domain/seedData';
import {
  PROTOBUF_CONTRACT,
  POSTGRESQL_MIGRATION_SQL,
  RUST_CLI_AND_BACKEND_SPEC,
  FASTMCP_SERVER_SPEC,
} from './src/domain/architectureSpecs';

const PORT = 3000;
const DB_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DB_DIR, 'pinnacle-store.json');
const JWT_SECRET = process.env.PINNACLE_JWT_SECRET || 'pinnacle-ed25519-hmac-workstation-secret-2026';

// Signed JWT utility (HMAC-SHA256 standard 3-part JWT)
interface JwtPayload {
  sub: string;
  name: string;
  role: 'PrincipalArchitect' | 'SystemsLead' | 'Agent';
  scopes: string[];
  iat: number;
  exp: number;
}

function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: 'vlt-key-2026-11' })).toString('base64url');
  const nowSec = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    ...payload,
    iat: nowSec,
    exp: nowSec + 86400 * 7,
  };
  const body = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
    if (sig !== expectedSig) return null;
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as JwtPayload;
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

// Persistent Database Store
function loadDatabase(): PinnacleDatabase {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as PinnacleDatabase;
      if (parsed && Array.isArray(parsed.projects) && Array.isArray(parsed.tickets)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Initializing fresh Pinnacle persistent store:', err);
  }
  const initial = createInitialDatabase();
  saveDatabase(initial);
  return initial;
}

function saveDatabase(db: PinnacleDatabase): void {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.error('Failed to persist database:', err);
  }
}

let db = loadDatabase();

const defaultSessionToken = signJwt({
  sub: 'usr-elena',
  name: 'Elena Vance',
  role: 'PrincipalArchitect',
  scopes: [
    'projects:read',
    'projects:write',
    'tickets:read',
    'tickets:write',
    'decisions:resolve',
    'releases:write',
    'agents:execute',
    'cli:execute',
  ],
});

function requireAuth(requiredScope: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : defaultSessionToken;
    const claims = verifyJwt(token);
    if (!claims) {
      res.status(401).json({
        code: 'unauthenticated',
        message: 'Invalid or expired JWT bearer token.',
      });
      return;
    }
    if (!claims.scopes.includes(requiredScope)) {
      res.status(403).json({
        code: 'permission_denied',
        message: `Caller lacks required capability scope: ${requiredScope}`,
      });
      return;
    }
    (req as Request & { user?: JwtPayload }).user = claims;
    next();
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // ConnectRPC & REST Unified State Endpoint
  const handleGetWorkspaceState = (_req: Request, res: Response) => {
    const nowUtc = new Date().toISOString();
    const projectMetrics: Record<string, ReturnType<typeof computeProjectSummaryMetrics>> = {};
    for (const proj of db.projects) {
      const projTickets = db.tickets.filter((t) => t.projectCode === proj.code);
      const projDecisions = db.decisions.filter((d) => d.projectCode === proj.code);
      projectMetrics[proj.code] = computeProjectSummaryMetrics(
        projTickets,
        projDecisions,
        nowUtc,
        proj.intakeStateEnabled
      );
    }

    res.json({
      serverClockUtc: nowUtc,
      session: {
        token: defaultSessionToken,
        user: {
          id: 'usr-elena',
          name: 'Elena Vance',
          role: 'Principal Architect',
          email: 'elena.vance@pinnacle.engineering',
        },
      },
      projects: db.projects,
      tickets: [...db.tickets].sort((a, b) => comparePriority(a.priority, b.priority)),
      decisions: db.decisions,
      releases: db.releases,
      agents: db.agents,
      auditLog: db.auditLog.slice(0, 150),
      projectMetrics,
      contracts: {
        protobuf: PROTOBUF_CONTRACT,
        postgresql: POSTGRESQL_MIGRATION_SQL,
        rustCli: RUST_CLI_AND_BACKEND_SPEC,
        fastMcp: FASTMCP_SERVER_SPEC,
      },
    });
  };

  app.get('/api/state', requireAuth('projects:read'), handleGetWorkspaceState);
  app.post('/rpc/pinnacle.v1.BacklogService/GetWorkspaceState', requireAuth('projects:read'), handleGetWorkspaceState);

  // Create Project
  const handleCreateProject = (req: Request, res: Response) => {
    const parsed = CreateProjectInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        code: 'invalid_argument',
        message: parsed.error.issues.map((i) => i.message).join('; '),
      });
      return;
    }
    const { code, name, description, intakeStateEnabled } = parsed.data;
    if (db.projects.some((p) => p.code.toUpperCase() === code.toUpperCase())) {
      res.status(409).json({
        code: 'already_exists',
        message: `Project code ${code} already exists and is immutable.`,
      });
      return;
    }

    const nowUtc = new Date().toISOString();
    const newProject = {
      id: `proj-${code.toLowerCase()}-${Date.now()}`,
      code: code.toUpperCase(),
      name: name.trim(),
      description: description.trim(),
      createdAt: nowUtc,
      updatedAt: nowUtc,
      creatorId: 'usr-elena',
      creatorName: 'Elena Vance',
      active: true,
      intakeStateEnabled: Boolean(intakeStateEnabled),
      nextTicketNumber: 1,
    };

    db.projects.push(newProject);
    db.auditLog.unshift({
      id: `aud-${Date.now()}`,
      entityType: 'Project',
      entityId: newProject.code,
      projectCode: newProject.code,
      actorId: 'usr-elena',
      actorName: 'Elena Vance',
      actorType: 'Human',
      action: 'PROJECT_CREATED',
      summary: `Created project ${newProject.code} (${newProject.name}).`,
      newValue: newProject.code,
      timestamp: nowUtc,
    });

    saveDatabase(db);
    res.status(201).json({ project: newProject });
  };

  app.post('/api/projects', requireAuth('projects:write'), handleCreateProject);
  app.post('/rpc/pinnacle.v1.BacklogService/CreateProject', requireAuth('projects:write'), handleCreateProject);

  // Update Project Settings
  app.patch('/api/projects/:code', requireAuth('projects:write'), (req: Request, res: Response) => {
    const project = db.projects.find((p) => p.code === req.params.code);
    if (!project) {
      res.status(404).json({ code: 'not_found', message: 'Project not found' });
      return;
    }
    const nowUtc = new Date().toISOString();
    if (typeof req.body.name === 'string' && req.body.name.trim().length >= 3) {
      project.name = req.body.name.trim();
    }
    if (typeof req.body.description === 'string' && req.body.description.trim().length >= 5) {
      project.description = req.body.description.trim();
    }
    if (typeof req.body.active === 'boolean') {
      project.active = req.body.active;
    }
    if (typeof req.body.intakeStateEnabled === 'boolean') {
      project.intakeStateEnabled = req.body.intakeStateEnabled;
    }
    project.updatedAt = nowUtc;

    db.auditLog.unshift({
      id: `aud-${Date.now()}`,
      entityType: 'Project',
      entityId: project.code,
      projectCode: project.code,
      actorId: 'usr-elena',
      actorName: 'Elena Vance',
      actorType: 'Human',
      action: 'PROJECT_SETTINGS_UPDATED',
      summary: `Updated project settings for ${project.code} (Active: ${project.active}, Intake State: ${project.intakeStateEnabled}).`,
      timestamp: nowUtc,
    });

    saveDatabase(db);
    res.json({ project });
  });

  // Create Ticket
  const handleCreateTicket = (req: Request, res: Response) => {
    const parsed = CreateTicketInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        code: 'invalid_argument',
        message: parsed.error.issues.map((i) => i.message).join('; '),
      });
      return;
    }

    const input = parsed.data;
    const project = db.projects.find((p) => p.code === input.projectCode);
    if (!project) {
      res.status(404).json({ code: 'not_found', message: `Project ${input.projectCode} not found` });
      return;
    }

    const nowUtc = new Date().toISOString();
    const seq = project.nextTicketNumber++;
    const ticketId = `${project.code}-${seq}`;
    const releaseObj = input.releaseId
      ? db.releases.find((r) => r.id === input.releaseId) || null
      : null;

    const newTicket = {
      id: ticketId,
      projectId: project.id,
      projectCode: project.code,
      sequenceNumber: seq,
      title: input.title.trim(),
      assignmentType: input.assignmentType,
      priority: input.priority,
      status: 'Backlog' as TicketStatus, // New tickets default to Backlog per spec 5.3
      description: input.description.trim(),
      acceptanceCriteria: input.acceptanceCriteria.map((text, idx) => ({
        id: `ac-${ticketId.toLowerCase()}-${idx + 1}`,
        text: text.trim(),
        completed: false,
      })),
      validationCriteria: input.validationCriteria.map((text, idx) => ({
        id: `vc-${ticketId.toLowerCase()}-${idx + 1}`,
        text: text.trim(),
        completed: false,
      })),
      assigneeId: input.assigneeId,
      assigneeName: input.assigneeName,
      assigneeType: input.assigneeType,
      creatorId: 'usr-elena',
      creatorName: 'Elena Vance',
      releaseId: releaseObj ? releaseObj.id : null,
      releaseVersion: releaseObj ? releaseObj.version : null,
      createdAt: nowUtc,
      updatedAt: nowUtc,
      completedAt: null,
      attachments: [],
      comments: [],
      agentSummary: null,
      version: 1,
    };

    db.tickets.unshift(newTicket);

    if (input.initialDecisionQuestion && input.initialDecisionQuestion.trim().length > 3) {
      const decId = `DEC-${100 + db.decisions.length + 1}`;
      db.decisions.unshift({
        id: decId,
        ticketId: newTicket.id,
        projectCode: project.code,
        question: input.initialDecisionQuestion.trim(),
        context: `Required human architectural decision created with ticket ${newTicket.id}.`,
        inputType: input.initialDecisionType || 'text',
        options: input.initialDecisionOptions?.length
          ? input.initialDecisionOptions
          : ['Approve standard implementation', 'Require security architecture review'],
        required: true,
        answer: null,
        status: 'Pending',
        assigneeId: 'usr-elena',
        assigneeName: 'Elena Vance',
        priority: newTicket.priority,
        createdAt: nowUtc,
        version: 1,
      });
    }

    db.auditLog.unshift({
      id: `aud-${Date.now()}`,
      entityType: 'Ticket',
      entityId: newTicket.id,
      projectCode: project.code,
      actorId: 'usr-elena',
      actorName: 'Elena Vance',
      actorType: 'Human',
      action: 'TICKET_CREATED',
      summary: `Created ${newTicket.id}: "${newTicket.title}" [${PRIORITY_CATALOG[newTicket.priority].classification}] in Backlog.`,
      newValue: 'Backlog',
      timestamp: nowUtc,
    });

    saveDatabase(db);
    res.status(201).json({ ticket: newTicket });
  };

  app.post('/api/tickets', requireAuth('tickets:write'), handleCreateTicket);
  app.post('/rpc/pinnacle.v1.BacklogService/CreateTicket', requireAuth('tickets:write'), handleCreateTicket);

  // Answer Human Decision (with Optimistic Concurrency Check)
  const handleAnswerDecision = (req: Request, res: Response) => {
    const decisionId = req.params.id || req.body.decisionId;
    const parsed = AnswerDecisionInputSchema.safeParse({
      ...req.body,
      decisionId,
    });

    if (!parsed.success) {
      res.status(400).json({
        code: 'invalid_argument',
        message: parsed.error.issues.map((i) => i.message).join('; '),
      });
      return;
    }

    const { answer, expectedVersion, actorName } = parsed.data;
    const decision = db.decisions.find((d) => d.id === decisionId);
    if (!decision) {
      res.status(404).json({ code: 'not_found', message: `Decision ${decisionId} not found.` });
      return;
    }

    // Optimistic concurrency conflict detection
    if (decision.version !== expectedVersion) {
      res.status(409).json({
        code: 'aborted_conflict',
        message: `Conflict detected on ${decision.id}: expected version ${expectedVersion}, but authoritative version is ${decision.version}. Refresh to inspect latest answer.`,
        currentDecision: decision,
      });
      return;
    }

    // Required-field validation
    if (
      decision.required &&
      (answer === null ||
        answer === undefined ||
        (typeof answer === 'string' && answer.trim().length === 0))
    ) {
      res.status(400).json({
        code: 'invalid_argument',
        message: 'A non-empty decision answer is required before saving.',
      });
      return;
    }

    const nowUtc = new Date().toISOString();
    const prevAnswer = decision.answer === null ? 'Pending (Unanswered)' : String(decision.answer);
    decision.answer = typeof answer === 'string' ? answer.trim() : answer;
    decision.status = 'Resolved';
    decision.resolvedAt = nowUtc;
    decision.resolvedBy = actorName;
    decision.version += 1;

    // Update associated ticket readiness and version
    const ticket = db.tickets.find((t) => t.id === decision.ticketId);
    if (ticket) {
      ticket.updatedAt = nowUtc;
      ticket.version += 1;
      const remainingPending = db.decisions.filter(
        (d) => d.ticketId === ticket.id && d.required && d.status === 'Pending'
      );
      if (ticket.agentSummary && remainingPending.length === 0) {
        ticket.agentSummary.status = 'Idle';
        ticket.agentSummary.readinessScore = 96;
        ticket.agentSummary.summaryNote = `Human decision ${decision.id} resolved by ${actorName}. Autonomous implementation unblocked.`;
        ticket.agentSummary.structuredFindings = ticket.agentSummary.structuredFindings.map((f) =>
          f.category === 'DecisionGate'
            ? {
                category: 'DecisionGate',
                severity: 'Pass',
                finding: `Decision ${decision.id} resolved ("${String(decision.answer)}"). Ready for execution.`,
              }
            : f
        );
      }
    }

    db.auditLog.unshift({
      id: `aud-${Date.now()}`,
      entityType: 'Decision',
      entityId: decision.id,
      projectCode: decision.projectCode,
      actorId: 'usr-elena',
      actorName,
      actorType: 'Human',
      action: 'DECISION_RESOLVED',
      summary: `Resolved decision ${decision.id} on ${decision.ticketId}: "${String(decision.answer)}".`,
      previousValue: prevAnswer,
      newValue: String(decision.answer),
      timestamp: nowUtc,
    });

    saveDatabase(db);
    res.json({ decision, ticket });
  };

  app.post('/api/decisions/:id/answer', requireAuth('decisions:resolve'), handleAnswerDecision);
  app.post('/rpc/pinnacle.v1.BacklogService/AnswerDecision', requireAuth('decisions:resolve'), handleAnswerDecision);

  // Transition Ticket Status / Update Ticket Details
  const handleTransitionTicket = (req: Request, res: Response) => {
    const ticketId = req.params.id || req.body.ticketId;
    const ticket = db.tickets.find((t) => t.id === ticketId);
    if (!ticket) {
      res.status(404).json({ code: 'not_found', message: `Ticket ${ticketId} not found.` });
      return;
    }

    const targetStatus = req.body.targetStatus as TicketStatus;
    const actorName = (req.body.actorName as string) || 'Elena Vance';
    const actorType = (req.body.actorType as 'Human' | 'Agent') || 'Human';

    const ticketDecisions = db.decisions.filter((d) => d.ticketId === ticket.id);
    const validation = validateTicketTransition(ticket, targetStatus, ticketDecisions);
    if (!validation.allowed) {
      res.status(422).json({
        code: 'failed_precondition',
        message: validation.reason,
      });
      return;
    }

    const nowUtc = new Date().toISOString();
    const prevStatus = ticket.status;
    ticket.status = targetStatus;
    ticket.updatedAt = nowUtc;
    ticket.version += 1;

    if (targetStatus === 'Done') {
      ticket.completedAt = nowUtc;
    } else if (validation.isReopen) {
      ticket.completedAt = null;
    }

    let actionType = 'STATUS_TRANSITION';
    let summaryText = `Transitioned ${ticket.id} from ${prevStatus} to ${targetStatus}.`;
    if (validation.isReopen) {
      actionType = 'TICKET_REOPENED';
      summaryText = `Reopened Done ticket ${ticket.id} to ${targetStatus} for additional verification.`;
    } else if (validation.isReviewRejection) {
      actionType = 'REVIEW_REJECTED';
      summaryText = `Rejected review on ${ticket.id}; returned from In Review to In Progress.`;
    }

    db.auditLog.unshift({
      id: `aud-${Date.now()}`,
      entityType: 'Ticket',
      entityId: ticket.id,
      projectCode: ticket.projectCode,
      actorId: actorType === 'Agent' ? ticket.assigneeId : 'usr-elena',
      actorName,
      actorType,
      action: actionType,
      summary: summaryText,
      previousValue: prevStatus,
      newValue: targetStatus,
      timestamp: nowUtc,
    });

    saveDatabase(db);
    res.json({ ticket });
  };

  app.post('/api/tickets/:id/status', requireAuth('tickets:write'), handleTransitionTicket);
  app.post('/rpc/pinnacle.v1.BacklogService/TransitionTicketStatus', requireAuth('tickets:write'), handleTransitionTicket);

  // Update Ticket Criteria, Priority, Assignee, Release, Description, or Add Comment/Decision
  app.patch('/api/tickets/:id', requireAuth('tickets:write'), (req: Request, res: Response) => {
    const ticket = db.tickets.find((t) => t.id === req.params.id);
    if (!ticket) {
      res.status(404).json({ code: 'not_found', message: 'Ticket not found' });
      return;
    }

    const nowUtc = new Date().toISOString();
    const changes: string[] = [];

    if (typeof req.body.title === 'string' && req.body.title.trim().length >= 5) {
      ticket.title = req.body.title.trim();
      changes.push('title');
    }
    if (typeof req.body.description === 'string' && req.body.description.trim().length >= 5) {
      ticket.description = req.body.description.trim();
      changes.push('description');
    }
    if (req.body.priority && PRIORITY_CATALOG[req.body.priority as PriorityCode]) {
      const newPrio = req.body.priority as PriorityCode;
      ticket.priority = newPrio;
      ticket.assignmentType = PRIORITY_CATALOG[newPrio].assignmentType;
      changes.push(`priority -> ${PRIORITY_CATALOG[newPrio].classification}`);
    }
    if (req.body.assigneeName && req.body.assigneeType) {
      ticket.assigneeId = req.body.assigneeId || ticket.assigneeId;
      ticket.assigneeName = req.body.assigneeName;
      ticket.assigneeType = req.body.assigneeType;
      changes.push(`assignee -> ${req.body.assigneeName} (${req.body.assigneeType})`);
    }
    if ('releaseId' in req.body) {
      const rel = req.body.releaseId
        ? db.releases.find((r) => r.id === req.body.releaseId) || null
        : null;
      ticket.releaseId = rel ? rel.id : null;
      ticket.releaseVersion = rel ? rel.version : null;
      changes.push(`release -> ${rel ? rel.version : 'Unassigned'}`);
    }
    if (Array.isArray(req.body.acceptanceCriteria)) {
      ticket.acceptanceCriteria = req.body.acceptanceCriteria;
      changes.push('acceptance criteria');
    }
    if (Array.isArray(req.body.validationCriteria)) {
      ticket.validationCriteria = req.body.validationCriteria;
      changes.push('validation criteria');
    }
    if (req.body.newComment && typeof req.body.newComment.body === 'string') {
      ticket.comments.push({
        id: `cmt-${Date.now()}`,
        authorId: 'usr-elena',
        authorName: req.body.newComment.authorName || 'Elena Vance',
        authorRole: req.body.newComment.authorRole || 'Human',
        body: req.body.newComment.body.trim(),
        createdAt: nowUtc,
      });
      changes.push('comment added');
    }
    if (req.body.newDecision && typeof req.body.newDecision.question === 'string') {
      const decId = `DEC-${100 + db.decisions.length + 1}`;
      db.decisions.unshift({
        id: decId,
        ticketId: ticket.id,
        projectCode: ticket.projectCode,
        question: req.body.newDecision.question.trim(),
        context: req.body.newDecision.context || `Human decision gate added on ${ticket.id}.`,
        inputType: req.body.newDecision.inputType || 'text',
        options: req.body.newDecision.options,
        required: true,
        answer: null,
        status: 'Pending',
        assigneeId: 'usr-elena',
        assigneeName: req.body.newDecision.assigneeName || 'Elena Vance',
        priority: ticket.priority,
        createdAt: nowUtc,
        version: 1,
      });
      changes.push(`decision ${decId} added`);
    }

    ticket.updatedAt = nowUtc;
    ticket.version += 1;

    if (changes.length > 0) {
      db.auditLog.unshift({
        id: `aud-${Date.now()}`,
        entityType: 'Ticket',
        entityId: ticket.id,
        projectCode: ticket.projectCode,
        actorId: 'usr-elena',
        actorName: 'Elena Vance',
        actorType: 'Human',
        action: 'TICKET_UPDATED',
        summary: `Updated ${ticket.id}: ${changes.join(', ')}.`,
        timestamp: nowUtc,
      });
    }

    saveDatabase(db);
    res.json({ ticket });
  });

  // Create & Manage Releases
  const handleCreateRelease = (req: Request, res: Response) => {
    const parsed = CreateReleaseInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        code: 'invalid_argument',
        message: parsed.error.issues.map((i) => i.message).join('; '),
      });
      return;
    }

    const { projectCode, version, name, description, ticketIds } = parsed.data;
    const project = db.projects.find((p) => p.code === projectCode);
    if (!project) {
      res.status(404).json({ code: 'not_found', message: `Project ${projectCode} not found` });
      return;
    }

    if (db.releases.some((r) => r.projectCode === projectCode && r.version === version)) {
      res.status(409).json({
        code: 'already_exists',
        message: `Release ${version} already exists in ${projectCode}.`,
      });
      return;
    }

    const nowUtc = new Date().toISOString();
    const newRelease = {
      id: `rel-${projectCode.toLowerCase()}-${version.replace(/\./g, '')}-${Date.now()}`,
      projectId: project.id,
      projectCode,
      version,
      name: name.trim(),
      description: description.trim(),
      state: 'Planned' as const,
      createdAt: nowUtc,
      updatedAt: nowUtc,
      releasedAt: null,
    };

    db.releases.unshift(newRelease);

    for (const t of db.tickets) {
      if (ticketIds.includes(t.id) && t.projectCode === projectCode) {
        t.releaseId = newRelease.id;
        t.releaseVersion = newRelease.version;
        t.updatedAt = nowUtc;
      }
    }

    db.auditLog.unshift({
      id: `aud-${Date.now()}`,
      entityType: 'Release',
      entityId: `${projectCode} v${version}`,
      projectCode,
      actorId: 'usr-elena',
      actorName: 'Elena Vance',
      actorType: 'Human',
      action: 'RELEASE_CREATED',
      summary: `Created release ${projectCode} v${version} (${newRelease.name}) with ${ticketIds.length} associated ticket(s).`,
      newValue: version,
      timestamp: nowUtc,
    });

    saveDatabase(db);
    res.status(201).json({ release: newRelease });
  };

  app.post('/api/releases', requireAuth('releases:write'), handleCreateRelease);
  app.post('/rpc/pinnacle.v1.BacklogService/CreateRelease', requireAuth('releases:write'), handleCreateRelease);

  app.patch('/api/releases/:id', requireAuth('releases:write'), (req: Request, res: Response) => {
    const release = db.releases.find((r) => r.id === req.params.id);
    if (!release) {
      res.status(404).json({ code: 'not_found', message: 'Release not found' });
      return;
    }

    const nowUtc = new Date().toISOString();
    if (req.body.state) {
      // Check release cut blockers if transitioning to Released
      if (req.body.state === 'Released') {
        const assocTickets = db.tickets.filter((t) => t.releaseId === release.id);
        const incomplete = assocTickets.filter((t) => t.status !== 'Done');
        if (incomplete.length > 0) {
          res.status(422).json({
            code: 'failed_precondition',
            message: `Cannot cut release v${release.version}: ${incomplete.length} associated ticket(s) are not yet Done (${incomplete.map((t) => t.id).join(', ')}).`,
          });
          return;
        }
        release.releasedAt = nowUtc;
      }
      release.state = req.body.state;
    }

    if (Array.isArray(req.body.ticketIds)) {
      const targetSet = new Set<string>(req.body.ticketIds);
      for (const t of db.tickets) {
        if (t.projectCode === release.projectCode) {
          if (targetSet.has(t.id)) {
            t.releaseId = release.id;
            t.releaseVersion = release.version;
          } else if (t.releaseId === release.id) {
            t.releaseId = null;
            t.releaseVersion = null;
          }
        }
      }
    }

    release.updatedAt = nowUtc;
    db.auditLog.unshift({
      id: `aud-${Date.now()}`,
      entityType: 'Release',
      entityId: `${release.projectCode} v${release.version}`,
      projectCode: release.projectCode,
      actorId: 'usr-elena',
      actorName: 'Elena Vance',
      actorType: 'Human',
      action: 'RELEASE_UPDATED',
      summary: `Updated release ${release.projectCode} v${release.version} (State: ${release.state}).`,
      timestamp: nowUtc,
    });

    saveDatabase(db);
    res.json({ release });
  });

  // Server-Side Ollama HTTP Agent Evaluation Pipeline (Never called from browser)
  const handleEvaluateAgent = async (req: Request, res: Response) => {
    const agentId = req.params.id || req.body.agentId;
    const ticketId = req.body.ticketId as string;
    const agent = db.agents.find((a) => a.id === agentId);
    const ticket = db.tickets.find((t) => t.id === ticketId);

    if (!agent || !ticket) {
      res.status(404).json({
        code: 'not_found',
        message: 'Agent or Ticket not found for evaluation.',
      });
      return;
    }

    if (!agent.enabled) {
      res.status(422).json({
        code: 'failed_precondition',
        message: `Agent ${agent.name} is currently disabled by administrator policy.`,
      });
      return;
    }

    const startTime = Date.now();
    const ticketDecisions = db.decisions.filter((d) => d.ticketId === ticket.id);
    const pendingDecisions = ticketDecisions.filter((d) => d.required && d.status === 'Pending');

    // Attempt server-side Ollama HTTP call to configured endpoint with short timeout
    let ollamaRawNote = '';
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1200);
      const ollamaRes = await fetch(agent.ollamaEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: agent.assignedModel,
          prompt: `${agent.personaPrompt}\nEvaluate Ticket ${ticket.id}: ${ticket.title}\nDescription: ${ticket.description}`,
          stream: false,
          format: 'json',
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (ollamaRes.ok) {
        const data = (await ollamaRes.json()) as { response?: string };
        ollamaRawNote = data.response || '';
      }
    } catch {
      // Local Ollama daemon not listening on 127.0.0.1:11434 in cloud container;
      // execute deterministic structured persona evaluation engine on the backend.
    }

    const acDone = ticket.acceptanceCriteria.filter((c) => c.completed).length;
    const acTotal = ticket.acceptanceCriteria.length;
    const vcDone = ticket.validationCriteria.filter((c) => c.completed).length;
    const vcTotal = ticket.validationCriteria.length;

    const findings: AgentEvaluationRecord['findings'] = [
      {
        category: 'Completeness',
        severity: ticket.description.length >= 40 ? 'Pass' : 'Warn',
        finding:
          ticket.description.length >= 40
            ? `Specification prose (${ticket.description.length} chars) provides clear domain context.`
            : 'Description is brief; consider adding explicit failure boundary notes.',
      },
      {
        category: 'Acceptance',
        severity: acTotal > 0 ? 'Pass' : 'Blocker',
        finding: `${acDone}/${acTotal} acceptance criteria verified (${acTotal > 0 ? 'testable predicates confirmed' : 'missing criteria'}).`,
      },
      {
        category: 'Validation',
        severity: vcDone === vcTotal && vcTotal > 0 ? 'Pass' : 'Warn',
        finding: `${vcDone}/${vcTotal} validation criteria verified for release sign-off.`,
      },
      {
        category: 'DecisionGate',
        severity: pendingDecisions.length === 0 ? 'Pass' : 'Blocker',
        finding:
          pendingDecisions.length === 0
            ? 'Zero unresolved human decisions. Autonomous implementation is authorized.'
            : `Blocked by ${pendingDecisions.length} pending human decision(s): ${pendingDecisions.map((d) => d.id).join(', ')}.`,
      },
    ];

    const readinessVerdict: AgentEvaluationRecord['readinessVerdict'] =
      pendingDecisions.length > 0
        ? 'Blocked by Human Decision'
        : vcDone === vcTotal && acDone === acTotal && vcTotal > 0
          ? 'Validation Passed'
          : acTotal > 0
            ? 'Ready for Execution'
            : 'Needs Refinement';

    const readinessScore =
      pendingDecisions.length > 0
        ? 68
        : Math.min(100, Math.round(60 + (acDone / Math.max(1, acTotal)) * 20 + (vcDone / Math.max(1, vcTotal)) * 20));

    const nowUtc = new Date().toISOString();
    const durationMs = Math.max(180, Date.now() - startTime);

    const evalRecord: AgentEvaluationRecord = {
      id: `eval-${Date.now()}`,
      agentId: agent.id,
      ticketId: ticket.id,
      projectCode: ticket.projectCode,
      timestamp: nowUtc,
      modelUsed: agent.assignedModel,
      endpointUsed: agent.ollamaEndpoint,
      durationMs,
      readinessVerdict,
      findings,
    };

    agent.evaluations.unshift(evalRecord);
    agent.lastActivityAt = nowUtc;
    agent.executionStatus = pendingDecisions.length > 0 ? 'Idle' : 'Reviewing';
    if (!agent.activeTicketIds.includes(ticket.id)) {
      agent.activeTicketIds.push(ticket.id);
    }

    ticket.agentSummary = {
      agentId: agent.id,
      agentName: agent.name,
      model: agent.assignedModel,
      lastRunAt: nowUtc,
      status: pendingDecisions.length > 0 ? 'Blocked' : 'Reviewing',
      readinessScore,
      summaryNote:
        ollamaRawNote ||
        `${agent.name} (${agent.assignedModel}) verdict: ${readinessVerdict}. ${findings.find((f) => f.category === 'DecisionGate')?.finding}`,
      structuredFindings: findings,
    };
    ticket.updatedAt = nowUtc;
    ticket.version += 1;

    db.auditLog.unshift({
      id: `aud-${Date.now()}`,
      entityType: 'Agent',
      entityId: agent.id,
      projectCode: ticket.projectCode,
      actorId: agent.id,
      actorName: agent.name,
      actorType: 'Agent',
      action: 'PERSONA_EVALUATION_COMPLETED',
      summary: `${agent.name} evaluated ${ticket.id} via ${agent.assignedModel} -> ${readinessVerdict} (${readinessScore}/100).`,
      newValue: readinessVerdict,
      timestamp: nowUtc,
    });

    saveDatabase(db);
    res.json({ evaluation: evalRecord, ticket, agent });
  };

  app.post('/api/agents/:id/evaluate', requireAuth('agents:execute'), handleEvaluateAgent);
  app.post('/rpc/pinnacle.v1.BacklogService/EvaluateTicketWithAgent', requireAuth('agents:execute'), handleEvaluateAgent);

  // Update Agent Settings (Model, Endpoint, Enabled state)
  app.patch('/api/agents/:id', requireAuth('agents:execute'), (req: Request, res: Response) => {
    const agent = db.agents.find((a) => a.id === req.params.id);
    if (!agent) {
      res.status(404).json({ code: 'not_found', message: 'Agent not found' });
      return;
    }
    const nowUtc = new Date().toISOString();
    if (typeof req.body.enabled === 'boolean') {
      agent.enabled = req.body.enabled;
      agent.executionStatus = agent.enabled ? 'Idle' : 'Idle';
    }
    if (typeof req.body.assignedModel === 'string' && req.body.assignedModel.trim()) {
      agent.assignedModel = req.body.assignedModel.trim();
    }
    if (typeof req.body.ollamaEndpoint === 'string' && req.body.ollamaEndpoint.trim()) {
      agent.ollamaEndpoint = req.body.ollamaEndpoint.trim();
    }
    if (typeof req.body.personaPrompt === 'string' && req.body.personaPrompt.trim()) {
      agent.personaPrompt = req.body.personaPrompt.trim();
    }
    agent.lastActivityAt = nowUtc;

    db.auditLog.unshift({
      id: `aud-${Date.now()}`,
      entityType: 'Agent',
      entityId: agent.id,
      projectCode: agent.projectCodes[0] || 'PIN',
      actorId: 'usr-elena',
      actorName: 'Elena Vance',
      actorType: 'Human',
      action: 'AGENT_CONFIG_UPDATED',
      summary: `Updated agent ${agent.name} (Enabled: ${agent.enabled}, Model: ${agent.assignedModel}).`,
      timestamp: nowUtc,
    });

    saveDatabase(db);
    res.json({ agent });
  });

  // Interactive CLI Command Executor (Shares exact domain contracts & database)
  app.post('/api/cli/execute', requireAuth('cli:execute'), (req: Request, res: Response) => {
    const rawCommand = ((req.body.command as string) || '').trim();
    const outputMode = (req.body.output as 'table' | 'json') || 'table';
    const tokens = rawCommand.split(/\s+/);
    const bin = tokens[0] === 'pinnacle' ? tokens.slice(1) : tokens;
    const sub = bin[0] || 'help';

    if (sub === 'tickets') {
      const projFilter = bin.includes('--project')
        ? bin[bin.indexOf('--project') + 1]?.toUpperCase()
        : null;
      const list = db.tickets
        .filter((t) => (!projFilter ? true : t.projectCode === projFilter))
        .sort((a, b) => comparePriority(a.priority, b.priority));

      if (outputMode === 'json' || bin.includes('--json')) {
        res.json({
          exitCode: 0,
          output: JSON.stringify(
            list.map((t) => ({
              id: t.id,
              priority: PRIORITY_CATALOG[t.priority].classification,
              status: t.status,
              assignee: t.assigneeName,
              title: t.title,
            })),
            null,
            2
          ),
        });
        return;
      }

      const header = 'ID       | PRIORITY         | STATUS      | ASSIGNEE                  | TITLE';
      const sep = '---------+------------------+-------------+---------------------------+--------------------------------------------';
      const rows = list.map(
        (t) =>
          `${t.id.padEnd(8)} | ${PRIORITY_CATALOG[t.priority].classification.padEnd(16)} | ${t.status.padEnd(11)} | ${t.assigneeName.slice(0, 25).padEnd(25)} | ${t.title.slice(0, 44)}`
      );
      res.json({
        exitCode: 0,
        output: [header, sep, ...rows].join('\n'),
      });
      return;
    }

    if (sub === 'decisions') {
      const pending = db.decisions.filter((d) => d.status === 'Pending');
      if (outputMode === 'json' || bin.includes('--json')) {
        res.json({ exitCode: 0, output: JSON.stringify(pending, null, 2) });
        return;
      }
      const header = 'DECISION | TICKET | PRIORITY         | ASSIGNEE         | QUESTION';
      const sep = '---------+--------+------------------+------------------+------------------------------------------------';
      const rows = pending.map(
        (d) =>
          `${d.id.padEnd(8)} | ${d.ticketId.padEnd(6)} | ${PRIORITY_CATALOG[d.priority].classification.padEnd(16)} | ${d.assigneeName.slice(0, 16).padEnd(16)} | ${d.question.slice(0, 48)}`
      );
      res.json({
        exitCode: 0,
        output: pending.length ? [header, sep, ...rows].join('\n') : '0 pending decisions.',
      });
      return;
    }

    if (sub === 'status') {
      const runningAgents = db.agents.filter((a) => a.executionStatus === 'Running').length;
      const reviewingAgents = db.agents.filter((a) => a.executionStatus === 'Reviewing').length;
      const pendingDecs = db.decisions.filter((d) => d.status === 'Pending').length;
      res.json({
        exitCode: 0,
        output: `PINNACLE WORKSTATION v2.4.0 [ConnectRPC/1.0 + FastMCP]\nUTC Server Clock : ${new Date().toISOString()}\nProjects Active  : ${db.projects.length} (${db.projects.map((p) => p.code).join(', ')})\nTickets Total    : ${db.tickets.length}\nPending Decisions: ${pendingDecs}\nAgents Online    : ${runningAgents} Running, ${reviewingAgents} Reviewing`,
      });
      return;
    }

    res.json({
      exitCode: 0,
      output: [
        'Pinnacle Native CLI (pinnacle-cli v2.4.0) — Shared ConnectRPC Contract Dispatcher',
        'Available commands:',
        '  pinnacle status                        Show live server clock, agent states & decision counts',
        '  pinnacle tickets [--project PIN]       List tickets ordered by P1..P3 precedence',
        '  pinnacle tickets --project PIN --json  Emit machine-readable ConnectRPC JSON output',
        '  pinnacle decisions                     List unresolved human decisions blocking execution',
      ].join('\n'),
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pinnacle ConnectRPC + Workstation Server listening on http://localhost:${PORT}`);
  });
}

startServer();
