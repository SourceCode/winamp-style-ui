import { z } from 'zod';

/**
 * PINNACLE SHARED DOMAIN CONTRACTS & VALIDATION RULES
 * Shared across Frontend, ConnectRPC Backend, CLI, and FastMCP Server.
 */

// 5.4 Ticket Priority System — Exact Precedence Order (1 = Highest, 6 = Lowest)
export enum PriorityCode {
  P1_DEFECT = 'P1_DEFECT',
  P1_ENHANCEMENT = 'P1_ENHANCEMENT',
  P2_DEFECT = 'P2_DEFECT',
  P2_ENHANCEMENT = 'P2_ENHANCEMENT',
  P3_DEFECT = 'P3_DEFECT',
  P3_ENHANCEMENT = 'P3_ENHANCEMENT',
}

export interface PriorityMetadata {
  code: PriorityCode;
  order: number;
  classification: string;
  display: 'Critical' | 'High' | 'Normal' | 'Low' | 'Lowest';
  assignmentType: 'Defect' | 'Enhancement';
  description: string;
  shortTag: string;
}

export const PRIORITY_CATALOG: Record<PriorityCode, PriorityMetadata> = {
  [PriorityCode.P1_DEFECT]: {
    code: PriorityCode.P1_DEFECT,
    order: 1,
    classification: 'P1 Defect',
    display: 'Critical',
    assignmentType: 'Defect',
    description: 'Broken functionality without a workaround or potential data loss.',
    shortTag: 'P1·DEF',
  },
  [PriorityCode.P1_ENHANCEMENT]: {
    code: PriorityCode.P1_ENHANCEMENT,
    order: 2,
    classification: 'P1 Enhancement',
    display: 'High',
    assignmentType: 'Enhancement',
    description: 'Revenue-generating functionality.',
    shortTag: 'P1·ENH',
  },
  [PriorityCode.P2_DEFECT]: {
    code: PriorityCode.P2_DEFECT,
    order: 3,
    classification: 'P2 Defect',
    display: 'High',
    assignmentType: 'Defect',
    description: 'Functional defect with a workaround.',
    shortTag: 'P2·DEF',
  },
  [PriorityCode.P2_ENHANCEMENT]: {
    code: PriorityCode.P2_ENHANCEMENT,
    order: 4,
    classification: 'P2 Enhancement',
    display: 'Normal',
    assignmentType: 'Enhancement',
    description: 'General software improvement.',
    shortTag: 'P2·ENH',
  },
  [PriorityCode.P3_DEFECT]: {
    code: PriorityCode.P3_DEFECT,
    order: 5,
    classification: 'P3 Defect',
    display: 'Low',
    assignmentType: 'Defect',
    description: 'Visual or minor functional defect.',
    shortTag: 'P3·DEF',
  },
  [PriorityCode.P3_ENHANCEMENT]: {
    code: PriorityCode.P3_ENHANCEMENT,
    order: 6,
    classification: 'P3 Enhancement',
    display: 'Lowest',
    assignmentType: 'Enhancement',
    description: 'Wishes, stretch goals, and optional improvements.',
    shortTag: 'P3·ENH',
  },
};

export function comparePriority(a: PriorityCode, b: PriorityCode): number {
  return PRIORITY_CATALOG[a].order - PRIORITY_CATALOG[b].order;
}

// 5.3 Ticket Status Lifecycle
export type TicketStatus = 'Created' | 'Backlog' | 'In Progress' | 'In Review' | 'Done';

export const TICKET_STATUSES: TicketStatus[] = [
  'Backlog',
  'In Progress',
  'In Review',
  'Done',
];

export type DecisionInputType = 'checkbox' | 'single_option' | 'select' | 'text';

export interface TicketDecision {
  id: string;
  ticketId: string;
  projectCode: string;
  question: string;
  context: string;
  inputType: DecisionInputType;
  options?: string[];
  required: boolean;
  answer: string | boolean | null;
  status: 'Pending' | 'Resolved';
  assigneeId: string;
  assigneeName: string;
  priority: PriorityCode;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  version: number;
}

export interface CriterionItem {
  id: string;
  text: string;
  completed: boolean;
  verifiedBy?: string;
}

export interface TicketAttachment {
  id: string;
  fileName: string;
  fileSize: string;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: string;
  sha256: string;
}

export interface TicketComment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: 'Human' | 'Agent';
  body: string;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  entityType: 'Project' | 'Ticket' | 'Decision' | 'Release' | 'Agent';
  entityId: string;
  projectCode: string;
  actorId: string;
  actorName: string;
  actorType: 'Human' | 'Agent' | 'System';
  action: string;
  summary: string;
  previousValue?: string;
  newValue?: string;
  timestamp: string;
}

export interface AgentExecutionSummary {
  agentId: string;
  agentName: string;
  model: string;
  lastRunAt: string;
  status: 'Idle' | 'Running' | 'Reviewing' | 'Blocked' | 'Completed' | 'Error';
  readinessScore: number; // 0-100
  summaryNote: string;
  structuredFindings: {
    category: 'Completeness' | 'Acceptance' | 'Validation' | 'DecisionGate' | 'Implementation';
    severity: 'Pass' | 'Warn' | 'Blocker';
    finding: string;
  }[];
}

export interface Ticket {
  id: string; // e.g. PIN-1
  projectId: string;
  projectCode: string;
  sequenceNumber: number;
  title: string;
  assignmentType: 'Enhancement' | 'Defect';
  priority: PriorityCode;
  status: TicketStatus;
  description: string;
  acceptanceCriteria: CriterionItem[];
  validationCriteria: CriterionItem[];
  assigneeId: string;
  assigneeName: string;
  assigneeType: 'Human' | 'Agent';
  creatorId: string;
  creatorName: string;
  releaseId: string | null;
  releaseVersion: string | null;
  createdAt: string; // ISO UTC
  updatedAt: string; // ISO UTC
  completedAt: string | null; // ISO UTC when status moved to Done
  attachments: TicketAttachment[];
  comments: TicketComment[];
  agentSummary: AgentExecutionSummary | null;
  version: number;
}

export interface Project {
  id: string;
  code: string; // Immutable e.g. PIN, NXS, VLT
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  creatorId: string;
  creatorName: string;
  active: boolean;
  intakeStateEnabled: boolean; // Whether 'Created' pre-backlog intake is active
  nextTicketNumber: number;
}

export interface Release {
  id: string;
  projectId: string;
  projectCode: string;
  version: string; // Strictly MAJOR.MINOR.PATCH
  name: string;
  description: string;
  state: 'Planned' | 'In Validation' | 'Ready for Cut' | 'Released';
  createdAt: string;
  updatedAt: string;
  releasedAt: string | null;
}

export interface AgentEvaluationRecord {
  id: string;
  agentId: string;
  ticketId: string;
  projectCode: string;
  timestamp: string;
  modelUsed: string;
  endpointUsed: string;
  durationMs: number;
  readinessVerdict: 'Ready for Execution' | 'Blocked by Human Decision' | 'Validation Passed' | 'Needs Refinement';
  findings: {
    category: 'Completeness' | 'Acceptance' | 'Validation' | 'DecisionGate' | 'Implementation';
    severity: 'Pass' | 'Warn' | 'Blocker';
    finding: string;
  }[];
}

export interface AgentPersona {
  id: string;
  name: string;
  roleTitle: string;
  personaPrompt: string;
  assignedModel: string;
  ollamaEndpoint: string;
  capabilities: string[];
  permissions: string[];
  executionPolicy: {
    requireZeroPendingDecisions: boolean;
    requireAcceptanceCriteria: boolean;
    requireValidationCriteria: boolean;
    maxConcurrentTickets: number;
    autoTransitionToReview: boolean;
  };
  enabled: boolean;
  executionStatus: 'Idle' | 'Running' | 'Reviewing' | 'Error';
  activeTicketIds: string[];
  projectCodes: string[];
  lastActivityAt: string;
  lastError: string | null;
  evaluations: AgentEvaluationRecord[];
}

// Runtime Validation Schemas (Zod)
export const SemVerSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, 'Version must follow strict SemVer MAJOR.MINOR.PATCH (e.g., 2.4.0)');

export const ProjectCodeSchema = z
  .string()
  .regex(/^[A-Z]{2,6}$/, 'Project code must be 2 to 6 uppercase letters (e.g., PIN, NXS)');

export const CreateProjectInputSchema = z.object({
  code: ProjectCodeSchema,
  name: z.string().min(3, 'Project name must be at least 3 characters').max(80),
  description: z.string().min(10, 'Provide a meaningful project description').max(600),
  intakeStateEnabled: z.boolean().optional(),
});

export const CreateTicketInputSchema = z.object({
  projectCode: ProjectCodeSchema,
  title: z.string().min(5, 'Title must be at least 5 characters').max(160),
  assignmentType: z.enum(['Enhancement', 'Defect']),
  priority: z.enum([
    PriorityCode.P1_DEFECT,
    PriorityCode.P1_ENHANCEMENT,
    PriorityCode.P2_DEFECT,
    PriorityCode.P2_ENHANCEMENT,
    PriorityCode.P3_DEFECT,
    PriorityCode.P3_ENHANCEMENT,
  ]),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  acceptanceCriteria: z.array(z.string().min(3)).min(1, 'At least one acceptance criterion is required'),
  validationCriteria: z.array(z.string().min(3)).min(1, 'At least one validation criterion is required'),
  assigneeId: z.string().min(1),
  assigneeName: z.string().min(1),
  assigneeType: z.enum(['Human', 'Agent']),
  releaseId: z.string().nullable().optional(),
  initialDecisionQuestion: z.string().optional(),
  initialDecisionType: z.enum(['checkbox', 'single_option', 'select', 'text']).optional(),
  initialDecisionOptions: z.array(z.string()).optional(),
});

export const AnswerDecisionInputSchema = z.object({
  decisionId: z.string().min(1),
  answer: z.union([z.string(), z.boolean()]),
  expectedVersion: z.number().int().nonnegative(),
  actorName: z.string().min(1),
});

export const CreateReleaseInputSchema = z.object({
  projectCode: ProjectCodeSchema,
  version: SemVerSchema,
  name: z.string().min(3, 'Release name must be at least 3 characters').max(100),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  ticketIds: z.array(z.string()),
});

/**
 * Pure Domain State Machine: Ticket Lifecycle & Decision Gate Validation
 */
export interface TransitionValidationResult {
  allowed: boolean;
  reason?: string;
  isReopen?: boolean;
  isReviewRejection?: boolean;
}

export function validateTicketTransition(
  ticket: Pick<Ticket, 'status' | 'assigneeType' | 'acceptanceCriteria' | 'validationCriteria'>,
  targetStatus: TicketStatus,
  ticketDecisions: Pick<TicketDecision, 'required' | 'status' | 'answer'>[]
): TransitionValidationResult {
  if (ticket.status === targetStatus) {
    return { allowed: true };
  }

  const unansweredRequired = ticketDecisions.filter(
    (d) =>
      d.required &&
      (d.status !== 'Resolved' ||
        d.answer === null ||
        d.answer === undefined ||
        (typeof d.answer === 'string' && d.answer.trim() === ''))
  );

  // Rule: A ticket with required unanswered decisions must not begin implementation (In Progress, In Review, Done)
  if (
    (targetStatus === 'In Progress' || targetStatus === 'In Review' || targetStatus === 'Done') &&
    unansweredRequired.length > 0
  ) {
    return {
      allowed: false,
      reason: `Blocked by ${unansweredRequired.length} unanswered required human decision(s). Humans must resolve all required decisions before implementation can proceed.`,
    };
  }

  // Rule: Done indicates validation requirements have been satisfied
  if (targetStatus === 'Done') {
    const unverifiedValidation = ticket.validationCriteria.filter((c) => !c.completed);
    if (unverifiedValidation.length > 0) {
      return {
        allowed: false,
        reason: `Cannot mark Done: ${unverifiedValidation.length} validation criterion item(s) remain unverified.`,
      };
    }
  }

  const isReopen = ticket.status === 'Done' && targetStatus !== 'Done';
  const isReviewRejection = ticket.status === 'In Review' && targetStatus === 'In Progress';

  return {
    allowed: true,
    isReopen,
    isReviewRejection,
  };
}

/**
 * Pure Domain Metrics Calculation (UTC Server Clock & Intervals)
 */
export interface ProjectSummaryMetrics {
  serverClockUtc: string;
  completedLast7Days: number;
  createdLast7Days: number;
  completedAllTime: number;
  outstandingTotal: number;
  pendingDecisionsCount: number;
  dailyActivity30d: {
    dateUtc: string; // YYYY-MM-DD
    label: string; // MM-DD
    created: number;
    completed: number;
  }[];
  statusDistribution: {
    Created: number;
    Backlog: number;
    'In Progress': number;
    'In Review': number;
    Done: number;
  };
}

export function computeProjectSummaryMetrics(
  tickets: Ticket[],
  decisions: TicketDecision[],
  referenceNowUtcIso: string,
  intakeStateEnabled: boolean
): ProjectSummaryMetrics {
  const nowMs = new Date(referenceNowUtcIso).getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const cutoff7dMs = nowMs - sevenDaysMs;

  let completedLast7Days = 0;
  let createdLast7Days = 0;
  let completedAllTime = 0;
  let outstandingTotal = 0;

  const statusDistribution: ProjectSummaryMetrics['statusDistribution'] = {
    Created: 0,
    Backlog: 0,
    'In Progress': 0,
    'In Review': 0,
    Done: 0,
  };

  for (const t of tickets) {
    const createdMs = new Date(t.createdAt).getTime();
    if (createdMs >= cutoff7dMs && createdMs <= nowMs) {
      createdLast7Days++;
    }

    if (t.status === 'Done') {
      completedAllTime++;
      statusDistribution.Done++;
      if (t.completedAt) {
        const completedMs = new Date(t.completedAt).getTime();
        if (completedMs >= cutoff7dMs && completedMs <= nowMs) {
          completedLast7Days++;
        }
      }
    } else {
      outstandingTotal++;
      if (t.status === 'Created' && intakeStateEnabled) {
        statusDistribution.Created++;
      } else if (t.status === 'Created' && !intakeStateEnabled) {
        // Never double-count; coerce disabled intake into Backlog bucket
        statusDistribution.Backlog++;
      } else {
        statusDistribution[t.status]++;
      }
    }
  }

  // Build 30-day UTC daily series
  const dailyMap = new Map<string, { created: number; completed: number }>();
  const refDate = new Date(referenceNowUtcIso);
  const baseUtcMidnight = Date.UTC(
    refDate.getUTCFullYear(),
    refDate.getUTCMonth(),
    refDate.getUTCDate()
  );

  const dailyActivity30d: ProjectSummaryMetrics['dailyActivity30d'] = [];
  for (let i = 29; i >= 0; i--) {
    const dayMs = baseUtcMidnight - i * 86400000;
    const d = new Date(dayMs);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const key = `${yyyy}-${mm}-${dd}`;
    dailyMap.set(key, { created: 0, completed: 0 });
    dailyActivity30d.push({
      dateUtc: key,
      label: `${mm}-${dd}`,
      created: 0,
      completed: 0,
    });
  }

  for (const t of tickets) {
    const createdDay = t.createdAt.slice(0, 10);
    const bucketC = dailyMap.get(createdDay);
    if (bucketC) {
      bucketC.created++;
    }
    if (t.status === 'Done' && t.completedAt) {
      const completedDay = t.completedAt.slice(0, 10);
      const bucketDone = dailyMap.get(completedDay);
      if (bucketDone) {
        bucketDone.completed++;
      }
    }
  }

  for (const item of dailyActivity30d) {
    const b = dailyMap.get(item.dateUtc);
    if (b) {
      item.created = b.created;
      item.completed = b.completed;
    }
  }

  const pendingDecisionsCount = decisions.filter((d) => d.status === 'Pending').length;

  return {
    serverClockUtc: referenceNowUtcIso,
    completedLast7Days,
    createdLast7Days,
    completedAllTime,
    outstandingTotal,
    pendingDecisionsCount,
    dailyActivity30d,
    statusDistribution,
  };
}
