import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AdminDialog } from './components/AdminDialog';
import { SnowfallLayer } from './components/ChristmasDecor';
import { StickPackStage } from './components/StickPackStage';
import { fetchEventState } from './lib/api';
import { initGlobalFormValidation } from './lib/validation';
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

  // Sync document title
  useEffect(() => {
    if (state?.eventName) {
      document.title = `${state.eventName} · Secret Santa`;
    }
  }, [state?.eventName]);

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

  const handleSelectExistingGuest = (participant: PublicParticipant) => {
    writeSavedParticipant(participant.id, participant.name);
    setSavedMe({ participantId: participant.id, name: participant.name });
  };

  const handleClearGuest = () => {
    clearSavedParticipant();
    setSavedMe(null);
  };

  const handleEventReset = () => {
    clearSavedParticipant();
    setSavedMe(null);
  };

  const currentGuest =
    state && savedMe
      ? state.participants.find((p) => p.id === savedMe.participantId) ?? null
      : null;

  const isDrawing = state?.phase === 'DRAWING';
  const totalCount = state?.participants.length ?? 0;

  const statusLabel = !state
    ? 'Loading...'
    : isDrawing
      ? 'Pick Your Stick'
      : totalCount === 0
        ? 'Awaiting Names'
        : 'Preparing Pack';

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
                  isDrawing ? 'bg-[#D99B26]' : totalCount === 0 ? 'bg-[#FDE68A]/70' : 'bg-[#4ADE80]'
                }`}
              />
              {statusLabel}
            </span>
          </div>
        </div>
      </header>

      {/* Main Centered Festive Stage — Stick Pack Shown Firsthand */}
      <main className="relative z-20 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-5 py-8 sm:px-8 sm:py-12">
        {!state && !loadError ? (
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
            <motion.section
              key="stage-stick-pack"
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
