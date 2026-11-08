import React, { useState } from 'react';
import {
  Project,
  Release,
  AgentPersona,
  Ticket,
  PriorityCode,
  PRIORITY_CATALOG,
  DecisionInputType,
} from '../domain/contracts';
import { X, Terminal, Play, ShieldCheck, Code2, Database, Cpu } from 'lucide-react';

export const CreateTicketModal: React.FC<{
  open: boolean;
  onClose: () => void;
  projects: Project[];
  releases: Release[];
  agents: AgentPersona[];
  defaultProjectCode: string;
  onCreateTicket: (input: {
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
  }) => Promise<void>;
}> = ({
  open,
  onClose,
  projects,
  releases,
  agents,
  defaultProjectCode,
  onCreateTicket,
}) => {
  const [projectCode, setProjectCode] = useState(defaultProjectCode || 'PIN');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<PriorityCode>(PriorityCode.P1_ENHANCEMENT);
  const [description, setDescription] = useState('');
  const [acText, setAcText] = useState(
    'ConnectRPC endpoint enforces schema validation and returns deterministic response.\nAll edge cases covered by unit assertions.'
  );
  const [vcText, setVcText] = useState(
    'Integration suite passes with zero regressions.\nAudit ledger records actor identity and UTC timestamp.'
  );
  const [assigneeComposite, setAssigneeComposite] = useState(
    `Agent:${agents[1]?.id || 'agt-kestrel'}:${agents[1]?.name || 'Kestrel-Code-Synthesizer'}`
  );
  const [releaseId, setReleaseId] = useState<string>('');
  const [decisionQuestion, setDecisionQuestion] = useState('');
  const [decisionType, setDecisionType] = useState<DecisionInputType>('text');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const projectReleases = releases.filter((r) => r.projectCode === projectCode);
  const selectedPriorityMeta = PRIORITY_CATALOG[priority];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const acList = acText
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length >= 3);
    const vcList = vcText
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length >= 3);

    if (title.trim().length < 5) {
      setErrorMsg('Ticket title must be at least 5 characters.');
      return;
    }
    if (description.trim().length < 10) {
      setErrorMsg('Description must be at least 10 characters.');
      return;
    }
    if (acList.length === 0 || vcList.length === 0) {
      setErrorMsg('Provide at least one Acceptance Criterion and one Validation Criterion.');
      return;
    }

    const [assigneeType, assigneeId, assigneeName] = assigneeComposite.split(':');

    try {
      setSubmitting(true);
      await onCreateTicket({
        projectCode,
        title: title.trim(),
        assignmentType: selectedPriorityMeta.assignmentType,
        priority,
        description: description.trim(),
        acceptanceCriteria: acList,
        validationCriteria: vcList,
        assigneeId,
        assigneeName,
        assigneeType: assigneeType as 'Human' | 'Agent',
        releaseId: releaseId || null,
        initialDecisionQuestion: decisionQuestion.trim() || undefined,
        initialDecisionType: decisionType,
      });
      setTitle('');
      setDescription('');
      setDecisionQuestion('');
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-ticket-modal-title"
    >
      <div className="sg-workspace-leaf w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="sg-titlebar px-4 py-2.5 flex items-center justify-between">
          <span id="create-ticket-modal-title" className="text-xs font-bold tracking-wider uppercase">
            Create Authoritative Backlog Ticket
          </span>
          <button
            type="button"
            onClick={onClose}
            className="sg-icon-btn w-6 h-6"
            aria-label="Close Create Ticket modal"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
          {errorMsg && (
            <div className="p-2.5 rounded bg-red-100 dark:bg-red-950 text-red-900 dark:text-red-200 font-semibold" role="alert">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold mb-1" htmlFor="ct-project">
                Project
              </label>
              <select
                id="ct-project"
                value={projectCode}
                onChange={(e) => {
                  setProjectCode(e.target.value);
                  setReleaseId('');
                }}
                className="sg-select w-full"
              >
                {projects.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block font-bold mb-1" htmlFor="ct-priority">
                Priority &amp; Assignment Classification
              </label>
              <select
                id="ct-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityCode)}
                className="sg-select w-full"
              >
                {Object.values(PRIORITY_CATALOG)
                  .sort((a, b) => a.order - b.order)
                  .map((p) => (
                    <option key={p.code} value={p.code}>
                      Order #{p.order}: {p.classification} ({p.display}) — {p.description}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold mb-1" htmlFor="ct-title">
              Ticket Title
            </label>
            <input
              id="ct-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Enforce Ed25519 signature verification on MCP tool invocations"
              className="sg-well-input w-full font-semibold"
              required
            />
          </div>

          <div>
            <label className="block font-bold mb-1" htmlFor="ct-desc">
              Engineering Specification &amp; Context
            </label>
            <textarea
              id="ct-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe exact requirements, architectural boundaries, and failure modes..."
              className="sg-well-input w-full"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold mb-1" htmlFor="ct-ac">
                Acceptance Criteria (One per line)
              </label>
              <textarea
                id="ct-ac"
                rows={3}
                value={acText}
                onChange={(e) => setAcText(e.target.value)}
                className="sg-well-input w-full font-mono text-[11px]"
                required
              />
            </div>
            <div>
              <label className="block font-bold mb-1" htmlFor="ct-vc">
                Validation Criteria (One per line)
              </label>
              <textarea
                id="ct-vc"
                rows={3}
                value={vcText}
                onChange={(e) => setVcText(e.target.value)}
                className="sg-well-input w-full font-mono text-[11px]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold mb-1" htmlFor="ct-assignee">
                Assign to Human Developer or AI Agent
              </label>
              <select
                id="ct-assignee"
                value={assigneeComposite}
                onChange={(e) => setAssigneeComposite(e.target.value)}
                className="sg-select w-full"
              >
                <optgroup label="Autonomous AI Agents">
                  {agents.map((a) => (
                    <option key={a.id} value={`Agent:${a.id}:${a.name}`}>
                      [Agent] {a.name} ({a.assignedModel})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Human Developers">
                  <option value="Human:usr-elena:Elena Vance">
                    [Human] Elena Vance (Principal Architect)
                  </option>
                  <option value="Human:usr-marcus:Marcus Sterling">
                    [Human] Marcus Sterling (Systems Lead)
                  </option>
                  <option value="Human:usr-soren:Soren Lindqvist">
                    [Human] Soren Lindqvist (Security Lead)
                  </option>
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block font-bold mb-1" htmlFor="ct-release">
                Target Release (Optional)
              </label>
              <select
                id="ct-release"
                value={releaseId}
                onChange={(e) => setReleaseId(e.target.value)}
                className="sg-select w-full"
              >
                <option value="">Unassigned (Backlog)</option>
                {projectReleases.map((r) => (
                  <option key={r.id} value={r.id}>
                    v{r.version} — {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--background-modifier-border)] grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block font-bold mb-1" htmlFor="ct-decision-q">
                Optional Blocking Human Decision Question
              </label>
              <input
                id="ct-decision-q"
                type="text"
                value={decisionQuestion}
                onChange={(e) => setDecisionQuestion(e.target.value)}
                placeholder="Leave blank if ready for immediate execution..."
                className="sg-well-input w-full"
              />
            </div>
            <div>
              <label className="block font-bold mb-1" htmlFor="ct-decision-type">
                Decision Input Type
              </label>
              <select
                id="ct-decision-type"
                value={decisionType}
                onChange={(e) => setDecisionType(e.target.value as DecisionInputType)}
                className="sg-select w-full"
              >
                <option value="text">Text Input</option>
                <option value="select">Select Dropdown</option>
                <option value="single_option">Single-Option Radio</option>
                <option value="checkbox">Checkbox</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--background-modifier-border)]">
            <button type="button" onClick={onClose} className="sg-btn">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="sg-btn sg-btn-primary">
              {submitting ? 'Creating Ticket...' : 'Create Ticket in Backlog'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const CreateProjectModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onCreateProject: (input: {
    code: string;
    name: string;
    description: string;
    intakeStateEnabled?: boolean;
  }) => Promise<void>;
}> = ({ open, onClose, onCreateProject }) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [intakeStateEnabled, setIntakeStateEnabled] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      setSubmitting(true);
      await onCreateProject({
        code: code.toUpperCase().trim(),
        name: name.trim(),
        description: description.trim(),
        intakeStateEnabled,
      });
      setCode('');
      setName('');
      setDescription('');
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-project-modal-title"
    >
      <div className="sg-workspace-leaf w-full max-w-lg overflow-hidden">
        <div className="sg-titlebar px-4 py-2.5 flex items-center justify-between">
          <span id="create-project-modal-title" className="text-xs font-bold tracking-wider uppercase">
            Register New Engineering Project
          </span>
          <button
            type="button"
            onClick={onClose}
            className="sg-icon-btn w-6 h-6"
            aria-label="Close Create Project modal"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 text-xs">
          {errorMsg && (
            <div className="p-2.5 rounded bg-red-100 dark:bg-red-950 text-red-900 dark:text-red-200 font-semibold" role="alert">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block font-bold mb-1" htmlFor="cp-code">
              Immutable Project Code (2–6 Uppercase Letters, e.g., AST, KRN)
            </label>
            <input
              id="cp-code"
              type="text"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="AST"
              className="sg-well-input w-40 font-mono font-bold uppercase"
              required
            />
          </div>

          <div>
            <label className="block font-bold mb-1" htmlFor="cp-name">
              Project Name
            </label>
            <input
              id="cp-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Astryx Reactive State Kernel"
              className="sg-well-input w-full"
              required
            />
          </div>

          <div>
            <label className="block font-bold mb-1" htmlFor="cp-desc">
              Project Description
            </label>
            <textarea
              id="cp-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the software system, repository scope, and release cadence..."
              className="sg-well-input w-full"
              required
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={intakeStateEnabled}
              onChange={(e) => setIntakeStateEnabled(e.target.checked)}
            />
            <span>Enable optional pre-backlog &quot;Created&quot; intake state</span>
          </label>

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--background-modifier-border)]">
            <button type="button" onClick={onClose} className="sg-btn">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="sg-btn sg-btn-primary">
              {submitting ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const CreateReleaseModal: React.FC<{
  open: boolean;
  onClose: () => void;
  projects: Project[];
  tickets: Ticket[];
  defaultProjectCode: string;
  onCreateRelease: (input: {
    projectCode: string;
    version: string;
    name: string;
    description: string;
    ticketIds: string[];
  }) => Promise<void>;
}> = ({ open, onClose, projects, tickets, defaultProjectCode, onCreateRelease }) => {
  const [projectCode, setProjectCode] = useState(defaultProjectCode || 'PIN');
  const [version, setVersion] = useState('2.6.0');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const projectTickets = tickets.filter((t) => t.projectCode === projectCode);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      setSubmitting(true);
      await onCreateRelease({
        projectCode,
        version: version.trim(),
        name: name.trim(),
        description: description.trim(),
        ticketIds: selectedTicketIds,
      });
      setName('');
      setDescription('');
      setSelectedTicketIds([]);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create release');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-release-modal-title"
    >
      <div className="sg-workspace-leaf w-full max-w-xl overflow-hidden">
        <div className="sg-titlebar px-4 py-2.5 flex items-center justify-between">
          <span id="create-release-modal-title" className="text-xs font-bold tracking-wider uppercase">
            Create SemVer Release Train
          </span>
          <button
            type="button"
            onClick={onClose}
            className="sg-icon-btn w-6 h-6"
            aria-label="Close Create Release modal"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 text-xs">
          {errorMsg && (
            <div className="p-2.5 rounded bg-red-100 dark:bg-red-950 text-red-900 dark:text-red-200 font-semibold" role="alert">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold mb-1" htmlFor="cr-project">
                Project
              </label>
              <select
                id="cr-project"
                value={projectCode}
                onChange={(e) => {
                  setProjectCode(e.target.value);
                  setSelectedTicketIds([]);
                }}
                className="sg-select w-full"
              >
                {projects.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1" htmlFor="cr-version">
                Semantic Version (MAJOR.MINOR.PATCH)
              </label>
              <input
                id="cr-version"
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="2.6.0"
                className="sg-well-input w-full font-mono font-bold"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-bold mb-1" htmlFor="cr-name">
              Release Title
            </label>
            <input
              id="cr-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Deterministic Sandbox Isolation & Zero-Copy RPC"
              className="sg-well-input w-full"
              required
            />
          </div>

          <div>
            <label className="block font-bold mb-1" htmlFor="cr-desc">
              Release Notes &amp; Scope
            </label>
            <textarea
              id="cr-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="sg-well-input w-full"
              required
            />
          </div>

          <div>
            <div className="font-bold mb-1">Associate {projectCode} Tickets:</div>
            <div className="max-h-36 overflow-y-auto border border-[var(--background-modifier-border)] rounded p-2 space-y-1 bg-[var(--background-primary)]">
              {projectTickets.map((t) => (
                <label key={t.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedTicketIds.includes(t.id)}
                    onChange={(e) =>
                      setSelectedTicketIds((prev) =>
                        e.target.checked
                          ? [...prev, t.id]
                          : prev.filter((id) => id !== t.id)
                      )
                    }
                  />
                  <span className="font-mono font-bold">{t.id}</span>
                  <span className="truncate">{t.title}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--background-modifier-border)]">
            <button type="button" onClick={onClose} className="sg-btn">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="sg-btn sg-btn-primary">
              {submitting ? 'Creating...' : 'Create Release'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const ArchitectureAndCliModal: React.FC<{
  open: boolean;
  onClose: () => void;
  sessionToken: string;
  contracts: {
    protobuf: string;
    postgresql: string;
    rustCli: string;
    fastMcp: string;
  };
  onExecuteCli: (command: string, output: 'table' | 'json') => Promise<{ exitCode: number; output: string }>;
}> = ({ open, onClose, sessionToken, contracts, onExecuteCli }) => {
  const [activeTab, setActiveTab] = useState<'cli' | 'protobuf' | 'sql' | 'rust' | 'mcp'>('cli');
  const [cliInput, setCliInput] = useState('pinnacle tickets --project PIN');
  const [cliFormat, setCliFormat] = useState<'table' | 'json'>('table');
  const [cliOutput, setCliOutput] = useState(
    'PINNACLE NATIVE CLI & FASTMCP CONSOLE READY.\nRun `pinnacle status`, `pinnacle tickets --project PIN`, or `pinnacle decisions` below.'
  );
  const [runningCli, setRunningCli] = useState(false);

  if (!open) return null;

  const handleRunCli = async (e: React.FormEvent) => {
    e.preventDefault();
    setRunningCli(true);
    try {
      const res = await onExecuteCli(cliInput, cliFormat);
      setCliOutput(`$ ${cliInput}\n\n${res.output}`);
    } catch (err) {
      setCliOutput(`$ ${cliInput}\nError: ${err instanceof Error ? err.message : 'Execution failed'}`);
    } finally {
      setRunningCli(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="arch-cli-modal-title"
    >
      <div className="sg-workspace-leaf w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden">
        <div className="sg-titlebar px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4" aria-hidden="true" />
            <span id="arch-cli-modal-title" className="text-xs font-bold tracking-wider uppercase">
              Pinnacle CLI, FastMCP &amp; ConnectRPC Architecture Contracts
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="sg-icon-btn w-6 h-6"
            aria-label="Close Architecture and CLI modal"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="sg-metal-bar px-4 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('cli')}
              className={`sg-btn text-xs ${activeTab === 'cli' ? 'sg-btn-primary' : ''}`}
            >
              <Terminal className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Interactive CLI Console</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('protobuf')}
              className={`sg-btn text-xs ${activeTab === 'protobuf' ? 'sg-btn-primary' : ''}`}
            >
              <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>ConnectRPC Protobuf</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sql')}
              className={`sg-btn text-xs ${activeTab === 'sql' ? 'sg-btn-primary' : ''}`}
            >
              <Database className="w-3.5 h-3.5" aria-hidden="true" />
              <span>PostgreSQL DDL</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('rust')}
              className={`sg-btn text-xs ${activeTab === 'rust' ? 'sg-btn-primary' : ''}`}
            >
              <Cpu className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Rust CLI Contract</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('mcp')}
              className={`sg-btn text-xs ${activeTab === 'mcp' ? 'sg-btn-primary' : ''}`}
            >
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span>FastMCP Server</span>
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-3 text-xs">
          {activeTab === 'cli' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">
                  Execute shared ConnectRPC contract commands in Human-Readable Table or Machine-Readable JSON mode:
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCliInput('pinnacle status')}
                    className="sg-btn text-[11px] py-1 px-2"
                  >
                    pinnacle status
                  </button>
                  <button
                    type="button"
                    onClick={() => setCliInput('pinnacle tickets --project PIN')}
                    className="sg-btn text-[11px] py-1 px-2"
                  >
                    pinnacle tickets --project PIN
                  </button>
                  <button
                    type="button"
                    onClick={() => setCliInput('pinnacle decisions')}
                    className="sg-btn text-[11px] py-1 px-2"
                  >
                    pinnacle decisions
                  </button>
                </div>
              </div>

              <form onSubmit={handleRunCli} className="flex items-center gap-2">
                <input
                  type="text"
                  aria-label="CLI command input"
                  value={cliInput}
                  onChange={(e) => setCliInput(e.target.value)}
                  className="sg-well-input flex-1 font-mono"
                />
                <select
                  aria-label="CLI output format"
                  value={cliFormat}
                  onChange={(e) => setCliFormat(e.target.value as 'table' | 'json')}
                  className="sg-select font-mono"
                >
                  <option value="table">--output table</option>
                  <option value="json">--output json</option>
                </select>
                <button type="submit" disabled={runningCli} className="sg-btn sg-btn-primary">
                  <Play className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{runningCli ? 'Running...' : 'Execute'}</span>
                </button>
              </form>

              <div className="sg-lcd-display p-4">
                <pre className="sg-lcd-readout text-xs m-0 overflow-x-auto whitespace-pre">
                  {cliOutput}
                </pre>
              </div>

              <div className="p-2.5 rounded border border-[var(--background-modifier-border)] bg-[var(--background-primary-alt)] font-mono text-[11px]">
                <div className="font-bold mb-1">Active Signed JWT Bearer Token (HS256 / Ed25519 Capability Assertion):</div>
                <div className="truncate opacity-80">{sessionToken}</div>
              </div>
            </div>
          )}

          {activeTab === 'protobuf' && (
            <div className="sg-lcd-display p-4">
              <pre className="sg-lcd-readout text-xs m-0 overflow-x-auto">{contracts.protobuf}</pre>
            </div>
          )}

          {activeTab === 'sql' && (
            <div className="sg-lcd-display p-4">
              <pre className="sg-lcd-readout text-xs m-0 overflow-x-auto">{contracts.postgresql}</pre>
            </div>
          )}

          {activeTab === 'rust' && (
            <div className="sg-lcd-display p-4">
              <pre className="sg-lcd-readout text-xs m-0 overflow-x-auto">{contracts.rustCli}</pre>
            </div>
          )}

          {activeTab === 'mcp' && (
            <div className="sg-lcd-display p-4">
              <pre className="sg-lcd-readout text-xs m-0 overflow-x-auto">{contracts.fastMcp}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
