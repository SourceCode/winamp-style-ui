import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Project,
  Ticket,
  TicketDecision,
  ProjectSummaryMetrics,
} from '../domain/contracts';
import { DeliveryActivityChart, TicketDistributionChart } from './EChartsPanels';
import { DecisionRowControl } from './DecisionRowControl';
import {
  FolderGit2,
  Plus,
  Settings,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Clock,
  Sliders,
} from 'lucide-react';

export const ProjectDirectoryView: React.FC<{
  projects: Project[];
  tickets: Ticket[];
  decisions: TicketDecision[];
  onOpenCreateProject: () => void;
  onUpdateProject: (
    code: string,
    patch: { name?: string; description?: string; active?: boolean; intakeStateEnabled?: boolean }
  ) => Promise<void>;
}> = ({ projects, tickets, decisions, onOpenCreateProject, onUpdateProject }) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="sg-section-panel p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold tracking-tight m-0">
            Authoritative Project Registry
          </h2>
          <p className="text-xs opacity-80 m-0 mt-0.5">
            Immutable project codes generate deterministic ticket identifiers across ConnectRPC, CLI, and FastMCP tools.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenCreateProject}
          className="sg-btn sg-btn-primary"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Create Project</span>
        </button>
      </div>

      <div className="sg-section-panel overflow-hidden">
        <div className="sg-metal-bar px-4 py-2 flex items-center justify-between">
          <span className="text-xs font-bold">Registered Engineering Projects ({projects.length})</span>
          <span className="font-mono text-[11px] opacity-75">Click any project to open Mission Control Summary</span>
        </div>
        <div className="overflow-x-auto">
          <table className="sg-table" aria-label="Projects Directory">
            <thead>
              <tr>
                <th>Code</th>
                <th>Project Name &amp; Description</th>
                <th>State</th>
                <th>Intake Mode</th>
                <th className="text-right">Total Tickets</th>
                <th className="text-right">Pending Decisions</th>
                <th>Creator &amp; Updated (UTC)</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((proj) => {
                const projTickets = tickets.filter((t) => t.projectCode === proj.code);
                const doneCount = projTickets.filter((t) => t.status === 'Done').length;
                const pendingDecs = decisions.filter(
                  (d) => d.projectCode === proj.code && d.status === 'Pending'
                ).length;

                return (
                  <tr key={proj.id}>
                    <td className="whitespace-nowrap">
                      <Link
                        to={`/projects/${proj.code}/summary`}
                        className="font-mono font-bold text-sm text-[var(--text-accent)] hover:underline"
                      >
                        {proj.code}
                      </Link>
                    </td>
                    <td className="max-w-md">
                      <div className="font-bold text-xs">{proj.name}</div>
                      <div className="text-[11.5px] opacity-80 line-clamp-2 mt-0.5">
                        {proj.description}
                      </div>
                    </td>
                    <td className="whitespace-nowrap">
                      <span className="font-mono text-xs">
                        {proj.active ? '● Active' : '○ Inactive'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-xs">
                      <span>{proj.intakeStateEnabled ? 'Created → Backlog' : 'Direct to Backlog'}</span>
                    </td>
                    <td className="whitespace-nowrap text-right font-mono tabular-nums text-xs">
                      <span className="font-bold">{projTickets.length}</span>
                      <span className="opacity-70"> ({doneCount} Done)</span>
                    </td>
                    <td className="whitespace-nowrap text-right font-mono tabular-nums text-xs">
                      {pendingDecs > 0 ? (
                        <span className="text-amber-800 dark:text-amber-300 font-bold">
                          {pendingDecs} Blocking
                        </span>
                      ) : (
                        <span className="opacity-70">0 Clear</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-[11px]">
                      <div>{proj.creatorName}</div>
                      <div className="font-mono opacity-70">{proj.updatedAt.slice(0, 16).replace('T', ' ')}Z</div>
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onUpdateProject(proj.code, { active: !proj.active })}
                          className="sg-btn text-[11px] py-1 px-2"
                        >
                          {proj.active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/projects/${proj.code}/summary`)}
                          className="sg-btn sg-btn-primary text-[11px] py-1 px-2.5"
                        >
                          <span>Open Summary</span>
                          <ArrowRight className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const ProjectSummaryDashboard: React.FC<{
  project: Project;
  metrics: ProjectSummaryMetrics;
  tickets: Ticket[];
  decisions: TicketDecision[];
  darkMode: boolean;
  onSaveDecision: (decisionId: string, answer: string | boolean, expectedVersion: number) => Promise<void>;
  onUpdateProject: (
    code: string,
    patch: { name?: string; description?: string; active?: boolean; intakeStateEnabled?: boolean }
  ) => Promise<void>;
}> = ({
  project,
  metrics,
  tickets,
  decisions,
  darkMode,
  onSaveDecision,
  onUpdateProject,
}) => {
  const [decisionFilter, setDecisionFilter] = useState<'Pending' | 'Resolved' | 'All'>('Pending');
  const [showSettings, setShowSettings] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [editDesc, setEditDesc] = useState(project.description);
  const [savingSettings, setSavingSettings] = useState(false);

  const projectDecisions = decisions.filter((d) => d.projectCode === project.code);
  const visibleDecisions = projectDecisions.filter((d) =>
    decisionFilter === 'All' ? true : d.status === decisionFilter
  );

  const handleSaveProjectSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await onUpdateProject(project.code, {
        name: editName,
        description: editDesc,
      });
      setShowSettings(false);
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Project Header Banner */}
      <div className="sg-section-panel p-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="sg-lcd-display px-3 py-2 flex flex-col items-center justify-center shrink-0">
            <span className="text-[10px] font-mono uppercase tracking-wider opacity-80">PROJECT</span>
            <span className="sg-lcd-readout text-lg font-bold tracking-widest">{project.code}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold tracking-tight m-0">{project.name}</h2>
              <span aria-hidden="true" className="opacity-50">·</span>
              <span className="font-mono text-xs opacity-80">
                {project.active ? 'Active Workstation' : 'Archived / Inactive'}
              </span>
              <span aria-hidden="true" className="opacity-50">·</span>
              <span className="font-mono text-[11px] opacity-75">
                Next Ticket ID: {project.code}-{project.nextTicketNumber}
              </span>
            </div>
            <p className="text-xs opacity-85 m-0 mt-1 max-w-3xl">{project.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link to={`/projects/${project.code}/tickets`} className="sg-btn">
            <FolderGit2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>View All Tickets ({tickets.length})</span>
          </Link>
          <button
            type="button"
            onClick={() => {
              setEditName(project.name);
              setEditDesc(project.description);
              setShowSettings((prev) => !prev);
            }}
            className="sg-btn"
            aria-expanded={showSettings}
          >
            <Settings className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Project Settings</span>
          </button>
        </div>
      </div>

      {/* Collapsible Project Settings Drawer */}
      {showSettings && (
        <form onSubmit={handleSaveProjectSettings} className="sg-section-panel p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--background-modifier-border)] pb-2">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4" aria-hidden="true" />
              <h3 className="text-xs font-bold m-0">
                Project Configuration — {project.code} (Immutable Code)
              </h3>
            </div>
            <span className="font-mono text-[11px] opacity-75">
              Created {project.createdAt.slice(0, 10)} by {project.creatorName}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" htmlFor="proj-settings-name">
                Project Name
              </label>
              <input
                id="proj-settings-name"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="sg-well-input w-full"
                required
              />
            </div>
            <div className="flex flex-col justify-end gap-2">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={project.active}
                  onChange={(e) => onUpdateProject(project.code, { active: e.target.checked })}
                />
                <span className="font-medium">Project is Active for ticket assignment &amp; agent execution</span>
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={project.intakeStateEnabled}
                  onChange={(e) =>
                    onUpdateProject(project.code, { intakeStateEnabled: e.target.checked })
                  }
                />
                <span className="font-medium">
                  Enable optional pre-backlog &quot;Created&quot; intake state in distribution telemetry
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" htmlFor="proj-settings-desc">
              Project Mission &amp; Scope Description
            </label>
            <textarea
              id="proj-settings-desc"
              rows={2}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="sg-well-input w-full"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setShowSettings(false)} className="sg-btn">
              Cancel
            </button>
            <button type="submit" disabled={savingSettings} className="sg-btn sg-btn-primary">
              {savingSettings ? 'Saving...' : 'Save Project Settings'}
            </button>
          </div>
        </form>
      )}

      {/* 4 Required Silverglass Blue-Glass LCD KPI Panels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="sg-lcd-display p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-mono opacity-85">
            <span>COMPLETED (LAST 7D UTC)</span>
            <span>7D·DONE</span>
          </div>
          <div className="my-2 flex items-baseline justify-between">
            <span
              className="sg-lcd-readout text-3xl font-bold tracking-wider"
              data-testid="kpi-completed-7d"
            >
              {String(metrics.completedLast7Days).padStart(2, '0')}
            </span>
            <span className="font-mono text-[11px] text-emerald-300">
              Validated &amp; Closed
            </span>
          </div>
          <div className="text-[10.5px] font-mono opacity-75 border-t border-[#7394c144] pt-1.5">
            Window: UTC -168h to {metrics.serverClockUtc.slice(11, 16)}Z
          </div>
        </div>

        <div className="sg-lcd-display p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-mono opacity-85">
            <span>CREATED (LAST 7D UTC)</span>
            <span>7D·NEW</span>
          </div>
          <div className="my-2 flex items-baseline justify-between">
            <span
              className="sg-lcd-readout text-3xl font-bold tracking-wider"
              data-testid="kpi-created-7d"
            >
              {String(metrics.createdLast7Days).padStart(2, '0')}
            </span>
            <span className="font-mono text-[11px] text-sky-200">
              Entered Backlog
            </span>
          </div>
          <div className="text-[10.5px] font-mono opacity-75 border-t border-[#7394c144] pt-1.5">
            Authoritative Server UTC Clock
          </div>
        </div>

        <div className="sg-lcd-display p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-mono opacity-85">
            <span>COMPLETED (ALL TIME)</span>
            <span>Σ·DONE</span>
          </div>
          <div className="my-2 flex items-baseline justify-between">
            <span
              className="sg-lcd-readout text-3xl font-bold tracking-wider"
              data-testid="kpi-completed-all"
            >
              {String(metrics.completedAllTime).padStart(2, '0')}
            </span>
            <span className="font-mono text-[11px] text-sky-200">
              {tickets.length > 0
                ? `${Math.round((metrics.completedAllTime / tickets.length) * 100)}% Delivery Rate`
                : '0%'}
            </span>
          </div>
          <div className="text-[10.5px] font-mono opacity-75 border-t border-[#7394c144] pt-1.5">
            Across {tickets.length} Total {project.code} Tickets
          </div>
        </div>

        <div className="sg-lcd-display p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-mono opacity-85">
            <span>TICKETS OUTSTANDING</span>
            <span>ACTIVE·WIP</span>
          </div>
          <div className="my-2 flex items-baseline justify-between">
            <span
              className="sg-lcd-readout text-3xl font-bold tracking-wider"
              data-testid="kpi-outstanding"
            >
              {String(metrics.outstandingTotal).padStart(2, '0')}
            </span>
            <span className="font-mono text-[11px] text-amber-300">
              {metrics.pendingDecisionsCount} Decision Gate(s)
            </span>
          </div>
          <div className="text-[10.5px] font-mono opacity-75 border-t border-[#7394c144] pt-1.5">
            Backlog + In Progress + In Review
          </div>
        </div>
      </div>

      {/* Charts Row: 30-Day Delivery Activity & Ticket Distribution Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <div className="lg:col-span-7 flex flex-col">
          <DeliveryActivityChart metrics={metrics} darkMode={darkMode} />
        </div>
        <div className="lg:col-span-5 flex flex-col">
          <TicketDistributionChart
            metrics={metrics}
            intakeEnabled={project.intakeStateEnabled}
            darkMode={darkMode}
          />
        </div>
      </div>

      {/* Outstanding Human Decisions Queue */}
      <div className="sg-section-panel overflow-hidden">
        <div className="sg-metal-bar px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-300" aria-hidden="true" />
            <div>
              <h3 className="text-xs font-bold m-0">
                Human Decision Gate Queue — {project.code}
              </h3>
              <p className="text-[11px] opacity-80 m-0">
                Humans make decisions. Autonomous agents are strictly blocked from starting implementation on tickets with unanswered required decisions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {(['Pending', 'Resolved', 'All'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setDecisionFilter(tab)}
                className={`sg-btn text-[11px] py-1 px-2.5 ${
                  decisionFilter === tab ? 'sg-btn-primary' : ''
                }`}
              >
                <span>{tab}</span>
                <span className="font-mono text-[10px] opacity-85">
                  (
                  {tab === 'All'
                    ? projectDecisions.length
                    : projectDecisions.filter((d) => d.status === tab).length}
                  )
                </span>
              </button>
            ))}
          </div>
        </div>

        {visibleDecisions.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            <div className="text-xs font-bold">
              Zero {decisionFilter === 'All' ? '' : decisionFilter} Human Decisions for {project.code}
            </div>
            <p className="text-xs opacity-75 max-w-md mx-auto">
              All required architectural and product decisions have been answered. Assigned AI agents are unblocked for implementation.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="sg-table" aria-label="Project Human Decisions List">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Decision Question &amp; Context</th>
                  <th>Authoritative Decision Control</th>
                  <th>Assignee</th>
                  <th>Priority</th>
                  <th>Age</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleDecisions.map((dec) => {
                  const assocTicket = tickets.find((t) => t.id === dec.ticketId);
                  return (
                    <DecisionRowControl
                      key={`${dec.id}-v${dec.version}`}
                      decision={dec}
                      ticket={assocTicket}
                      serverClockUtc={metrics.serverClockUtc}
                      onSaveAnswer={onSaveDecision}
                    />
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
