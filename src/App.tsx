import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { pinnacleClient, WorkspaceStatePayload } from './api/client';
import { ProjectDirectoryView, ProjectSummaryDashboard } from './components/ProjectViews';
import { TicketListView, TicketDetailView } from './components/TicketViews';
import {
  ReleaseDirectoryView,
  ReleaseDetailView,
  AgentDirectoryView,
  AgentDetailView,
  GlobalDecisionsView,
  ActivityAuditView,
} from './components/ReleaseAndAgentViews';
import {
  CreateTicketModal,
  CreateProjectModal,
  CreateReleaseModal,
  ArchitectureAndCliModal,
} from './components/ModalsAndCli';
import {
  FolderKanban,
  ChevronRight,
  ChevronDown,
  Ticket as TicketIcon,
  ShieldAlert,
  Package,
  Bot,
  Activity,
  Search,
  Plus,
  Bell,
  Settings,
  Sun,
  Moon,
  Terminal,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  UserCheck,
  RefreshCw,
} from 'lucide-react';

function PinnacleWorkstationShell() {
  const location = useLocation();
  const navigate = useNavigate();

  const [state, setState] = useState<WorkspaceStatePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiConnected, setApiConnected] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Theme & Equalizer state (persisted in localStorage)
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('pinnacle_theme') === 'dark';
  });
  const [equalizerEnabled, setEqualizerEnabled] = useState<boolean>(() => {
    return localStorage.getItem('pinnacle_eq') !== 'off';
  });

  // Left Explorer Sidebar state (persisted)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('pinnacle_sidebar_collapsed') === 'true';
  });
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem('pinnacle_sidebar_width'));
    return saved >= 200 && saved <= 420 ? saved : 256;
  });
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('pinnacle_expanded_projects');
      return saved ? JSON.parse(saved) : { PIN: true, NXS: true, VLT: false };
    } catch {
      return { PIN: true, NXS: true };
    }
  });

  // Top Bar Popovers & Global Search
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  // Modals
  const [createTicketOpen, setCreateTicketOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createReleaseOpen, setCreateReleaseOpen] = useState(false);
  const [archCliOpen, setArchCliOpen] = useState(false);

  // Sync HTML theme class
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.remove('theme-light');
      root.classList.add('theme-dark');
      localStorage.setItem('pinnacle_theme', 'dark');
    } else {
      root.classList.remove('theme-dark');
      root.classList.add('theme-light');
      localStorage.setItem('pinnacle_theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('pinnacle_eq', equalizerEnabled ? 'on' : 'off');
  }, [equalizerEnabled]);

  useEffect(() => {
    localStorage.setItem('pinnacle_sidebar_collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const fetchState = useCallback(async () => {
    try {
      const data = await pinnacleClient.getWorkspaceState();
      setState(data);
      setApiConnected(true);
      setErrorBanner(null);
    } catch (err) {
      setApiConnected(false);
      setErrorBanner(err instanceof Error ? err.message : 'Disconnected from ConnectRPC server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Keyboard shortcut 'c' outside inputs to open Create Ticket
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setCreateTicketOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Derive active project code from URL
  const activeProjectCode = useMemo(() => {
    const match = location.pathname.match(/^\/projects\/([A-Z0-9_-]+)/i);
    if (match) return match[1].toUpperCase();
    return state?.projects[0]?.code || 'PIN';
  }, [location.pathname, state?.projects]);

  const toggleProjectExpand = (code: string) => {
    setExpandedProjects((prev) => {
      const next = { ...prev, [code]: !prev[code] };
      localStorage.setItem('pinnacle_expanded_projects', JSON.stringify(next));
      return next;
    });
  };

  // Sidebar drag resize handler
  const startSidebarResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.min(400, Math.max(210, startWidth + (moveEvent.clientX - startX)));
      setSidebarWidth(nextWidth);
      localStorage.setItem('pinnacle_sidebar_width', String(nextWidth));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Global search results
  const searchResults = useMemo(() => {
    if (!state || !globalSearch.trim()) return [];
    const q = globalSearch.toLowerCase();
    const items: { label: string; sub: string; path: string; kind: string }[] = [];

    for (const t of state.tickets) {
      if (t.id.toLowerCase().includes(q) || t.title.toLowerCase().includes(q)) {
        items.push({
          label: `${t.id} — ${t.title}`,
          sub: `${t.status} · ${t.assigneeName}`,
          path: `/projects/${t.projectCode}/tickets/${t.id}`,
          kind: 'TICKET',
        });
      }
    }
    for (const d of state.decisions) {
      if (d.id.toLowerCase().includes(q) || d.question.toLowerCase().includes(q)) {
        items.push({
          label: `${d.id} (${d.ticketId}) — ${d.question}`,
          sub: `Decision · ${d.status}`,
          path: `/projects/${d.projectCode}/tickets/${d.ticketId}`,
          kind: 'DECISION',
        });
      }
    }
    for (const r of state.releases) {
      if (r.version.includes(q) || r.name.toLowerCase().includes(q)) {
        items.push({
          label: `${r.projectCode} v${r.version} — ${r.name}`,
          sub: `Release · ${r.state}`,
          path: `/projects/${r.projectCode}/releases/${r.id}`,
          kind: 'RELEASE',
        });
      }
    }
    return items.slice(0, 8);
  }, [state, globalSearch]);

  // Breadcrumb segments
  const breadcrumbs = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    const crumbs: { id: string; label: string; to: string }[] = [
      { id: 'root-pinnacle', label: 'PINNACLE', to: '/' },
    ];
    let acc = '';
    parts.forEach((part, idx) => {
      acc += `/${part}`;
      crumbs.push({
        id: `crumb-${idx}-${acc}`,
        label: part.toUpperCase(),
        to: acc,
      });
    });
    return crumbs;
  }, [location.pathname]);

  if (loading && !state) {
    return (
      <div className="h-screen w-screen sg-chassis flex items-center justify-center p-6">
        <div className="sg-lcd-display p-6 max-w-md w-full text-center space-y-2">
          <div className="sg-lcd-readout text-base font-bold tracking-widest">
            INITIALIZING PINNACLE WORKSTATION...
          </div>
          <div className="font-mono text-xs opacity-80">
            Synchronizing ConnectRPC contracts, PostgreSQL ledger &amp; Ollama agent personas
          </div>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="h-screen w-screen sg-chassis flex items-center justify-center p-6">
        <div className="sg-section-panel p-6 max-w-md w-full space-y-3 text-center">
          <h1 className="text-base font-bold">ConnectRPC Synchronization Error</h1>
          <p className="text-xs opacity-80">{errorBanner || 'Unable to load workspace state.'}</p>
          <button type="button" onClick={fetchState} className="sg-btn sg-btn-primary">
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const runningAgentsCount = state.agents.filter(
    (a) => a.enabled && a.executionStatus === 'Running'
  ).length;
  const reviewingAgentsCount = state.agents.filter(
    (a) => a.enabled && a.executionStatus === 'Reviewing'
  ).length;
  const pendingDecisionsList = state.decisions.filter((d) => d.status === 'Pending');

  // Action Handlers
  const handleSaveDecision = async (
    decisionId: string,
    answer: string | boolean,
    expectedVersion: number
  ) => {
    await pinnacleClient.answerDecision({
      decisionId,
      answer,
      expectedVersion,
      actorName: state.session.user.name,
    });
    await fetchState();
  };

  const handleUpdateProject = async (
    code: string,
    patch: { name?: string; description?: string; active?: boolean; intakeStateEnabled?: boolean }
  ) => {
    await pinnacleClient.updateProjectSettings(code, patch);
    await fetchState();
  };

  return (
    <div className="h-screen w-screen flex flex-col sg-chassis select-none overflow-hidden">
      {/* 1. TOP APPLICATION BAR (Dark Metallic Silverglass Title Bar) */}
      <header className="sg-titlebar h-11 px-3 flex items-center justify-between gap-3 shrink-0 z-30">
        {/* Left Zone: Identity + Project Selector + Breadcrumb */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            className="sg-icon-btn w-7 h-7"
            aria-label={sidebarCollapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-3.5 h-3.5" />
            ) : (
              <PanelLeftClose className="w-3.5 h-3.5" />
            )}
          </button>

          <Link
            to={`/projects/${activeProjectCode}/summary`}
            className="flex items-center gap-2 text-white no-underline shrink-0"
          >
            <span className="w-2.5 h-2.5 rotate-45 bg-[#c5ddff] border border-[#102344] inline-block" />
            <span className="font-extrabold tracking-[0.14em] text-xs whitespace-nowrap">
              PINNACLE
            </span>
          </Link>

          <div className="hidden 2xl:block w-6 sg-grip-rail shrink-0" aria-hidden="true" />

          {/* Current Project Selector */}
          <select
            aria-label="Current Project Selector"
            value={activeProjectCode}
            onChange={(e) => navigate(`/projects/${e.target.value}/summary`)}
            className="sg-select text-xs font-mono font-bold py-1 pl-2.5 pr-7 h-7 shrink-0"
          >
            {state.projects.map((p) => (
              <option key={p.code} value={p.code}>
                {p.code} · {p.name}
              </option>
            ))}
          </select>

          {/* Breadcrumb Trail */}
          <nav
            aria-label="Breadcrumb"
            className="hidden lg:flex items-center gap-1 text-[11px] font-mono text-[#dcecff] min-w-0 overflow-hidden"
          >
            {breadcrumbs.slice(-3).map((crumb, idx) => (
              <React.Fragment key={crumb.id}>
                {idx > 0 && <ChevronRight className="w-3 h-3 opacity-60 shrink-0" />}
                <Link
                  to={crumb.to}
                  className="hover:underline text-[#dcecff] whitespace-nowrap shrink-0"
                >
                  {crumb.label}
                </Link>
              </React.Fragment>
            ))}
          </nav>
        </div>

        {/* Center Zone: Global Search */}
        <div className="relative w-52 xl:w-64 shrink-0 hidden sm:block">
          <Search
            className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Global search across tickets, decisions, and releases"
            value={globalSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="Search ID (PIN-1, DEC-101)..."
            className="sg-well-input sg-search-input w-full py-1 h-7 text-xs"
          />
          {searchFocused && searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-8 sg-workspace-leaf p-1.5 z-50 shadow-xl space-y-1">
              {searchResults.map((item) => (
                <button
                  key={item.path + item.label}
                  type="button"
                  onMouseDown={() => {
                    navigate(item.path);
                    setGlobalSearch('');
                  }}
                  className="w-full text-left p-1.5 rounded hover:bg-[var(--background-modifier-hover)] flex items-center justify-between gap-2 text-xs"
                >
                  <div className="truncate">
                    <div className="font-semibold truncate">{item.label}</div>
                    <div className="text-[10.5px] opacity-75">{item.sub}</div>
                  </div>
                  <span className="font-mono text-[10px] opacity-75 shrink-0">{item.kind}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Zone: Create Ticket, Active Agent Indicator, CLI, Theme, Notifications, Account */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setCreateTicketOpen(true)}
            className="sg-btn py-1 px-3 h-7 text-xs font-bold"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Create Ticket</span>
          </button>

          {/* Active Agent Indicator */}
          <Link
            to="/agents"
            className="hidden lg:inline-flex sg-btn py-1 px-2.5 h-7 text-[11px] font-mono no-underline"
            title="Active Autonomous Agents"
          >
            <Bot className="w-3.5 h-3.5 text-sky-700 dark:text-sky-300" aria-hidden="true" />
            <span>
              {runningAgentsCount} Run · {reviewingAgentsCount} Rev
            </span>
          </Link>

          {/* CLI & Contracts Console Button */}
          <button
            type="button"
            onClick={() => setArchCliOpen(true)}
            className="sg-btn py-1 px-2.5 h-7 text-[11px] font-mono"
            title="Open Pinnacle CLI & ConnectRPC / FastMCP Contracts"
          >
            <Terminal className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden md:inline">CLI &amp; MCP</span>
          </button>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowNotifications((prev) => !prev);
                setShowAccountMenu(false);
              }}
              className="sg-icon-btn w-7 h-7 relative"
              aria-label={`Notifications (${pendingDecisionsList.length} pending decisions)`}
            >
              <Bell className="w-3.5 h-3.5" />
              {pendingDecisionsList.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 font-mono font-bold text-[9px] rounded-full px-1 leading-tight">
                  {pendingDecisionsList.length}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-9 w-80 sg-workspace-leaf p-3 z-50 shadow-xl space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-[var(--background-modifier-border)] pb-1.5 font-bold">
                  <span>Pending Decision Alerts ({pendingDecisionsList.length})</span>
                  <button
                    type="button"
                    onClick={() => setShowNotifications(false)}
                    className="text-[11px] underline"
                  >
                    Close
                  </button>
                </div>
                {pendingDecisionsList.length === 0 ? (
                  <div className="py-3 text-center opacity-75">Zero unresolved human decisions.</div>
                ) : (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {pendingDecisionsList.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          setShowNotifications(false);
                          navigate(`/projects/${d.projectCode}/tickets/${d.ticketId}`);
                        }}
                        className="w-full text-left p-2 rounded border border-[var(--background-modifier-border)] bg-[var(--background-primary-alt)] hover:bg-[var(--background-modifier-hover)]"
                      >
                        <div className="font-mono font-bold text-[var(--text-accent)]">
                          {d.id} Blocks {d.ticketId}
                        </div>
                        <div className="truncate mt-0.5">{d.question}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Light Silver / Dark Gunmetal Mode Toggle */}
          <button
            type="button"
            onClick={() => setDarkMode((prev) => !prev)}
            className="sg-icon-btn w-7 h-7"
            aria-label={darkMode ? 'Switch to Light Silver theme' : 'Switch to Dark Gunmetal theme'}
            title={darkMode ? 'Light Silver Mode' : 'Dark Gunmetal Mode'}
          >
            {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          {/* User Avatar & Account Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowAccountMenu((prev) => !prev);
                setShowNotifications(false);
              }}
              className="sg-btn py-1 px-2.5 h-7 text-xs font-semibold"
              aria-label="Operator Account Menu"
            >
              <span className="font-mono font-bold">EV</span>
              <span className="hidden xl:inline">Elena Vance</span>
            </button>

            {showAccountMenu && (
              <div className="absolute right-0 top-9 w-64 sg-workspace-leaf p-3 z-50 shadow-xl space-y-2 text-xs">
                <div className="border-b border-[var(--background-modifier-border)] pb-2">
                  <div className="font-bold">{state.session.user.name}</div>
                  <div className="text-[11px] opacity-80">{state.session.user.role}</div>
                  <div className="font-mono text-[10.5px] opacity-70 truncate">
                    {state.session.user.email}
                  </div>
                </div>
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEqualizerEnabled((prev) => !prev);
                      setShowAccountMenu(false);
                    }}
                    className="sg-btn w-full justify-between text-xs"
                  >
                    <span>Status Bar Equalizer</span>
                    <span className="font-mono">{equalizerEnabled ? 'ON' : 'OFF'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAccountMenu(false);
                      setArchCliOpen(true);
                    }}
                    className="sg-btn w-full justify-between text-xs"
                  >
                    <span>Inspect Signed JWT &amp; CLI</span>
                    <Terminal className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. BODY: LEFT NAVIGATION TREE + MAIN WORKSPACE */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Navigation Tree (Silverglass Obsidian Explorer) */}
        {!sidebarCollapsed && (
          <aside
            style={{ width: `${sidebarWidth}px` }}
            className="sg-chassis border-r border-[var(--sg-edge)] flex flex-col shrink-0 select-none relative"
            aria-label="Primary Workstation Navigation"
          >
            {/* Explorer Action Bar */}
            <div className="sg-metal-bar px-3 py-1.5 flex items-center justify-between">
              <span className="font-mono font-bold text-[11px] tracking-wider uppercase">
                PINNACLE EXPLORER
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCreateProjectOpen(true)}
                  className="sg-icon-btn w-6 h-6"
                  aria-label="Create new project"
                  title="New Project"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={fetchState}
                  className="sg-icon-btn w-6 h-6"
                  aria-label="Synchronize workspace state"
                  title="Sync Now"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Hierarchical Tree Navigation */}
            <div className="p-2 flex-1 overflow-y-auto space-y-3">
              {/* Projects Section */}
              <div>
                <div className="px-2 py-1 flex items-center justify-between text-[11px] font-mono font-bold opacity-75 uppercase">
                  <span>Projects</span>
                  <Link to="/projects" className="hover:underline text-[10.5px]">
                    Directory
                  </Link>
                </div>

                <div className="space-y-1 mt-0.5">
                  {state.projects.map((proj) => {
                    const isExpanded = Boolean(expandedProjects[proj.code]);
                    const projPendingDecisions = state.decisions.filter(
                      (d) => d.projectCode === proj.code && d.status === 'Pending'
                    ).length;
                    const projTicketCount = state.tickets.filter(
                      (t) => t.projectCode === proj.code
                    ).length;

                    return (
                      <div key={proj.id} className="space-y-0.5">
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => toggleProjectExpand(proj.code)}
                            className="p-1 rounded hover:bg-[var(--background-modifier-hover)] text-[var(--text-normal)] bg-transparent border-0 cursor-pointer"
                            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${proj.code} tree`}
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!isExpanded) toggleProjectExpand(proj.code);
                              navigate(`/projects/${proj.code}/summary`);
                            }}
                            className={`sg-nav-item py-1 px-2 ${
                              location.pathname.startsWith(`/projects/${proj.code}`) &&
                              !isExpanded
                                ? 'is-active'
                                : ''
                            }`}
                          >
                            <span className="font-mono font-bold text-xs">
                              {proj.code} — {proj.name.split(' ')[0]}
                            </span>
                            {projPendingDecisions > 0 && (
                              <span className="font-mono text-[10px] font-bold text-amber-800 dark:text-amber-300">
                                !{projPendingDecisions}
                              </span>
                            )}
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="pl-5 pr-1 space-y-0.5 border-l border-[var(--background-modifier-border)] ml-2.5">
                            <button
                              type="button"
                              onClick={() => navigate(`/projects/${proj.code}/summary`)}
                              className={`sg-nav-item py-1 px-2 text-xs ${
                                location.pathname === `/projects/${proj.code}/summary`
                                  ? 'is-active'
                                  : ''
                              }`}
                            >
                              <span className="inline-flex items-center gap-1.5">
                                <LayoutDashboard className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Summary</span>
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => navigate(`/projects/${proj.code}/tickets`)}
                              className={`sg-nav-item py-1 px-2 text-xs ${
                                location.pathname.startsWith(`/projects/${proj.code}/tickets`)
                                  ? 'is-active'
                                  : ''
                              }`}
                            >
                              <span className="inline-flex items-center gap-1.5">
                                <TicketIcon className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Tickets</span>
                              </span>
                              <span className="font-mono text-[10.5px] opacity-80">
                                {projTicketCount}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => navigate(`/projects/${proj.code}/releases`)}
                              className={`sg-nav-item py-1 px-2 text-xs ${
                                location.pathname.startsWith(`/projects/${proj.code}/releases`)
                                  ? 'is-active'
                                  : ''
                              }`}
                            >
                              <span className="inline-flex items-center gap-1.5">
                                <Package className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Releases</span>
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => navigate(`/projects/${proj.code}/decisions`)}
                              className={`sg-nav-item py-1 px-2 text-xs ${
                                location.pathname === `/projects/${proj.code}/decisions`
                                  ? 'is-active'
                                  : ''
                              }`}
                            >
                              <span className="inline-flex items-center gap-1.5">
                                <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Decisions</span>
                              </span>
                              {projPendingDecisions > 0 && (
                                <span className="font-mono text-[10.5px] font-bold">
                                  {projPendingDecisions}
                                </span>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => navigate(`/projects/${proj.code}/agents`)}
                              className={`sg-nav-item py-1 px-2 text-xs ${
                                location.pathname === `/projects/${proj.code}/agents`
                                  ? 'is-active'
                                  : ''
                              }`}
                            >
                              <span className="inline-flex items-center gap-1.5">
                                <Bot className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Agents</span>
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Global Workstation Views */}
              <div className="pt-2 border-t border-[var(--background-modifier-border)] space-y-0.5">
                <div className="px-2 py-1 text-[11px] font-mono font-bold opacity-75 uppercase">
                  Global Views
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/projects')}
                  className={`sg-nav-item ${location.pathname === '/projects' ? 'is-active' : ''}`}
                >
                  <span className="inline-flex items-center gap-2">
                    <FolderKanban className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>All Projects</span>
                  </span>
                  <span className="font-mono text-[11px]">{state.projects.length}</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/my-tickets')}
                  className={`sg-nav-item ${
                    location.pathname === '/my-tickets' ? 'is-active' : ''
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>My Tickets</span>
                  </span>
                  <span className="font-mono text-[11px]">
                    {state.tickets.filter((t) => t.assigneeName.includes('Elena')).length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/decisions')}
                  className={`sg-nav-item ${location.pathname === '/decisions' ? 'is-active' : ''}`}
                >
                  <span className="inline-flex items-center gap-2">
                    <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Decisions</span>
                  </span>
                  <span className="font-mono text-[11px] font-bold">
                    {pendingDecisionsList.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/releases')}
                  className={`sg-nav-item ${location.pathname === '/releases' ? 'is-active' : ''}`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Package className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Releases</span>
                  </span>
                  <span className="font-mono text-[11px]">{state.releases.length}</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/agents')}
                  className={`sg-nav-item ${
                    location.pathname.startsWith('/agents') ? 'is-active' : ''
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Bot className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Agents</span>
                  </span>
                  <span className="font-mono text-[11px]">{state.agents.length}</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/activity')}
                  className={`sg-nav-item ${location.pathname === '/activity' ? 'is-active' : ''}`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Activity</span>
                  </span>
                </button>
              </div>
            </div>

            {/* Vault / Workstation Profile Footer */}
            <div className="sg-metal-bar px-3 py-2 border-t border-[var(--sg-edge)] flex items-center justify-between text-[11px] font-mono">
              <span className="truncate font-bold">@Pinnacle-Core</span>
              <button
                type="button"
                onClick={() => setArchCliOpen(true)}
                className="sg-icon-btn w-6 h-6"
                aria-label="Open CLI and Architecture Settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Resize Drag Handle */}
            <div
              onMouseDown={startSidebarResize}
              className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--interactive-accent)]"
              title="Drag to resize navigation sidebar"
            />
          </aside>
        )}

        {/* Main Workspace Leaf */}
        <main className="flex-1 min-w-0 p-2 flex flex-col overflow-hidden">
          <div className="sg-workspace-leaf flex-1 flex flex-col overflow-hidden">
            {/* Workspace Leaf Header Bar */}
            <div className="sg-metal-bar px-4 py-2 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 text-xs font-bold truncate">
                <span className="font-mono text-[var(--text-accent)]">
                  [{activeProjectCode}]
                </span>
                <span aria-hidden="true">·</span>
                <span className="truncate">
                  Humans make decisions. Agents execute work. Pinnacle maintains the authoritative record.
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setCreateReleaseOpen(true)}
                  className="sg-btn text-[11px] py-1 px-2.5"
                >
                  <Package className="w-3 h-3" aria-hidden="true" />
                  <span>New Release</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCreateProjectOpen(true)}
                  className="sg-btn text-[11px] py-1 px-2.5"
                >
                  <FolderKanban className="w-3 h-3" aria-hidden="true" />
                  <span>New Project</span>
                </button>
              </div>
            </div>

            {/* Scrollable Route Content */}
            <div className="flex-1 overflow-y-auto p-4 select-text">
              <Routes>
                <Route path="/" element={<Navigate to="/projects/PIN/summary" replace />} />

                <Route
                  path="/projects"
                  element={
                    <ProjectDirectoryView
                      projects={state.projects}
                      tickets={state.tickets}
                      decisions={state.decisions}
                      onOpenCreateProject={() => setCreateProjectOpen(true)}
                      onUpdateProject={handleUpdateProject}
                    />
                  }
                />

                <Route
                  path="/projects/:projectCode/summary"
                  element={
                    <ProjectSummaryRoute
                      state={state}
                      darkMode={darkMode}
                      onSaveDecision={handleSaveDecision}
                      onUpdateProject={handleUpdateProject}
                    />
                  }
                />

                <Route
                  path="/projects/:projectCode/tickets"
                  element={
                    <ProjectTicketsRoute
                      state={state}
                      onOpenCreateTicket={() => setCreateTicketOpen(true)}
                    />
                  }
                />

                <Route
                  path="/projects/:projectCode/tickets/:ticketId"
                  element={
                    <ProjectTicketDetailRoute
                      state={state}
                      onRefresh={fetchState}
                      onSaveDecision={handleSaveDecision}
                    />
                  }
                />

                <Route
                  path="/projects/:projectCode/releases"
                  element={
                    <ProjectReleasesRoute
                      state={state}
                      onOpenCreateRelease={() => setCreateReleaseOpen(true)}
                    />
                  }
                />

                <Route
                  path="/projects/:projectCode/releases/:releaseId"
                  element={
                    <ProjectReleaseDetailRoute
                      state={state}
                      onRefresh={fetchState}
                    />
                  }
                />

                <Route
                  path="/projects/:projectCode/decisions"
                  element={
                    <ProjectDecisionsRoute
                      state={state}
                      onSaveDecision={handleSaveDecision}
                    />
                  }
                />

                <Route
                  path="/projects/:projectCode/agents"
                  element={
                    <ProjectAgentsRoute
                      state={state}
                      onRefresh={fetchState}
                    />
                  }
                />

                <Route
                  path="/my-tickets"
                  element={
                    <TicketListView
                      title="My Assigned Tickets (Elena Vance)"
                      subtitle="Human-assigned engineering tickets requiring implementation or validation review"
                      tickets={state.tickets.filter((t) =>
                        t.assigneeName.toLowerCase().includes('elena')
                      )}
                      decisions={state.decisions}
                      onOpenCreateTicket={() => setCreateTicketOpen(true)}
                    />
                  }
                />

                <Route
                  path="/decisions"
                  element={
                    <GlobalDecisionsView
                      title="Global Human Decisions Queue (All Projects)"
                      decisions={state.decisions}
                      tickets={state.tickets}
                      serverClockUtc={state.serverClockUtc}
                      onSaveDecision={handleSaveDecision}
                    />
                  }
                />

                <Route
                  path="/releases"
                  element={
                    <ReleaseDirectoryView
                      title="Global Release Trains (All Projects)"
                      releases={state.releases}
                      tickets={state.tickets}
                      decisions={state.decisions}
                      onOpenCreateRelease={() => setCreateReleaseOpen(true)}
                    />
                  }
                />

                <Route
                  path="/agents"
                  element={
                    <AgentDirectoryView
                      agents={state.agents}
                      onToggleAgentEnabled={async (id, enabled) => {
                        await pinnacleClient.updateAgentConfig(id, { enabled });
                        await fetchState();
                      }}
                    />
                  }
                />

                <Route
                  path="/agents/:agentId"
                  element={
                    <AgentDetailRoute
                      state={state}
                      onRefresh={fetchState}
                    />
                  }
                />

                <Route
                  path="/activity"
                  element={<ActivityAuditView auditLog={state.auditLog} />}
                />

                <Route path="*" element={<Navigate to="/projects/PIN/summary" replace />} />
              </Routes>
            </div>
          </div>
        </main>
      </div>

      {/* 3. BOTTOM STATUS BAR (Silverglass Desktop Status Bar with Blue-Glass Equalizer) */}
      <footer
        className="sg-metal-bar h-7 px-3 border-t border-[var(--sg-edge)] flex items-center justify-between gap-3 text-[11px] font-mono shrink-0"
        aria-label="Workstation Operational Status Bar"
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Decorative Blue-Glass Equalizer (Click to pause/resume) */}
          <button
            type="button"
            onClick={() => setEqualizerEnabled((prev) => !prev)}
            className={`sg-equalizer-box cursor-pointer ${
              !equalizerEnabled ? 'sg-eq-paused opacity-60' : ''
            }`}
            aria-label={
              equalizerEnabled
                ? 'Pause decorative Silverglass spectrum equalizer'
                : 'Resume decorative Silverglass spectrum equalizer'
            }
            title="Decorative Silverglass Spectrum (Click to toggle)"
          >
            <span className="sg-eq-bar" />
            <span className="sg-eq-bar" />
            <span className="sg-eq-bar" />
            <span className="sg-eq-bar" />
            <span className="sg-eq-bar" />
            <span className="sg-eq-bar" />
            <span className="sg-eq-bar" />
            <span className="sg-eq-bar" />
            <span className="sg-eq-bar" />
            <span className="sg-eq-bar" />
          </button>

          <span className="font-bold whitespace-nowrap">
            PROJECT: {activeProjectCode}
          </span>
          <span aria-hidden="true" className="opacity-50">|</span>
          <span className="whitespace-nowrap">
            API: {apiConnected ? 'CONNECTED (ConnectRPC/1.0)' : 'DISCONNECTED'}
          </span>
          <span aria-hidden="true" className="opacity-50 hidden sm:inline">|</span>
          <span className="whitespace-nowrap hidden sm:inline">
            AGENTS: {runningAgentsCount} RUNNING · {reviewingAgentsCount} REVIEWING
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0 tabular-nums">
          <Link
            to="/decisions"
            className="font-bold hover:underline whitespace-nowrap text-[var(--text-normal)]"
          >
            PENDING DECISIONS: {pendingDecisionsList.length}
          </Link>
          <span aria-hidden="true" className="opacity-50 hidden md:inline">|</span>
          <span className="whitespace-nowrap hidden md:inline opacity-85">
            LAST SYNC: {state.serverClockUtc.slice(0, 19).replace('T', ' ')}Z
          </span>
        </div>
      </footer>

      {/* Modals */}
      <CreateTicketModal
        open={createTicketOpen}
        onClose={() => setCreateTicketOpen(false)}
        projects={state.projects}
        releases={state.releases}
        agents={state.agents}
        defaultProjectCode={activeProjectCode}
        onCreateTicket={async (input) => {
          const res = await pinnacleClient.createTicket(input);
          await fetchState();
          navigate(`/projects/${res.ticket.projectCode}/tickets/${res.ticket.id}`);
        }}
      />

      <CreateProjectModal
        open={createProjectOpen}
        onClose={() => setCreateProjectOpen(false)}
        onCreateProject={async (input) => {
          const res = await pinnacleClient.createProject(input);
          await fetchState();
          navigate(`/projects/${res.project.code}/summary`);
        }}
      />

      <CreateReleaseModal
        open={createReleaseOpen}
        onClose={() => setCreateReleaseOpen(false)}
        projects={state.projects}
        tickets={state.tickets}
        defaultProjectCode={activeProjectCode}
        onCreateRelease={async (input) => {
          const res = await pinnacleClient.createRelease(input);
          await fetchState();
          navigate(`/projects/${res.release.projectCode}/releases/${res.release.id}`);
        }}
      />

      <ArchitectureAndCliModal
        open={archCliOpen}
        onClose={() => setArchCliOpen(false)}
        sessionToken={state.session.token}
        contracts={state.contracts}
        onExecuteCli={(cmd, fmt) => pinnacleClient.executeCliCommand(cmd, fmt)}
      />
    </div>
  );
}

// Route Wrappers for URL Parameterized Deep Linking
const ProjectSummaryRoute: React.FC<{
  state: WorkspaceStatePayload;
  darkMode: boolean;
  onSaveDecision: (decisionId: string, answer: string | boolean, expectedVersion: number) => Promise<void>;
  onUpdateProject: (
    code: string,
    patch: { name?: string; description?: string; active?: boolean; intakeStateEnabled?: boolean }
  ) => Promise<void>;
}> = ({ state, darkMode, onSaveDecision, onUpdateProject }) => {
  const { projectCode } = useParams<{ projectCode: string }>();
  const code = (projectCode || 'PIN').toUpperCase();
  const project = state.projects.find((p) => p.code === code) || state.projects[0];
  const metrics = state.projectMetrics[project.code];
  const projTickets = state.tickets.filter((t) => t.projectCode === project.code);

  return (
    <ProjectSummaryDashboard
      project={project}
      metrics={metrics}
      tickets={projTickets}
      decisions={state.decisions}
      darkMode={darkMode}
      onSaveDecision={onSaveDecision}
      onUpdateProject={onUpdateProject}
    />
  );
};

const ProjectTicketsRoute: React.FC<{
  state: WorkspaceStatePayload;
  onOpenCreateTicket: () => void;
}> = ({ state, onOpenCreateTicket }) => {
  const { projectCode } = useParams<{ projectCode: string }>();
  const code = (projectCode || 'PIN').toUpperCase();
  const project = state.projects.find((p) => p.code === code) || state.projects[0];
  const projTickets = state.tickets.filter((t) => t.projectCode === project.code);

  return (
    <TicketListView
      title={`${project.code} — ${project.name} Tickets`}
      subtitle={`Authoritative backlog and validation queue for ${project.code} (${projTickets.length} tickets)`}
      tickets={projTickets}
      decisions={state.decisions}
      onOpenCreateTicket={onOpenCreateTicket}
    />
  );
};

const ProjectTicketDetailRoute: React.FC<{
  state: WorkspaceStatePayload;
  onRefresh: () => Promise<void>;
  onSaveDecision: (decisionId: string, answer: string | boolean, expectedVersion: number) => Promise<void>;
}> = ({ state, onRefresh, onSaveDecision }) => {
  const { ticketId } = useParams<{ ticketId: string }>();
  const ticket =
    state.tickets.find((t) => t.id.toUpperCase() === (ticketId || '').toUpperCase()) ||
    state.tickets[0];

  return (
    <TicketDetailView
      ticket={ticket}
      decisions={state.decisions}
      releases={state.releases}
      agents={state.agents}
      auditLog={state.auditLog}
      serverClockUtc={state.serverClockUtc}
      onTransitionStatus={async (targetStatus) => {
        await pinnacleClient.transitionTicketStatus({
          ticketId: ticket.id,
          targetStatus,
          actorName: state.session.user.name,
          actorType: 'Human',
        });
        await onRefresh();
      }}
      onUpdateTicket={async (patch) => {
        await pinnacleClient.updateTicket(ticket.id, patch);
        await onRefresh();
      }}
      onSaveDecision={onSaveDecision}
      onRunAgentEvaluation={async (agentId, tId) => {
        await pinnacleClient.evaluateTicketWithAgent(agentId, tId);
        await onRefresh();
      }}
    />
  );
};

const ProjectReleasesRoute: React.FC<{
  state: WorkspaceStatePayload;
  onOpenCreateRelease: () => void;
}> = ({ state, onOpenCreateRelease }) => {
  const { projectCode } = useParams<{ projectCode: string }>();
  const code = (projectCode || 'PIN').toUpperCase();
  const projectReleases = state.releases.filter((r) => r.projectCode === code);

  return (
    <ReleaseDirectoryView
      title={`${code} — SemVer Release Trains`}
      releases={projectReleases}
      tickets={state.tickets}
      decisions={state.decisions}
      onOpenCreateRelease={onOpenCreateRelease}
    />
  );
};

const ProjectReleaseDetailRoute: React.FC<{
  state: WorkspaceStatePayload;
  onRefresh: () => Promise<void>;
}> = ({ state, onRefresh }) => {
  const { releaseId } = useParams<{ releaseId: string }>();
  const release =
    state.releases.find((r) => r.id === releaseId || r.version === releaseId) ||
    state.releases[0];
  const projectTickets = state.tickets.filter((t) => t.projectCode === release.projectCode);

  return (
    <ReleaseDetailView
      release={release}
      projectTickets={projectTickets}
      decisions={state.decisions}
      onUpdateRelease={async (id, patch) => {
        await pinnacleClient.updateRelease(id, patch);
        await onRefresh();
      }}
    />
  );
};

const ProjectDecisionsRoute: React.FC<{
  state: WorkspaceStatePayload;
  onSaveDecision: (decisionId: string, answer: string | boolean, expectedVersion: number) => Promise<void>;
}> = ({ state, onSaveDecision }) => {
  const { projectCode } = useParams<{ projectCode: string }>();
  const code = (projectCode || 'PIN').toUpperCase();
  const projDecisions = state.decisions.filter((d) => d.projectCode === code);

  return (
    <GlobalDecisionsView
      title={`${code} — Project Human Decisions Queue`}
      decisions={projDecisions}
      tickets={state.tickets}
      serverClockUtc={state.serverClockUtc}
      onSaveDecision={onSaveDecision}
    />
  );
};

const ProjectAgentsRoute: React.FC<{
  state: WorkspaceStatePayload;
  onRefresh: () => Promise<void>;
}> = ({ state, onRefresh }) => {
  const { projectCode } = useParams<{ projectCode: string }>();
  const code = (projectCode || 'PIN').toUpperCase();
  const projAgents = state.agents.filter((a) => a.projectCodes.includes(code));

  return (
    <AgentDirectoryView
      agents={projAgents.length > 0 ? projAgents : state.agents}
      onToggleAgentEnabled={async (id, enabled) => {
        await pinnacleClient.updateAgentConfig(id, { enabled });
        await onRefresh();
      }}
    />
  );
};

const AgentDetailRoute: React.FC<{
  state: WorkspaceStatePayload;
  onRefresh: () => Promise<void>;
}> = ({ state, onRefresh }) => {
  const { agentId } = useParams<{ agentId: string }>();
  const agent = state.agents.find((a) => a.id === agentId) || state.agents[0];

  return (
    <AgentDetailView
      agent={agent}
      tickets={state.tickets}
      onUpdateAgent={async (id, patch) => {
        await pinnacleClient.updateAgentConfig(id, patch);
        await onRefresh();
      }}
      onRunEvaluation={async (id, tId) => {
        await pinnacleClient.evaluateTicketWithAgent(id, tId);
        await onRefresh();
      }}
    />
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <PinnacleWorkstationShell />
    </BrowserRouter>
  );
}
