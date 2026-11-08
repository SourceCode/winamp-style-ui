import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { TicketDecision, Ticket } from '../domain/contracts';
import { PriorityBadge } from './PriorityBadge';
import { Check, AlertCircle, Clock } from 'lucide-react';

export function formatDecisionAge(createdAtIso: string, referenceUtcIso: string): string {
  const diffMs = Math.max(0, new Date(referenceUtcIso).getTime() - new Date(createdAtIso).getTime());
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 24) {
    return `${Math.max(1, hours)}h`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days}d ${remHours}h`;
}

export const DecisionRowControl: React.FC<{
  decision: TicketDecision;
  ticket?: Ticket;
  serverClockUtc: string;
  onSaveAnswer: (decisionId: string, answer: string | boolean, expectedVersion: number) => Promise<void>;
}> = ({ decision, ticket, serverClockUtc, onSaveAnswer }) => {
  const [draftAnswer, setDraftAnswer] = useState<string | boolean>(() => {
    if (decision.answer !== null && decision.answer !== undefined) {
      return decision.answer;
    }
    if (decision.inputType === 'checkbox') {
      return false;
    }
    return '';
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSavedSuccess(false);

    if (decision.inputType !== 'checkbox') {
      if (typeof draftAnswer !== 'string' || draftAnswer.trim().length === 0) {
        setErrorMsg('Required decision field cannot be empty.');
        return;
      }
    } else if (decision.required && draftAnswer !== true) {
      setErrorMsg('You must confirm the checkbox to authorize this decision gate.');
      return;
    }

    try {
      setSaving(true);
      await onSaveAnswer(decision.id, draftAnswer, decision.version);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save decision');
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr>
      <td className="whitespace-nowrap">
        <div className="flex flex-col gap-0.5">
          <Link
            to={`/projects/${decision.projectCode}/tickets/${decision.ticketId}`}
            className="font-mono font-bold text-[var(--text-accent)] hover:underline"
          >
            {decision.ticketId}
          </Link>
          <span className="text-[11px] opacity-80 truncate max-w-[145px]" title={ticket?.title}>
            {ticket?.title || 'Associated Ticket'}
          </span>
        </div>
      </td>
      <td className="max-w-[290px]">
        <div className="flex flex-col gap-1">
          <div className="font-semibold text-xs leading-snug">
            <span className="font-mono text-[11px] opacity-75 mr-1.5">[{decision.id}]</span>
            {decision.question}
          </div>
          <div className="text-[11px] opacity-75 line-clamp-2">{decision.context}</div>
          {errorMsg && (
            <div className="flex items-center gap-1 text-[11px] text-red-700 dark:text-red-300 font-medium mt-0.5" role="alert">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}
          {savedSuccess && (
            <div className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium mt-0.5" role="status">
              <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Decision recorded to authoritative ledger (v{decision.version}).</span>
            </div>
          )}
        </div>
      </td>
      <td className="min-w-[190px] max-w-[240px]">
        <form id={`form-${decision.id}`} onSubmit={handleSave} className="flex flex-col gap-1">
          {decision.inputType === 'select' && decision.options && (
            <select
              aria-label={`Select decision for ${decision.id}`}
              value={typeof draftAnswer === 'string' ? draftAnswer : ''}
              onChange={(e) => setDraftAnswer(e.target.value)}
              className="sg-select w-full text-xs"
            >
              <option value="">-- Choose authoritative option --</option>
              {decision.options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          )}

          {decision.inputType === 'single_option' && decision.options && (
            <div className="flex flex-col gap-1" role="radiogroup" aria-label={decision.question}>
              {decision.options.map((opt) => (
                <label key={opt} className="flex items-start gap-1.5 text-[11px] cursor-pointer">
                  <input
                    type="radio"
                    name={`radio-${decision.id}`}
                    value={opt}
                    checked={draftAnswer === opt}
                    onChange={() => setDraftAnswer(opt)}
                    className="mt-0.5"
                  />
                  <span className="leading-tight">{opt}</span>
                </label>
              ))}
            </div>
          )}

          {decision.inputType === 'checkbox' && (
            <label className="flex items-center gap-2 text-xs cursor-pointer py-1">
              <input
                type="checkbox"
                checked={Boolean(draftAnswer)}
                onChange={(e) => setDraftAnswer(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="font-medium">
                Authorize &amp; confirm ({decision.id})
              </span>
            </label>
          )}

          {decision.inputType === 'text' && (
            <input
              type="text"
              aria-label={`Decision text input for ${decision.id}`}
              value={typeof draftAnswer === 'string' ? draftAnswer : ''}
              onChange={(e) => setDraftAnswer(e.target.value)}
              placeholder="Enter authoritative value..."
              className="sg-well-input w-full text-xs"
            />
          )}
        </form>
      </td>
      <td className="whitespace-nowrap text-xs">
        <span>{decision.assigneeName}</span>
      </td>
      <td className="whitespace-nowrap">
        <PriorityBadge priority={decision.priority} />
      </td>
      <td className="whitespace-nowrap font-mono text-xs tabular-nums">
        <span className="inline-flex items-center gap-1">
          <Clock className="w-3 h-3 opacity-70" aria-hidden="true" />
          {formatDecisionAge(decision.createdAt, serverClockUtc)}
        </span>
      </td>
      <td className="whitespace-nowrap text-right">
        <button
          type="submit"
          form={`form-${decision.id}`}
          disabled={saving}
          className="sg-btn sg-btn-primary text-xs"
        >
          <Check className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{saving ? 'Saving...' : decision.status === 'Resolved' ? 'Update Decision' : 'Save Decision'}</span>
        </button>
      </td>
    </tr>
  );
};

export const TicketDecisionCard: React.FC<{
  decision: TicketDecision;
  serverClockUtc: string;
  onSaveAnswer: (decisionId: string, answer: string | boolean, expectedVersion: number) => Promise<void>;
}> = ({ decision, serverClockUtc, onSaveAnswer }) => {
  const [draftAnswer, setDraftAnswer] = useState<string | boolean>(() => {
    if (decision.answer !== null && decision.answer !== undefined) {
      return decision.answer;
    }
    return decision.inputType === 'checkbox' ? false : '';
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSavedSuccess(false);

    if (decision.inputType !== 'checkbox') {
      if (typeof draftAnswer !== 'string' || draftAnswer.trim().length === 0) {
        setErrorMsg('Required decision field cannot be empty.');
        return;
      }
    } else if (decision.required && draftAnswer !== true) {
      setErrorMsg('You must confirm the checkbox to authorize this decision gate.');
      return;
    }

    try {
      setSaving(true);
      await onSaveAnswer(decision.id, draftAnswer, decision.version);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save decision');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSave}
      className="p-3.5 border-b last:border-b-0 border-[var(--background-modifier-border)] space-y-2.5 text-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-[var(--text-accent)]">[{decision.id}]</span>
          <span aria-hidden="true">·</span>
          <PriorityBadge priority={decision.priority} />
          <span aria-hidden="true">·</span>
          <span className="font-medium">Assignee: {decision.assigneeName}</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums">
          <span>Status: {decision.status}</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3 opacity-70" aria-hidden="true" />
            Age: {formatDecisionAge(decision.createdAt, serverClockUtc)}
          </span>
        </div>
      </div>

      <div>
        <div className="font-bold text-xs">{decision.question}</div>
        <div className="text-[11.5px] opacity-80 mt-0.5">{decision.context}</div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <div className="flex-1 min-w-[240px]">
          {decision.inputType === 'select' && decision.options && (
            <select
              aria-label={`Select decision for ${decision.id}`}
              value={typeof draftAnswer === 'string' ? draftAnswer : ''}
              onChange={(e) => setDraftAnswer(e.target.value)}
              className="sg-select w-full text-xs"
            >
              <option value="">-- Choose authoritative option --</option>
              {decision.options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          )}

          {decision.inputType === 'single_option' && decision.options && (
            <div className="flex flex-col gap-1" role="radiogroup" aria-label={decision.question}>
              {decision.options.map((opt) => (
                <label key={opt} className="flex items-start gap-1.5 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name={`card-radio-${decision.id}`}
                    value={opt}
                    checked={draftAnswer === opt}
                    onChange={() => setDraftAnswer(opt)}
                    className="mt-0.5"
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          )}

          {decision.inputType === 'checkbox' && (
            <label className="flex items-center gap-2 text-xs cursor-pointer py-1">
              <input
                type="checkbox"
                checked={Boolean(draftAnswer)}
                onChange={(e) => setDraftAnswer(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="font-medium">
                Authorize &amp; confirm human sign-off ({decision.id})
              </span>
            </label>
          )}

          {decision.inputType === 'text' && (
            <input
              type="text"
              aria-label={`Decision text input for ${decision.id}`}
              value={typeof draftAnswer === 'string' ? draftAnswer : ''}
              onChange={(e) => setDraftAnswer(e.target.value)}
              placeholder="Enter authoritative specification value..."
              className="sg-well-input w-full text-xs"
            />
          )}
        </div>

        <button type="submit" disabled={saving} className="sg-btn sg-btn-primary text-xs">
          <Check className="w-3.5 h-3.5" aria-hidden="true" />
          <span>
            {saving
              ? 'Saving...'
              : decision.status === 'Resolved'
                ? 'Update Decision'
                : 'Save Decision'}
          </span>
        </button>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-1 text-[11px] text-red-700 dark:text-red-300 font-medium" role="alert">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}
      {savedSuccess && (
        <div className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium" role="status">
          <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Decision recorded to authoritative ledger (v{decision.version}).</span>
        </div>
      )}
    </form>
  );
};

