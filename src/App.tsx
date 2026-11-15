import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AdminDialog } from './components/AdminDialog';
import { SnowfallLayer } from './components/ChristmasDecor';
import { StickPackStage } from './components/StickPackStage';
import { fetchEventState } from './lib/api';
import { initGlobalFormValidation } from './lib/validation';
import type { EventState } from './types';

const POLL_INTERVAL_MS = 3000;

export default function App() {
  const prefersReducedMotion = useReducedMotion();
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
        setAdminOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setAdminOpen(false);
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
    if (
      state?.eventName &&
      state.eventName.toLowerCase() !== 'exchange gift' &&
      state.eventName.toLowerCase() !== 'gift exchange'
    ) {
      document.title = `${state.eventName} · Year-End Dinner`;
    } else {
      document.title = 'Gift Exchange · Year-End Dinner';
    }
  }, [state?.eventName]);

  const handleCrestTap = () => {
    const now = Date.now();
    const recent = secretTapsRef.current.filter((t) => now - t < 2500);
    recent.push(now);
    secretTapsRef.current = recent;
    if (recent.length >= 5) {
      secretTapsRef.current = [];
      setAdminOpen((v) => !v);
    }
  };

  const handleEventReset = () => {
    setResetSignal((n) => n + 1);
  };

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-x-hidden overflow-y-auto bg-[#061A44] px-3 py-3 text-white sm:px-6 sm:py-4 lg:h-[100dvh] lg:max-h-[100dvh] lg:overflow-hidden">
      {/* Deep Royal Navy & Mint-Turquoise Ambient Glow */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-44 left-1/2 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-[#4CE6B8]/[0.16] blur-[140px]" />
        <div className="absolute bottom-[-160px] left-[-10%] h-[420px] w-[420px] rounded-full bg-[#153E90]/[0.28] blur-[130px]" />
        <div className="absolute right-[-8%] top-[30%] h-[380px] w-[380px] rounded-full bg-[#20B486]/[0.18] blur-[120px]" />
      </div>

      {/* Gentle Shimmer Particles */}
      <SnowfallLayer />

      {/* Centered Top Event Header (No Header Bar, No External Logo Image) */}
      <header className="relative z-20 mb-2 flex shrink-0 flex-col items-center justify-center text-center sm:mb-3">
        <button
          type="button"
          onClick={handleCrestTap}
          aria-label="Gift Exchange — Year-End Dinner Hosted by Trifecta, An Optima Company"
          className="group flex flex-col items-center justify-center rounded-2xl px-3 py-1 text-center transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98]"
        >
          <p className="font-serif text-3xl italic leading-none tracking-tight sm:text-4xl">
            {!state?.eventName ||
            state.eventName.toLowerCase() === 'exchange gift' ||
            state.eventName.toLowerCase() === 'gift exchange' ? (
              <>
                <span className="text-white drop-shadow-[1.5px_1.5px_0_rgba(76,230,184,0.4)]">
                  Gift{' '}
                </span>
                <span className="text-[#4CE6B8]">Exchange</span>
              </>
            ) : (
              <span className="text-white">{state.eventName}</span>
            )}
          </p>

          <p className="mt-1 font-sans text-[11px] font-bold uppercase tracking-[0.28em] text-[#4CE6B8] sm:text-xs">
            Year-End Dinner
          </p>

          <div className="mt-1 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5">
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-white/90 sm:text-[10px]">
              Hosted by
            </span>
            <span className="inline-flex items-baseline gap-1.5">
              <span className="font-serif text-base italic leading-none text-white sm:text-lg">
                Trifecta
              </span>
              <span className="text-xs text-[#4CE6B8]/70" aria-hidden="true">
                |
              </span>
              <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-[#B8D0F0] sm:text-[11px]">
                An Optima Company
              </span>
            </span>
          </div>

          <span
            aria-hidden="true"
            className="mt-1 h-1 w-28 rounded-full bg-gradient-to-r from-transparent via-[#4CE6B8]/75 to-transparent blur-[1px]"
          />
        </button>
      </header>

      {/* Main Centered / Side-by-Side Responsive Stage */}
      <main className="relative z-20 flex w-full max-w-6xl shrink-0 flex-col items-center justify-center gap-4 lg:flex-row lg:items-stretch lg:gap-5">
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
          <>
            <motion.div
              layout={!prefersReducedMotion}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className="flex w-full max-w-xl shrink-0 items-center justify-center lg:w-[470px] xl:w-[560px]"
            >
              <StickPackStage
                state={state}
                resetSignal={resetSignal}
                onStateUpdate={applyNewState}
              />
            </motion.div>

            <AnimatePresence mode="popLayout">
              {adminOpen && (
                <motion.div
                  key="admin-companion-panel"
                  layout={!prefersReducedMotion}
                  initial={
                    prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: 32, scale: 0.96 }
                  }
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={
                    prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 32, scale: 0.96 }
                  }
                  transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                  className="flex w-full max-w-xl shrink-0 justify-center lg:w-[440px] xl:w-[480px]"
                >
                  <AdminDialog
                    open={adminOpen}
                    state={state}
                    onClose={() => setAdminOpen(false)}
                    onStateUpdate={applyNewState}
                    onEventReset={handleEventReset}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : null}
      </main>
    </div>
  );
}
