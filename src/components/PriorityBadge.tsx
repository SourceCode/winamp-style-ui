import React from 'react';
import {
  AlertOctagon,
  Flame,
  AlertTriangle,
  ArrowUpRight,
  Wrench,
  Sparkles,
  Bot,
  User,
} from 'lucide-react';
import { PriorityCode, PRIORITY_CATALOG, TicketStatus } from '../domain/contracts';

export const PriorityBadge: React.FC<{
  priority: PriorityCode;
  showOrder?: boolean;
}> = ({ priority, showOrder = false }) => {
  const meta = PRIORITY_CATALOG[priority] || PRIORITY_CATALOG[PriorityCode.P2_ENHANCEMENT];

  const getIconAndTone = () => {
    switch (priority) {
      case PriorityCode.P1_DEFECT:
        return {
          icon: <AlertOctagon className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" aria-hidden="true" />,
          textClass: 'text-red-800 dark:text-red-300 font-bold',
        };
      case PriorityCode.P1_ENHANCEMENT:
        return {
          icon: <Flame className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />,
          textClass: 'text-amber-900 dark:text-amber-300 font-bold',
        };
      case PriorityCode.P2_DEFECT:
        return {
          icon: <AlertTriangle className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400 shrink-0" aria-hidden="true" />,
          textClass: 'text-orange-900 dark:text-orange-300 font-semibold',
        };
      case PriorityCode.P2_ENHANCEMENT:
        return {
          icon: <ArrowUpRight className="w-3.5 h-3.5 text-sky-700 dark:text-sky-300 shrink-0" aria-hidden="true" />,
          textClass: 'text-sky-900 dark:text-sky-200 font-semibold',
        };
      case PriorityCode.P3_DEFECT:
        return {
          icon: <Wrench className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300 shrink-0" aria-hidden="true" />,
          textClass: 'text-slate-700 dark:text-slate-300 font-medium',
        };
      case PriorityCode.P3_ENHANCEMENT:
      default:
        return {
          icon: <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300 shrink-0" aria-hidden="true" />,
          textClass: 'text-slate-600 dark:text-slate-400 font-medium',
        };
    }
  };

  const { icon, textClass } = getIconAndTone();

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs whitespace-nowrap shrink-0 ${textClass}`}
      title={`${meta.classification} (${meta.display}): ${meta.description}`}
    >
      {icon}
      <span>{meta.classification}</span>
      <span aria-hidden="true" className="opacity-60">·</span>
      <span className="font-mono text-[11px]">{meta.display}</span>
      {showOrder && (
        <>
          <span aria-hidden="true" className="opacity-60">·</span>
          <span className="font-mono text-[11px] opacity-80">#{meta.order}</span>
        </>
      )}
    </span>
  );
};

export const StatusLabel: React.FC<{ status: TicketStatus }> = ({ status }) => {
  const toneMap: Record<TicketStatus, string> = {
    Created: 'text-slate-600 dark:text-slate-300',
    Backlog: 'text-slate-800 dark:text-slate-200',
    'In Progress': 'text-sky-800 dark:text-sky-300 font-semibold',
    'In Review': 'text-amber-800 dark:text-amber-300 font-semibold',
    Done: 'text-emerald-800 dark:text-emerald-300 font-semibold',
  };

  const symbolMap: Record<TicketStatus, string> = {
    Created: '○',
    Backlog: '◇',
    'In Progress': '▶',
    'In Review': '◈',
    Done: '✓',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs whitespace-nowrap shrink-0 ${toneMap[status]}`}>
      <span className="font-mono" aria-hidden="true">{symbolMap[status]}</span>
      <span>{status}</span>
    </span>
  );
};

export const AssigneeLabel: React.FC<{
  name: string;
  type: 'Human' | 'Agent';
}> = ({ name, type }) => {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap shrink-0">
      {type === 'Agent' ? (
        <Bot className="w-3.5 h-3.5 text-sky-700 dark:text-sky-300 shrink-0" aria-label="Autonomous Agent" />
      ) : (
        <User className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300 shrink-0" aria-label="Human Developer" />
      )}
      <span className="truncate max-w-[165px] font-medium">{name}</span>
      <span aria-hidden="true" className="opacity-50">·</span>
      <span className="font-mono text-[11px] opacity-75">{type}</span>
    </span>
  );
};
