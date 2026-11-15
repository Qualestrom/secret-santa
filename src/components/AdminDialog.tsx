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
import {
  resetFormValidationState,
  setupLightDismissFallback,
  syncElementAria,
} from '../lib/validation';
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const loginFormRef = useRef<HTMLFormElement>(null);
  const loginPinRef = useRef<HTMLInputElement>(null);
  const addFormRef = useRef<HTMLFormElement>(null);
  const settingsFormRef = useRef<HTMLFormElement>(null);

  const [activeAdminPin, setActiveAdminPin] = useState<string | null>(null);
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
    const dialog = dialogRef.current;
    if (!dialog) return;

    const cleanupDismiss = setupLightDismissFallback(dialog);
    const handleClose = () => {
      dialog.returnValue = '';
      setLoginPin('');
      setLoginError(null);
      setFeedback(null);
      setConfirmReset(false);
      resetFormValidationState(loginFormRef.current);
      onClose();
    };

    dialog.addEventListener('close', handleClose);
    return () => {
      cleanupDismiss();
      dialog.removeEventListener('close', handleClose);
    };
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      setLoginError(null);
      setFeedback(null);
      setConfirmReset(false);
      if (!dialog.open) {
        dialog.showModal();
      }
      if (activeAdminPin) {
        postEventAction('admin_verify', { adminPin: activeAdminPin })
          .then((res) => onStateUpdate(res.state))
          .catch(() => {});
      }
      requestAnimationFrame(() => {
        if (!activeAdminPin && loginPinRef.current) {
          syncElementAria(loginPinRef.current, false);
          loginPinRef.current.focus();
        }
      });
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, activeAdminPin, onStateUpdate]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      dialogRef.current
        ?.querySelectorAll('input')
        .forEach((el) => syncElementAria(el, false));
    });
  }, [open, activeAdminPin, state.phase]);

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
        return `Added ${label} into the Christmas tin!`;
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
      setFeedback({ text: 'Christmas event settings saved.', isError: false });
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

  const total = state.totalCount;
  const drawnCount = Math.max(0, total - state.remainingCount);
  const roster = state.participants ?? [];

  return (
    <dialog
      ref={dialogRef}
      id="admin-dialog"
      className="atelier-dialog"
      aria-labelledby="admin-dialog-title"
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      <div className="atelier-dialog-scroll rounded-[28px] bg-[#D99B26]/20 p-1.5 ring-1 ring-[#D99B26]/35">
        <div className="rounded-[22px] bg-[#10291E] p-6 sm:p-7 shadow-[inset_0_1px_0_rgba(255,253,249,0.1)]">
          <div className="mb-5 flex items-start justify-between gap-4 border-b border-white/[0.1] pb-4">
            <div>
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-[#D99B26]">
                <ShieldCheck size={14} weight="regular" aria-hidden="true" />
                Organizer Controls
              </span>
              <h2
                id="admin-dialog-title"
                className="mt-1 font-serif text-3xl leading-none tracking-tight text-[#FFFDF9]"
              >
                {activeAdminPin ? 'Manage Stick Draw' : 'Organizer Access'}
              </h2>
            </div>

            <form method="dialog">
              <button
                type="submit"
                value="close"
                aria-label="Close organizer controls"
                className="atelier-btn inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06] text-[#F7EFE1] ring-1 ring-white/[0.12] transition-colors duration-200 hover:bg-white/[0.12] active:scale-[0.97]"
              >
                <X size={18} weight="light" aria-hidden="true" />
              </button>
            </form>
          </div>

          {!activeAdminPin ? (
            <div>
              <p className="mb-5 text-sm leading-relaxed text-[#D8E2DC]">
                Enter the Organizer PIN to activate the stick draw, manage names, and track stick
                progress without spoiling matches.
              </p>

              <form
                ref={loginFormRef}
                method="POST"
                action="/api/event"
                aria-labelledby="admin-dialog-title"
                onSubmit={handleLoginSubmit}
              >
                <div className="mb-5 flex flex-col gap-1.5">
                  <label htmlFor="admin-pin-input" className="text-sm font-medium text-[#FFFDF9]">
                    Organizer 4-Digit PIN <span className="text-[#FCA5A5]" aria-hidden="true">*</span>
                  </label>
                  <span id="admin-pin-hint" className="text-xs text-[#D8E2DC]/75">
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
                    className="mb-4 flex items-start gap-2 rounded-xl border border-[#B91C1C]/60 bg-[#B91C1C]/20 px-3.5 py-2.5 text-sm text-[#FCA5A5]"
                  >
                    <ErrorMark />
                    <span>{loginError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loginSubmitting}
                  className="atelier-btn group flex w-full items-center justify-between rounded-full bg-[#B91C1C] py-2 pl-6 pr-2 text-sm font-semibold text-[#FFFDF9] transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-[#991B1B] active:scale-[0.98] disabled:opacity-60"
                >
                  <span>{loginSubmitting ? 'Verifying...' : 'Unlock Organizer Controls'}</span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/20 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                    <ArrowUpRight size={17} weight="regular" aria-hidden="true" />
                  </span>
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-6">
              {feedback && (
                <div
                  role="status"
                  aria-live="polite"
                  className={`rounded-xl border px-3.5 py-2.5 text-sm font-medium ${
                    feedback.isError
                      ? 'border-[#B91C1C]/60 bg-[#B91C1C]/20 text-[#FCA5A5]'
                      : 'border-[#D99B26]/45 bg-[#D99B26]/15 text-[#FFFDF9]'
                  }`}
                >
                  {feedback.text}
                </div>
              )}

              {/* Phase Controls */}
              <section aria-labelledby="admin-phase-heading">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 id="admin-phase-heading" className="text-base font-semibold text-[#FFFDF9]">
                    Stick Draw Phase
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveAdminPin(null)}
                    className="atelier-btn inline-flex items-center gap-1.5 rounded-full border border-white/[0.14] bg-white/[0.05] px-3.5 py-1.5 text-xs font-medium text-[#F7EFE1] transition-colors hover:bg-white/[0.1]"
                  >
                    <Lock size={13} weight="regular" aria-hidden="true" />
                    Lock Panel
                  </button>
                </div>

                {total === 0 ? (
                  <div className="rounded-2xl border border-white/[0.12] bg-white/[0.04] p-4">
                    <p className="text-sm text-[#D8E2DC]">
                      Add participant names below. As soon as names are added, sticks inside the tin
                      can be pulled immediately!
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/[0.12] bg-white/[0.04] p-4">
                    <div className="mb-3 flex items-baseline justify-between">
                      <span className="text-sm text-[#D8E2DC]">Sticks Pulled</span>
                      <span className="font-mono text-sm font-semibold text-[#D99B26]">
                        {drawnCount} of {total} sticks pulled
                      </span>
                    </div>
                    <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-white/[0.1]">
                      <div
                        className="h-full rounded-full bg-[#D99B26] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]"
                        style={{ width: `${total > 0 ? (drawnCount / total) * 100 : 0}%` }}
                      />
                    </div>
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
                      className="atelier-btn inline-flex items-center gap-2 rounded-full border border-white/[0.16] bg-white/[0.06] px-4 py-2 text-xs font-semibold text-[#FFFDF9] transition-colors hover:bg-white/[0.12] active:scale-[0.98]"
                    >
                      <ArrowsClockwise size={14} weight="regular" aria-hidden="true" />
                      Put All Sticks Back in Tin (Re-shuffle)
                    </button>
                  </div>
                )}
              </section>

              {/* Participant List */}
              <section
                aria-labelledby="admin-participants-heading"
                className="border-t border-white/[0.1] pt-5"
              >
                <h3
                  id="admin-participants-heading"
                  className="mb-1 text-base font-semibold text-[#FFFDF9]"
                >
                  Participant List (Spoiler-Free)
                </h3>
                <p className="mb-3 text-xs text-[#D8E2DC]/80">
                  Spoiler-Free: Which names have already been picked stays completely hidden so the
                  organizer can join the draw too.
                </p>

                <form
                  ref={addFormRef}
                  method="POST"
                  action="/api/event"
                  aria-labelledby="admin-add-heading"
                  onSubmit={handleAddSubmit}
                  className="mb-4 rounded-2xl border border-white/[0.12] bg-white/[0.04] p-4"
                >
                  <h4 id="admin-add-heading" className="mb-2.5 text-sm font-semibold text-[#FFFDF9]">
                    Add Participant Names
                  </h4>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="admin-add-name" className="text-xs font-medium text-[#FFFDF9]">
                      Single Name or Comma-Separated List{' '}
                      <span className="text-[#FCA5A5]" aria-hidden="true">*</span>
                    </label>
                    <span id="admin-add-name-hint" className="text-[11px] text-[#D8E2DC]/75">
                      Enter a single name, or multiple names separated by commas
                    </span>
                    <div className="flex flex-wrap items-start gap-2.5">
                      <div className="min-w-[180px] flex-1">
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
                          aria-describedby="admin-add-name-hint"
                          data-error="admin-add-name-error"
                          placeholder="e.g. Layla, Omar, Nadia, Tariq"
                          className="atelier-input"
                        />
                        <div id="admin-add-name-error" className="error-msg">
                          <ErrorMark />
                          <span>Enter at least one name (2–40 characters each).</span>
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={busyAction === 'admin_add_participant'}
                        className="atelier-btn inline-flex items-center gap-1.5 rounded-full border border-white/[0.16] bg-white/[0.1] px-5 py-3 text-xs font-semibold text-[#FFFDF9] transition-colors hover:bg-white/[0.18]"
                      >
                        <Plus size={14} weight="bold" aria-hidden="true" />
                        {busyAction === 'admin_add_participant' ? 'Adding...' : 'Add to Pack'}
                      </button>
                    </div>
                  </div>
                </form>

                {roster.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/[0.16] px-4 py-4 text-sm text-[#D8E2DC]/80">
                    No names in the Christmas tin yet. Add participant names above.
                  </p>
                ) : (
                  <ul className="divide-y divide-white/[0.08] rounded-2xl border border-white/[0.1] bg-white/[0.03]">
                    {roster.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="font-medium text-[#FFFDF9]">{p.name}</span>
                          <span className="inline-flex items-center rounded-full bg-white/[0.08] px-2.5 py-0.5 font-mono text-[11px] text-[#D8E2DC]">
                            In Pack
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            runAdminAction(
                              'admin_remove_participant',
                              { participantId: p.id },
                              `Removed ${p.name} from the pack.`
                            )
                          }
                          className="atelier-btn inline-flex items-center gap-1 rounded-full border border-[#B91C1C]/50 bg-[#B91C1C]/15 px-3 py-1 text-xs font-medium text-[#FCA5A5] transition-colors hover:bg-[#B91C1C]/30"
                        >
                          <UserMinus size={13} weight="regular" aria-hidden="true" />
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Event Settings */}
              <section
                aria-labelledby="admin-settings-heading"
                className="border-t border-white/[0.1] pt-5"
              >
                <h3
                  id="admin-settings-heading"
                  className="mb-3 text-base font-semibold text-[#FFFDF9]"
                >
                  Christmas Event Settings
                </h3>
                <form
                  ref={settingsFormRef}
                  method="POST"
                  action="/api/event"
                  aria-labelledby="admin-settings-heading"
                  onSubmit={handleSettingsSubmit}
                  className="space-y-4"
                >
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="settings-event-name"
                      className="text-xs font-medium text-[#FFFDF9]"
                    >
                      Event Title <span className="text-[#FCA5A5]" aria-hidden="true">*</span>
                    </label>
                    <span id="settings-event-name-hint" className="text-[11px] text-[#D8E2DC]/75">
                      Displayed at the top of the page (2–60 characters)
                    </span>
                    <input
                      id="settings-event-name"
                      name="eventName"
                      type="text"
                      minLength={2}
                      maxLength={60}
                      required
                      value={settingsTitle}
                      onChange={(e) => setSettingsTitle(e.target.value)}
                      aria-describedby="settings-event-name-hint"
                      data-error="settings-event-name-error"
                      className="atelier-input"
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
                        className="text-xs font-medium text-[#FFFDF9]"
                      >
                        Gift Budget or Date Note
                      </label>
                      <span id="settings-budget-hint" className="text-[11px] text-[#D8E2DC]/75">
                        Optional (up to 40 characters)
                      </span>
                      <input
                        id="settings-budget"
                        name="budget"
                        type="text"
                        maxLength={40}
                        value={settingsBudget}
                        onChange={(e) => setSettingsBudget(e.target.value)}
                        aria-describedby="settings-budget-hint"
                        data-error="settings-budget-error"
                        className="atelier-input"
                      />
                      <div id="settings-budget-error" className="error-msg">
                        <ErrorMark />
                        <span>Must be 40 characters or less.</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor="settings-new-pin"
                        className="text-xs font-medium text-[#FFFDF9]"
                      >
                        Change Organizer PIN
                      </label>
                      <span id="settings-new-pin-hint" className="text-[11px] text-[#D8E2DC]/75">
                        Leave blank to keep current PIN
                      </span>
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
                        aria-describedby="settings-new-pin-hint"
                        data-error="settings-new-pin-error"
                        placeholder="Optional 4 digits"
                        className="atelier-input font-mono"
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
                    className="atelier-btn inline-flex items-center gap-2 rounded-full border border-white/[0.16] bg-white/[0.08] px-5 py-2 text-xs font-semibold text-[#FFFDF9] transition-colors hover:bg-white/[0.14]"
                  >
                    <Check size={14} weight="bold" aria-hidden="true" />
                    Save Settings
                  </button>
                </form>
              </section>

              {/* Reset Event */}
              <section
                aria-labelledby="admin-danger-heading"
                className="border-t border-white/[0.1] pt-5"
              >
                <h3 id="admin-danger-heading" className="mb-1 text-base font-semibold text-[#FCA5A5]">
                  Reset Event
                </h3>
                <p className="mb-3 text-xs text-[#D8E2DC]/80">
                  Clears every name and stick pairing so you can start fresh.
                </p>

                {!confirmReset ? (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="atelier-btn inline-flex items-center gap-2 rounded-full border border-[#B91C1C]/50 bg-[#B91C1C]/20 px-4 py-2 text-xs font-semibold text-[#FCA5A5] transition-colors hover:bg-[#B91C1C]/35"
                  >
                    <Trash size={14} weight="regular" aria-hidden="true" />
                    Reset Entire Event
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      disabled={busyAction === 'admin_reset_all'}
                      onClick={handleResetAll}
                      className="atelier-btn inline-flex items-center gap-2 rounded-full bg-[#B91C1C] px-4 py-2 text-xs font-semibold text-[#FFFDF9] hover:bg-[#991B1B]"
                    >
                      Confirm Delete All Names
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="atelier-btn rounded-full border border-white/[0.16] px-4 py-2 text-xs font-medium text-[#D8E2DC] hover:text-[#FFFDF9]"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
