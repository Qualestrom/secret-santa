import { useEffect, useMemo, useState } from 'react';
import {
  ArrowsClockwise,
  Check,
  Eye,
  EyeSlash,
  Gift,
  HandPointing,
  Sparkle,
  Star,
} from '@phosphor-icons/react';
import confetti from 'canvas-confetti';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ApiError, redrawSelfMatch, revealDrawMatch } from '../lib/api';
import type { EventState, SavedDrawRecord } from '../types';
import { ErrorMark } from './ErrorMark';
import { HollySprig } from './ChristmasDecor';

const LOCAL_DRAW_KEY = 'secret_santa_drawn_stick_v2';
const LOCAL_CLAIM_KEY = 'secret_santa_claim_id_v2';

function createRandomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `claim_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreateClaimId(): string {
  try {
    const existing = localStorage.getItem(LOCAL_CLAIM_KEY);
    if (existing && existing.length >= 8) return existing;
    const fresh = createRandomId();
    localStorage.setItem(LOCAL_CLAIM_KEY, fresh);
    return fresh;
  } catch {
    return createRandomId();
  }
}

function rotateClaimId(): string {
  const fresh = createRandomId();
  try {
    localStorage.setItem(LOCAL_CLAIM_KEY, fresh);
  } catch {
    // Ignore storage quota errors
  }
  return fresh;
}

function readSavedDraw(): SavedDrawRecord | null {
  try {
    const raw = localStorage.getItem(LOCAL_DRAW_KEY);
    return raw ? (JSON.parse(raw) as SavedDrawRecord) : null;
  } catch {
    return null;
  }
}

function writeSavedDraw(record: SavedDrawRecord): void {
  try {
    localStorage.setItem(LOCAL_DRAW_KEY, JSON.stringify(record));
  } catch {
    // Ignore
  }
}

function clearSavedDraw(): void {
  try {
    localStorage.removeItem(LOCAL_DRAW_KEY);
  } catch {
    // Ignore
  }
}

interface StickPackStageProps {
  state: EventState;
  resetSignal: number;
  onStateUpdate: (state: EventState) => void;
}

function createJitterOffsets(count: number, seed: number): number[] {
  return Array.from({ length: count }, (_, idx) => {
    const wave = Math.sin((idx + 1) * 12.9898 + seed * 78.233) * 43758.5453;
    const frac = wave - Math.floor(wave);
    return (frac - 0.5) * 4.4;
  });
}

export function StickPackStage({
  state,
  resetSignal,
  onStateUpdate,
}: StickPackStageProps) {
  const prefersReducedMotion = useReducedMotion();
  const [claimId, setClaimId] = useState<string>(() => getOrCreateClaimId());
  const [savedDraw, setSavedDraw] = useState<SavedDrawRecord | null>(() => readSavedDraw());
  const [hoveredStick, setHoveredStick] = useState<number | null>(null);
  const [peekStick, setPeekStick] = useState<number | null>(null);
  const [pullingStick, setPullingStick] = useState<number | null>(null);
  const [redrawing, setRedrawing] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState(1);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [hideMatchText, setHideMatchText] = useState(false);

  const totalCount = state.totalCount;
  const remainingCount = state.remainingCount;
  const isAllPicked = totalCount > 0 && remainingCount === 0;
  const stickCount = totalCount === 0 ? 5 : Math.min(remainingCount, 12);

  const stickJitter = useMemo(
    () => createJitterOffsets(Math.max(stickCount, 1), shuffleSeed),
    [stickCount, shuffleSeed]
  );

  // Sync local saved draw if organizer resets the pack or rotates the round
  useEffect(() => {
    if (
      savedDraw &&
      (state.totalCount === 0 || savedDraw.roundId !== state.roundId)
    ) {
      clearSavedDraw();
      setSavedDraw(null);
      setHideMatchText(false);
      setDrawError(null);
    }
  }, [state.totalCount, state.roundId, savedDraw]);

  // Clear local state if organizer reset callback triggers
  useEffect(() => {
    if (resetSignal > 0) {
      clearSavedDraw();
      setSavedDraw(null);
      setHideMatchText(false);
      setDrawError(null);
      setClaimId(rotateClaimId());
    }
  }, [resetSignal]);

  // Playful entrance rattle on initial mount when sticks are present
  useEffect(() => {
    if (!prefersReducedMotion && !savedDraw && stickCount > 0) {
      setIsShaking(true);
      const t = setTimeout(() => setIsShaking(false), 440);
      return () => clearTimeout(t);
    }
  }, [prefersReducedMotion, savedDraw, stickCount]);

  // Periodic playful peek so sticks feel alive inside the tin
  useEffect(() => {
    if (
      prefersReducedMotion ||
      savedDraw ||
      stickCount === 0 ||
      pullingStick !== null ||
      isShaking
    ) {
      setPeekStick(null);
      return;
    }

    let clearPeekTimer: ReturnType<typeof setTimeout> | undefined;
    const interval = setInterval(() => {
      if (hoveredStick !== null) return;
      const next = Math.floor(Math.random() * stickCount);
      setPeekStick(next);
      clearPeekTimer = setTimeout(() => setPeekStick(null), 850);
    }, 2400);

    return () => {
      clearInterval(interval);
      if (clearPeekTimer) clearTimeout(clearPeekTimer);
    };
  }, [prefersReducedMotion, savedDraw, stickCount, pullingStick, isShaking, hoveredStick]);

  const fireChristmasConfetti = () => {
    if (prefersReducedMotion) return;
    confetti({
      particleCount: 65,
      spread: 74,
      origin: { y: 0.56 },
      colors: ['#B91C1C', '#D99B26', '#1E5B3E', '#FFFDF9'],
      disableForReducedMotion: true,
    });
  };

  const triggerTinShake = () => {
    if (pullingStick !== null || isShaking) return;
    setHoveredStick(null);
    setPeekStick(null);
    setIsShaking(true);
    setShuffleSeed((s) => s + 1);
    setTimeout(() => {
      setIsShaking(false);
    }, prefersReducedMotion ? 120 : 480);
  };

  const handleShakeButtonClick = () => {
    setDrawError(null);
    triggerTinShake();
  };

  const handlePullStick = async (stickIndex: number) => {
    if (pullingStick !== null) return;

    if (totalCount === 0) {
      triggerTinShake();
      setDrawError(
        "No names in the pack yet — waiting for the organizer to add everyone's names."
      );
      return;
    }

    if (remainingCount === 0) {
      setDrawError('All sticks in the pack have already been picked!');
      return;
    }

    setDrawError(null);
    setPeekStick(null);
    setPullingStick(stickIndex);

    try {
      const [result] = await Promise.all([
        revealDrawMatch(claimId),
        new Promise((resolve) => setTimeout(resolve, prefersReducedMotion ? 180 : 520)),
      ]);
      const record: SavedDrawRecord = {
        roundId: result.state.roundId,
        claimId: result.claimId,
        pickedId: result.pickedId,
        recipientName: result.assignedToName,
        stickNumber: stickIndex + 1,
      };
      writeSavedDraw(record);
      setClaimId(result.claimId);
      setSavedDraw(record);
      setHideMatchText(false);
      onStateUpdate(result.state);
      fireChristmasConfetti();
    } catch (err) {
      setDrawError(err instanceof ApiError ? err.message : 'Unable to pull a stick right now.');
    } finally {
      setPullingStick(null);
    }
  };

  const handleRedrawSelf = async () => {
    if (!savedDraw || redrawing) return;
    setDrawError(null);
    setRedrawing(true);
    try {
      const result = await redrawSelfMatch(savedDraw.claimId, savedDraw.pickedId);
      const record: SavedDrawRecord = {
        roundId: result.state.roundId,
        claimId: result.claimId,
        pickedId: result.pickedId,
        recipientName: result.assignedToName,
        stickNumber: savedDraw.stickNumber,
      };
      writeSavedDraw(record);
      setSavedDraw(record);
      setHideMatchText(false);
      onStateUpdate(result.state);
      fireChristmasConfetti();
    } catch (err) {
      setDrawError(err instanceof ApiError ? err.message : 'Unable to swap sticks right now.');
    } finally {
      setRedrawing(false);
    }
  };

  const handleNextPersonSharedDevice = () => {
    clearSavedDraw();
    setSavedDraw(null);
    setHideMatchText(false);
    setDrawError(null);
    setClaimId(rotateClaimId());
  };

  // Spread & spacing tuned to sit cleanly inside the 212px cup mouth across mobile and desktop
  const spread = stickCount <= 1 ? 0 : Math.min(44, 20 + stickCount * 2.2);
  const stepX = stickCount <= 1 ? 0 : Math.min(14, 62 / (stickCount - 1));
  const activeHintStick = pullingStick ?? hoveredStick ?? peekStick;

  return (
    <div className="parchment-card w-full max-w-xl rounded-[28px] bg-[#D99B26]/25 p-1.5 shadow-[0_26px_64px_-15px_rgba(0,0,0,0.55)]">
      <div className="rounded-[22px] border border-[#D99B26]/35 bg-[#FFFDF9] p-4 text-[#1B2E24] sm:p-6">
        <AnimatePresence mode="wait">
          {!savedDraw ? (
            <motion.div
              key="pack-stage"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              className="text-center"
            >
              {/* Compact Editorial Header */}
              <div className="mx-auto flex max-w-[44ch] flex-col items-center">
                <HollySprig className="mb-1 h-5 w-16" />
                <h1 className="font-serif text-3xl leading-none text-[#143D2B] sm:text-4xl">
                  {isAllPicked ? 'All Sticks Drawn!' : 'Pick a Stick from the Pack'}
                </h1>
                <p className="mt-1.5 text-xs leading-snug text-[#4E5F54] sm:text-sm">
                  {totalCount === 0
                    ? 'Give the wooden sticks a playful shake while the organizer adds the names.'
                    : isAllPicked
                      ? 'Every name in the Christmas tin has been claimed with zero duplicates.'
                      : 'Tap any wooden stick tucked inside the Christmas tin to reveal your Secret Santa match.'}
                </p>

                {/* Live Pool Counter Pill */}
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#143D2B]/[0.07] px-3 py-1 font-mono text-[11px] font-semibold text-[#143D2B]">
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 rounded-full ${
                      totalCount === 0
                        ? 'bg-[#D99B26]'
                        : remainingCount > 0
                          ? 'bg-[#16A34A]'
                          : 'bg-[#B91C1C]'
                    }`}
                  />
                  {totalCount === 0
                    ? 'Waiting for organizer to add names'
                    : `${remainingCount} of ${totalCount} sticks left in tin`}
                </div>
              </div>

              {drawError && (
                <div
                  role="alert"
                  className="mx-auto mt-2.5 flex max-w-md items-center justify-center gap-2 rounded-xl border border-[#B91C1C]/35 bg-[#FEE2E2] px-3 py-2 text-xs font-medium text-[#991B1B]"
                >
                  <ErrorMark />
                  <span>{drawError}</span>
                </div>
              )}

              {/* Compact 3-Layer Stick-in-Tin Stage (Zero Scrolling on Desktop or Mobile) */}
              <div className="relative mx-auto mt-2 h-[236px] w-full max-w-[330px] select-none">
                {/* Floating Hover/Shake Prompt Pill Clear Above Stick Tips */}
                <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 font-mono text-[10px] font-semibold transition-all duration-200 ${
                      hoveredStick !== null || pullingStick !== null
                        ? 'border-[#B91C1C]/35 bg-[#FEF2F2] text-[#B91C1C] shadow-xs'
                        : 'border-[#D99B26]/35 bg-[#F7EFE1]/90 text-[#5B3A1B]'
                    }`}
                  >
                    <Sparkle
                      size={11}
                      weight="fill"
                      className={activeHintStick !== null ? 'text-[#B91C1C]' : 'text-[#D99B26]'}
                      aria-hidden="true"
                    />
                    {pullingStick !== null
                      ? `Pulling Stick #${String(pullingStick + 1).padStart(2, '0')}...`
                      : hoveredStick !== null
                        ? `Tap to Pull Stick #${String(hoveredStick + 1).padStart(2, '0')}`
                        : isShaking
                          ? 'Shaking the Christmas Tin...'
                          : isAllPicked
                            ? 'Pack Complete'
                            : 'Tap a stick or shake the tin'}
                  </span>
                </div>

                {/* Warm Candlelight Glow Behind Tin */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-4 left-1/2 h-36 w-52 -translate-x-1/2 rounded-full bg-[#D99B26]/22 blur-2xl"
                />

                {/* Animated Tin + Sticks Shake Wrapper */}
                <motion.div
                  className="absolute inset-0"
                  animate={
                    isShaking && !prefersReducedMotion
                      ? {
                          rotate: [0, -5, 5, -3.5, 3.5, -1.5, 0],
                          x: [0, -6, 6, -4, 4, -2, 0],
                        }
                      : pullingStick !== null && !prefersReducedMotion
                        ? {
                            rotate: [0, -2.5, 2.5, -1, 0],
                            y: [0, 2.5, 0],
                          }
                        : { rotate: 0, x: 0, y: 0 }
                  }
                  transition={{ duration: 0.44, ease: [0.23, 1, 0.32, 1] }}
                >
                  {/* LAYER 1 (z-10): Tin Cup Back Rim & Deep Interior Shadow */}
                  <svg
                    viewBox="0 0 212 116"
                    className="pointer-events-none absolute bottom-0 left-1/2 z-10 h-[116px] w-[212px] -translate-x-1/2"
                    fill="none"
                    aria-hidden="true"
                  >
                    <ellipse
                      cx="106"
                      cy="18"
                      rx="76"
                      ry="13"
                      fill="#3F0909"
                      stroke="#D99B26"
                      strokeWidth="2.2"
                    />
                    <ellipse
                      cx="106"
                      cy="19"
                      rx="69"
                      ry="9.5"
                      fill="#230404"
                      fillOpacity="0.82"
                    />
                  </svg>

                  {/* LAYER 2 (z-20): Living Wooden Sticks Seated Inside the Cup */}
                  {stickCount > 0 && (
                    <div className="absolute bottom-[36px] left-1/2 z-20">
                      {Array.from({ length: stickCount }).map((_, idx) => {
                        const ratio = stickCount === 1 ? 0.5 : idx / (stickCount - 1);
                        const baseAngle = stickCount === 1 ? -3 : -spread / 2 + ratio * spread;
                        const jitter = stickJitter[idx] ?? 0;
                        const restAngle = isShaking ? baseAngle * 0.35 : baseAngle + jitter;
                        const baseX = (idx - (stickCount - 1) / 2) * stepX;

                        const isHovered = hoveredStick === idx;
                        const isPeeking = peekStick === idx && hoveredStick === null;
                        const isPulling = pullingStick === idx;
                        const anotherPulling = pullingStick !== null && !isPulling;

                        let neighborPushX = 0;
                        let neighborPushRot = 0;
                        if (
                          hoveredStick !== null &&
                          hoveredStick !== idx &&
                          pullingStick === null
                        ) {
                          const dir = idx < hoveredStick ? -1 : 1;
                          const dist = Math.abs(idx - hoveredStick);
                          const falloff = dist === 1 ? 1 : dist === 2 ? 0.5 : 0.2;
                          neighborPushX = dir * 6 * falloff;
                          neighborPushRot = dir * 2.4 * falloff;
                        }

                        const targetY = isPulling
                          ? -74
                          : anotherPulling
                            ? 16
                            : isHovered
                              ? -24
                              : isPeeking
                                ? -11
                                : isShaking
                                  ? -6
                                  : 0;

                        const targetRotate = isPulling
                          ? 0
                          : restAngle +
                            neighborPushRot +
                            (isPeeking ? (idx % 2 === 0 ? -2.2 : 2.2) : 0);

                        const targetX = isPulling ? 0 : baseX + neighborPushX;

                        return (
                          <motion.button
                            key={idx}
                            type="button"
                            disabled={pullingStick !== null}
                            aria-label={`Pull stick ${idx + 1} from the pack`}
                            onMouseEnter={() => setHoveredStick(idx)}
                            onMouseLeave={() => setHoveredStick(null)}
                            onFocus={() => setHoveredStick(idx)}
                            onBlur={() => setHoveredStick(null)}
                            onClick={() => handlePullStick(idx)}
                            animate={{
                              y: targetY,
                              x: targetX,
                              rotate: targetRotate,
                              scale: isPulling ? 1.08 : isHovered ? 1.06 : isPeeking ? 1.03 : 1,
                              opacity: anotherPulling ? 0.45 : 1,
                            }}
                            transition={{
                              type: 'spring',
                              stiffness: isPulling ? 220 : 300,
                              damping: isPulling ? 18 : 19,
                            }}
                            style={{
                              zIndex: isPulling ? 28 : isHovered ? 26 : 10 + idx,
                            }}
                            className="group absolute bottom-0 left-0 -ml-4 h-[146px] w-8 origin-bottom cursor-pointer rounded-t-full border border-[#8D643B]/55 bg-gradient-to-r from-[#D8AC7B] via-[#F4DEC0] to-[#C39363] shadow-[0_5px_12px_rgba(27,46,36,0.22)] transition-shadow duration-200 hover:shadow-[0_10px_20px_rgba(185,28,28,0.28)] focus-visible:outline-2 focus-visible:outline-[#B91C1C] disabled:cursor-wait"
                          >
                            {/* Non-colliding Ambient Breathing Wrapper */}
                            <motion.div
                              className="flex h-full w-full flex-col items-center overflow-hidden rounded-t-full"
                              animate={
                                !prefersReducedMotion &&
                                !isHovered &&
                                !isPulling &&
                                !anotherPulling
                                  ? { y: [0, -3, 0] }
                                  : { y: 0 }
                              }
                              transition={
                                !prefersReducedMotion &&
                                !isHovered &&
                                !isPulling &&
                                !anotherPulling
                                  ? {
                                      duration: 2.8 + (idx % 4) * 0.35,
                                      delay: idx * 0.22,
                                      repeat: Infinity,
                                      ease: 'easeInOut',
                                    }
                                  : { duration: 0.15 }
                              }
                            >
                              <span className="relative h-6 w-full bg-gradient-to-b from-[#DC2626] via-[#C81E1E] to-[#991B1B]">
                                <span
                                  aria-hidden="true"
                                  className="absolute inset-y-1 left-1 w-1 rounded-full bg-white/30"
                                />
                              </span>
                              <span className="h-1 w-full bg-[#D99B26]" />
                              <span className="mt-2 font-mono text-[9.5px] font-bold tracking-tight text-[#5F3C1C]">
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                              <Star
                                size={10}
                                weight="fill"
                                className={`mt-1 transition-transform duration-200 ${
                                  isHovered || isPeeking
                                    ? 'scale-125 text-[#B91C1C]'
                                    : 'text-[#B91C1C]/75'
                                }`}
                                aria-hidden="true"
                              />
                              <span
                                aria-hidden="true"
                                className="mt-2.5 h-10 w-px rounded-full bg-[#8D643B]/20"
                              />
                            </motion.div>
                          </motion.button>
                        );
                      })}
                    </div>
                  )}

                  {/* LAYER 3 (z-30, pointer-events-none): Tin Cup Front Wall */}
                  <svg
                    viewBox="0 0 212 116"
                    className="pointer-events-none absolute bottom-0 left-1/2 z-30 h-[116px] w-[212px] -translate-x-1/2 drop-shadow-[0_14px_24px_rgba(15,41,30,0.28)]"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M30 18A76 13 0 0 0 182 18L165 100C163 108 138 113 106 113C74 113 49 108 47 100L30 18Z"
                      fill="url(#compactTinFrontGrad)"
                      stroke="#D99B26"
                      strokeWidth="2.2"
                    />
                    <path
                      d="M30 18A76 13 0 0 0 182 18"
                      stroke="#FDE68A"
                      strokeOpacity="0.72"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                    />
                    <path
                      d="M37 52C57 59 81 61 106 61C131 61 155 59 175 52L172 68C153 75 130 77 106 77C82 77 59 75 40 68L37 52Z"
                      fill="#D99B26"
                    />
                    <circle
                      cx="106"
                      cy="64"
                      r="15.5"
                      fill="#0F291E"
                      stroke="#FFFDF9"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M106 53L112.5 63H108.5L114 71H98L103.5 63H99.5L106 53Z"
                      fill="#D99B26"
                    />
                    <defs>
                      <linearGradient
                        id="compactTinFrontGrad"
                        x1="30"
                        y1="18"
                        x2="182"
                        y2="110"
                        gradientUnits="userSpaceOnUse"
                      >
                        <stop stopColor="#DC2626" />
                        <stop offset="0.52" stopColor="#B91C1C" />
                        <stop offset="1" stopColor="#7F1D1D" />
                      </linearGradient>
                    </defs>
                  </svg>
                </motion.div>
              </div>

              {/* Compact Action Controls Below the Tin */}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5">
                {!isAllPicked && (
                  <button
                    type="button"
                    disabled={pullingStick !== null || isShaking}
                    onClick={handleShakeButtonClick}
                    className="atelier-btn inline-flex items-center gap-2 rounded-full border border-[#D8CBB5] bg-[#F7EFE1] px-4 py-2 text-xs font-semibold text-[#143D2B] transition-all duration-200 hover:border-[#D99B26] hover:bg-[#EFE2CB] active:scale-[0.97] disabled:opacity-60"
                  >
                    <ArrowsClockwise
                      size={14}
                      weight="bold"
                      className={isShaking ? 'animate-spin' : ''}
                      aria-hidden="true"
                    />
                    <span>Shake Tin</span>
                  </button>
                )}

                {!isAllPicked && (
                  <button
                    type="button"
                    disabled={pullingStick !== null}
                    onClick={() => handlePullStick(Math.floor(Math.random() * stickCount))}
                    className="atelier-btn group inline-flex items-center gap-2.5 rounded-full bg-[#B91C1C] py-1.5 pl-5 pr-1.5 text-xs font-semibold text-[#FFFDF9] shadow-[0_10px_24px_-8px_rgba(185,28,28,0.45)] transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-[#991B1B] active:scale-[0.98] disabled:opacity-60 sm:text-sm"
                  >
                    <span>
                      {pullingStick !== null ? 'Pulling Stick...' : 'Pick a Random Stick'}
                    </span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/20 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:-translate-y-0.5">
                      <HandPointing size={16} weight="regular" aria-hidden="true" />
                    </span>
                  </button>
                )}
              </div>
            </motion.div>
          ) : (
            /* Revealed Keepsake Wooden Stick + Compact Gift Tag (Zero Scroll) */
            <motion.div
              key="revealed-stick"
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 210, damping: 22 }}
              className="py-1 text-center"
            >
              {/* Horizontal Wooden Keepsake Stick */}
              <div className="mx-auto mb-3.5 flex max-w-sm items-center overflow-hidden rounded-full border border-[#8D643B]/45 bg-gradient-to-r from-[#EED2AF] via-[#DFB78A] to-[#C89B6E] shadow-sm">
                <div className="flex h-9 w-14 shrink-0 items-center justify-center bg-[#B91C1C] font-mono text-xs font-bold text-[#FFFDF9]">
                  #{String(savedDraw.stickNumber).padStart(2, '0')}
                </div>
                <div className="h-9 w-1.5 shrink-0 bg-[#D99B26]" />
                <div className="flex flex-1 items-center justify-center gap-1.5 px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-[#5B3A1B]">
                  <Sparkle size={12} weight="fill" className="text-[#B91C1C]" aria-hidden="true" />
                  <span>Stick Claimed From Pack</span>
                </div>
              </div>

              {drawError && (
                <div
                  role="alert"
                  className="mx-auto mb-3 flex max-w-md items-center justify-center gap-2 rounded-xl border border-[#B91C1C]/35 bg-[#FEE2E2] px-3 py-2 text-xs font-medium text-[#991B1B]"
                >
                  <ErrorMark />
                  <span>{drawError}</span>
                </div>
              )}

              {/* Compact Parchment Gift Tag */}
              <div className="mx-auto max-w-md rounded-3xl border-2 border-[#D99B26]/45 bg-[#F7EFE1] p-4 shadow-inner sm:p-6">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#B91C1C] text-[#FFFDF9]">
                  <Gift size={20} weight="light" aria-hidden="true" />
                </div>
                <p className="text-xs font-medium text-[#4E5F54] sm:text-sm">
                  You are Secret Santa for
                </p>

                <div className="my-3 rounded-2xl border border-[#D99B26]/35 bg-[#FFFDF9] px-4 py-4 shadow-xs sm:py-5">
                  {hideMatchText ? (
                    <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#6B7A70] sm:text-sm">
                      Hidden from screen
                    </p>
                  ) : (
                    <p className="break-words font-serif text-3xl italic leading-tight text-[#B91C1C] sm:text-4xl">
                      {savedDraw.recipientName}
                    </p>
                  )}
                </div>

                <p className="text-[11px] leading-snug text-[#5F6F65]">
                  This name has been locked to your draw and removed from the pack so nobody else
                  can pick the same person.
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setHideMatchText((v) => !v)}
                    className="atelier-btn inline-flex items-center gap-1.5 rounded-full border border-[#D8CBB5] bg-[#FFFDF9] px-4 py-2 text-xs font-semibold text-[#143D2B] transition-colors hover:border-[#143D2B]"
                  >
                    {hideMatchText ? (
                      <>
                        <Eye size={14} weight="regular" aria-hidden="true" />
                        Peek
                      </>
                    ) : (
                      <>
                        <EyeSlash size={14} weight="regular" aria-hidden="true" />
                        Hide Name
                      </>
                    )}
                  </button>

                  {remainingCount > 0 && (
                    <button
                      type="button"
                      disabled={redrawing}
                      onClick={handleRedrawSelf}
                      className="atelier-btn inline-flex items-center gap-1.5 rounded-full border border-[#B91C1C]/40 bg-[#FFFDF9] px-4 py-2 text-xs font-semibold text-[#B91C1C] transition-colors hover:bg-[#FEF2F2] disabled:opacity-50"
                    >
                      <ArrowsClockwise
                        size={14}
                        weight="bold"
                        className={redrawing ? 'animate-spin' : ''}
                        aria-hidden="true"
                      />
                      {redrawing ? 'Swapping...' : 'Picked Myself? Redraw'}
                    </button>
                  )}

                  {remainingCount > 0 && (
                    <button
                      type="button"
                      onClick={handleNextPersonSharedDevice}
                      className="atelier-btn inline-flex items-center gap-1.5 rounded-full bg-[#143D2B] px-4 py-2 text-xs font-semibold text-[#FFFDF9] transition-colors hover:bg-[#0F291E]"
                    >
                      <Check size={14} weight="bold" aria-hidden="true" />
                      Next Person
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
