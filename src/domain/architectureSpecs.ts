export const PROTOBUF_CONTRACT = `syntax = "proto3";

package pinnacle.v1;

option go_package = "github.com/pinnacle-dev/pinnacle/gen/proto/pinnacle/v1;pinnaclev1";

// Authoritative ConnectRPC Contract for Pinnacle Mission Control
service BacklogService {
  rpc GetWorkspaceState(GetWorkspaceStateRequest) returns (GetWorkspaceStateResponse);
  rpc CreateProject(CreateProjectRequest) returns (CreateProjectResponse);
  rpc UpdateProjectSettings(UpdateProjectSettingsRequest) returns (UpdateProjectSettingsResponse);
  rpc CreateTicket(CreateTicketRequest) returns (CreateTicketResponse);
  rpc TransitionTicketStatus(TransitionTicketStatusRequest) returns (TransitionTicketStatusResponse);
  rpc AnswerDecision(AnswerDecisionRequest) returns (AnswerDecisionResponse);
  rpc CreateRelease(CreateReleaseRequest) returns (CreateReleaseResponse);
  rpc EvaluateTicketWithAgent(EvaluateTicketWithAgentRequest) returns (EvaluateTicketWithAgentResponse);
  rpc ExecuteCliCommand(ExecuteCliCommandRequest) returns (ExecuteCliCommandResponse);
}

enum PriorityCode {
  PRIORITY_CODE_UNSPECIFIED = 0;
  PRIORITY_CODE_P1_DEFECT = 1;       // Order 1: Critical
  PRIORITY_CODE_P1_ENHANCEMENT = 2;  // Order 2: High
  PRIORITY_CODE_P2_DEFECT = 3;       // Order 3: High
  PRIORITY_CODE_P2_ENHANCEMENT = 4;  // Order 4: Normal
  PRIORITY_CODE_P3_DEFECT = 5;       // Order 5: Low
  PRIORITY_CODE_P3_ENHANCEMENT = 6;  // Order 6: Lowest
}`;

export const POSTGRESQL_MIGRATION_SQL = `-- migrations/0001_pinnacle_authoritative_schema.sql
CREATE TYPE priority_code AS ENUM (
  'P1_DEFECT', 'P1_ENHANCEMENT',
  'P2_DEFECT', 'P2_ENHANCEMENT',
  'P3_DEFECT', 'P3_ENHANCEMENT'
);

CREATE TYPE ticket_status AS ENUM (
  'Created', 'Backlog', 'In Progress', 'In Review', 'Done'
);

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(6) UNIQUE NOT NULL CHECK (code ~ '^[A-Z]{2,6}$'),
  name VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  intake_state_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  next_ticket_number INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  creator_id VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tickets (
  id VARCHAR(16) PRIMARY KEY, -- e.g. PIN-1
  project_id UUID NOT NULL REFERENCES projects(id),
  project_code VARCHAR(6) NOT NULL,
  sequence_number INTEGER NOT NULL,
  title VARCHAR(160) NOT NULL,
  assignment_type VARCHAR(16) NOT NULL CHECK (assignment_type IN ('Enhancement', 'Defect')),
  priority priority_code NOT NULL,
  status ticket_status NOT NULL DEFAULT 'Backlog',
  description TEXT NOT NULL,
  assignee_id VARCHAR(64) NOT NULL,
  assignee_type VARCHAR(16) NOT NULL CHECK (assignee_type IN ('Human', 'Agent')),
  release_id VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
  completed_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE(project_code, sequence_number)
);

CREATE TABLE ticket_decisions (
  id VARCHAR(32) PRIMARY KEY,
  ticket_id VARCHAR(16) NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  project_code VARCHAR(6) NOT NULL,
  question TEXT NOT NULL,
  input_type VARCHAR(24) NOT NULL CHECK (input_type IN ('checkbox', 'single_option', 'select', 'text')),
  required BOOLEAN NOT NULL DEFAULT TRUE,
  answer JSONB,
  status VARCHAR(16) NOT NULL DEFAULT 'Pending',
  version INTEGER NOT NULL DEFAULT 1,
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(64)
);

-- Immutable Audit Ledger Trigger: Prevent UPDATE or DELETE on audit_events
CREATE TABLE audit_events (
  id VARCHAR(64) PRIMARY KEY,
  entity_type VARCHAR(24) NOT NULL,
  entity_id VARCHAR(32) NOT NULL,
  project_code VARCHAR(6) NOT NULL,
  actor_id VARCHAR(64) NOT NULL,
  actor_type VARCHAR(16) NOT NULL,
  action VARCHAR(64) NOT NULL,
  summary TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);`;

export const RUST_CLI_AND_BACKEND_SPEC = `// crates/pinnacle-cli/src/main.rs
use clap::{Parser, Subcommand, ValueEnum};
use serde::Serialize;

#[derive(Parser)]
#[command(name = "pinnacle", version = "2.4.0", about = "Authoritative CLI for Pinnacle Agentic Backlog")]
struct Cli {
    #[arg(long, env = "PINNACLE_API_URL", default_value = "http://localhost:3000")]
    endpoint: String,
    #[arg(long, env = "PINNACLE_TOKEN")]
    token: Option<String>,
    #[arg(long, default_value = "table")]
    output: OutputFormat,
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// List projects or tickets with priority sorting
    Tickets {
        #[arg(short, long)]
        project: Option<String>,
        #[arg(short, long)]
        status: Option<String>,
    },
    /// Resolve a pending human decision with optimistic concurrency verification
    Decide {
        decision_id: String,
        #[arg(short, long)]
        answer: String,
        #[arg(short, long)]
        version: u32,
    },
    /// Trigger an Ollama persona evaluation via ConnectRPC backend
    Audit {
        ticket_id: String,
        #[arg(short, long, default_value = "agt-archon")]
        agent: String,
    },
}`;

export const FASTMCP_SERVER_SPEC = `# mcp/pinnacle_mcp_server.py
from fastmcp import FastMCP
import httpx
import os

mcp = FastMCP(
    "Pinnacle-Mission-Control",
    dependencies=["httpx", "pydantic"]
)

PINNACLE_RPC_BASE = os.environ.get("PINNACLE_RPC_BASE", "http://localhost:3000/rpc/pinnacle.v1.BacklogService")
PINNACLE_AGENT_JWT = os.environ.get("PINNACLE_AGENT_JWT", "")

@mcp.tool()
async def pinnacle_get_ticket(ticket_id: str) -> dict:
    """Fetch authoritative ticket specification, acceptance criteria, and decision gate readiness."""
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{PINNACLE_RPC_BASE}/GetTicket",
            headers={"Authorization": f"Bearer {PINNACLE_AGENT_JWT}", "Connect-Protocol-Version": "1"},
            json={"ticketId": ticket_id}
        )
        res.raise_for_status()
        return res.json()

@mcp.tool()
async def pinnacle_claim_ticket(ticket_id: str, agent_id: str) -> dict:
    """Claim a ticket and transition to In Progress. Fails if any required human decision is Pending."""
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{PINNACLE_RPC_BASE}/TransitionTicketStatus",
            headers={"Authorization": f"Bearer {PINNACLE_AGENT_JWT}", "Connect-Protocol-Version": "1"},
            json={"ticketId": ticket_id, "targetStatus": "In Progress", "actorName": agent_id, "actorType": "Agent"}
        )
        return res.json()`;
