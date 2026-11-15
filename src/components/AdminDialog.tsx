import { useEffect, useRef, useState } from 'react';
import {
  ArrowsClockwise,
  ArrowUpRight,
  Check,
  Key,
  Lock,
  LockOpen,
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

  // Inline PIN reset
  const [pinResetTargetId, setPinResetTargetId] = useState<string | null>(null);
  const [pinResetValue, setPinResetValue] = useState('');

  // Manual participant add
  const [addName, setAddName] = useState('');
  const [addPin, setAddPin] = useState('');

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
      setPinResetTargetId(null);
      setPinResetValue('');
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
      requestAnimationFrame(() => {
        if (!activeAdminPin && loginPinRef.current) {
          syncElementAria(loginPinRef.current, false);
          loginPinRef.current.focus();
        }
      });
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, activeAdminPin]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      dialogRef.current
        ?.querySelectorAll('input')
        .forEach((el) => syncElementAria(el, false));
    });
  }, [open, activeAdminPin, pinResetTargetId, state.phase]);

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

  const runAdminAction = async (
    actionKey: string,
    payload: Record<string, unknown>,
    successMessage: string
  ) => {
    if (!activeAdminPin) return false;
    setFeedback(null);
    setBusyAction(actionKey);
    try {
      const res = await postEventAction(actionKey, { adminPin: activeAdminPin, ...payload });
      onStateUpdate(res.state);
      setFeedback({ text: successMessage, isError: false });
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
    const ok = await runAdminAction(
      'admin_add_participant',
      { name: addName.trim(), pin: addPin.trim() },
      `Added ${addName.trim()} to the guest ledger.`
    );
    if (ok) {
      setAddName('');
      setAddPin('');
      resetFormValidationState(addFormRef.current);
    }
  };

  const handlePinResetSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
    participantId: string,
    participantName: string
  ) => {
    e.preventDefault();
    const ok = await runAdminAction(
      'admin_reset_pin',
      { participantId, newPin: pinResetValue.trim() },
      `Updated PIN for ${participantName}.`
    );
    if (ok) {
      setPinResetTargetId(null);
      setPinResetValue('');
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
      setFeedback({ text: 'Event settings updated.', isError: false });
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
      'Event reset. Ready for a fresh guest ledger.'
    );
    if (ok) {
      setConfirmReset(false);
      onEventReset();
    }
  };

  const isDrawing = state.phase === 'DRAWING';
  const total = state.participants.length;
  const drawnCount = state.participants.filter((p) => p.hasDrawn).length;

  return (
    <dialog
      ref={dialogRef}
      id="admin-dialog"
      className="atelier-dialog atelier-dialog-wide"
      aria-labelledby="admin-dialog-title"
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      <div className="atelier-dialog-scroll rounded-[28px] bg-white/[0.03] p-1.5 ring-1 ring-white/[0.08]">
        <div className="rounded-[22px] bg-[#111715] p-6 sm:p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-4 mb-5">
            <div>
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-[#C5A059]">
                <ShieldCheck size={14} weight="regular" aria-hidden="true" />
                Organizer Console
              </span>
              <h2
                id="admin-dialog-title"
                className="mt-1 font-serif text-3xl leading-none tracking-tight text-[#F5F2EB]"
              >
                {activeAdminPin ? 'Event Administration' : 'Organizer Verification'}
              </h2>
            </div>

            <form method="dialog">
              <button
                type="submit"
                value="close"
                aria-label="Close organizer console"
                className="atelier-btn inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04] text-[#9E988E] ring-1 ring-white/[0.08] transition-colors duration-200 hover:bg-white/[0.08] hover:text-[#F5F2EB] active:scale-[0.97]"
              >
                <X size={18} weight="light" aria-hidden="true" />
              </button>
            </form>
          </div>

          {!activeAdminPin ? (
            <div>
              <p className="mb-5 text-sm leading-relaxed text-[#9E988E]">
                Manage the guest ledger, initiate the draw, and monitor completion without
                revealing private pairings.
              </p>

              <form
                ref={loginFormRef}
                method="POST"
                action="/api/event"
                aria-labelledby="admin-dialog-title"
                onSubmit={handleLoginSubmit}
              >
                <div className="mb-5 flex flex-col gap-1.5">
                  <label htmlFor="admin-pin-input" className="text-sm font-medium text-[#F5F2EB]">
                    Organizer 4-Digit PIN <span className="text-[#C83E31]" aria-hidden="true">*</span>
                  </label>
                  <span id="admin-pin-hint" className="text-xs text-[#9E988E]">
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
                    className="mb-4 flex items-start gap-2 rounded-xl border border-[#C83E31]/40 bg-[#C83E31]/12 px-3.5 py-2.5 text-sm text-[#F28B7D]"
                  >
                    <ErrorMark />
                    <span>{loginError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loginSubmitting}
                  className="atelier-btn group flex w-full items-center justify-between rounded-full bg-[#C83E31] py-2 pl-6 pr-2 text-sm font-semibold text-[#F5F2EB] transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-[#d64538] active:scale-[0.98] disabled:opacity-60"
                >
                  <span>{loginSubmitting ? 'Verifying...' : 'Unlock Organizer Console'}</span>
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
                      ? 'border-[#C83E31]/40 bg-[#C83E31]/12 text-[#F28B7D]'
                      : 'border-[#C5A059]/35 bg-[#C5A059]/10 text-[#F5F2EB]'
                  }`}
                >
                  {feedback.text}
                </div>
              )}

              {/* Phase Controls */}
              <section aria-labelledby="admin-phase-heading">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 id="admin-phase-heading" className="text-base font-semibold text-[#F5F2EB]">
                    Exchange Phase
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveAdminPin(null);
                      setPinResetTargetId(null);
                    }}
                    className="atelier-btn inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.03] px-3.5 py-1.5 text-xs font-medium text-[#9E988E] transition-colors hover:bg-white/[0.07] hover:text-[#F5F2EB]"
                  >
                    <Lock size={13} weight="regular" aria-hidden="true" />
                    Lock Console
                  </button>
                </div>

                {!isDrawing ? (
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                    <p className="mb-4 text-sm text-[#9E988E]">
                      {total >= 3
                        ? `${total} participants ready. Locking registration generates a randomized single-cycle pairing.`
                        : `Need at least 3 participants to start the draw (${total} joined so far).`}
                    </p>
                    <button
                      type="button"
                      disabled={total < 3 || busyAction === 'admin_start_draw'}
                      onClick={() =>
                        runAdminAction(
                          'admin_start_draw',
                          {},
                          'Registration locked and secret pairings generated.'
                        )
                      }
                      className="atelier-btn group flex w-full items-center justify-between rounded-full bg-[#C83E31] py-2 pl-5 pr-2 text-sm font-semibold text-[#F5F2EB] transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-[#d64538] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <span>
                        {busyAction === 'admin_start_draw'
                          ? 'Shuffling Pairings...'
                          : 'Lock Registration & Open Draw'}
                      </span>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/20">
                        <ArrowUpRight size={16} weight="regular" aria-hidden="true" />
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                    <div className="mb-3 flex items-baseline justify-between">
                      <span className="text-sm text-[#9E988E]">Envelope Completion</span>
                      <span className="font-mono text-sm font-semibold text-[#C5A059]">
                        {drawnCount} / {total} unsealed
                      </span>
                    </div>
                    <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
                      <div
                        className="h-full rounded-full bg-[#C5A059] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]"
                        style={{ width: `${total > 0 ? (drawnCount / total) * 100 : 0}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      <button
                        type="button"
                        disabled={busyAction === 'admin_reshuffle'}
                        onClick={() =>
                          runAdminAction(
                            'admin_reshuffle',
                            {},
                            'All pairings freshly re-shuffled and statuses reset.'
                          )
                        }
                        className="atelier-btn inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-xs font-semibold text-[#F5F2EB] transition-colors hover:bg-white/[0.08] active:scale-[0.98]"
                      >
                        <ArrowsClockwise size={14} weight="regular" aria-hidden="true" />
                        Re-shuffle Matches
                      </button>
                      <button
                        type="button"
                        disabled={busyAction === 'admin_reopen_registration'}
                        onClick={() =>
                          runAdminAction(
                            'admin_reopen_registration',
                            {},
                            'Registration re-opened. Previous pairings were cleared.'
                          )
                        }
                        className="atelier-btn inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-xs font-semibold text-[#F5F2EB] transition-colors hover:bg-white/[0.08] active:scale-[0.98]"
                      >
                        <LockOpen size={14} weight="regular" aria-hidden="true" />
                        Re-open Registration
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* Participant Manager */}
              <section
                aria-labelledby="admin-participants-heading"
                className="border-t border-white/[0.08] pt-5"
              >
                <h3
                  id="admin-participants-heading"
                  className="mb-1 text-base font-semibold text-[#F5F2EB]"
                >
                  Guest Ledger (Spoiler-Free)
                </h3>
                <p className="mb-3 text-xs text-[#9E988E]">
                  Track status or reset forgotten PINs without exposing matches.
                </p>

                {total === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/[0.12] px-4 py-4 text-sm text-[#9E988E]">
                    No participants have joined yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-white/[0.07] rounded-2xl border border-white/[0.08] bg-white/[0.02]">
                    {state.participants.map((p) => (
                      <li key={p.id} className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="font-medium text-[#F5F2EB]">{p.name}</span>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[11px] ${
                                isDrawing
                                  ? p.hasDrawn
                                    ? 'bg-[#C5A059]/15 text-[#C5A059]'
                                    : 'bg-white/[0.06] text-[#9E988E]'
                                  : 'bg-white/[0.06] text-[#9E988E]'
                              }`}
                            >
                              {isDrawing ? (p.hasDrawn ? 'Unsealed' : 'Pending') : 'Registered'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setPinResetTargetId(pinResetTargetId === p.id ? null : p.id);
                                setPinResetValue('');
                              }}
                              className="atelier-btn inline-flex items-center gap-1 rounded-full border border-white/[0.1] px-3 py-1 text-xs font-medium text-[#9E988E] transition-colors hover:bg-white/[0.06] hover:text-[#F5F2EB]"
                            >
                              <Key size={13} weight="regular" aria-hidden="true" />
                              Reset PIN
                            </button>

                            {!isDrawing && (
                              <button
                                type="button"
                                onClick={() =>
                                  runAdminAction(
                                    'admin_remove_participant',
                                    { participantId: p.id },
                                    `Removed ${p.name} from the ledger.`
                                  )
                                }
                                className="atelier-btn inline-flex items-center gap-1 rounded-full border border-[#C83E31]/30 px-3 py-1 text-xs font-medium text-[#F28B7D] transition-colors hover:bg-[#C83E31]/15"
                              >
                                <UserMinus size={13} weight="regular" aria-hidden="true" />
                                Remove
                              </button>
                            )}
                          </div>
                        </div>

                        {pinResetTargetId === p.id && (
                          <form
                            method="POST"
                            action="/api/event"
                            aria-label={`Reset PIN for ${p.name}`}
                            onSubmit={(e) => handlePinResetSubmit(e, p.id, p.name)}
                            className="mt-3 flex flex-wrap items-end gap-2.5 border-t border-white/[0.06] pt-3"
                          >
                            <div className="flex min-w-[140px] flex-1 flex-col gap-1">
                              <label
                                htmlFor={`reset-pin-${p.id}`}
                                className="text-xs font-medium text-[#9E988E]"
                              >
                                New 4-Digit PIN for {p.name}
                              </label>
                              <input
                                id={`reset-pin-${p.id}`}
                                name="newPin"
                                type="text"
                                inputMode="numeric"
                                pattern="\d{4}"
                                minLength={4}
                                maxLength={4}
                                required
                                autoComplete="off"
                                autoFocus
                                value={pinResetValue}
                                onChange={(e) => setPinResetValue(e.target.value)}
                                placeholder="4 digits"
                                className="atelier-input font-mono"
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={busyAction === 'admin_reset_pin'}
                              className="atelier-btn inline-flex items-center gap-1.5 rounded-full bg-[#C83E31] px-4 py-2 text-xs font-semibold text-[#F5F2EB] hover:bg-[#d64538]"
                            >
                              <Check size={14} weight="bold" aria-hidden="true" />
                              Save PIN
                            </button>
                            <button
                              type="button"
                              onClick={() => setPinResetTargetId(null)}
                              className="atelier-btn rounded-full border border-white/[0.12] px-4 py-2 text-xs font-medium text-[#9E988E] hover:text-[#F5F2EB]"
                            >
                              Cancel
                            </button>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {!isDrawing && (
                  <form
                    ref={addFormRef}
                    method="POST"
                    action="/api/event"
                    aria-labelledby="admin-add-heading"
                    onSubmit={handleAddSubmit}
                    className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4"
                  >
                    <h4 id="admin-add-heading" className="mb-3 text-sm font-semibold text-[#F5F2EB]">
                      Add Guest Manually
                    </h4>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                      <div className="flex flex-col gap-1 sm:col-span-7">
                        <label
                          htmlFor="admin-add-name"
                          className="text-xs font-medium text-[#F5F2EB]"
                        >
                          Name <span className="text-[#C83E31]" aria-hidden="true">*</span>
                        </label>
                        <span id="admin-add-name-hint" className="text-[11px] text-[#9E988E]">
                          2–40 characters
                        </span>
                        <input
                          id="admin-add-name"
                          name="name"
                          type="text"
                          minLength={2}
                          maxLength={40}
                          required
                          autoComplete="off"
                          value={addName}
                          onChange={(e) => setAddName(e.target.value)}
                          aria-describedby="admin-add-name-hint"
                          data-error="admin-add-name-error"
                          placeholder="Guest name"
                          className="atelier-input"
                        />
                        <div id="admin-add-name-error" className="error-msg">
                          <ErrorMark />
                          <span>Enter 2–40 characters.</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 sm:col-span-5">
                        <label
                          htmlFor="admin-add-pin"
                          className="text-xs font-medium text-[#F5F2EB]"
                        >
                          4-Digit PIN <span className="text-[#C83E31]" aria-hidden="true">*</span>
                        </label>
                        <span id="admin-add-pin-hint" className="text-[11px] text-[#9E988E]">
                          Share privately with guest
                        </span>
                        <input
                          id="admin-add-pin"
                          name="pin"
                          type="text"
                          inputMode="numeric"
                          pattern="\d{4}"
                          minLength={4}
                          maxLength={4}
                          required
                          autoComplete="off"
                          value={addPin}
                          onChange={(e) => setAddPin(e.target.value)}
                          aria-describedby="admin-add-pin-hint"
                          data-error="admin-add-pin-error"
                          placeholder="1234"
                          className="atelier-input font-mono"
                        />
                        <div id="admin-add-pin-error" className="error-msg">
                          <ErrorMark />
                          <span>4 numeric digits required.</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={busyAction === 'admin_add_participant'}
                      className="atelier-btn mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.05] px-4 py-2 text-xs font-semibold text-[#F5F2EB] transition-colors hover:bg-white/[0.1]"
                    >
                      <Plus size={14} weight="bold" aria-hidden="true" />
                      Add to Ledger
                    </button>
                  </form>
                )}
              </section>

              {/* Event Settings */}
              <section
                aria-labelledby="admin-settings-heading"
                className="border-t border-white/[0.08] pt-5"
              >
                <h3
                  id="admin-settings-heading"
                  className="mb-3 text-base font-semibold text-[#F5F2EB]"
                >
                  Exchange Settings
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
                      className="text-xs font-medium text-[#F5F2EB]"
                    >
                      Event Title <span className="text-[#C83E31]" aria-hidden="true">*</span>
                    </label>
                    <span id="settings-event-name-hint" className="text-[11px] text-[#9E988E]">
                      Displayed on the masthead (2–60 characters)
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
                        className="text-xs font-medium text-[#F5F2EB]"
                      >
                        Gift Budget or Note
                      </label>
                      <span id="settings-budget-hint" className="text-[11px] text-[#9E988E]">
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
                        className="text-xs font-medium text-[#F5F2EB]"
                      >
                        Change Organizer PIN
                      </label>
                      <span id="settings-new-pin-hint" className="text-[11px] text-[#9E988E]">
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
                    className="atelier-btn inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.06] px-5 py-2 text-xs font-semibold text-[#F5F2EB] transition-colors hover:bg-white/[0.12]"
                  >
                    <Check size={14} weight="bold" aria-hidden="true" />
                    Save Settings
                  </button>
                </form>
              </section>

              {/* Reset Event */}
              <section
                aria-labelledby="admin-danger-heading"
                className="border-t border-white/[0.08] pt-5"
              >
                <h3 id="admin-danger-heading" className="mb-1 text-base font-semibold text-[#F28B7D]">
                  Reset Exchange
                </h3>
                <p className="mb-3 text-xs text-[#9E988E]">
                  Clears every participant and pairing to begin a new event.
                </p>

                {!confirmReset ? (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="atelier-btn inline-flex items-center gap-2 rounded-full border border-[#C83E31]/40 bg-[#C83E31]/10 px-4 py-2 text-xs font-semibold text-[#F28B7D] transition-colors hover:bg-[#C83E31]/20"
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
                      className="atelier-btn inline-flex items-center gap-2 rounded-full bg-[#C83E31] px-4 py-2 text-xs font-semibold text-[#F5F2EB] hover:bg-[#d64538]"
                    >
                      Confirm Delete All Names
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="atelier-btn rounded-full border border-white/[0.12] px-4 py-2 text-xs font-medium text-[#9E988E] hover:text-[#F5F2EB]"
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
