import { useEffect, useRef, useState } from 'react';
import {
  ArrowsClockwise,
  ArrowUpRight,
  BellRinging,
  Check,
  Lock,
  Plus,
  ShieldCheck,
  Trash,
  UserMinus,
  X,
} from '@phosphor-icons/react';
import { ApiError, postEventAction } from '../lib/api';
import { resetFormValidationState, syncElementAria } from '../lib/validation';
import type { EventState } from '../types';
import { ErrorMark } from './ErrorMark';

interface AdminDialogProps {
  open: boolean;
  state: EventState;
  onClose: () => void;
  onStateUpdate: (state: EventState) => void;
  onEventReset: () => void;
}

export function AdminDialog({
  open,
  state,
  onClose,
  onStateUpdate,
  onEventReset,
}: AdminDialogProps) {
  const loginFormRef = useRef<HTMLFormElement>(null);
  const loginPinRef = useRef<HTMLInputElement>(null);
  const addFormRef = useRef<HTMLFormElement>(null);

  const [activeAdminPin, setActiveAdminPin] = useState<string | null>(null);
  const [loginPin, setLoginPin] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  const [feedback, setFeedback] = useState<{ text: string; isError: boolean } | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Manual participant add (Name only)
  const [addName, setAddName] = useState('');

  // Reset confirmation
  const [confirmReset, setConfirmReset] = useState(false);

  // Picked-name live notifier tracking
  const [pickNotice, setPickNotice] = useState<string | null>(null);
  const prevDrawnIdsRef = useRef<Set<string> | null>(null);
  const prevRoundIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoginError(null);
    setFeedback(null);
    setConfirmReset(false);

    if (activeAdminPin) {
      postEventAction('admin_verify', { adminPin: activeAdminPin })
        .then((res) => onStateUpdate(res.state))
        .catch(() => {});
    }

    const frame = requestAnimationFrame(() => {
      if (!activeAdminPin && loginPinRef.current) {
        syncElementAria(loginPinRef.current, false);
        loginPinRef.current.focus();
      }
      document
        .getElementById('admin-panel')
        ?.querySelectorAll('input')
        .forEach((el) => syncElementAria(el, false));
    });

    return () => cancelAnimationFrame(frame);
  }, [open, activeAdminPin, onStateUpdate]);

  // Refresh organizer roster automatically when polling detects picks or round changes
  useEffect(() => {
    if (!open || !activeAdminPin) return;
    let cancelled = false;
    postEventAction('admin_verify', { adminPin: activeAdminPin })
      .then((res) => {
        if (!cancelled) onStateUpdate(res.state);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, activeAdminPin, state.remainingCount, state.totalCount, state.roundId, onStateUpdate]);

  // Notify organizer when any name from the list is newly picked
  useEffect(() => {
    const participants = state.participants;
    if (!participants) return;

    const currentDrawn = participants.filter((p) => p.hasDrawn);
    const currentDrawnIds = new Set(currentDrawn.map((p) => p.id));
    const prevDrawnIds = prevDrawnIdsRef.current;

    if (prevRoundIdRef.current === state.roundId && prevDrawnIds !== null) {
      const newlyPicked = currentDrawn.filter((p) => !prevDrawnIds.has(p.id));
      if (newlyPicked.length > 0) {
        const names = newlyPicked.map((p) => p.name).join(', ');
        setPickNotice(
          newlyPicked.length === 1
            ? `"${names}" was just picked from the tin (${currentDrawn.length} of ${state.totalCount} picked).`
            : `${newlyPicked.length} names just picked: ${names} (${currentDrawn.length} of ${state.totalCount} picked).`
        );
      } else if (currentDrawn.length === 0) {
        setPickNotice(null);
      }
    } else if (prevRoundIdRef.current !== state.roundId || currentDrawn.length === 0) {
      setPickNotice(null);
    }

    prevDrawnIdsRef.current = currentDrawnIds;
    prevRoundIdRef.current = state.roundId;
  }, [state.participants, state.roundId, state.totalCount]);

  const handleLoginSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError(null);
    setLoginSubmitting(true);
    const trimmed = loginPin.trim();
    try {
      const res = await postEventAction('admin_verify', { adminPin: trimmed });
      setActiveAdminPin(trimmed);
      setLoginPin('');
      onStateUpdate(res.state);
      resetFormValidationState(loginFormRef.current);
    } catch (err) {
      setLoginError(err instanceof ApiError ? err.message : 'Unable to verify Organizer PIN.');
      loginPinRef.current?.select();
    } finally {
      setLoginSubmitting(false);
    }
  };

  const runAdminAction = async <T extends Record<string, unknown> = Record<string, never>>(
    actionKey: string,
    payload: Record<string, unknown>,
    successMessage: string | ((res: T & { ok: boolean; state: EventState }) => string)
  ) => {
    if (!activeAdminPin) return false;
    setFeedback(null);
    setBusyAction(actionKey);
    try {
      const res = await postEventAction<T>(actionKey, { adminPin: activeAdminPin, ...payload });
      onStateUpdate(res.state);
      const message = typeof successMessage === 'function' ? successMessage(res) : successMessage;
      setFeedback({ text: message, isError: false });
      return true;
    } catch (err) {
      setFeedback({
        text: err instanceof ApiError ? err.message : 'Action failed.',
        isError: true,
      });
      return false;
    } finally {
      setBusyAction(null);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = addName.trim();
    const ok = await runAdminAction<{ addedCount?: number }>(
      'admin_add_participant',
      { name: trimmed },
      (res) => {
        const count = res.addedCount ?? 1;
        const label = count > 1 ? `${count} participants` : trimmed;
        return `Added ${label} into the Exchange Gift tin!`;
      }
    );
    if (ok) {
      setAddName('');
      resetFormValidationState(addFormRef.current);
    }
  };

  const handleResetAll = async () => {
    const ok = await runAdminAction(
      'admin_reset_all',
      {},
      'Event reset. Ready for a new group of names.'
    );
    if (ok) {
      setConfirmReset(false);
      onEventReset();
    }
  };

  const total = state.totalCount;
  const drawnCount = Math.max(0, total - state.remainingCount);
  const roster = state.participants ?? [];
  const latestPicked = roster
    .filter((p) => p.hasDrawn)
    .sort((a, b) => (b.drawnAt ?? '').localeCompare(a.drawnAt ?? ''))[0];

  return (
    <aside
      id="admin-panel"
      aria-labelledby="admin-dialog-title"
      className="flex w-full flex-col rounded-[28px] bg-[#4CE6B8]/20 p-1.5 ring-1 ring-[#4CE6B8]/35 shadow-[0_26px_64px_-15px_rgba(3,12,38,0.65)]"
    >
      <div className="flex h-full flex-col justify-between rounded-[22px] bg-gradient-to-b from-[#0A2663] to-[#061A44] p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] sm:p-5">
        {/* Compact Header */}
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-[#4CE6B8]/20 pb-3">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#4CE6B8]">
              <ShieldCheck size={13} weight="regular" aria-hidden="true" />
              Organizer Controls
            </span>
            <h2
              id="admin-dialog-title"
              className="mt-0.5 truncate font-serif text-2xl leading-none tracking-tight text-white"
            >
              {activeAdminPin ? 'Manage Stick Draw' : 'Organizer Access'}
            </h2>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {activeAdminPin && (
              <button
                type="button"
                onClick={() => setActiveAdminPin(null)}
                aria-label="Lock organizer panel"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#4CE6B8]/25 bg-[#0D2E70]/70 px-3 text-xs font-medium text-white transition-colors hover:bg-[#123A88] active:scale-[0.97]"
              >
                <Lock size={13} weight="regular" aria-hidden="true" />
                <span>Lock</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close organizer controls"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#4CE6B8]/25 bg-[#0D2E70]/70 text-white transition-colors duration-200 hover:bg-[#123A88] active:scale-[0.97]"
            >
              <X size={16} weight="light" aria-hidden="true" />
            </button>
          </div>
        </div>

        {!activeAdminPin ? (
          <div className="flex flex-1 flex-col justify-center py-2">
            <p className="mb-4 text-xs leading-relaxed text-[#B8D0F0] sm:text-sm">
              Enter the Organizer PIN beside the tin to manage names and monitor stick progress
              without spoiling who picked who.
            </p>

            <form
              ref={loginFormRef}
              method="POST"
              action="/api/event"
              aria-labelledby="admin-dialog-title"
              onSubmit={handleLoginSubmit}
            >
              <div className="mb-4 flex flex-col gap-1.5">
                <label
                  htmlFor="admin-pin-input"
                  className="text-xs font-medium text-white sm:text-sm"
                >
                  Organizer 4-Digit PIN <span className="text-[#FCA5A5]" aria-hidden="true">*</span>
                </label>
                <span id="admin-pin-hint" className="text-xs text-[#B8D0F0]/80">
                  Organizer PIN is 1234
                </span>
                <input
                  ref={loginPinRef}
                  id="admin-pin-input"
                  name="adminPin"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{4}"
                  minLength={4}
                  maxLength={4}
                  required
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="done"
                  autoFocus
                  value={loginPin}
                  onChange={(e) => setLoginPin(e.target.value)}
                  aria-describedby="admin-pin-hint"
                  data-error="admin-pin-error"
                  placeholder="1234"
                  className="atelier-input font-mono tracking-[0.35em] text-center"
                />
                <div id="admin-pin-error" className="error-msg">
                  <ErrorMark />
                  <span>Enter a valid 4-digit Organizer PIN.</span>
                </div>
              </div>

              {loginError && (
                <div
                  role="alert"
                  className="mb-3 flex items-start gap-2 rounded-xl border border-[#F87171]/60 bg-[#991B1B]/25 px-3 py-2 text-xs text-[#FCA5A5] sm:text-sm"
                >
                  <ErrorMark />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loginSubmitting}
                className="atelier-btn group flex w-full items-center justify-between rounded-full bg-[#4CE6B8] py-1.5 pl-5 pr-1.5 text-sm font-bold text-[#061A44] transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-[#6EF5CD] active:scale-[0.98] disabled:opacity-60"
              >
                <span>{loginSubmitting ? 'Verifying...' : 'Unlock Organizer Controls'}</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#061A44]/15 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                  <ArrowUpRight size={16} weight="regular" aria-hidden="true" />
                </span>
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-2.5">
            {feedback && (
              <div
                role="status"
                aria-live="polite"
                className={`rounded-xl border px-3 py-2 text-xs font-medium ${
                  feedback.isError
                    ? 'border-[#F87171]/60 bg-[#991B1B]/25 text-[#FCA5A5]'
                    : 'border-[#4CE6B8]/45 bg-[#4CE6B8]/15 text-white'
                }`}
              >
                {feedback.text}
              </div>
            )}

            {(pickNotice || latestPicked) && (
              <div
                role="status"
                aria-live="polite"
                className="flex items-center justify-between gap-2 rounded-xl border border-[#4CE6B8]/50 bg-[#4CE6B8]/15 px-3 py-2 text-xs text-white"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#4CE6B8] text-[#061A44]">
                    <BellRinging size={13} weight="fill" aria-hidden="true" />
                  </span>
                  <span className="truncate font-medium">
                    {pickNotice ?? (
                      <>
                        Latest picked from list:{' '}
                        <strong className="font-semibold text-[#4CE6B8]">
                          {latestPicked?.name}
                        </strong>{' '}
                        ({drawnCount} of {total} picked)
                      </>
                    )}
                  </span>
                </div>
                {pickNotice && (
                  <button
                    type="button"
                    onClick={() => setPickNotice(null)}
                    className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#B8D0F0] hover:text-white"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            )}

            {/* Compact Progress & Quick Actions Strip */}
            <div className="rounded-xl border border-[#4CE6B8]/20 bg-[#061A44]/60 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-[#B8D0F0]">Sticks Pulled</span>
                  <span className="font-mono text-xs font-semibold text-[#4CE6B8]">
                    {drawnCount} / {total}
                  </span>
                </div>

                {total > 0 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={busyAction === 'admin_reshuffle'}
                      onClick={() =>
                        runAdminAction(
                          'admin_reshuffle',
                          {},
                          'All sticks returned to the tin! Everyone can pull freshly.'
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-full border border-[#4CE6B8]/25 bg-[#0D2E70]/70 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-[#123A88] active:scale-[0.98]"
                    >
                      <ArrowsClockwise size={12} weight="regular" aria-hidden="true" />
                      <span>Re-shuffle</span>
                    </button>

                    {!confirmReset ? (
                      <button
                        type="button"
                        onClick={() => setConfirmReset(true)}
                        className="inline-flex items-center gap-1 rounded-full border border-[#F87171]/45 bg-[#991B1B]/25 px-2.5 py-1 text-[11px] font-semibold text-[#FCA5A5] transition-colors hover:bg-[#991B1B]/45"
                      >
                        <Trash size={12} weight="regular" aria-hidden="true" />
                        <span>Reset</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={busyAction === 'admin_reset_all'}
                          onClick={handleResetAll}
                          className="rounded-full bg-[#B91C1C] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#991B1B]"
                        >
                          Confirm Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmReset(false)}
                          className="rounded-full border border-[#4CE6B8]/25 px-2 py-1 text-[11px] font-medium text-[#B8D0F0] hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#061A44]">
                <div
                  className="h-full rounded-full bg-[#4CE6B8] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]"
                  style={{ width: `${total > 0 ? (drawnCount / total) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Single-Line Add Participant Form */}
            <form
              ref={addFormRef}
              method="POST"
              action="/api/event"
              aria-label="Add participant names"
              onSubmit={handleAddSubmit}
              className="rounded-xl border border-[#4CE6B8]/20 bg-[#061A44]/60 p-3"
            >
              <label htmlFor="admin-add-name" className="mb-1 block text-xs font-medium text-white">
                Add Names (comma-separated) <span className="text-[#FCA5A5]" aria-hidden="true">*</span>
              </label>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <input
                    id="admin-add-name"
                    name="name"
                    type="text"
                    minLength={2}
                    maxLength={240}
                    required
                    autoComplete="off"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    data-error="admin-add-name-error"
                    placeholder="e.g. Layla, Omar, Nadia, Tariq"
                    className="atelier-input !min-h-[40px] !py-1.5 text-xs sm:text-sm"
                  />
                  <div id="admin-add-name-error" className="error-msg">
                    <ErrorMark />
                    <span>Enter at least one name (2–40 characters each).</span>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={busyAction === 'admin_add_participant'}
                  className="inline-flex h-[40px] shrink-0 items-center gap-1 rounded-full bg-[#4CE6B8] px-4 text-xs font-bold text-[#061A44] transition-colors hover:bg-[#6EF5CD] disabled:opacity-60"
                >
                  <Plus size={13} weight="bold" aria-hidden="true" />
                  <span>{busyAction === 'admin_add_participant' ? 'Adding...' : 'Add'}</span>
                </button>
              </div>
            </form>

            {/* Compact Participant Grid with Live Picked Status */}
            <div className="flex-1">
              <div className="mb-1.5 flex items-center justify-between text-[11px] text-[#B8D0F0]/80">
                <span className="font-medium text-[#B8D0F0]">Participants ({total})</span>
                <span className="font-mono text-[10px] font-semibold text-[#4CE6B8]">
                  {drawnCount} Picked · {state.remainingCount} In Tin
                </span>
              </div>

              {roster.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#4CE6B8]/25 px-3 py-5 text-center text-xs text-[#B8D0F0]/80">
                  No names in the Exchange Gift tin yet. Add names above.
                </p>
              ) : (
                <ul className="admin-roster-scroll grid max-h-[176px] grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
                  {roster.map((p) => (
                    <li
                      key={p.id}
                      className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-1.5 text-xs transition-colors ${
                        p.hasDrawn
                          ? 'border-[#4CE6B8]/55 bg-[#4CE6B8]/14'
                          : 'border-[#4CE6B8]/20 bg-[#061A44]/60'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span
                          className="truncate font-medium text-white"
                          title={`${p.name} — ${p.hasDrawn ? 'Picked' : 'Still in tin'}`}
                        >
                          {p.name}
                        </span>
                        {p.hasDrawn ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#4CE6B8] px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[#061A44]">
                            <Check size={10} weight="bold" aria-hidden="true" />
                            Picked
                          </span>
                        ) : (
                          <span className="inline-flex shrink-0 items-center rounded-full border border-[#4CE6B8]/25 bg-[#0D2E70]/60 px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider text-[#B8D0F0]">
                            In Tin
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${p.name} from pack`}
                        onClick={() =>
                          runAdminAction(
                            'admin_remove_participant',
                            { participantId: p.id },
                            `Removed ${p.name} from the pack.`
                          )
                        }
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#F87171]/40 bg-[#991B1B]/25 text-[#FCA5A5] transition-colors hover:bg-[#991B1B]/50"
                      >
                        <UserMinus size={12} weight="regular" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
