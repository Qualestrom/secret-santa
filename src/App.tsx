import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  ArrowsLeftRight,
  CheckCircle,
  Sparkle,
  Users,
} from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { AdminDialog } from './components/AdminDialog';
import {
  HollySprig,
  SnowfallLayer,
  WaitingStickCup,
} from './components/ChristmasDecor';
import { ErrorMark } from './components/ErrorMark';
import { StickPackStage } from './components/StickPackStage';
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

const POLL_INTERVAL_MS = 3500;
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
    // Ignore storage quota / privacy mode errors
  }
}

function clearSavedParticipant(): void {
  try {
    localStorage.removeItem(LOCAL_JOINED_KEY);
  } catch {
    // Ignore
  }
}

export default function App() {
  const [state, setState] = useState<EventState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedMe, setSavedMe] = useState<SavedParticipantRecord | null>(() =>
    readSavedParticipant()
  );
  const [showReconnectPicker, setShowReconnectPicker] = useState(false);

  // Welcome Name Entry Form
  const regFormRef = useRef<HTMLFormElement>(null);
  const [regName, setRegName] = useState('');
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regServerError, setRegServerError] = useState<string | null>(null);

  // Hidden Admin Dialog
  const [adminOpen, setAdminOpen] = useState(false);
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
      setLoadError(err instanceof Error ? err.message : 'Unable to sync Christmas event.');
    } finally {
      fetchingRef.current = false;
    }
  }, [applyNewState]);

  // Validation sync + Hidden Admin URL/Keyboard triggers
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

  // Sync document title & newly mounted input aria-invalid
  useEffect(() => {
    if (state?.eventName) {
      document.title = `${state.eventName} · Secret Santa`;
    }
    if (state) {
      requestAnimationFrame(() => {
        regFormRef.current
          ?.querySelectorAll('input')
          .forEach((el) => syncElementAria(el, false));
      });
    }
  }, [state?.eventName, state?.phase, savedMe]);

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
    setRegSubmitting(true);

    const cleanName = regName.trim();

    try {
      const data = await postEventAction<{ participantId: string }>('register', {
        name: cleanName,
      });
      writeSavedParticipant(data.participantId, cleanName);
      setSavedMe({ participantId: data.participantId, name: cleanName });
      setRegName('');
      setShowReconnectPicker(false);
      resetFormValidationState(regFormRef.current);
      applyNewState(data.state);
    } catch (err) {
      if (err instanceof ApiError) {
        setRegServerError(err.message);
        if (err.status === 409) refreshNow();
      } else {
        setRegServerError('Unable to add your name right now. Please try again.');
      }
    } finally {
      setRegSubmitting(false);
    }
  };

  const handleSelectExistingGuest = (participant: PublicParticipant) => {
    writeSavedParticipant(participant.id, participant.name);
    setSavedMe({ participantId: participant.id, name: participant.name });
    setShowReconnectPicker(false);
  };

  const handleClearGuest = () => {
    clearSavedParticipant();
    setSavedMe(null);
  };

  const handleEventReset = () => {
    clearSavedParticipant();
    setSavedMe(null);
    setShowReconnectPicker(false);
  };

  const currentGuest =
    state && savedMe
      ? state.participants.find((p) => p.id === savedMe.participantId) ?? null
      : null;

  const isDrawing = state?.phase === 'DRAWING';
  const totalCount = state?.participants.length ?? 0;

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-[#0F291E] text-[#FFFDF9]">
      {/* Warm Christmas Evergreen & Candlelight Glow */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-44 left-1/2 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-[#D99B26]/[0.11] blur-[140px]" />
        <div className="absolute bottom-[-160px] left-[-10%] h-[420px] w-[420px] rounded-full bg-[#B91C1C]/[0.16] blur-[130px]" />
        <div className="absolute right-[-8%] top-[30%] h-[380px] w-[380px] rounded-full bg-[#1E5B3E]/[0.45] blur-[120px]" />
      </div>

      {/* Gentle Snowfall Particles */}
      <SnowfallLayer />

      {/* Festive Top Header (Zero Visible Admin Buttons) */}
      <header className="relative z-20 border-b border-[#D99B26]/20 bg-[#0B1F16]/65 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3.5">
            {/* Hidden 5-Tap Secret Crest */}
            <button
              type="button"
              onClick={handleCrestTap}
              aria-label="Christmas Gift Exchange Crest"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#B91C1C] text-[#FFFDF9] shadow-[0_4px_16px_rgba(185,28,28,0.45)] ring-2 ring-[#D99B26]/70 transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.93]"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                <path
                  d="M12 3L14.4 8.8L20.6 9.3L15.9 13.4L17.3 19.5L12 16.2L6.7 19.5L8.1 13.4L3.4 9.3L9.6 8.8L12 3Z"
                  fill="#FFFDF9"
                  stroke="#D99B26"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#D99B26]">
                Secret Santa
              </p>
              <p className="font-serif text-xl leading-none text-[#FFFDF9] sm:text-2xl">
                {state?.eventName || 'Christmas Secret Santa'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {state?.budget && state.budget.trim() && (
              <span className="rounded-full border border-[#D99B26]/40 bg-[#D99B26]/15 px-3.5 py-1 font-mono text-xs font-medium text-[#FDE68A]">
                {state.budget}
              </span>
            )}
            <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.14] bg-white/[0.06] px-3.5 py-1 font-mono text-xs text-[#E2ECE6]">
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${
                  isDrawing ? 'bg-[#D99B26]' : 'bg-[#4ADE80]'
                }`}
              />
              {state
                ? isDrawing
                  ? 'Pick Your Stick'
                  : 'Collecting Names'
                : 'Loading...'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Centered Festive Stage */}
      <main className="relative z-20 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-5 py-10 sm:px-8 sm:py-14">
        {!state && !loadError ? (
          /* Skeletal Loader */
          <div className="mx-auto w-full max-w-xl rounded-[30px] bg-white/[0.05] p-6">
            <div className="mx-auto mb-4 h-8 w-36 animate-pulse rounded-full bg-white/[0.1]" />
            <div className="mx-auto mb-6 h-12 w-3/4 animate-pulse rounded-xl bg-white/[0.08]" />
            <div className="h-48 w-full animate-pulse rounded-2xl bg-white/[0.06]" />
          </div>
        ) : loadError && !state ? (
          <div className="mx-auto max-w-md rounded-2xl border border-[#B91C1C]/50 bg-[#B91C1C]/20 p-6 text-center text-sm text-[#FCA5A5]">
            <p className="font-semibold">Unable to load Christmas event</p>
            <p className="mt-1 opacity-90">{loadError}</p>
          </div>
        ) : state ? (
          <AnimatePresence mode="wait">
            {!isDrawing && !currentGuest ? (
              /* STAGE A: Welcome Screen — Only Input Your Name */
              <motion.section
                key="stage-welcome"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                aria-labelledby="welcome-heading"
                className="parchment-card mx-auto w-full max-w-xl rounded-[30px] bg-[#D99B26]/25 p-1.5 shadow-[0_28px_70px_-15px_rgba(0,0,0,0.55)]"
              >
                <div className="rounded-[24px] border border-[#D99B26]/35 bg-[#FFFDF9] p-6 text-[#1B2E24] sm:p-10">
                  <div className="mb-7 flex flex-col items-center text-center">
                    <HollySprig className="mb-2 h-8 w-24" />
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#B91C1C]">
                      Christmas Gift Exchange
                    </span>
                    <h1
                      id="welcome-heading"
                      className="mt-2 font-serif text-4xl leading-[0.98] tracking-tight text-[#143D2B] sm:text-5xl"
                    >
                      Welcome! Add Your Name to the Pack
                    </h1>
                    <p className="mt-3 max-w-[40ch] text-sm leading-relaxed text-[#4E5F54]">
                      Enter your name to place your wooden stick in the Christmas tin. Once
                      everyone is in, the stick draw will begin!
                    </p>
                  </div>

                  <form
                    ref={regFormRef}
                    method="POST"
                    action="/api/event"
                    aria-labelledby="welcome-heading"
                    onSubmit={handleRegisterSubmit}
                    className="space-y-5"
                  >
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="reg-name" className="text-sm font-semibold text-[#143D2B]">
                        Your Name <span className="text-[#B91C1C]" aria-hidden="true">*</span>
                      </label>
                      <span id="reg-name-hint" className="text-xs text-[#5F6F65]">
                        2–40 characters (shown in the Christmas pack so everyone knows who joined)
                      </span>
                      <input
                        id="reg-name"
                        name="name"
                        type="text"
                        minLength={2}
                        maxLength={40}
                        required
                        autoComplete="name"
                        enterKeyHint="done"
                        autoFocus
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        aria-describedby="reg-name-hint"
                        data-error="reg-name-error"
                        placeholder="e.g. Layla Al-Mansour"
                        className="atelier-input-light"
                      />
                      <div id="reg-name-error" className="error-msg">
                        <ErrorMark />
                        <span>Please enter your name (2–40 characters).</span>
                      </div>
                    </div>

                    {regServerError && (
                      <div
                        role="alert"
                        className="flex items-start gap-2 rounded-xl border border-[#B91C1C]/35 bg-[#FEE2E2] px-3.5 py-2.5 text-sm font-medium text-[#991B1B]"
                      >
                        <ErrorMark />
                        <span>{regServerError}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={regSubmitting}
                      className="atelier-btn group flex w-full items-center justify-between rounded-full bg-[#B91C1C] py-2 pl-6 pr-2 text-sm font-semibold text-[#FFFDF9] shadow-[0_14px_30px_-10px_rgba(185,28,28,0.55)] transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-[#991B1B] active:scale-[0.98] disabled:opacity-60"
                    >
                      <span>
                        {regSubmitting ? 'Putting Your Stick In...' : 'Put My Stick in the Pack'}
                      </span>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/20 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                        <ArrowUpRight size={17} weight="regular" aria-hidden="true" />
                      </span>
                    </button>
                  </form>

                  {/* Discreet reconnect link if user already submitted name on another tab/device */}
                  {totalCount > 0 && (
                    <div className="mt-6 border-t border-[#E7DCCB] pt-4 text-center">
                      {!showReconnectPicker ? (
                        <button
                          type="button"
                          onClick={() => setShowReconnectPicker(true)}
                          className="text-xs font-medium text-[#4E5F54] underline decoration-[#D99B26]/60 underline-offset-4 transition-colors hover:text-[#B91C1C]"
                        >
                          Already added your name? View the waiting room ({totalCount} joined)
                        </button>
                      ) : (
                        <div className="text-left">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-semibold text-[#143D2B]">
                              Tap your name to enter the waiting room:
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowReconnectPicker(false)}
                              className="text-xs text-[#5F6F65] hover:text-[#143D2B]"
                            >
                              Cancel
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {state.participants.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => handleSelectExistingGuest(p)}
                                className="rounded-full border border-[#D8CBB5] bg-[#F7EFE1] px-3.5 py-1.5 text-xs font-semibold text-[#143D2B] transition-colors hover:border-[#B91C1C] hover:text-[#B91C1C]"
                              >
                                {p.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.section>
            ) : !isDrawing && currentGuest ? (
              /* STAGE B: Festive Waiting Dialogue */
              <motion.section
                key="stage-waiting"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                aria-labelledby="waiting-heading"
                className="parchment-card mx-auto w-full max-w-2xl rounded-[30px] bg-[#D99B26]/25 p-1.5 shadow-[0_28px_70px_-15px_rgba(0,0,0,0.55)]"
              >
                <div className="rounded-[24px] border border-[#D99B26]/35 bg-[#FFFDF9] p-6 text-[#1B2E24] sm:p-10">
                  <div className="text-center">
                    <WaitingStickCup stickCount={totalCount} />

                    <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#143D2B]/[0.08] px-3.5 py-1 font-mono text-xs font-semibold text-[#143D2B]">
                      <CheckCircle size={15} weight="fill" className="text-[#16A34A]" aria-hidden="true" />
                      <span>You&apos;re in the pack, {currentGuest.name}</span>
                    </div>

                    <h1
                      id="waiting-heading"
                      className="mt-3 font-serif text-4xl leading-none text-[#143D2B] sm:text-5xl"
                    >
                      Waiting for Everyone&apos;s Names...
                    </h1>
                    <p className="mx-auto mt-3 max-w-[44ch] text-sm leading-relaxed text-[#4E5F54]">
                      Hang tight! As soon as everyone has joined and the organizer activates the
                      draw, this page will turn into the stick pack so you can pick yours.
                    </p>
                  </div>

                  {/* Live Pack Roster */}
                  <div className="mt-7 rounded-2xl border border-[#E7DCCB] bg-[#F7EFE1]/75 p-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#143D2B]">
                        <Users size={15} weight="regular" aria-hidden="true" />
                        Sticks in the Tin ({totalCount})
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#5F6F65]">
                        <Sparkle size={12} weight="fill" className="text-[#D99B26]" aria-hidden="true" />
                        Live updates on
                      </span>
                    </div>

                    <ul className="flex flex-wrap gap-2">
                      {state.participants.map((p) => {
                        const isYou = p.id === currentGuest.id;
                        return (
                          <li
                            key={p.id}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                              isYou
                                ? 'bg-[#B91C1C] text-[#FFFDF9] shadow-sm'
                                : 'border border-[#D8CBB5] bg-[#FFFDF9] text-[#143D2B]'
                            }`}
                          >
                            <span>{isYou ? `${p.name} (You)` : p.name}</span>
                          </li>
                        );
                      })}
                    </ul>

                    {totalCount < 3 && (
                      <p className="mt-3 text-xs text-[#5F6F65]">
                        Need at least 3 participants in the pack before the organizer can start the
                        stick draw.
                      </p>
                    )}
                  </div>

                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      onClick={handleClearGuest}
                      className="atelier-btn inline-flex items-center gap-1.5 rounded-full border border-[#D8CBB5] bg-[#FFFDF9] px-4 py-2 text-xs font-semibold text-[#4E5F54] transition-colors hover:border-[#B91C1C] hover:text-[#B91C1C]"
                    >
                      <ArrowsLeftRight size={14} weight="regular" aria-hidden="true" />
                      Add Another Name / Switch Guest
                    </button>
                  </div>
                </div>
              </motion.section>
            ) : (
              /* STAGE C: Pick a Stick from the Pack */
              <motion.section
                key="stage-draw"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
              >
                <StickPackStage
                  state={state}
                  currentGuest={currentGuest}
                  onSelectGuest={handleSelectExistingGuest}
                  onClearGuest={handleClearGuest}
                  onStateUpdate={applyNewState}
                />
              </motion.section>
            )}
          </AnimatePresence>
        ) : null}
      </main>

      {/* Festive Footer */}
      <footer className="relative z-20 border-t border-[#D99B26]/20 bg-[#0B1F16]/60">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4 text-xs text-[#D8E2DC]/80 sm:px-8">
          <span className="font-mono">
            {state?.storageMode === 'vercel-storage'
              ? 'Synced via Vercel Storage'
              : 'Local Dev Storage'}
          </span>
          <span>Secret Santa pairings are randomized and kept private on the server.</span>
        </div>
      </footer>

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
