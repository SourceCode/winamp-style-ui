import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Release,
  Ticket,
  TicketDecision,
  AgentPersona,
  AuditEvent,
  comparePriority,
} from '../domain/contracts';
import { PriorityBadge, StatusLabel, AssigneeLabel } from './PriorityBadge';
import { DecisionRowControl } from './DecisionRowControl';
import {
  PackageCheck,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Bot,
  Play,
  Sliders,
  CheckCircle2,
  History,
  Terminal,
  ArrowRight,
  Lock,
} from 'lucide-react';

export const ReleaseDirectoryView: React.FC<{
  title: string;
  releases: Release[];
  tickets: Ticket[];
  decisions: TicketDecision[];
  onOpenCreateRelease: () => void;
}> = ({ title, releases, tickets, decisions, onOpenCreateRelease }) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="sg-section-panel p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight m-0">{title}</h2>
          <p className="text-xs opacity-80 m-0 mt-0.5">
            Strict SemVer (MAJOR.MINOR.PATCH) release trains with automated decision &amp; validation blocker gates.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenCreateRelease}
          className="sg-btn sg-btn-primary"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Create Release</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {releases.map((rel) => {
          const relTickets = tickets.filter((t) => t.releaseId === rel.id);
          const doneTickets = relTickets.filter((t) => t.status === 'Done');
          const pct =
            relTickets.length > 0
              ? Math.round((doneTickets.length / relTickets.length) * 100)
              : 100;
          const blockingDecisions = decisions.filter(
            (d) =>
              d.status === 'Pending' &&
              relTickets.some((t) => t.id === d.ticketId)
          );
          const unverifiedTickets = relTickets.filter(
            (t) =>
              t.status !== 'Done' ||
              t.validationCriteria.some((vc) => !vc.completed)
          );

          return (
            <div key={rel.id} className="sg-section-panel overflow-hidden flex flex-col justify-between">
              {/* Polished-Metal Header + Blue-Glass SemVer Display */}
              <div className="sg-metal-bar p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="sg-lcd-display px-3 py-1.5 shrink-0 text-center">
                    <div className="text-[9px] font-mono opacity-80">{rel.projectCode} SEMVER</div>
                    <div className="sg-lcd-readout text-base font-bold tracking-wider">
                      v{rel.version}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <Link
                      to={`/projects/${rel.projectCode}/releases/${rel.id}`}
                      className="text-xs font-bold hover:underline block truncate text-[var(--text-normal)]"
                    >
                      {rel.name}
                    </Link>
                    <div className="font-mono text-[11px] opacity-80">
                      State: {rel.state} · {relTickets.length} Associated Ticket(s)
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate(`/projects/${rel.projectCode}/releases/${rel.id}`)}
                  className="sg-btn text-[11px] py-1 px-2.5"
                >
                  <span>Inspect</span>
                  <ArrowRight className="w-3 h-3" aria-hidden="true" />
                </button>
              </div>

              <div className="p-3.5 space-y-3">
                <p className="text-xs opacity-85 m-0">{rel.description}</p>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--background-modifier-border)] font-mono text-xs">
                  <div>
                    <div className="text-[10.5px] opacity-70">Completion</div>
                    <div className="font-bold tabular-nums">
                      {doneTickets.length}/{relTickets.length} ({pct}%)
                    </div>
                  </div>
                  <div>
                    <div className="text-[10.5px] opacity-70">Decision Blockers</div>
                    <div
                      className={`font-bold tabular-nums ${
                        blockingDecisions.length > 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {blockingDecisions.length} Pending
                    </div>
                  </div>
                  <div>
                    <div className="text-[10.5px] opacity-70">Validation Blockers</div>
                    <div
                      className={`font-bold tabular-nums ${
                        unverifiedTickets.length > 0 ? 'text-amber-800 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {unverifiedTickets.length} Incomplete
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const ReleaseDetailView: React.FC<{
  release: Release;
  projectTickets: Ticket[];
  decisions: TicketDecision[];
  onUpdateRelease: (
    releaseId: string,
    patch: { state?: Release['state']; ticketIds?: string[] }
  ) => Promise<void>;
}> = ({ release, projectTickets, decisions, onUpdateRelease }) => {
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [managingTickets, setManagingTickets] = useState(false);

  const associatedTickets = projectTickets
    .filter((t) => t.releaseId === release.id)
    .sort((a, b) => comparePriority(a.priority, b.priority));
  const doneTickets = associatedTickets.filter((t) => t.status === 'Done');
  const completionPct =
    associatedTickets.length > 0
      ? Math.round((doneTickets.length / associatedTickets.length) * 100)
      : 100;

  const blockingDecisions = decisions.filter(
    (d) =>
      d.status === 'Pending' &&
      associatedTickets.some((t) => t.id === d.ticketId)
  );
  const validationBlockers = associatedTickets.filter(
    (t) =>
      t.status !== 'Done' ||
      t.validationCriteria.some((vc) => !vc.completed)
  );

  const handleStateChange = async (newState: Release['state']) => {
    setReleaseError(null);
    try {
      await onUpdateRelease(release.id, { state: newState });
    } catch (err) {
      setReleaseError(err instanceof Error ? err.message : 'Failed to transition release state');
    }
  };

  const handleToggleTicketAssociation = async (ticketId: string) => {
    const currentIds = associatedTickets.map((t) => t.id);
    const nextIds = currentIds.includes(ticketId)
      ? currentIds.filter((id) => id !== ticketId)
      : [...currentIds, ticketId];
    await onUpdateRelease(release.id, { ticketIds: nextIds });
  };

  return (
    <div className="space-y-4">
      {/* Polished-Metal Header with Prominent Blue-Glass SemVer Readout */}
      <div className="sg-section-panel overflow-hidden">
        <div className="sg-metal-bar px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="sg-lcd-display px-4 py-2.5 text-center">
              <div className="text-[10px] font-mono tracking-widest opacity-80">
                {release.projectCode} · SEMVER RELEASE
              </div>
              <div className="sg-lcd-readout text-2xl font-bold tracking-wider">
                v{release.version}
              </div>
            </div>
            <div>
              <h1 className="text-base font-bold m-0">{release.name}</h1>
              <p className="text-xs opacity-85 m-0 mt-0.5 max-w-2xl">{release.description}</p>
              <div className="font-mono text-[11px] opacity-75 mt-1">
                State: <span className="font-bold">{release.state}</span> · Created{' '}
                {release.createdAt.slice(0, 10)} · Updated {release.updatedAt.slice(0, 16).replace('T', ' ')}Z
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(['Planned', 'In Validation', 'Ready for Cut', 'Released'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => handleStateChange(st)}
                className={`sg-btn text-xs ${release.state === st ? 'sg-btn-primary' : ''}`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {releaseError && (
          <div
            className="p-3 bg-red-50 dark:bg-red-950/50 border-t border-red-500 text-red-900 dark:text-red-200 text-xs font-semibold flex items-center justify-between"
            role="alert"
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{releaseError}</span>
            </div>
            <button
              type="button"
              onClick={() => setReleaseError(null)}
              className="sg-btn text-[11px] py-0.5 px-2"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="sg-lcd-display p-3">
            <div className="text-[10.5px] font-mono opacity-80">RELEASE COMPLETION</div>
            <div className="sg-lcd-readout text-2xl font-bold mt-1">
              {completionPct}% ({doneTickets.length}/{associatedTickets.length} Done)
            </div>
          </div>
          <div className="sg-lcd-display p-3">
            <div className="text-[10.5px] font-mono opacity-80">OUTSTANDING HUMAN DECISIONS</div>
            <div className="sg-lcd-readout text-2xl font-bold mt-1">
              {blockingDecisions.length} Blocking
            </div>
          </div>
          <div className="sg-lcd-display p-3">
            <div className="text-[10.5px] font-mono opacity-80">VALIDATION BLOCKERS</div>
            <div className="sg-lcd-readout text-2xl font-bold mt-1">
              {validationBlockers.length} Ticket(s)
            </div>
          </div>
        </div>
      </div>

      {/* Blockers Summary Panel */}
      {(blockingDecisions.length > 0 || validationBlockers.length > 0) && (
        <div className="sg-section-panel overflow-hidden">
          <div className="sg-metal-bar px-4 py-2 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-700 dark:text-amber-300" aria-hidden="true" />
            <span className="text-xs font-bold">
              Active Release Cut Blockers ({blockingDecisions.length} Decisions, {validationBlockers.length} Incomplete Tickets)
            </span>
          </div>
          <div className="p-3.5 space-y-2 text-xs">
            {blockingDecisions.map((dec) => (
              <div
                key={dec.id}
                className="p-2 rounded border border-[var(--background-modifier-border)] bg-[var(--background-primary)] flex items-center justify-between gap-2"
              >
                <div>
                  <span className="font-mono font-bold text-red-700 dark:text-red-300 mr-2">
                    [DECISION BLOCKER · {dec.id}]
                  </span>
                  <span>
                    Ticket{' '}
                    <Link
                      to={`/projects/${dec.projectCode}/tickets/${dec.ticketId}`}
                      className="font-mono font-bold underline"
                    >
                      {dec.ticketId}
                    </Link>
                    : {dec.question}
                  </span>
                </div>
                <span className="font-mono text-[11px]">Assignee: {dec.assigneeName}</span>
              </div>
            ))}
            {validationBlockers.map((t) => (
              <div
                key={t.id}
                className="p-2 rounded border border-[var(--background-modifier-border)] bg-[var(--background-primary)] flex items-center justify-between gap-2"
              >
                <div>
                  <span className="font-mono font-bold text-amber-800 dark:text-amber-300 mr-2">
                    [VALIDATION BLOCKER · {t.id}]
                  </span>
                  <Link
                    to={`/projects/${t.projectCode}/tickets/${t.id}`}
                    className="font-semibold hover:underline"
                  >
                    {t.title}
                  </Link>
                </div>
                <span className="font-mono text-[11px]">
                  Status: {t.status} · VC{' '}
                  {t.validationCriteria.filter((c) => c.completed).length}/
                  {t.validationCriteria.length}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Associated Tickets & Association Editor */}
      <div className="sg-section-panel overflow-hidden">
        <div className="sg-metal-bar px-4 py-2 flex items-center justify-between">
          <span className="text-xs font-bold">
            Tickets Assigned to {release.projectCode} v{release.version} ({associatedTickets.length})
          </span>
          <button
            type="button"
            onClick={() => setManagingTickets((prev) => !prev)}
            className="sg-btn text-[11px] py-1 px-2.5"
          >
            {managingTickets ? 'Done Managing Associations' : 'Manage Ticket Associations'}
          </button>
        </div>

        {managingTickets && (
          <div className="p-3.5 border-b border-[var(--background-modifier-border)] bg-[var(--background-primary-alt)] space-y-2">
            <div className="text-xs font-bold">
              Select {release.projectCode} tickets to include in v{release.version}:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto">
              {projectTickets.map((t) => {
                const checked = t.releaseId === release.id;
                return (
                  <label
                    key={t.id}
                    className="flex items-center gap-2 text-xs p-1.5 rounded bg-[var(--background-primary)] border border-[var(--background-modifier-border)] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleTicketAssociation(t.id)}
                    />
                    <span className="font-mono font-bold">{t.id}</span>
                    <span className="truncate flex-1">{t.title}</span>
                    <span className="font-mono text-[10.5px] opacity-75">{t.status}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="sg-table" aria-label="Release Associated Tickets">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Priority</th>
                <th>Title</th>
                <th>Status</th>
                <th>Assignee</th>
                <th className="text-right">Validation Criteria</th>
              </tr>
            </thead>
            <tbody>
              {associatedTickets.map((t) => (
                <tr key={t.id}>
                  <td className="font-mono font-bold text-xs">
                    <Link
                      to={`/projects/${t.projectCode}/tickets/${t.id}`}
                      className="text-[var(--text-accent)] hover:underline"
                    >
                      {t.id}
                    </Link>
                  </td>
                  <td>
                    <PriorityBadge priority={t.priority} />
                  </td>
                  <td className="text-xs font-semibold">{t.title}</td>
                  <td>
                    <StatusLabel status={t.status} />
                  </td>
                  <td>
                    <AssigneeLabel name={t.assigneeName} type={t.assigneeType} />
                  </td>
                  <td className="text-right font-mono text-xs tabular-nums">
                    {t.validationCriteria.filter((c) => c.completed).length}/
                    {t.validationCriteria.length} Verified
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const AgentDirectoryView: React.FC<{
  agents: AgentPersona[];
  onToggleAgentEnabled: (agentId: string, enabled: boolean) => Promise<void>;
}> = ({ agents, onToggleAgentEnabled }) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="sg-section-panel p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight m-0">
            Autonomous AI Agent Registry (Ollama &amp; FastMCP Personas)
          </h2>
          <p className="text-xs opacity-80 m-0 mt-0.5">
            All Ollama persona evaluations originate strictly from the backend server with enforced capability scopes and human decision locks.
          </p>
        </div>
      </div>

      <div className="sg-section-panel overflow-hidden">
        <div className="sg-metal-bar px-4 py-2 flex items-center justify-between">
          <span className="text-xs font-bold">Configured Agent Personas ({agents.length})</span>
          <span className="font-mono text-[11px] opacity-75">
            Click any agent to configure persona prompt, Ollama model, or inspect findings
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="sg-table" aria-label="Autonomous Agents Directory">
            <thead>
              <tr>
                <th>Agent Name &amp; Role</th>
                <th>Assigned Ollama Model</th>
                <th>Server-Side Endpoint</th>
                <th>Execution Status</th>
                <th>Capabilities &amp; Scopes</th>
                <th>Last Activity (UTC)</th>
                <th className="text-right">Controls</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((ag) => (
                <tr key={ag.id}>
                  <td>
                    <Link
                      to={`/agents/${ag.id}`}
                      className="font-bold text-xs text-[var(--text-accent)] hover:underline block"
                    >
                      {ag.name}
                    </Link>
                    <span className="text-[11px] opacity-80">{ag.roleTitle}</span>
                  </td>
                  <td className="font-mono text-xs font-semibold">{ag.assignedModel}</td>
                  <td className="font-mono text-[11px] opacity-80">{ag.ollamaEndpoint}</td>
                  <td className="whitespace-nowrap font-mono text-xs">
                    <span>
                      {ag.enabled ? `● ${ag.executionStatus}` : '○ Disabled'}
                    </span>
                  </td>
                  <td className="max-w-xs text-[11px]">
                    <div className="truncate" title={ag.capabilities.join(' · ')}>
                      {ag.capabilities.slice(0, 3).join(' · ')}
                    </div>
                    <div className="font-mono opacity-70 truncate">
                      Scopes: {ag.permissions.join(', ')}
                    </div>
                  </td>
                  <td className="font-mono text-[11px] whitespace-nowrap tabular-nums">
                    {ag.lastActivityAt.slice(0, 16).replace('T', ' ')}Z
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onToggleAgentEnabled(ag.id, !ag.enabled)}
                        className="sg-btn text-[11px] py-1 px-2"
                      >
                        {ag.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/agents/${ag.id}`)}
                        className="sg-btn sg-btn-primary text-[11px] py-1 px-2.5"
                      >
                        <span>Configure</span>
                        <ArrowRight className="w-3 h-3" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const AgentDetailView: React.FC<{
  agent: AgentPersona;
  tickets: Ticket[];
  onUpdateAgent: (
    agentId: string,
    patch: {
      enabled?: boolean;
      assignedModel?: string;
      ollamaEndpoint?: string;
      personaPrompt?: string;
    }
  ) => Promise<void>;
  onRunEvaluation: (agentId: string, ticketId: string) => Promise<void>;
}> = ({ agent, tickets, onUpdateAgent, onRunEvaluation }) => {
  const [modelInput, setModelInput] = useState(agent.assignedModel);
  const [endpointInput, setEndpointInput] = useState(agent.ollamaEndpoint);
  const [promptInput, setPromptInput] = useState(agent.personaPrompt);
  const [selectedTicketId, setSelectedTicketId] = useState(
    tickets[0]?.id || 'PIN-1'
  );
  const [runningEval, setRunningEval] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);

  const assignedTickets = tickets.filter((t) => t.assigneeId === agent.id);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateAgent(agent.id, {
      assignedModel: modelInput,
      ollamaEndpoint: endpointInput,
      personaPrompt: promptInput,
    });
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
  };

  const handleDispatchEval = async () => {
    if (!selectedTicketId) return;
    setRunningEval(true);
    try {
      await onRunEvaluation(agent.id, selectedTicketId);
    } finally {
      setRunningEval(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="sg-section-panel p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="sg-lcd-display px-3.5 py-2 text-center">
            <div className="text-[10px] font-mono opacity-80">AGENT STATUS</div>
            <div className="sg-lcd-readout text-base font-bold">
              {agent.enabled ? agent.executionStatus.toUpperCase() : 'DISABLED'}
            </div>
          </div>
          <div>
            <h1 className="text-base font-bold m-0">{agent.name}</h1>
            <p className="text-xs opacity-80 m-0">{agent.roleTitle}</p>
            <div className="font-mono text-[11px] opacity-75 mt-1">
              Model: {agent.assignedModel} · Endpoint: {agent.ollamaEndpoint} (Server-Proxied)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onUpdateAgent(agent.id, { enabled: !agent.enabled })}
            className="sg-btn"
          >
            {agent.enabled ? 'Disable Agent Persona' : 'Enable Agent Persona'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left: Persona & Model Config + Evaluation History */}
        <div className="lg:col-span-8 space-y-4">
          <form onSubmit={handleSaveConfig} className="sg-section-panel overflow-hidden">
            <div className="sg-metal-bar px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="text-xs font-bold">
                  Persona Definition &amp; Server-Side Ollama Model Configuration
                </span>
              </div>
              {savedBanner && (
                <span className="font-mono text-[11px] text-emerald-800 dark:text-emerald-300 font-bold">
                  ✓ Configuration Saved
                </span>
              )}
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1" htmlFor="agent-model-input">
                    Assigned Ollama Model Tag
                  </label>
                  <input
                    id="agent-model-input"
                    type="text"
                    value={modelInput}
                    onChange={(e) => setModelInput(e.target.value)}
                    className="sg-well-input w-full font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1" htmlFor="agent-endpoint-input">
                    Backend Ollama HTTP Endpoint Reference
                  </label>
                  <input
                    id="agent-endpoint-input"
                    type="text"
                    value={endpointInput}
                    onChange={(e) => setEndpointInput(e.target.value)}
                    className="sg-well-input w-full font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1" htmlFor="agent-persona-prompt">
                  Authoritative System Persona Prompt
                </label>
                <textarea
                  id="agent-persona-prompt"
                  rows={3}
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  className="sg-well-input w-full"
                  required
                />
              </div>

              <div className="flex justify-end">
                <button type="submit" className="sg-btn sg-btn-primary">
                  Save Persona Configuration
                </button>
              </div>
            </div>
          </form>

          {/* Evaluation History & Structured Findings */}
          <div className="sg-section-panel overflow-hidden">
            <div className="sg-metal-bar px-4 py-2 flex items-center justify-between">
              <span className="text-xs font-bold">
                Structured Evaluation History ({agent.evaluations.length})
              </span>
              <div className="flex items-center gap-2">
                <select
                  aria-label="Select ticket to evaluate"
                  value={selectedTicketId}
                  onChange={(e) => setSelectedTicketId(e.target.value)}
                  className="sg-select text-xs py-1"
                >
                  {tickets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.id} — {t.title.slice(0, 36)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={runningEval || !agent.enabled}
                  onClick={handleDispatchEval}
                  className="sg-btn sg-btn-primary text-xs py-1 px-2.5"
                >
                  <Play className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{runningEval ? 'Evaluating...' : 'Evaluate Ticket Now'}</span>
                </button>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {agent.evaluations.length === 0 ? (
                <p className="text-xs opacity-75 m-0">
                  No evaluation records yet. Select a ticket above and click &quot;Evaluate Ticket Now&quot;.
                </p>
              ) : (
                agent.evaluations.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 rounded border border-[var(--background-modifier-border)] bg-[var(--background-primary)] space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/projects/${ev.projectCode}/tickets/${ev.ticketId}`}
                          className="font-mono font-bold text-[var(--text-accent)] hover:underline"
                        >
                          {ev.ticketId}
                        </Link>
                        <span aria-hidden="true">·</span>
                        <span className="font-bold">{ev.readinessVerdict}</span>
                      </div>
                      <span className="font-mono text-[11px] opacity-75 tabular-nums">
                        {ev.modelUsed} · {ev.durationMs}ms · {ev.timestamp.slice(0, 19).replace('T', ' ')}Z
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                      {ev.findings.map((f, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded bg-[var(--background-primary-alt)] text-[11.5px] flex items-start justify-between gap-2"
                        >
                          <div>
                            <span className="font-mono font-bold mr-1">[{f.category}]</span>
                            <span>{f.finding}</span>
                          </div>
                          <span className="font-mono font-bold text-[10px]">{f.severity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Capabilities, Execution Policy & Assigned Tickets */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="sg-section-panel overflow-hidden">
            <div className="sg-metal-bar px-3.5 py-2">
              <span className="text-xs font-bold">Capabilities &amp; Execution Policy</span>
            </div>
            <div className="p-3.5 space-y-3 text-xs">
              <div>
                <div className="font-bold mb-1">Authorized Capabilities:</div>
                <ul className="space-y-1 m-0 pl-4">
                  {agent.capabilities.map((cap) => (
                    <li key={cap}>{cap}</li>
                  ))}
                </ul>
              </div>

              <div className="pt-2 border-t border-[var(--background-modifier-border)]">
                <div className="font-bold mb-1">JWT / FastMCP Permission Scopes:</div>
                <div className="font-mono text-[11px] opacity-85">
                  {agent.permissions.join(' · ')}
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--background-modifier-border)] space-y-1 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span>Require 0 Pending Decisions:</span>
                  <span className="font-bold">
                    {agent.executionPolicy.requireZeroPendingDecisions ? 'ENFORCED' : 'OPTIONAL'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Max Concurrent Tickets:</span>
                  <span className="font-bold">{agent.executionPolicy.maxConcurrentTickets}</span>
                </div>
                <div className="flex justify-between">
                  <span>Operational Error State:</span>
                  <span className="font-bold">{agent.lastError || '0 Errors (Nominal)'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="sg-section-panel overflow-hidden">
            <div className="sg-metal-bar px-3.5 py-2">
              <span className="text-xs font-bold">
                Assigned Tickets ({assignedTickets.length})
              </span>
            </div>
            <div className="p-3 space-y-2">
              {assignedTickets.length === 0 ? (
                <p className="text-xs opacity-75 m-0">No tickets currently assigned.</p>
              ) : (
                assignedTickets.map((t) => (
                  <Link
                    key={t.id}
                    to={`/projects/${t.projectCode}/tickets/${t.id}`}
                    className="block p-2 rounded border border-[var(--background-modifier-border)] bg-[var(--background-primary)] hover:bg-[var(--background-modifier-hover)] text-xs"
                  >
                    <div className="flex items-center justify-between font-mono font-bold">
                      <span className="text-[var(--text-accent)]">{t.id}</span>
                      <span>{t.status}</span>
                    </div>
                    <div className="truncate mt-0.5 font-medium">{t.title}</div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export const GlobalDecisionsView: React.FC<{
  title: string;
  decisions: TicketDecision[];
  tickets: Ticket[];
  serverClockUtc: string;
  onSaveDecision: (decisionId: string, answer: string | boolean, expectedVersion: number) => Promise<void>;
}> = ({ title, decisions, tickets, serverClockUtc, onSaveDecision }) => {
  const [filter, setFilter] = useState<'Pending' | 'Resolved' | 'All'>('Pending');
  const filtered = decisions.filter((d) => (filter === 'All' ? true : d.status === filter));

  return (
    <div className="space-y-4">
      <div className="sg-section-panel p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold m-0">{title}</h2>
          <p className="text-xs opacity-80 m-0 mt-0.5">
            Centralized human decision desk. Resolving a decision immediately unblocks assigned autonomous agents and logs to ticket history.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {(['Pending', 'Resolved', 'All'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`sg-btn text-xs ${filter === tab ? 'sg-btn-primary' : ''}`}
            >
              {tab} (
              {tab === 'All'
                ? decisions.length
                : decisions.filter((d) => d.status === tab).length}
              )
            </button>
          ))}
        </div>
      </div>

      <div className="sg-section-panel overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            <div className="text-sm font-bold">No {filter} Decisions</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="sg-table" aria-label="Global Human Decisions Queue">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Decision Question &amp; Context</th>
                  <th>Decision Input Control</th>
                  <th>Assignee</th>
                  <th>Priority</th>
                  <th>Age</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((dec) => (
                  <DecisionRowControl
                    key={`${dec.id}-v${dec.version}`}
                    decision={dec}
                    ticket={tickets.find((t) => t.id === dec.ticketId)}
                    serverClockUtc={serverClockUtc}
                    onSaveAnswer={onSaveDecision}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export const ActivityAuditView: React.FC<{
  auditLog: AuditEvent[];
}> = ({ auditLog }) => {
  const [entityFilter, setEntityFilter] = useState<string>('ALL');
  const visible = auditLog.filter((e) =>
    entityFilter === 'ALL' ? true : e.entityType === entityFilter
  );

  return (
    <div className="space-y-4">
      <div className="sg-section-panel p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold m-0">
            Immutable Authoritative Audit Ledger
          </h2>
          <p className="text-xs opacity-80 m-0 mt-0.5">
            Complete append-only chronological record of human decisions, ticket status transitions, review rejections, and agent evaluations.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {(['ALL', 'Ticket', 'Decision', 'Release', 'Agent', 'Project'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setEntityFilter(kind)}
              className={`sg-btn text-xs ${entityFilter === kind ? 'sg-btn-primary' : ''}`}
            >
              {kind === 'ALL' ? 'All Events' : `${kind}s`}
            </button>
          ))}
        </div>
      </div>

      <div className="sg-section-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="sg-table" aria-label="Immutable Audit Stream">
            <thead>
              <tr>
                <th>UTC Timestamp</th>
                <th>Project</th>
                <th>Entity</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((ev) => (
                <tr key={ev.id}>
                  <td className="font-mono text-[11px] whitespace-nowrap tabular-nums">
                    {ev.timestamp.slice(0, 19).replace('T', ' ')}Z
                  </td>
                  <td className="font-mono font-bold text-xs">{ev.projectCode}</td>
                  <td className="font-mono text-xs whitespace-nowrap">
                    {ev.entityType} · {ev.entityId}
                  </td>
                  <td className="whitespace-nowrap text-xs">
                    <span className="font-semibold">{ev.actorName}</span>
                    <span aria-hidden="true" className="mx-1 opacity-50">·</span>
                    <span className="font-mono text-[10.5px] opacity-75">{ev.actorType}</span>
                  </td>
                  <td className="font-mono font-bold text-[11px] whitespace-nowrap">
                    {ev.action}
                  </td>
                  <td className="text-xs">{ev.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
