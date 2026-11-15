import { useEffect, useRef, useState } from 'react';
import {
  ArrowsClockwise,
  ArrowUpRight,
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

type AdminTab = 'pack' | 'settings';

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
  const settingsFormRef = useRef<HTMLFormElement>(null);
  const packTabRef = useRef<HTMLButtonElement>(null);
  const settingsTabRef = useRef<HTMLButtonElement>(null);

  const [activeAdminPin, setActiveAdminPin] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('pack');
  const [loginPin, setLoginPin] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  const [feedback, setFeedback] = useState<{ text: string; isError: boolean } | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Manual participant add (Name only)
  const [addName, setAddName] = useState('');

  // Event settings
  const [settingsTitle, setSettingsTitle] = useState(state.eventName);
  const [settingsBudget, setSettingsBudget] = useState(state.budget);
  const [settingsNewPin, setSettingsNewPin] = useState('');

  // Reset confirmation
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!settingsFormRef.current?.contains(document.activeElement)) {
      setSettingsTitle(state.eventName);
      setSettingsBudget(state.budget);
    }
  }, [state.eventName, state.budget]);

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

  const handleSettingsSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeAdminPin) return;
    setFeedback(null);
    setBusyAction('admin_update_settings');

    try {
      const trimmedNewPin = settingsNewPin.trim();
      const res = await postEventAction<{ adminPinUpdated?: boolean }>('admin_update_settings', {
        adminPin: activeAdminPin,
        eventName: settingsTitle.trim(),
        budget: settingsBudget.trim(),
        newAdminPin: trimmedNewPin,
      });
      if (res.adminPinUpdated && trimmedNewPin) {
        setActiveAdminPin(trimmedNewPin);
      }
      setSettingsNewPin('');
      onStateUpdate(res.state);
      resetFormValidationState(settingsFormRef.current);
      setFeedback({ text: 'Exchange Gift settings saved.', isError: false });
    } catch (err) {
      setFeedback({
        text: err instanceof ApiError ? err.message : 'Unable to save settings.',
        isError: true,
      });
    } finally {
      setBusyAction(null);
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

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const nextTab: AdminTab =
      e.key === 'Home'
        ? 'pack'
        : e.key === 'End'
          ? 'settings'
          : activeTab === 'pack'
            ? 'settings'
            : 'pack';
    setActiveTab(nextTab);
    requestAnimationFrame(() => {
      if (nextTab === 'pack') packTabRef.current?.focus();
      else settingsTabRef.current?.focus();
    });
  };

  const total = state.totalCount;
  const drawnCount = Math.max(0, total - state.remainingCount);
  const roster = state.participants ?? [];

  return (
    <aside
      id="admin-panel"
      aria-labelledby="admin-dialog-title"
      className="flex w-full flex-col rounded-[28px] bg-[#14B8A6]/20 p-1.5 ring-1 ring-[#2DD4BF]/35 shadow-[0_26px_64px_-15px_rgba(0,0,0,0.55)]"
    >
      <div className="flex h-full flex-col justify-between rounded-[22px] bg-[#0B213F] p-4 text-[#F8FAFC] shadow-[inset_0_1px_0_rgba(248,250,252,0.1)] sm:p-5">
        {/* Compact Header */}
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/[0.1] pb-3">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#2DD4BF]">
              <ShieldCheck size={13} weight="regular" aria-hidden="true" />
              Organizer Controls
            </span>
            <h2
              id="admin-dialog-title"
              className="mt-0.5 truncate font-serif text-2xl leading-none tracking-tight text-[#F8FAFC]"
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
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/[0.14] bg-white/[0.06] px-3 text-xs font-medium text-[#E2E8F0] transition-colors hover:bg-white/[0.12] active:scale-[0.97]"
              >
                <Lock size={13} weight="regular" aria-hidden="true" />
                <span>Lock</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close organizer controls"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-[#E2E8F0] ring-1 ring-white/[0.12] transition-colors duration-200 hover:bg-white/[0.14] active:scale-[0.97]"
            >
              <X size={16} weight="light" aria-hidden="true" />
            </button>
          </div>
        </div>

        {!activeAdminPin ? (
          <div className="flex flex-1 flex-col justify-center py-2">
            <p className="mb-4 text-xs leading-relaxed text-[#CBD5E1] sm:text-sm">
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
                <label htmlFor="admin-pin-input" className="text-xs font-medium text-[#F8FAFC] sm:text-sm">
                  Organizer 4-Digit PIN <span className="text-[#FCA5A5]" aria-hidden="true">*</span>
                </label>
                <span id="admin-pin-hint" className="text-xs text-[#CBD5E1]/80">
                  Default initial PIN is 1234 (changeable once unlocked)
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
                className="atelier-btn group flex w-full items-center justify-between rounded-full bg-[#0F766E] py-1.5 pl-5 pr-1.5 text-sm font-semibold text-[#F8FAFC] transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-[#115E59] active:scale-[0.98] disabled:opacity-60"
              >
                <span>{loginSubmitting ? 'Verifying...' : 'Unlock Organizer Controls'}</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/20 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                  <ArrowUpRight size={16} weight="regular" aria-hidden="true" />
                </span>
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-1 flex-col">
            {feedback && (
              <div
                role="status"
                aria-live="polite"
                className={`mb-2.5 rounded-xl border px-3 py-2 text-xs font-medium ${
                  feedback.isError
                    ? 'border-[#F87171]/60 bg-[#991B1B]/25 text-[#FCA5A5]'
                    : 'border-[#2DD4BF]/45 bg-[#14B8A6]/15 text-[#F8FAFC]'
                }`}
              >
                {feedback.text}
              </div>
            )}

            {/* Accessible Segmented Tablist */}
            <div
              role="tablist"
              aria-label="Organizer sections"
              onKeyDown={handleTabKeyDown}
              className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-white/[0.1] bg-white/[0.05] p-1"
            >
              <button
                ref={packTabRef}
                type="button"
                role="tab"
                id="tab-pack"
                aria-selected={activeTab === 'pack'}
                tabIndex={activeTab === 'pack' ? 0 : -1}
                onClick={() => setActiveTab('pack')}
                className="atelier-tab rounded-lg px-3 py-1.5 text-xs font-semibold text-[#CBD5E1] transition-colors hover:text-[#F8FAFC]"
              >
                Names & Pack ({total})
              </button>
              <button
                ref={settingsTabRef}
                type="button"
                role="tab"
                id="tab-settings"
                aria-selected={activeTab === 'settings'}
                tabIndex={activeTab === 'settings' ? 0 : -1}
                onClick={() => setActiveTab('settings')}
                className="atelier-tab rounded-lg px-3 py-1.5 text-xs font-semibold text-[#CBD5E1] transition-colors hover:text-[#F8FAFC]"
              >
                Settings & PIN
              </button>
            </div>

            {/* Tab 1: Names & Pack */}
            <div role="tabpanel" aria-labelledby="tab-pack" hidden={activeTab !== 'pack'}>
              <div className="flex flex-col gap-2.5">
                {/* Compact Progress & Quick Actions Strip */}
                <div className="rounded-xl border border-white/[0.12] bg-white/[0.04] p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-[#CBD5E1]">Sticks Pulled</span>
                      <span className="font-mono text-xs font-semibold text-[#2DD4BF]">
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
                          className="inline-flex items-center gap-1 rounded-full border border-white/[0.16] bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-[#F8FAFC] transition-colors hover:bg-white/[0.14] active:scale-[0.98]"
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
                              className="rounded-full bg-[#B91C1C] px-2.5 py-1 text-[11px] font-semibold text-[#F8FAFC] hover:bg-[#991B1B]"
                            >
                              Confirm Clear
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmReset(false)}
                              className="rounded-full border border-white/[0.16] px-2 py-1 text-[11px] font-medium text-[#CBD5E1] hover:text-[#F8FAFC]"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.1]">
                    <div
                      className="h-full rounded-full bg-[#14B8A6] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]"
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
                  className="rounded-xl border border-white/[0.12] bg-white/[0.04] p-3"
                >
                  <label htmlFor="admin-add-name" className="mb-1 block text-xs font-medium text-[#F8FAFC]">
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
                      className="inline-flex h-[40px] shrink-0 items-center gap-1 rounded-full border border-[#2DD4BF]/40 bg-[#0F766E] px-4 text-xs font-semibold text-[#F8FAFC] transition-colors hover:bg-[#115E59] disabled:opacity-60"
                    >
                      <Plus size={13} weight="bold" aria-hidden="true" />
                      <span>{busyAction === 'admin_add_participant' ? 'Adding...' : 'Add'}</span>
                    </button>
                  </div>
                </form>

                {/* Compact Spoiler-Free Participant Grid */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-[11px] text-[#CBD5E1]/80">
                    <span className="font-medium text-[#CBD5E1]">Participants (Spoiler-Free)</span>
                    <span>Pick status stays hidden</span>
                  </div>

                  {roster.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-white/[0.16] px-3 py-4 text-center text-xs text-[#CBD5E1]/80">
                      No names in the Exchange Gift tin yet. Add names above.
                    </p>
                  ) : (
                    <ul className="admin-roster-scroll grid max-h-[164px] grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
                      {roster.map((p) => (
                        <li
                          key={p.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs"
                        >
                          <span className="truncate font-medium text-[#F8FAFC]" title={p.name}>
                            {p.name}
                          </span>
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
            </div>

            {/* Tab 2: Settings & PIN */}
            <div role="tabpanel" aria-labelledby="tab-settings" hidden={activeTab !== 'settings'}>
              <form
                ref={settingsFormRef}
                method="POST"
                action="/api/event"
                aria-label="Exchange Gift Settings"
                onSubmit={handleSettingsSubmit}
                className="space-y-3 rounded-xl border border-white/[0.12] bg-white/[0.04] p-3.5"
              >
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="settings-event-name"
                    className="text-xs font-medium text-[#F8FAFC]"
                  >
                    Event Title <span className="text-[#FCA5A5]" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="settings-event-name"
                    name="eventName"
                    type="text"
                    minLength={2}
                    maxLength={60}
                    required
                    value={settingsTitle}
                    onChange={(e) => setSettingsTitle(e.target.value)}
                    data-error="settings-event-name-error"
                    className="atelier-input !min-h-[42px] !py-1.5 text-sm"
                  />
                  <div id="settings-event-name-error" className="error-msg">
                    <ErrorMark />
                    <span>Event title must be 2–60 characters.</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="settings-budget"
                      className="text-xs font-medium text-[#F8FAFC]"
                    >
                      Gift Budget / Note
                    </label>
                    <input
                      id="settings-budget"
                      name="budget"
                      type="text"
                      maxLength={40}
                      value={settingsBudget}
                      onChange={(e) => setSettingsBudget(e.target.value)}
                      data-error="settings-budget-error"
                      className="atelier-input !min-h-[42px] !py-1.5 text-sm"
                    />
                    <div id="settings-budget-error" className="error-msg">
                      <ErrorMark />
                      <span>Must be 40 characters or less.</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="settings-new-pin"
                      className="text-xs font-medium text-[#F8FAFC]"
                    >
                      New Organizer PIN
                    </label>
                    <input
                      id="settings-new-pin"
                      name="newAdminPin"
                      type="text"
                      inputMode="numeric"
                      pattern="\d{4}"
                      maxLength={4}
                      autoComplete="off"
                      value={settingsNewPin}
                      onChange={(e) => setSettingsNewPin(e.target.value)}
                      data-error="settings-new-pin-error"
                      placeholder="Optional 4 digits"
                      className="atelier-input !min-h-[42px] !py-1.5 font-mono text-sm"
                    />
                    <div id="settings-new-pin-error" className="error-msg">
                      <ErrorMark />
                      <span>Must be exactly 4 digits.</span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busyAction === 'admin_update_settings'}
                  className="atelier-btn inline-flex items-center gap-2 rounded-full border border-[#2DD4BF]/40 bg-[#0F766E] px-5 py-2 text-xs font-semibold text-[#F8FAFC] transition-colors hover:bg-[#115E59]"
                >
                  <Check size={14} weight="bold" aria-hidden="true" />
                  Save Settings
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
