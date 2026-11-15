import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle,
  EnvelopeSimple,
  LockKey,
  SealCheck,
  Sparkle,
} from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import { AdminDialog } from './components/AdminDialog';
import { DrawDialog } from './components/DrawDialog';
import { ErrorMark } from './components/ErrorMark';
import { ApiError, fetchEventState, postEventAction } from './lib/api';
import {
  initGlobalFormValidation,
  resetFormValidationState,
  syncElementAria,
} from './lib/validation';
import type {
  EventState,
  PublicParticipant,
  SavedParticipantRecord,
} from './types';

const POLL_INTERVAL_MS = 4000;
const LOCAL_JOINED_KEY = 'secret_santa_joined_v1';

function readSavedParticipant(): SavedParticipantRecord | null {
  try {
    const raw = localStorage.getItem(LOCAL_JOINED_KEY);
    return raw ? (JSON.parse(raw) as SavedParticipantRecord) : null;
  } catch {
    return null;
  }
}

function writeSavedParticipant(participantId: string, name: string): void {
  try {
    localStorage.setItem(LOCAL_JOINED_KEY, JSON.stringify({ participantId, name }));
  } catch {
    // Ignore privacy/storage errors
  }
}

function clearSavedParticipant(): void {
  try {
    localStorage.removeItem(LOCAL_JOINED_KEY);
  } catch {
    // Ignore
  }
}

function getInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
}

const GRAIN_DATA_URI =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export default function App() {
  const [state, setState] = useState<EventState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedMe, setSavedMe] = useState<SavedParticipantRecord | null>(() =>
    readSavedParticipant()
  );

  // Registration form
  const regFormRef = useRef<HTMLFormElement>(null);
  const [regName, setRegName] = useState('');
  const [regPin, setRegPin] = useState('');
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regServerError, setRegServerError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Dialog states
  const [selectedParticipant, setSelectedParticipant] = useState<PublicParticipant | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);

  // Secret 5-tap trigger state
  const secretTapsRef = useRef<number[]>([]);
  const fetchingRef = useRef(false);

  const applyNewState = useCallback((next: EventState) => {
    setState(next);
    setLoadError(null);
    setSavedMe((prev) => {
      if (prev && !next.participants.some((p) => p.id === prev.participantId)) {
        clearSavedParticipant();
        return null;
      }
      return prev;
    });
  }, []);

  const refreshNow = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const next = await fetchEventState();
      applyNewState(next);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to sync event state.');
    } finally {
      fetchingRef.current = false;
    }
  }, [applyNewState]);

  // Initialize validation sync & hidden URL trigger
  useEffect(() => {
    const cleanupValidation = initGlobalFormValidation();

    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === '1' || window.location.hash === '#admin') {
      setAdminOpen(true);
      window.history.replaceState({}, '', window.location.pathname);
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'a' && e.shiftKey && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setAdminOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      cleanupValidation();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // Live polling
  useEffect(() => {
    refreshNow();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshNow();
      }
    }, POLL_INTERVAL_MS);

    const onVisChange = () => {
      if (document.visibilityState === 'visible') {
        refreshNow();
      }
    };
    document.addEventListener('visibilitychange', onVisChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, [refreshNow]);

  // Update document title & initialize aria-invalid on newly mounted inputs
  useEffect(() => {
    if (state?.eventName) {
      document.title = `${state.eventName} · Winter Gift Exchange`;
    }
    if (state) {
      requestAnimationFrame(() => {
        regFormRef.current
          ?.querySelectorAll('input')
          .forEach((el) => syncElementAria(el, false));
      });
    }
  }, [state?.eventName, state?.phase]);

  const handleCrestTap = () => {
    const now = Date.now();
    const recent = secretTapsRef.current.filter((t) => now - t < 2500);
    recent.push(now);
    secretTapsRef.current = recent;
    if (recent.length >= 5) {
      secretTapsRef.current = [];
      setAdminOpen(true);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setRegServerError(null);
    setStatusMessage(null);
    setRegSubmitting(true);

    const cleanName = regName.trim();
    const cleanPin = regPin.trim();

    try {
      const data = await postEventAction<{ participantId: string }>('register', {
        name: cleanName,
        pin: cleanPin,
      });
      writeSavedParticipant(data.participantId, cleanName);
      setSavedMe({ participantId: data.participantId, name: cleanName });
      setRegName('');
      setRegPin('');
      resetFormValidationState(regFormRef.current);
      applyNewState(data.state);
      setStatusMessage(`${cleanName} has been inscribed in the guest ledger.`);
    } catch (err) {
      if (err instanceof ApiError) {
        setRegServerError(err.message);
        if (err.status === 409) refreshNow();
      } else {
        setRegServerError('Unable to complete registration. Please try again.');
      }
    } finally {
      setRegSubmitting(false);
    }
  };

  const handleEventReset = () => {
    clearSavedParticipant();
    setSavedMe(null);
    setStatusMessage(null);
  };

  const isDrawing = state?.phase === 'DRAWING';
  const totalCount = state?.participants.length ?? 0;
  const drawnCount = state?.participants.filter((p) => p.hasDrawn).length ?? 0;

  return (
    <div className="relative min-h-[100dvh] flex flex-col bg-[#0B0F0E] text-[#F5F2EB]">
      {/* Fixed GPU-safe subtle atmospheric glow & film grain */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 left-[-10%] h-[480px] w-[480px] rounded-full bg-[#C83E31]/[0.07] blur-[120px]" />
        <div className="absolute bottom-[-160px] right-[-8%] h-[420px] w-[420px] rounded-full bg-[#1C4538]/[0.22] blur-[120px]" />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.028]"
        style={{ backgroundImage: GRAIN_DATA_URI }}
      />

      {/* Minimal Editorial Top Masthead (No visible admin controls) */}
      <header className="relative z-10 border-b border-white/[0.07]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={handleCrestTap}
              aria-label="Atelier crest"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#C83E31] text-[#F5F2EB] shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)] ring-1 ring-[#C83E31]/60 transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.94]"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" />
                <circle cx="12" cy="12" r="2.6" fill="#0B0F0E" stroke="#C5A059" strokeWidth="1.4" />
              </svg>
            </button>

            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#9E988E]">
                Atelier Gift Exchange
              </p>
              <p className="text-sm font-medium text-[#F5F2EB]">
                {isDrawing ? 'Unsealing Correspondence' : 'Guest Registry'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {state?.budget && state.budget.trim() && (
              <span className="rounded-full border border-[#C5A059]/30 bg-[#C5A059]/10 px-3.5 py-1 font-mono text-xs text-[#C5A059]">
                {state.budget}
              </span>
            )}
            <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1 font-mono text-xs text-[#9E988E]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C5A059]" aria-hidden="true" />
              {state ? (isDrawing ? 'Draw Open' : 'Registry Open') : 'Connecting'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Asymmetric Split Content */}
      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14 lg:py-16">
        {!state && !loadError ? (
          /* Skeletal Loader matching asymmetric 5 / 7 split */
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="space-y-6 lg:col-span-5">
              <div className="h-12 w-3/4 animate-pulse rounded-xl bg-white/[0.06]" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-white/[0.04]" />
              <div className="h-72 w-full animate-pulse rounded-[28px] bg-white/[0.04]" />
            </div>
            <div className="space-y-4 lg:col-span-7">
              <div className="h-8 w-44 animate-pulse rounded bg-white/[0.05]" />
              <div className="h-20 w-full animate-pulse rounded-2xl bg-white/[0.03]" />
              <div className="h-20 w-full animate-pulse rounded-2xl bg-white/[0.03]" />
              <div className="h-20 w-full animate-pulse rounded-2xl bg-white/[0.03]" />
            </div>
          </div>
        ) : loadError && !state ? (
          <div className="rounded-2xl border border-[#C83E31]/35 bg-[#C83E31]/10 p-6 text-sm text-[#F28B7D]">
            <p className="font-semibold">Unable to load event state</p>
            <p className="mt-1 opacity-90">{loadError}</p>
          </div>
        ) : state ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
            className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-14"
          >
            {/* LEFT COLUMN: Editorial Header + Primary Action Surface */}
            <section className="lg:col-span-5" aria-labelledby="event-main-heading">
              <div className="mb-8">
                <h1
                  id="event-main-heading"
                  className="font-serif text-4xl leading-[0.98] tracking-tight text-[#F5F2EB] sm:text-5xl lg:text-[3.5rem]"
                >
                  {state.eventName}
                </h1>
                <p className="mt-4 max-w-[44ch] text-base leading-relaxed text-[#9E988E]">
                  {isDrawing
                    ? 'Select your sealed correspondence card on the ledger and verify with your 4-digit PIN to uncover who you are gifting to.'
                    : 'Inscribe your name and choose a private 4-digit PIN. Once every guest has joined, the organizer will unlock the draw.'}
                </p>
              </div>

              {statusMessage && (
                <div
                  role="status"
                  aria-live="polite"
                  className="mb-5 flex items-center gap-2.5 rounded-2xl border border-[#C5A059]/35 bg-[#C5A059]/10 px-4 py-3 text-sm text-[#F5F2EB]"
                >
                  <CheckCircle size={18} weight="light" className="shrink-0 text-[#C5A059]" aria-hidden="true" />
                  <span>{statusMessage}</span>
                </div>
              )}

              {!isDrawing ? (
                /* PHASE 1: Double-Bezel Registration Atelier Form */
                <div className="rounded-[28px] bg-white/[0.025] p-1.5 ring-1 ring-white/[0.08]">
                  <div className="rounded-[22px] bg-[#111715] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] sm:p-7">
                    <div className="mb-5 flex items-center justify-between border-b border-white/[0.07] pb-4">
                      <h2
                        id="register-form-heading"
                        className="font-serif text-2xl tracking-tight text-[#F5F2EB]"
                      >
                        Enter the Guest Ledger
                      </h2>
                      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#9E988E]">
                        Phase 01
                      </span>
                    </div>

                    {savedMe && (
                      <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-[#C5A059]/30 bg-[#C5A059]/[0.08] px-3.5 py-3 text-xs leading-relaxed text-[#F5F2EB]">
                        <Sparkle size={16} weight="light" className="mt-0.5 shrink-0 text-[#C5A059]" aria-hidden="true" />
                        <span>
                          Registered on this device as{' '}
                          <strong className="font-semibold">{savedMe.name}</strong>. Keep your PIN
                          handy for when the draw opens.
                        </span>
                      </div>
                    )}

                    <form
                      ref={regFormRef}
                      method="POST"
                      action="/api/event"
                      aria-labelledby="register-form-heading"
                      onSubmit={handleRegisterSubmit}
                      className="space-y-5"
                    >
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="reg-name" className="text-sm font-medium text-[#F5F2EB]">
                          Your Name <span className="text-[#C83E31]" aria-hidden="true">*</span>
                        </label>
                        <span id="reg-name-hint" className="text-xs text-[#9E988E]">
                          2–40 characters, visible to all participants
                        </span>
                        <input
                          id="reg-name"
                          name="name"
                          type="text"
                          minLength={2}
                          maxLength={40}
                          required
                          autoComplete="name"
                          enterKeyHint="next"
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          aria-describedby="reg-name-hint"
                          data-error="reg-name-error"
                          placeholder="e.g. Layla Al-Mansour"
                          className="atelier-input"
                        />
                        <div id="reg-name-error" className="error-msg">
                          <ErrorMark />
                          <span>Please enter a name between 2 and 40 characters.</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="reg-pin" className="text-sm font-medium text-[#F5F2EB]">
                          4-Digit Secret PIN{' '}
                          <span className="text-[#C83E31]" aria-hidden="true">*</span>
                        </label>
                        <span id="reg-pin-hint" className="text-xs text-[#9E988E]">
                          Choose 4 digits (0–9) to privately unseal your match later
                        </span>
                        <input
                          id="reg-pin"
                          name="pin"
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
                          value={regPin}
                          onChange={(e) => setRegPin(e.target.value)}
                          aria-describedby="reg-pin-hint"
                          data-error="reg-pin-error"
                          placeholder="e.g. 4821"
                          className="atelier-input font-mono tracking-[0.25em]"
                        />
                        <div id="reg-pin-error" className="error-msg">
                          <ErrorMark />
                          <span>Enter exactly 4 numeric digits (for example, 4821).</span>
                        </div>
                      </div>

                      {regServerError && (
                        <div
                          role="alert"
                          className="flex items-start gap-2 rounded-xl border border-[#C83E31]/40 bg-[#C83E31]/12 px-3.5 py-2.5 text-sm text-[#F28B7D]"
                        >
                          <ErrorMark />
                          <span>{regServerError}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={regSubmitting}
                        className="atelier-btn group flex w-full items-center justify-between rounded-full bg-[#C83E31] py-2 pl-6 pr-2 text-sm font-semibold text-[#F5F2EB] shadow-[0_14px_32px_-12px_rgba(200,62,49,0.65)] transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-[#d64538] active:scale-[0.98] disabled:opacity-60"
                      >
                        <span>{regSubmitting ? 'Inscribing...' : 'Join the Exchange'}</span>
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/20 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                          <ArrowUpRight size={17} weight="regular" aria-hidden="true" />
                        </span>
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                /* PHASE 2: Draw Completion Summary Module */
                <div className="rounded-[28px] bg-white/[0.025] p-1.5 ring-1 ring-white/[0.08]">
                  <div className="rounded-[22px] bg-[#111715] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] sm:p-7">
                    <div className="mb-4 flex items-center justify-between border-b border-white/[0.07] pb-4">
                      <h2 className="font-serif text-2xl tracking-tight text-[#F5F2EB]">
                        Draw Progress
                      </h2>
                      <span className="font-mono text-xs text-[#C5A059]">
                        {drawnCount} / {totalCount}
                      </span>
                    </div>

                    <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
                      <div
                        className="h-full rounded-full bg-[#C5A059] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]"
                        style={{
                          width: `${totalCount > 0 ? (drawnCount / totalCount) * 100 : 0}%`,
                        }}
                      />
                    </div>

                    <p className="text-sm leading-relaxed text-[#9E988E]">
                      {drawnCount === totalCount && totalCount > 0
                        ? 'Every participant has unsealed their correspondence. You may still tap your card to re-verify with your PIN.'
                        : `${totalCount - drawnCount} ${totalCount - drawnCount === 1 ? 'envelope remains' : 'envelopes remain'} sealed.`}
                    </p>
                  </div>
                </div>
              )}
            </section>

            {/* RIGHT COLUMN: Guest Ledger (Phase 1) or Sealed Correspondence Grid (Phase 2) */}
            <section
              className="lg:col-span-7"
              aria-labelledby="ledger-heading"
            >
              <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2 border-b border-white/[0.08] pb-4">
                <div>
                  <h2
                    id="ledger-heading"
                    className="font-serif text-3xl tracking-tight text-[#F5F2EB]"
                  >
                    {isDrawing ? 'Sealed Correspondence' : 'Guest Ledger'}
                  </h2>
                  <p className="mt-1 text-xs text-[#9E988E]">
                    {totalCount} {totalCount === 1 ? 'participant' : 'participants'} · Updates
                    automatically
                  </p>
                </div>

                {!isDrawing && (
                  <span className="font-mono text-xs text-[#9E988E]">
                    Min. 3 guests to draw
                  </span>
                )}
              </div>

              {!isDrawing ? (
                totalCount === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/[0.12] px-6 py-14 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04] text-[#9E988E]">
                      <EnvelopeSimple size={22} weight="light" aria-hidden="true" />
                    </div>
                    <p className="font-serif text-2xl text-[#F5F2EB]">
                      The ledger awaits its first guest
                    </p>
                    <p className="mx-auto mt-1.5 max-w-[36ch] text-sm text-[#9E988E]">
                      Share this page link so everyone can enter their name and personal 4-digit
                      PIN.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-white/[0.07]">
                    {state.participants.map((p, index) => {
                      const isYou = savedMe?.participantId === p.id;
                      return (
                        <li
                          key={p.id}
                          className="flex items-center justify-between gap-4 py-3.5"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <span className="w-6 shrink-0 font-mono text-xs text-[#9E988E]">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <span
                              aria-hidden="true"
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold ${
                                isYou
                                  ? 'bg-[#C83E31] text-[#F5F2EB]'
                                  : 'bg-white/[0.06] text-[#F5F2EB] ring-1 ring-white/[0.08]'
                              }`}
                            >
                              {getInitial(p.name)}
                            </span>
                            <span className="truncate text-base font-medium text-[#F5F2EB]">
                              {p.name}
                            </span>
                          </div>

                          <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-[#9E988E]">
                            {isYou ? 'This device' : 'Confirmed'}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {state.participants.map((p) => {
                    const isYou = savedMe?.participantId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedParticipant(p)}
                        className="atelier-btn group text-left rounded-[24px] bg-white/[0.025] p-1.5 ring-1 ring-white/[0.08] transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover:ring-[#C5A059]/45 active:scale-[0.985]"
                      >
                        <div
                          className={`flex min-h-[124px] flex-col justify-between rounded-[18px] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] transition-colors duration-300 ${
                            p.hasDrawn
                              ? 'bg-[#121A17] group-hover:bg-[#16201C]'
                              : 'bg-[#111715] group-hover:bg-[#171E1B]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                aria-hidden="true"
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold ${
                                  isYou
                                    ? 'bg-[#C83E31] text-[#F5F2EB]'
                                    : 'bg-white/[0.06] text-[#F5F2EB] ring-1 ring-white/[0.1]'
                                }`}
                              >
                                {getInitial(p.name)}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-base font-semibold text-[#F5F2EB]">
                                  {p.name}
                                </p>
                                {isYou && (
                                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#C5A059]">
                                    This device
                                  </p>
                                )}
                              </div>
                            </div>

                            {p.hasDrawn ? (
                              <SealCheck
                                size={20}
                                weight="light"
                                className="shrink-0 text-[#C5A059]"
                                aria-hidden="true"
                              />
                            ) : (
                              <EnvelopeSimple
                                size={20}
                                weight="light"
                                className="shrink-0 text-[#C83E31] transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:-translate-y-0.5"
                                aria-hidden="true"
                              />
                            )}
                          </div>

                          <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-3">
                            <span
                              className={`font-mono text-[11px] uppercase tracking-[0.14em] ${
                                p.hasDrawn ? 'text-[#C5A059]' : 'text-[#9E988E]'
                              }`}
                            >
                              {p.hasDrawn ? 'Seal Broken · Re-open' : 'Seal Intact · Unseal'}
                            </span>
                            <LockKey
                              size={14}
                              weight="light"
                              className="text-[#9E988E] transition-colors group-hover:text-[#F5F2EB]"
                              aria-hidden="true"
                            />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </motion.div>
        ) : null}
      </main>

      {/* Subtle Footer */}
      <footer className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-xs text-[#9E988E] sm:px-8">
          <span className="font-mono">
            {state?.storageMode === 'vercel-storage'
              ? 'Synced via Vercel Storage'
              : 'Local Dev Storage'}
          </span>
          <span>
            Pairings stay private on the server and are unsealed only with your personal PIN.
          </span>
        </div>
      </footer>

      {/* Modal Dialogs */}
      <DrawDialog
        participant={selectedParticipant}
        budget={state?.budget || ''}
        onClose={() => setSelectedParticipant(null)}
        onStateUpdate={applyNewState}
      />

      {state && (
        <AdminDialog
          open={adminOpen}
          state={state}
          onClose={() => setAdminOpen(false)}
          onStateUpdate={applyNewState}
          onEventReset={handleEventReset}
        />
      )}
    </div>
  );
}
