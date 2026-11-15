import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminDialog } from './components/AdminDialog';
import { SnowfallLayer } from './components/ChristmasDecor';
import { StickPackStage } from './components/StickPackStage';
import { fetchEventState } from './lib/api';
import { initGlobalFormValidation } from './lib/validation';
import type { EventState } from './types';

const POLL_INTERVAL_MS = 3000;

export default function App() {
  const [state, setState] = useState<EventState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);

  // Hidden Admin Dialog
  const [adminOpen, setAdminOpen] = useState(false);
  const secretTapsRef = useRef<number[]>([]);
  const fetchingRef = useRef(false);

  const applyNewState = useCallback((next: EventState) => {
    setState((prev) => ({
      ...next,
      participants: next.participants ?? prev?.participants,
    }));
    setLoadError(null);
  }, []);

  const refreshNow = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const next = await fetchEventState();
      applyNewState(next);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to sync Exchange Gift event.');
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

  // Live polling across devices so remaining stick count stays synced
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

  // Sync browser document title
  useEffect(() => {
    if (state?.eventName) {
      document.title =
        state.eventName.toLowerCase() === 'exchange gift'
          ? 'Exchange Gift'
          : `${state.eventName} · Exchange Gift`;
    } else {
      document.title = 'Exchange Gift';
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

  const handleEventReset = () => {
    setResetSignal((n) => n + 1);
  };

  return (
    <div className="relative flex h-[100dvh] max-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-[#07162C] px-3 py-2 text-[#F8FAFC] sm:px-6 sm:py-4">
      {/* Deep Midnight Blue & Turquoise Ambient Glow */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-44 left-1/2 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-[#14B8A6]/[0.15] blur-[140px]" />
        <div className="absolute bottom-[-160px] left-[-10%] h-[420px] w-[420px] rounded-full bg-[#0284C7]/[0.18] blur-[130px]" />
        <div className="absolute right-[-8%] top-[30%] h-[380px] w-[380px] rounded-full bg-[#0D9488]/[0.22] blur-[120px]" />
      </div>

      {/* Gentle Shimmer Particles */}
      <SnowfallLayer />

      {/* Centered Top Website Title Only (No Header Bar, No Budget/Status Pills) */}
      <div className="relative z-20 mb-2.5 flex shrink-0 items-center justify-center gap-3 sm:mb-4">
        <button
          type="button"
          onClick={handleCrestTap}
          aria-label="Exchange Gift Crest"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0D9488] text-[#F8FAFC] shadow-[0_4px_18px_rgba(20,184,166,0.45)] ring-2 ring-[#5EEAD4]/70 transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.93]"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
            <path
              d="M12 3L14.4 8.8L20.6 9.3L15.9 13.4L17.3 19.5L12 16.2L6.7 19.5L8.1 13.4L3.4 9.3L9.6 8.8L12 3Z"
              fill="#F8FAFC"
              stroke="#0B213F"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div onClick={handleCrestTap} className="select-none text-left">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#2DD4BF]">
            Gift Exchange
          </p>
          <p className="font-serif text-2xl leading-none text-[#F8FAFC] sm:text-3xl">
            {state?.eventName || 'Exchange Gift'}
          </p>
        </div>
      </div>

      {/* Main Centered Single-Screen Stage */}
      <main className="relative z-20 flex w-full max-w-2xl shrink-0 items-center justify-center">
        {!state && !loadError ? (
          <div className="w-full max-w-xl rounded-[28px] bg-white/[0.05] p-6">
            <div className="mx-auto mb-3 h-7 w-32 animate-pulse rounded-full bg-white/[0.1]" />
            <div className="mx-auto mb-4 h-10 w-2/3 animate-pulse rounded-xl bg-white/[0.08]" />
            <div className="h-44 w-full animate-pulse rounded-2xl bg-white/[0.06]" />
          </div>
        ) : loadError && !state ? (
          <div className="mx-auto max-w-md rounded-2xl border border-[#F87171]/50 bg-[#991B1B]/25 p-6 text-center text-sm text-[#FCA5A5]">
            <p className="font-semibold">Unable to load Exchange Gift event</p>
            <p className="mt-1 opacity-90">{loadError}</p>
          </div>
        ) : state ? (
          <StickPackStage
            state={state}
            resetSignal={resetSignal}
            onStateUpdate={applyNewState}
          />
        ) : null}
      </main>

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
