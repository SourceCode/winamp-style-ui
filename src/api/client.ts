import {
  Project,
  Ticket,
  TicketDecision,
  Release,
  AgentPersona,
  AuditEvent,
  ProjectSummaryMetrics,
  PriorityCode,
  TicketStatus,
  CriterionItem,
  DecisionInputType,
} from '../domain/contracts';

export interface WorkspaceStatePayload {
  serverClockUtc: string;
  session: {
    token: string;
    user: {
      id: string;
      name: string;
      role: string;
      email: string;
    };
  };
  projects: Project[];
  tickets: Ticket[];
  decisions: TicketDecision[];
  releases: Release[];
  agents: AgentPersona[];
  auditLog: AuditEvent[];
  projectMetrics: Record<string, ProjectSummaryMetrics>;
  contracts: {
    protobuf: string;
    postgresql: string;
    rustCli: string;
    fastMcp: string;
  };
}

let cachedJwtToken = '';

export function setSessionToken(token: string) {
  cachedJwtToken = token;
}

async function connectRpcRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Connect-Protocol-Version': '1',
    ...(options.headers as Record<string, string>),
  };
  if (cachedJwtToken) {
    headers['Authorization'] = `Bearer ${cachedJwtToken}`;
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `ConnectRPC Error (${res.status})`);
  }
  return data as T;
}

export const pinnacleClient = {
  async getWorkspaceState(): Promise<WorkspaceStatePayload> {
    const data = await connectRpcRequest<WorkspaceStatePayload>(
      '/rpc/pinnacle.v1.BacklogService/GetWorkspaceState',
      { method: 'POST', body: JSON.stringify({}) }
    );
    if (data.session?.token) {
      setSessionToken(data.session.token);
    }
    return data;
  },

  async createProject(input: {
    code: string;
    name: string;
    description: string;
    intakeStateEnabled?: boolean;
  }) {
    return connectRpcRequest<{ project: Project }>(
      '/rpc/pinnacle.v1.BacklogService/CreateProject',
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    );
  },

  async updateProjectSettings(
    code: string,
    input: {
      name?: string;
      description?: string;
      active?: boolean;
      intakeStateEnabled?: boolean;
    }
  ) {
    return connectRpcRequest<{ project: Project }>(`/api/projects/${code}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  async createTicket(input: {
    projectCode: string;
    title: string;
    assignmentType: 'Enhancement' | 'Defect';
    priority: PriorityCode;
    description: string;
    acceptanceCriteria: string[];
    validationCriteria: string[];
    assigneeId: string;
    assigneeName: string;
    assigneeType: 'Human' | 'Agent';
    releaseId?: string | null;
    initialDecisionQuestion?: string;
    initialDecisionType?: DecisionInputType;
    initialDecisionOptions?: string[];
  }) {
    return connectRpcRequest<{ ticket: Ticket }>(
      '/rpc/pinnacle.v1.BacklogService/CreateTicket',
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    );
  },

  async transitionTicketStatus(input: {
    ticketId: string;
    targetStatus: TicketStatus;
    actorName?: string;
    actorType?: 'Human' | 'Agent';
  }) {
    return connectRpcRequest<{ ticket: Ticket }>(
      '/rpc/pinnacle.v1.BacklogService/TransitionTicketStatus',
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    );
  },

  async updateTicket(
    ticketId: string,
    patch: {
      title?: string;
      description?: string;
      priority?: PriorityCode;
      assigneeId?: string;
      assigneeName?: string;
      assigneeType?: 'Human' | 'Agent';
      releaseId?: string | null;
      acceptanceCriteria?: CriterionItem[];
      validationCriteria?: CriterionItem[];
      newComment?: { authorName: string; authorRole: 'Human' | 'Agent'; body: string };
      newDecision?: {
        question: string;
        context?: string;
        inputType: DecisionInputType;
        options?: string[];
        assigneeName?: string;
      };
    }
  ) {
    return connectRpcRequest<{ ticket: Ticket }>(`/api/tickets/${ticketId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  async answerDecision(input: {
    decisionId: string;
    answer: string | boolean;
    expectedVersion: number;
    actorName: string;
  }) {
    return connectRpcRequest<{ decision: TicketDecision; ticket?: Ticket }>(
      '/rpc/pinnacle.v1.BacklogService/AnswerDecision',
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    );
  },

  async createRelease(input: {
    projectCode: string;
    version: string;
    name: string;
    description: string;
    ticketIds: string[];
  }) {
    return connectRpcRequest<{ release: Release }>(
      '/rpc/pinnacle.v1.BacklogService/CreateRelease',
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    );
  },

  async updateRelease(
    releaseId: string,
    patch: {
      state?: Release['state'];
      ticketIds?: string[];
    }
  ) {
    return connectRpcRequest<{ release: Release }>(`/api/releases/${releaseId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  async evaluateTicketWithAgent(agentId: string, ticketId: string) {
    return connectRpcRequest<{ ticket: Ticket; agent: AgentPersona }>(
      '/rpc/pinnacle.v1.BacklogService/EvaluateTicketWithAgent',
      {
        method: 'POST',
        body: JSON.stringify({ agentId, ticketId }),
      }
    );
  },

  async updateAgentConfig(
    agentId: string,
    patch: {
      enabled?: boolean;
      assignedModel?: string;
      ollamaEndpoint?: string;
      personaPrompt?: string;
    }
  ) {
    return connectRpcRequest<{ agent: AgentPersona }>(`/api/agents/${agentId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  async executeCliCommand(command: string, output: 'table' | 'json' = 'table') {
    return connectRpcRequest<{ exitCode: number; output: string }>('/api/cli/execute', {
      method: 'POST',
      body: JSON.stringify({ command, output }),
    });
  },
};
