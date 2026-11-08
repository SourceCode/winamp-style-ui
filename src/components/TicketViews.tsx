import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Ticket,
  TicketDecision,
  Release,
  AgentPersona,
  AuditEvent,
  PriorityCode,
  PRIORITY_CATALOG,
  comparePriority,
  TicketStatus,
  TICKET_STATUSES,
  CriterionItem,
  DecisionInputType,
} from '../domain/contracts';
import { PriorityBadge, StatusLabel, AssigneeLabel } from './PriorityBadge';
import { TicketDecisionCard } from './DecisionRowControl';
import {
  Search,
  Plus,
  CheckSquare,
  Square,
  ShieldAlert,
  ShieldCheck,
  Bot,
  MessageSquare,
  History,
  Paperclip,
  Edit3,
  Check,
  Play,
  RotateCcw,
  XCircle,
  ExternalLink,
} from 'lucide-react';

export const TicketListView: React.FC<{
  title: string;
  subtitle: string;
  tickets: Ticket[];
  decisions: TicketDecision[];
  onOpenCreateTicket: () => void;
}> = ({ title, subtitle, tickets, decisions, onOpenCreateTicket }) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'Defect' | 'Enhancement'>('ALL');
  const [assigneeTypeFilter, setAssigneeTypeFilter] = useState<'ALL' | 'Human' | 'Agent'>('ALL');

  const filteredTickets = tickets
    .filter((t) => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && t.assignmentType !== typeFilter) return false;
      if (assigneeTypeFilter !== 'ALL' && t.assigneeType !== assigneeTypeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          t.id.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.assigneeName.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => comparePriority(a.priority, b.priority));

  return (
    <div className="space-y-4">
      {/* Filter & Action Toolbar */}
      <div className="sg-section-panel p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold tracking-tight m-0">{title}</h2>
            <p className="text-xs opacity-80 m-0 mt-0.5">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onOpenCreateTicket}
            className="sg-btn sg-btn-primary"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Create Ticket</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--background-modifier-border)]">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-60 pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              aria-label="Filter tickets by ID, title, or assignee"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by ID (PIN-1), title, or assignee..."
              className="sg-well-input sg-search-input w-full"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter Buttons */}
            <div className="flex items-center gap-1" role="group" aria-label="Filter by ticket status">
              {(['ALL', 'Backlog', 'In Progress', 'In Review', 'Done'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`sg-btn text-[11px] py-1 px-2.5 ${
                    statusFilter === st ? 'sg-btn-primary' : ''
                  }`}
                >
                  {st === 'ALL' ? 'All Statuses' : st}
                </button>
              ))}
            </div>

            <select
              aria-label="Filter by assignment type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'ALL' | 'Defect' | 'Enhancement')}
              className="sg-select text-xs"
            >
              <option value="ALL">All Types (Defect &amp; Enh)</option>
              <option value="Defect">Defects Only</option>
              <option value="Enhancement">Enhancements Only</option>
            </select>

            <select
              aria-label="Filter by assignee role"
              value={assigneeTypeFilter}
              onChange={(e) => setAssigneeTypeFilter(e.target.value as 'ALL' | 'Human' | 'Agent')}
              className="sg-select text-xs"
            >
              <option value="ALL">Humans &amp; Agents</option>
              <option value="Human">Human Assigned</option>
              <option value="Agent">Agent Assigned</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ticket Table */}
      <div className="sg-section-panel overflow-hidden">
        <div className="sg-metal-bar px-4 py-2 flex items-center justify-between">
          <span className="text-xs font-bold">
            Ordered by P1 Defect → P3 Enhancement Precedence ({filteredTickets.length} shown)
          </span>
          <span className="font-mono text-[11px] opacity-75">
            Click any ticket ID or row to open 2-Column Engineering Inspector
          </span>
        </div>

        {filteredTickets.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <div className="text-sm font-bold">No tickets match the active filter criteria</div>
            <p className="text-xs opacity-75">
              Adjust your status/type filters or create a new ticket in the backlog.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setTypeFilter('ALL');
                setAssigneeTypeFilter('ALL');
              }}
              className="sg-btn mt-2"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="sg-table" aria-label="Ticket Backlog Table">
              <thead>
                <tr>
                  <th>Ticket ID</th>
                  <th>Priority &amp; Type</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Decision Gate</th>
                  <th>Assignee</th>
                  <th>Release</th>
                  <th className="text-right">Criteria</th>
                  <th>Updated (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => {
                  const pendingDecs = decisions.filter(
                    (d) => d.ticketId === ticket.id && d.required && d.status === 'Pending'
                  );
                  const acDone = ticket.acceptanceCriteria.filter((c) => c.completed).length;
                  const vcDone = ticket.validationCriteria.filter((c) => c.completed).length;

                  return (
                    <tr
                      key={ticket.id}
                      onClick={() =>
                        navigate(`/projects/${ticket.projectCode}/tickets/${ticket.id}`)
                      }
                      className="cursor-pointer"
                    >
                      <td className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <Link
                          to={`/projects/${ticket.projectCode}/tickets/${ticket.id}`}
                          className="font-mono font-bold text-xs text-[var(--text-accent)] hover:underline"
                        >
                          {ticket.id}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap">
                        <PriorityBadge priority={ticket.priority} showOrder />
                      </td>
                      <td className="max-w-md">
                        <div className="font-semibold text-xs truncate" title={ticket.title}>
                          {ticket.title}
                        </div>
                      </td>
                      <td className="whitespace-nowrap">
                        <StatusLabel status={ticket.status} />
                      </td>
                      <td className="whitespace-nowrap text-xs">
                        {pendingDecs.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-300 font-semibold">
                            <ShieldAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>Blocked ({pendingDecs.map((d) => d.id).join(', ')})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-800 dark:text-emerald-300 opacity-85">
                            <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>Ready</span>
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        <AssigneeLabel name={ticket.assigneeName} type={ticket.assigneeType} />
                      </td>
                      <td className="whitespace-nowrap font-mono text-xs">
                        {ticket.releaseVersion ? `v${ticket.releaseVersion}` : '—'}
                      </td>
                      <td className="whitespace-nowrap text-right font-mono text-[11px] tabular-nums">
                        <span>
                          AC {acDone}/{ticket.acceptanceCriteria.length} · VC {vcDone}/
                          {ticket.validationCriteria.length}
                        </span>
                      </td>
                      <td className="whitespace-nowrap font-mono text-[11px] opacity-75 tabular-nums">
                        {ticket.updatedAt.slice(0, 16).replace('T', ' ')}Z
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export const TicketDetailView: React.FC<{
  ticket: Ticket;
  decisions: TicketDecision[];
  releases: Release[];
  agents: AgentPersona[];
  auditLog: AuditEvent[];
  serverClockUtc: string;
  onTransitionStatus: (targetStatus: TicketStatus) => Promise<void>;
  onUpdateTicket: (patch: Parameters<typeof import('../api/client').pinnacleClient.updateTicket>[1]) => Promise<void>;
  onSaveDecision: (decisionId: string, answer: string | boolean, expectedVersion: number) => Promise<void>;
  onRunAgentEvaluation: (agentId: string, ticketId: string) => Promise<void>;
}> = ({
  ticket,
  decisions,
  releases,
  agents,
  auditLog,
  serverClockUtc,
  onTransitionStatus,
  onUpdateTicket,
  onSaveDecision,
  onRunAgentEvaluation,
}) => {
  const [editingDescription, setEditingDescription] = useState(false);
  const [draftTitle, setDraftTitle] = useState(ticket.title);
  const [draftDescription, setDraftDescription] = useState(ticket.description);
  const [newAcText, setNewAcText] = useState('');
  const [newVcText, setNewVcText] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [evaluatingAgent, setEvaluatingAgent] = useState(false);

  // Add new human decision form
  const [showAddDecision, setShowAddDecision] = useState(false);
  const [newDecQuestion, setNewDecQuestion] = useState('');
  const [newDecType, setNewDecType] = useState<DecisionInputType>('text');
  const [newDecOptions, setNewDecOptions] = useState('Approve standard path, Require architecture review');

  const ticketDecisions = decisions.filter((d) => d.ticketId === ticket.id);
  const pendingRequiredDecisions = ticketDecisions.filter(
    (d) => d.required && d.status === 'Pending'
  );
  const projectReleases = releases.filter((r) => r.projectCode === ticket.projectCode);
  const ticketHistory = auditLog.filter(
    (e) =>
      e.entityId === ticket.id ||
      e.summary.includes(ticket.id) ||
      ticketDecisions.some((d) => d.id === e.entityId)
  );

  const handleStatusChange = async (target: TicketStatus) => {
    setTransitionError(null);
    setTransitioning(true);
    try {
      await onTransitionStatus(target);
    } catch (err) {
      setTransitionError(err instanceof Error ? err.message : 'Status transition blocked');
    } finally {
      setTransitioning(false);
    }
  };

  const handleToggleCriterion = async (
    kind: 'acceptanceCriteria' | 'validationCriteria',
    itemId: string
  ) => {
    const list: CriterionItem[] = ticket[kind].map((item) =>
      item.id === itemId
        ? {
            ...item,
            completed: !item.completed,
            verifiedBy: !item.completed ? 'Elena Vance' : undefined,
          }
        : item
    );
    await onUpdateTicket({ [kind]: list });
  };

  const handleAddCriterion = async (
    e: React.FormEvent,
    kind: 'acceptanceCriteria' | 'validationCriteria'
  ) => {
    e.preventDefault();
    const text = kind === 'acceptanceCriteria' ? newAcText.trim() : newVcText.trim();
    if (!text) return;
    const prefix = kind === 'acceptanceCriteria' ? 'ac' : 'vc';
    const updated: CriterionItem[] = [
      ...ticket[kind],
      {
        id: `${prefix}-${ticket.id.toLowerCase()}-${Date.now()}`,
        text,
        completed: false,
      },
    ];
    await onUpdateTicket({ [kind]: updated });
    if (kind === 'acceptanceCriteria') setNewAcText('');
    else setNewVcText('');
  };

  const handleSaveDescription = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateTicket({
      title: draftTitle,
      description: draftDescription,
    });
    setEditingDescription(false);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    await onUpdateTicket({
      newComment: {
        authorName: 'Elena Vance',
        authorRole: 'Human',
        body: commentBody.trim(),
      },
    });
    setCommentBody('');
  };

  const handleCreateDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDecQuestion.trim()) return;
    await onUpdateTicket({
      newDecision: {
        question: newDecQuestion.trim(),
        inputType: newDecType,
        options:
          newDecType === 'select' || newDecType === 'single_option'
            ? newDecOptions
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
        assigneeName: 'Elena Vance',
      },
    });
    setNewDecQuestion('');
    setShowAddDecision(false);
  };

  const handleTriggerEvaluation = async (agentId: string) => {
    setEvaluatingAgent(true);
    try {
      await onRunAgentEvaluation(agentId, ticket.id);
    } finally {
      setEvaluatingAgent(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Section Anchor Jump Bar */}
      <div className="sg-section-panel px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-bold text-[var(--text-accent)]">{ticket.id}</span>
          <span aria-hidden="true">·</span>
          <StatusLabel status={ticket.status} />
          <span aria-hidden="true">·</span>
          <PriorityBadge priority={ticket.priority} showOrder />
          <span aria-hidden="true">·</span>
          <span className="font-mono text-[11px] opacity-75">v{ticket.version}</span>
        </div>

        <nav className="flex items-center gap-3 font-medium" aria-label="Ticket Section Anchors">
          <a href="#description" className="hover:underline whitespace-nowrap">Description</a>
          <a href="#acceptance-criteria" className="hover:underline whitespace-nowrap">Acceptance ({ticket.acceptanceCriteria.length})</a>
          <a href="#validation-criteria" className="hover:underline whitespace-nowrap">Validation ({ticket.validationCriteria.length})</a>
          <a href="#decisions" className="hover:underline whitespace-nowrap">Decisions ({ticketDecisions.length})</a>
          <a href="#comments" className="hover:underline whitespace-nowrap">Comments ({ticket.comments.length})</a>
          <a href="#audit-history" className="hover:underline whitespace-nowrap">Audit History ({ticketHistory.length})</a>
        </nav>
      </div>

      {/* Transition Error Banner */}
      {transitionError && (
        <div
          className="sg-section-panel p-3 border-red-600 bg-red-50 dark:bg-red-950/50 text-red-900 dark:text-red-200 flex items-center justify-between gap-3"
          role="alert"
        >
          <div className="flex items-center gap-2 text-xs font-semibold">
            <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{transitionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setTransitionError(null)}
            className="sg-btn text-[11px] py-0.5 px-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Two-Column Workstation Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT / MAIN COLUMN (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* 1. Title & Description Panel */}
          <section id="description" className="sg-section-panel overflow-hidden">
            <div className="sg-metal-bar px-4 py-2 flex items-center justify-between gap-2">
              <span className="text-xs font-bold">
                {ticket.id} — Specification &amp; Problem Statement
              </span>
              <button
                type="button"
                onClick={() => {
                  setDraftTitle(ticket.title);
                  setDraftDescription(ticket.description);
                  setEditingDescription((prev) => !prev);
                }}
                className="sg-btn text-[11px] py-1 px-2.5"
              >
                <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{editingDescription ? 'Cancel Edit' : 'Edit Specification'}</span>
              </button>
            </div>

            <div className="p-4">
              {editingDescription ? (
                <form onSubmit={handleSaveDescription} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold mb-1" htmlFor="edit-ticket-title">
                      Ticket Title
                    </label>
                    <input
                      id="edit-ticket-title"
                      type="text"
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      className="sg-well-input w-full font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1" htmlFor="edit-ticket-desc">
                      Detailed Engineering Description
                    </label>
                    <textarea
                      id="edit-ticket-desc"
                      rows={4}
                      value={draftDescription}
                      onChange={(e) => setDraftDescription(e.target.value)}
                      className="sg-well-input w-full"
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="submit" className="sg-btn sg-btn-primary">
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Save Specification</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-2.5">
                  <h1 className="text-lg font-bold tracking-tight m-0 leading-snug">
                    {ticket.title}
                  </h1>
                  <p className="text-xs leading-relaxed opacity-90 whitespace-pre-wrap m-0">
                    {ticket.description}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* 2. Human Decisions Section */}
          <section id="decisions" className="sg-section-panel overflow-hidden">
            <div className="sg-metal-bar px-4 py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-700 dark:text-amber-300" aria-hidden="true" />
                <span className="text-xs font-bold">
                  Explicit Human Decisions ({ticketDecisions.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddDecision((prev) => !prev)}
                className="sg-btn text-[11px] py-1 px-2.5"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add Required Decision</span>
              </button>
            </div>

            {showAddDecision && (
              <form
                onSubmit={handleCreateDecision}
                className="p-3.5 border-b border-[var(--background-modifier-border)] bg-[var(--background-primary-alt)] space-y-2.5"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold mb-1" htmlFor="new-dec-q">
                      Decision Question (Blocks Agent Execution until Answered)
                    </label>
                    <input
                      id="new-dec-q"
                      type="text"
                      value={newDecQuestion}
                      onChange={(e) => setNewDecQuestion(e.target.value)}
                      placeholder="e.g., Approve database migration rollback policy?"
                      className="sg-well-input w-full"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" htmlFor="new-dec-type">
                      Decision Control Type
                    </label>
                    <select
                      id="new-dec-type"
                      value={newDecType}
                      onChange={(e) => setNewDecType(e.target.value as DecisionInputType)}
                      className="sg-select w-full"
                    >
                      <option value="text">Text Input</option>
                      <option value="select">Select Dropdown</option>
                      <option value="single_option">Single-Option Radio</option>
                      <option value="checkbox">Checkbox Authorization</option>
                    </select>
                  </div>
                </div>

                {(newDecType === 'select' || newDecType === 'single_option') && (
                  <div>
                    <label className="block text-xs font-semibold mb-1" htmlFor="new-dec-opts">
                      Comma-Separated Options
                    </label>
                    <input
                      id="new-dec-opts"
                      type="text"
                      value={newDecOptions}
                      onChange={(e) => setNewDecOptions(e.target.value)}
                      className="sg-well-input w-full"
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddDecision(false)}
                    className="sg-btn text-xs"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="sg-btn sg-btn-primary text-xs">
                    Register Decision Gate
                  </button>
                </div>
              </form>
            )}

            {ticketDecisions.length === 0 ? (
              <div className="p-4 text-xs opacity-80 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                <span>No outstanding human decisions required for this ticket.</span>
              </div>
            ) : (
              <div>
                {ticketDecisions.map((dec) => (
                  <TicketDecisionCard
                    key={`${dec.id}-v${dec.version}`}
                    decision={dec}
                    serverClockUtc={serverClockUtc}
                    onSaveAnswer={onSaveDecision}
                  />
                ))}
              </div>
            )}
          </section>

          {/* 3. Acceptance Criteria & Validation Criteria Checklists */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <section id="acceptance-criteria" className="sg-section-panel overflow-hidden flex flex-col">
              <div className="sg-metal-bar px-3.5 py-2 flex items-center justify-between">
                <span className="text-xs font-bold">
                  Acceptance Criteria ({ticket.acceptanceCriteria.filter((c) => c.completed).length}/
                  {ticket.acceptanceCriteria.length})
                </span>
                <span className="font-mono text-[10.5px] opacity-75">Implementation Spec</span>
              </div>
              <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                <ul className="space-y-2 m-0 p-0 list-none">
                  {ticket.acceptanceCriteria.map((ac) => (
                    <li
                      key={ac.id}
                      className="flex items-start gap-2 text-xs p-1.5 rounded hover:bg-[var(--background-modifier-hover)]"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleCriterion('acceptanceCriteria', ac.id)}
                        className="mt-0.5 text-[var(--text-accent)] shrink-0 cursor-pointer bg-transparent border-0 p-0"
                        aria-label={`Toggle acceptance criterion: ${ac.text}`}
                      >
                        {ac.completed ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4 opacity-70" />
                        )}
                      </button>
                      <div className="flex-1">
                        <span className={ac.completed ? 'line-through opacity-75' : 'font-medium'}>
                          {ac.text}
                        </span>
                        {ac.verifiedBy && (
                          <div className="font-mono text-[10px] opacity-70 mt-0.5">
                            Verified by {ac.verifiedBy}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>

                <form
                  onSubmit={(e) => handleAddCriterion(e, 'acceptanceCriteria')}
                  className="flex items-center gap-1.5 pt-2 border-t border-[var(--background-modifier-border)]"
                >
                  <input
                    type="text"
                    aria-label="New acceptance criterion"
                    value={newAcText}
                    onChange={(e) => setNewAcText(e.target.value)}
                    placeholder="Add acceptance criterion..."
                    className="sg-well-input flex-1 text-xs"
                  />
                  <button type="submit" className="sg-btn text-xs py-1 px-2.5">
                    Add
                  </button>
                </form>
              </div>
            </section>

            <section id="validation-criteria" className="sg-section-panel overflow-hidden flex flex-col">
              <div className="sg-metal-bar px-3.5 py-2 flex items-center justify-between">
                <span className="text-xs font-bold">
                  Validation Criteria ({ticket.validationCriteria.filter((c) => c.completed).length}/
                  {ticket.validationCriteria.length})
                </span>
                <span className="font-mono text-[10.5px] opacity-75">Required for Done</span>
              </div>
              <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                <ul className="space-y-2 m-0 p-0 list-none">
                  {ticket.validationCriteria.map((vc) => (
                    <li
                      key={vc.id}
                      className="flex items-start gap-2 text-xs p-1.5 rounded hover:bg-[var(--background-modifier-hover)]"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleCriterion('validationCriteria', vc.id)}
                        className="mt-0.5 text-[var(--text-accent)] shrink-0 cursor-pointer bg-transparent border-0 p-0"
                        aria-label={`Toggle validation criterion: ${vc.text}`}
                      >
                        {vc.completed ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4 opacity-70" />
                        )}
                      </button>
                      <div className="flex-1">
                        <span className={vc.completed ? 'line-through opacity-75' : 'font-medium'}>
                          {vc.text}
                        </span>
                        {vc.verifiedBy && (
                          <div className="font-mono text-[10px] opacity-70 mt-0.5">
                            Verified by {vc.verifiedBy}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>

                <form
                  onSubmit={(e) => handleAddCriterion(e, 'validationCriteria')}
                  className="flex items-center gap-1.5 pt-2 border-t border-[var(--background-modifier-border)]"
                >
                  <input
                    type="text"
                    aria-label="New validation criterion"
                    value={newVcText}
                    onChange={(e) => setNewVcText(e.target.value)}
                    placeholder="Add validation criterion..."
                    className="sg-well-input flex-1 text-xs"
                  />
                  <button type="submit" className="sg-btn text-xs py-1 px-2.5">
                    Add
                  </button>
                </form>
              </div>
            </section>
          </div>

          {/* 4. Attachments */}
          <section id="attachments" className="sg-section-panel overflow-hidden">
            <div className="sg-metal-bar px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="text-xs font-bold">
                  Verification Artifacts &amp; Attachments ({ticket.attachments.length})
                </span>
              </div>
              <span className="font-mono text-[11px] opacity-75">SHA-256 Content-Addressed</span>
            </div>
            {ticket.attachments.length === 0 ? (
              <div className="p-3.5 text-xs opacity-75">
                No trace bundles or artifacts attached to this ticket.
              </div>
            ) : (
              <table className="sg-table" aria-label="Ticket Attachments">
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>MIME Type</th>
                    <th className="text-right">Size</th>
                    <th>Uploaded By</th>
                    <th>SHA-256 Digest</th>
                  </tr>
                </thead>
                <tbody>
                  {ticket.attachments.map((att) => (
                    <tr key={att.id}>
                      <td className="font-mono font-semibold text-xs">{att.fileName}</td>
                      <td className="font-mono text-[11px] opacity-80">{att.mimeType}</td>
                      <td className="font-mono text-xs text-right tabular-nums">{att.fileSize}</td>
                      <td className="text-xs">{att.uploadedBy}</td>
                      <td className="font-mono text-[11px] opacity-75">
                        {att.sha256.slice(0, 16)}…
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* 5. Comments Thread */}
          <section id="comments" className="sg-section-panel overflow-hidden">
            <div className="sg-metal-bar px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="text-xs font-bold">
                  Engineering &amp; Agent Discussion ({ticket.comments.length})
                </span>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {ticket.comments.length === 0 ? (
                <p className="text-xs opacity-75 m-0">No comments recorded yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {ticket.comments.map((cmt) => (
                    <div
                      key={cmt.id}
                      className="p-3 rounded border border-[var(--background-modifier-border)] bg-[var(--background-primary)]"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs mb-1">
                        <AssigneeLabel name={cmt.authorName} type={cmt.authorRole} />
                        <span className="font-mono text-[11px] opacity-70 tabular-nums">
                          {cmt.createdAt.slice(0, 19).replace('T', ' ')}Z
                        </span>
                      </div>
                      <p className="text-xs m-0 leading-relaxed">{cmt.body}</p>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddComment} className="space-y-2 pt-2 border-t border-[var(--background-modifier-border)]">
                <label className="block text-xs font-semibold" htmlFor="new-comment-input">
                  Append Engineering Note
                </label>
                <div className="flex gap-2">
                  <input
                    id="new-comment-input"
                    type="text"
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    placeholder="Record architectural guidance or review feedback..."
                    className="sg-well-input flex-1"
                  />
                  <button type="submit" className="sg-btn sg-btn-primary">
                    Post Comment
                  </button>
                </div>
              </form>
            </div>
          </section>

          {/* 6. Immutable Audit History Timeline */}
          <section id="audit-history" className="sg-section-panel overflow-hidden">
            <div className="sg-metal-bar px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="text-xs font-bold">
                  Immutable Audit History ({ticketHistory.length})
                </span>
              </div>
              <span className="font-mono text-[11px] opacity-75">Append-Only Ledger</span>
            </div>
            <div className="overflow-x-auto">
              <table className="sg-table" aria-label="Ticket Audit History">
                <thead>
                  <tr>
                    <th>UTC Timestamp</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Audit Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {ticketHistory.map((ev) => (
                    <tr key={ev.id}>
                      <td className="font-mono text-[11px] whitespace-nowrap tabular-nums">
                        {ev.timestamp.slice(0, 19).replace('T', ' ')}Z
                      </td>
                      <td className="whitespace-nowrap text-xs">
                        <span className="font-semibold">{ev.actorName}</span>
                        <span aria-hidden="true" className="mx-1 opacity-50">·</span>
                        <span className="font-mono text-[10.5px] opacity-75">{ev.actorType}</span>
                      </td>
                      <td className="font-mono text-[11px] whitespace-nowrap font-bold">
                        {ev.action}
                      </td>
                      <td className="text-xs">{ev.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* RIGHT INSPECTOR COLUMN (4 cols) */}
        <aside className="lg:col-span-4 space-y-4">
          {/* Decision Readiness & Lifecycle Controls */}
          <div className="sg-section-panel overflow-hidden">
            <div className="sg-metal-bar px-3.5 py-2 flex items-center justify-between">
              <span className="text-xs font-bold">Lifecycle &amp; Decision Gate Inspector</span>
              <span className="font-mono text-[11px]">{ticket.id}</span>
            </div>

            <div className="p-3.5 space-y-3.5">
              {/* Blue-Glass LCD Decision Readiness Display */}
              <div className="sg-lcd-display p-3 space-y-1.5">
                <div className="flex items-center justify-between text-[10.5px] font-mono opacity-80">
                  <span>AUTONOMOUS EXECUTION GATE</span>
                  <span>v{ticket.version}</span>
                </div>
                <div className="sg-lcd-readout text-sm font-bold tracking-wide">
                  {pendingRequiredDecisions.length > 0
                    ? `BLOCKED (${pendingRequiredDecisions.length} DECISION PENDING)`
                    : 'AUTHORIZED · DECISION GATE CLEAR'}
                </div>
                <div className="text-[11px] font-mono opacity-85">
                  {pendingRequiredDecisions.length > 0
                    ? `Resolve ${pendingRequiredDecisions.map((d) => d.id).join(', ')} before moving to In Progress.`
                    : 'All required human decisions are resolved.'}
                </div>
              </div>

              {/* Lifecycle Transition Buttons */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold">
                  Authoritative Status Lifecycle
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {TICKET_STATUSES.map((st) => {
                    const isCurrent = ticket.status === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        disabled={transitioning || isCurrent}
                        onClick={() => handleStatusChange(st)}
                        className={`sg-btn text-xs justify-between ${
                          isCurrent ? 'sg-btn-primary opacity-100' : ''
                        }`}
                      >
                        <span>{st}</span>
                        {isCurrent && <span className="font-mono text-[10px]">ACTIVE</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Explicit Review Reject or Reopen Actions */}
                {ticket.status === 'In Review' && (
                  <button
                    type="button"
                    disabled={transitioning}
                    onClick={() => handleStatusChange('In Progress')}
                    className="sg-btn w-full mt-1.5 text-red-800 dark:text-red-300"
                  >
                    <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Reject Review → Return to In Progress</span>
                  </button>
                )}

                {ticket.status === 'Done' && (
                  <button
                    type="button"
                    disabled={transitioning}
                    onClick={() => handleStatusChange('In Progress')}
                    className="sg-btn w-full mt-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Reopen Ticket (Logged in Audit History)</span>
                  </button>
                )}
              </div>

              {/* Metadata Controls */}
              <div className="space-y-2.5 pt-2 border-t border-[var(--background-modifier-border)] text-xs">
                <div>
                  <label className="block font-semibold mb-1" htmlFor="inspector-priority">
                    Priority Classification (Updates Type)
                  </label>
                  <select
                    id="inspector-priority"
                    value={ticket.priority}
                    onChange={(e) =>
                      onUpdateTicket({ priority: e.target.value as PriorityCode })
                    }
                    className="sg-select w-full"
                  >
                    {Object.values(PRIORITY_CATALOG)
                      .sort((a, b) => a.order - b.order)
                      .map((p) => (
                        <option key={p.code} value={p.code}>
                          #{p.order} · {p.classification} ({p.display})
                        </option>
                      ))}
                  </select>
                  <p className="text-[11px] opacity-75 m-0 mt-1">
                    {PRIORITY_CATALOG[ticket.priority].description}
                  </p>
                </div>

                <div>
                  <label className="block font-semibold mb-1" htmlFor="inspector-assignee">
                    Assigned Engineer or Autonomous Agent
                  </label>
                  <select
                    id="inspector-assignee"
                    value={`${ticket.assigneeType}:${ticket.assigneeId}:${ticket.assigneeName}`}
                    onChange={(e) => {
                      const [type, id, name] = e.target.value.split(':');
                      onUpdateTicket({
                        assigneeType: type as 'Human' | 'Agent',
                        assigneeId: id,
                        assigneeName: name,
                      });
                    }}
                    className="sg-select w-full"
                  >
                    <optgroup label="Autonomous AI Agents (Ollama Personas)">
                      {agents.map((a) => (
                        <option key={a.id} value={`Agent:${a.id}:${a.name}`}>
                          [Agent] {a.name} ({a.assignedModel})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Human Engineers">
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
                  <label className="block font-semibold mb-1" htmlFor="inspector-release">
                    Target SemVer Release
                  </label>
                  <select
                    id="inspector-release"
                    value={ticket.releaseId || ''}
                    onChange={(e) =>
                      onUpdateTicket({ releaseId: e.target.value || null })
                    }
                    className="sg-select w-full"
                  >
                    <option value="">Unassigned (Backlog Pool)</option>
                    {projectReleases.map((r) => (
                      <option key={r.id} value={r.id}>
                        v{r.version} — {r.name} ({r.state})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 border-t border-[var(--background-modifier-border)] space-y-1 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="opacity-75">Assignment Type:</span>
                    <span className="font-bold">{ticket.assignmentType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-75">Creator:</span>
                    <span>{ticket.creatorName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-75">Created (UTC):</span>
                    <span className="tabular-nums">{ticket.createdAt.slice(0, 16).replace('T', ' ')}Z</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-75">Updated (UTC):</span>
                    <span className="tabular-nums">{ticket.updatedAt.slice(0, 16).replace('T', ' ')}Z</span>
                  </div>
                  {ticket.completedAt && (
                    <div className="flex justify-between text-emerald-700 dark:text-emerald-300">
                      <span>Completed (UTC):</span>
                      <span className="tabular-nums">{ticket.completedAt.slice(0, 16).replace('T', ' ')}Z</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Agent Execution Summary & Server-Side Ollama Audit Trigger */}
          <div className="sg-section-panel overflow-hidden">
            <div className="sg-metal-bar px-3.5 py-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="text-xs font-bold">Agent Execution &amp; Validation Findings</span>
              </div>
            </div>

            <div className="p-3.5 space-y-3 text-xs">
              {ticket.agentSummary ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Link
                      to={`/agents/${ticket.agentSummary.agentId}`}
                      className="font-bold text-[var(--text-accent)] hover:underline inline-flex items-center gap-1"
                    >
                      <span>{ticket.agentSummary.agentName}</span>
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </Link>
                    <span className="font-mono text-[11px] font-bold">
                      Readiness: {ticket.agentSummary.readinessScore}/100
                    </span>
                  </div>

                  <div className="text-[11px] font-mono opacity-80">
                    Model: {ticket.agentSummary.model} · Status: {ticket.agentSummary.status}
                  </div>

                  <p className="text-xs m-0 p-2 rounded bg-[var(--background-primary-alt)] border border-[var(--background-modifier-border)]">
                    {ticket.agentSummary.summaryNote}
                  </p>

                  <div className="space-y-1.5">
                    <div className="font-semibold text-[11px] opacity-80">
                      Structured Findings:
                    </div>
                    {ticket.agentSummary.structuredFindings.map((f, i) => (
                      <div
                        key={i}
                        className="p-2 rounded border border-[var(--background-modifier-border)] bg-[var(--background-primary)] flex items-start justify-between gap-2 text-[11.5px]"
                      >
                        <div>
                          <span className="font-mono font-bold mr-1.5">[{f.category}]</span>
                          <span>{f.finding}</span>
                        </div>
                        <span
                          className={`font-mono font-bold text-[10.5px] shrink-0 ${
                            f.severity === 'Blocker'
                              ? 'text-red-700 dark:text-red-300'
                              : f.severity === 'Warn'
                                ? 'text-amber-700 dark:text-amber-300'
                                : 'text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {f.severity.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs opacity-75 m-0">
                  No agent evaluation has been executed on {ticket.id} yet. Trigger a persona evaluation below.
                </p>
              )}

              <div className="pt-2 border-t border-[var(--background-modifier-border)] space-y-1.5">
                <div className="font-semibold text-[11px]">
                  Dispatch Server-Side Ollama Persona Audit:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {agents.slice(0, 3).map((ag) => (
                    <button
                      key={ag.id}
                      type="button"
                      disabled={evaluatingAgent || !ag.enabled}
                      onClick={() => handleTriggerEvaluation(ag.id)}
                      className="sg-btn text-[11px] py-1 px-2.5 flex-1"
                    >
                      <Play className="w-3 h-3" aria-hidden="true" />
                      <span>{evaluatingAgent ? 'Auditing...' : ag.name.split('-')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
