import { useEffect, useMemo, useState } from 'react';
import {
  ArrowsClockwise,
  ArrowsLeftRight,
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
import { ApiError, revealDrawMatch } from '../lib/api';
import type { EventState, PublicParticipant } from '../types';
import { ErrorMark } from './ErrorMark';
import { HollySprig } from './ChristmasDecor';

interface StickPackStageProps {
  state: EventState;
  currentGuest: PublicParticipant | null;
  onSelectGuest: (participant: PublicParticipant) => void;
  onClearGuest: () => void;
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
  currentGuest,
  onSelectGuest,
  onClearGuest,
  onStateUpdate,
}: StickPackStageProps) {
  const prefersReducedMotion = useReducedMotion();
  const [hoveredStick, setHoveredStick] = useState<number | null>(null);
  const [peekStick, setPeekStick] = useState<number | null>(null);
  const [pullingStick, setPullingStick] = useState<number | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState(1);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<{
    stickNumber: number;
    giverName: string;
    recipientName: string;
  } | null>(null);
  const [hideMatchText, setHideMatchText] = useState(false);

  const participants = state.participants;
  const totalCount = participants.length;
  const drawnCount = participants.filter((p) => p.hasDrawn).length;
  const isDrawing = state.phase === 'DRAWING';
  const stickCount = Math.min(Math.max(totalCount, 5), 12);

  const stickJitter = useMemo(
    () => createJitterOffsets(stickCount, shuffleSeed),
    [stickCount, shuffleSeed]
  );

  // Subtle initial tin shake on load and clean state reset on guest/phase change
  useEffect(() => {
    setRevealed(null);
    setDrawError(null);
    setHideMatchText(false);
    setPullingStick(null);
    setHoveredStick(null);

    if (!prefersReducedMotion) {
      setIsShaking(true);
      const t = setTimeout(() => setIsShaking(false), 460);
      return () => clearTimeout(t);
    }
  }, [currentGuest?.id, state.phase, prefersReducedMotion]);

  // Periodic playful peek animation so sticks feel alive even while viewing firsthand
  useEffect(() => {
    if (prefersReducedMotion || revealed || pullingStick !== null || isShaking) {
      setPeekStick(null);
      return;
    }

    let clearPeekTimer: ReturnType<typeof setTimeout> | undefined;
    const interval = setInterval(() => {
      if (hoveredStick !== null) return;
      const next = Math.floor(Math.random() * stickCount);
      setPeekStick(next);
      clearPeekTimer = setTimeout(() => setPeekStick(null), 900);
    }, 2400);

    return () => {
      clearInterval(interval);
      if (clearPeekTimer) clearTimeout(clearPeekTimer);
    };
  }, [
    prefersReducedMotion,
    revealed,
    pullingStick,
    isShaking,
    hoveredStick,
    stickCount,
  ]);

  const fireChristmasConfetti = () => {
    if (prefersReducedMotion) return;
    confetti({
      particleCount: 68,
      spread: 76,
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
    }, prefersReducedMotion ? 120 : 500);
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
        "The organizer hasn't added the participant names yet! Once names are added, tap your name and pull a stick."
      );
      return;
    }

    if (totalCount < 3 || !isDrawing) {
      triggerTinShake();
      setDrawError(
        `Waiting for the organizer to finish adding at least 3 participants (${totalCount}/3 in pack).`
      );
      return;
    }

    if (!currentGuest) {
      triggerTinShake();
      setDrawError(
        'Please tap your name in the list above first so we know who is pulling this stick!'
      );
      return;
    }

    setDrawError(null);
    setPeekStick(null);
    setPullingStick(stickIndex);

    try {
      const [result] = await Promise.all([
        revealDrawMatch(currentGuest.id),
        new Promise((resolve) => setTimeout(resolve, prefersReducedMotion ? 180 : 560)),
      ]);
      onStateUpdate(result.state);
      setRevealed({
        stickNumber: stickIndex + 1,
        giverName: result.participantName,
        recipientName: result.assignedToName,
      });
      setHideMatchText(false);
      fireChristmasConfetti();
    } catch (err) {
      setDrawError(err instanceof ApiError ? err.message : 'Unable to pull a stick right now.');
    } finally {
      setPullingStick(null);
    }
  };

  // Spread & spacing tuned to sit cleanly inside the 248px cup mouth & 290px mobile card width
  const spread = stickCount <= 1 ? 0 : Math.min(46, 22 + stickCount * 2.2);
  const stepX = stickCount <= 1 ? 0 : Math.min(16, 72 / (stickCount - 1));
  const activeHintStick = pullingStick ?? hoveredStick ?? peekStick;

  return (
    <div className="parchment-card mx-auto max-w-3xl rounded-[30px] bg-[#D99B26]/25 p-1.5 shadow-[0_28px_70px_-15px_rgba(0,0,0,0.55)]">
      <div className="rounded-[24px] border border-[#D99B26]/35 bg-[#FFFDF9] p-6 text-[#1B2E24] sm:p-9">
        {/* Top Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E7DCCB] pb-4">
          <div>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B91C1C]">
              {currentGuest ? 'Drawing For' : 'Christmas Stick Pack'}
            </span>
            <p className="font-serif text-3xl leading-tight text-[#143D2B]">
              {currentGuest ? currentGuest.name : state.eventName}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {totalCount > 0 && (
              <span className="rounded-full bg-[#143D2B]/[0.08] px-3 py-1 font-mono text-xs font-semibold text-[#143D2B]">
                {isDrawing ? `${drawnCount} / ${totalCount} pulled` : `${totalCount} in pack`}
              </span>
            )}
            {currentGuest && (
              <button
                type="button"
                onClick={onClearGuest}
                className="atelier-btn inline-flex items-center gap-1.5 rounded-full border border-[#D8CBB5] bg-[#F7EFE1] px-3.5 py-1.5 text-xs font-semibold text-[#1B2E24] transition-colors hover:border-[#B91C1C] hover:text-[#B91C1C]"
              >
                <ArrowsLeftRight size={14} weight="regular" aria-hidden="true" />
                Switch Guest
              </button>
            )}
          </div>
        </div>

        {/* Participant Selector Bar Above Heading/Tin */}
        {!revealed && (
          <div className="mt-5">
            {totalCount === 0 ? (
              <div className="rounded-2xl border border-[#D99B26]/35 bg-[#F7EFE1]/85 px-4 py-3 text-center text-xs font-medium text-[#4E5F54]">
                No participant names in the pack yet — the organizer will add everyone&apos;s names.
              </div>
            ) : (
              <div className="rounded-2xl border border-[#E7DCCB] bg-[#F7EFE1]/80 px-4 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[#143D2B]">
                    Step 1 · Tap Your Name
                  </span>
                  {totalCount < 3 ? (
                    <span className="font-mono text-[11px] font-medium text-[#B91C1C]">
                      Need {3 - totalCount} more name{3 - totalCount === 1 ? '' : 's'} to unlock draw
                    </span>
                  ) : currentGuest ? (
                    <span className="font-mono text-[11px] font-medium text-[#1E5B3E]">
                      Selected: {currentGuest.name}
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] text-[#5F6F65]">
                      Select yourself before pulling
                    </span>
                  )}
                </div>

                <div className="mt-2.5 flex flex-wrap gap-2">
                  {participants.map((p) => {
                    const isSelected = currentGuest?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onSelectGuest(p)}
                        className={`atelier-btn inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-[0.97] ${
                          isSelected
                            ? 'border-[#B91C1C] bg-[#B91C1C] text-[#FFFDF9] shadow-sm'
                            : p.hasDrawn
                              ? 'border-[#D8CBB5] bg-white/75 text-[#5F6F65] hover:border-[#D99B26] hover:text-[#143D2B]'
                              : 'border-[#D99B26]/45 bg-white text-[#143D2B] shadow-2xs hover:border-[#B91C1C]'
                        }`}
                      >
                        {p.hasDrawn && (
                          <Check
                            size={12}
                            weight="bold"
                            className={isSelected ? 'text-[#FFFDF9]' : 'text-[#1E5B3E]'}
                            aria-hidden="true"
                          />
                        )}
                        <span>{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <AnimatePresence mode="wait">
          {!revealed ? (
            <motion.div
              key="pack-stage"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
              className="pt-6 text-center"
            >
              <div className="mx-auto flex max-w-[46ch] flex-col items-center">
                <HollySprig className="mb-1.5 h-7 w-20" />
                <h1 className="font-serif text-4xl leading-none text-[#143D2B] sm:text-5xl">
                  {currentGuest?.hasDrawn
                    ? 'Peek at Your Stick Again'
                    : 'Pick a Stick from the Pack'}
                </h1>
                <p className="mt-2.5 text-sm leading-relaxed text-[#4E5F54]">
                  {totalCount === 0
                    ? 'Give the wooden sticks a playful shake inside the Christmas tin while the organizer loads everyone into the pack.'
                    : currentGuest?.hasDrawn
                      ? 'You already pulled a stick earlier. Tap any stick below if you need a quick reminder of your Secret Santa match.'
                      : 'Tap any wooden stick tucked inside the Christmas tin below to pull it out and reveal who you are gifting.'}
                </p>
              </div>

              {drawError && (
                <div
                  role="alert"
                  className="mx-auto mt-4 flex max-w-md items-center justify-center gap-2 rounded-xl border border-[#B91C1C]/35 bg-[#FEE2E2] px-4 py-2.5 text-sm font-medium text-[#991B1B]"
                >
                  <ErrorMark />
                  <span>{drawError}</span>
                </div>
              )}

              {/* Dedicated 3-Layer Interactive Stick-in-Tin Stage */}
              <div className="relative mx-auto mt-5 h-[316px] w-full max-w-[380px] select-none">
                {/* Floating Prompt Pill Centered Clear Above Stick Tips */}
                <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 font-mono text-[11px] font-semibold transition-all duration-200 ${
                      hoveredStick !== null || pullingStick !== null
                        ? 'border-[#B91C1C]/35 bg-[#FEF2F2] text-[#B91C1C] shadow-sm'
                        : 'border-[#D99B26]/35 bg-[#F7EFE1]/90 text-[#5B3A1B]'
                    }`}
                  >
                    <Sparkle
                      size={12}
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
                          : 'Tap any stick or shake the tin'}
                  </span>
                </div>

                {/* Warm Candlelight Glow Behind Tin */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-6 left-1/2 h-44 w-60 -translate-x-1/2 rounded-full bg-[#D99B26]/22 blur-2xl"
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
                            y: [0, 3, 0],
                          }
                        : { rotate: 0, x: 0, y: 0 }
                  }
                  transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
                >
                  {/* LAYER 1 (z-10): Tin Cup Back Rim & Deep Interior Shadow */}
                  <svg
                    viewBox="0 0 248 136"
                    className="pointer-events-none absolute bottom-0 left-1/2 z-10 h-[136px] w-[248px] -translate-x-1/2"
                    fill="none"
                    aria-hidden="true"
                  >
                    <ellipse
                      cx="124"
                      cy="20"
                      rx="90"
                      ry="15"
                      fill="#3F0909"
                      stroke="#D99B26"
                      strokeWidth="2.5"
                    />
                    <ellipse
                      cx="124"
                      cy="21.5"
                      rx="81"
                      ry="11"
                      fill="#230404"
                      fillOpacity="0.8"
                    />
                  </svg>

                  {/* LAYER 2 (z-20): Living Interactive Wooden Sticks Seated Inside the Cup */}
                  <div className="absolute bottom-[44px] left-1/2 z-20">
                    {Array.from({ length: stickCount }).map((_, idx) => {
                      const ratio = stickCount === 1 ? 0.5 : idx / (stickCount - 1);
                      const baseAngle = -spread / 2 + ratio * spread;
                      const jitter = stickJitter[idx] ?? 0;
                      const restAngle = isShaking ? baseAngle * 0.35 : baseAngle + jitter;
                      const baseX = (idx - (stickCount - 1) / 2) * stepX;

                      const isHovered = hoveredStick === idx;
                      const isPeeking = peekStick === idx && hoveredStick === null;
                      const isPulling = pullingStick === idx;
                      const anotherPulling = pullingStick !== null && !isPulling;

                      // Subtle neighbor parting when cursor glides over the fan
                      let neighborPushX = 0;
                      let neighborPushRot = 0;
                      if (hoveredStick !== null && hoveredStick !== idx && pullingStick === null) {
                        const dir = idx < hoveredStick ? -1 : 1;
                        const dist = Math.abs(idx - hoveredStick);
                        const falloff = dist === 1 ? 1 : dist === 2 ? 0.5 : 0.2;
                        neighborPushX = dir * 7 * falloff;
                        neighborPushRot = dir * 2.5 * falloff;
                      }

                      const targetY = isPulling
                        ? -84
                        : anotherPulling
                          ? 20
                          : isHovered
                            ? -28
                            : isPeeking
                              ? -13
                              : isShaking
                                ? -8
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
                            scale: isPulling ? 1.08 : isHovered ? 1.07 : isPeeking ? 1.03 : 1,
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
                          className="group absolute bottom-0 left-0 -ml-[18px] h-[176px] w-9 origin-bottom cursor-pointer rounded-t-full border border-[#8D643B]/55 bg-gradient-to-r from-[#D8AC7B] via-[#F4DEC0] to-[#C39363] shadow-[0_6px_14px_rgba(27,46,36,0.22)] transition-shadow duration-200 hover:shadow-[0_12px_24px_rgba(185,28,28,0.28)] focus-visible:outline-2 focus-visible:outline-[#B91C1C] disabled:cursor-wait"
                        >
                          {/* Subtle Ambient Breathing Wrapper */}
                          <motion.div
                            className="flex h-full w-full flex-col items-center overflow-hidden rounded-t-full"
                            animate={
                              !prefersReducedMotion &&
                              !isHovered &&
                              !isPulling &&
                              !anotherPulling
                                ? { y: [0, -3.5, 0] }
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
                            {/* Glossy Painted Crimson Dip Tip */}
                            <span className="relative h-7 w-full bg-gradient-to-b from-[#DC2626] via-[#C81E1E] to-[#991B1B]">
                              <span
                                aria-hidden="true"
                                className="absolute inset-y-1 left-1.5 w-1 rounded-full bg-white/30"
                              />
                            </span>
                            {/* Double Burnished Gold Collar */}
                            <span className="h-1.5 w-full bg-[#D99B26]" />
                            <span className="h-px w-full bg-[#7C5324]/45" />

                            {/* Stick Number */}
                            <span className="mt-2.5 font-mono text-[10px] font-bold tracking-tight text-[#5F3C1C]">
                              {String(idx + 1).padStart(2, '0')}
                            </span>

                            {/* Engraved Star Emblem */}
                            <Star
                              size={11}
                              weight="fill"
                              className={`mt-1 transition-transform duration-200 ${
                                isHovered || isPeeking
                                  ? 'scale-125 text-[#B91C1C]'
                                  : 'text-[#B91C1C]/75'
                              }`}
                              aria-hidden="true"
                            />

                            {/* Subtle Wood Grain Vertical Line */}
                            <span
                              aria-hidden="true"
                              className="mt-3 h-14 w-px rounded-full bg-[#8D643B]/20"
                            />
                          </motion.div>
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* LAYER 3 (z-30, pointer-events-none): Tin Cup Front Wall Covering Stick Bases */}
                  <svg
                    viewBox="0 0 248 136"
                    className="pointer-events-none absolute bottom-0 left-1/2 z-30 h-[136px] w-[248px] -translate-x-1/2 drop-shadow-[0_18px_28px_rgba(15,41,30,0.3)]"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M34 20A90 15 0 0 0 214 20L194 116C192 126 162 132 124 132C86 132 56 126 54 116L34 20Z"
                      fill="url(#packTinFrontBody)"
                      stroke="#D99B26"
                      strokeWidth="2.4"
                    />
                    <path
                      d="M34 20A90 15 0 0 0 214 20"
                      stroke="#FDE68A"
                      strokeOpacity="0.72"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M42 60C66 68 94 71 124 71C154 71 182 68 206 60L202 79C179 87 153 90 124 90C95 90 69 87 46 79L42 60Z"
                      fill="#D99B26"
                    />
                    <circle
                      cx="124"
                      cy="74"
                      r="18.5"
                      fill="#0F291E"
                      stroke="#FFFDF9"
                      strokeWidth="2"
                    />
                    <path
                      d="M124 61L131.5 72.5H126.8L133.5 82H114.5L121.2 72.5H116.5L124 61Z"
                      fill="#D99B26"
                    />
                    <defs>
                      <linearGradient
                        id="packTinFrontBody"
                        x1="34"
                        y1="20"
                        x2="214"
                        y2="128"
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

              {/* Action Controls Below the Tin */}
              <div className="mt-5 flex flex-col items-center gap-3">
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    disabled={pullingStick !== null || isShaking}
                    onClick={handleShakeButtonClick}
                    className="atelier-btn inline-flex items-center gap-2 rounded-full border border-[#D8CBB5] bg-[#F7EFE1] px-4 py-2.5 text-xs font-semibold text-[#143D2B] transition-all duration-200 hover:border-[#D99B26] hover:bg-[#EFE2CB] active:scale-[0.97] disabled:opacity-60"
                  >
                    <ArrowsClockwise
                      size={15}
                      weight="bold"
                      className={isShaking ? 'animate-spin' : ''}
                      aria-hidden="true"
                    />
                    <span>Shake Tin</span>
                  </button>

                  <button
                    type="button"
                    disabled={pullingStick !== null}
                    onClick={() => handlePullStick(Math.floor(Math.random() * stickCount))}
                    className="atelier-btn group inline-flex items-center gap-3 rounded-full bg-[#B91C1C] py-2 pl-6 pr-2 text-sm font-semibold text-[#FFFDF9] shadow-[0_12px_28px_-8px_rgba(185,28,28,0.45)] transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-[#991B1B] active:scale-[0.98] disabled:opacity-60"
                  >
                    <span>
                      {pullingStick !== null
                        ? 'Pulling Your Stick...'
                        : currentGuest?.hasDrawn
                          ? 'Pull & Peek at My Match'
                          : 'Pick a Random Stick for Me'}
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/20 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:-translate-y-0.5">
                      <HandPointing size={17} weight="regular" aria-hidden="true" />
                    </span>
                  </button>
                </div>

                <span className="font-mono text-[11px] text-[#6B7A70]">
                  Tap any wooden stick inside the cup above or shake to mix
                </span>
              </div>
            </motion.div>
          ) : (
            /* Revealed Keepsake Wooden Stick + Parchment Gift Tag */
            <motion.div
              key="revealed-stick"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 210, damping: 22 }}
              className="pt-7 text-center"
            >
              {/* Horizontal Wooden Keepsake Stick */}
              <div className="mx-auto mb-5 flex max-w-md items-center overflow-hidden rounded-full border border-[#8D643B]/45 bg-gradient-to-r from-[#EED2AF] via-[#DFB78A] to-[#C89B6E] shadow-md">
                <div className="flex h-10 w-16 shrink-0 items-center justify-center bg-[#B91C1C] font-mono text-xs font-bold text-[#FFFDF9]">
                  #{String(revealed.stickNumber).padStart(2, '0')}
                </div>
                <div className="h-10 w-2 shrink-0 bg-[#D99B26]" />
                <div className="flex flex-1 items-center justify-center gap-2 px-4 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-[#5B3A1B]">
                  <Sparkle size={14} weight="fill" className="text-[#B91C1C]" aria-hidden="true" />
                  <span>Stick Drawn for {revealed.giverName}</span>
                </div>
              </div>

              {/* Tied Parchment Gift Tag */}
              <div className="mx-auto max-w-lg rounded-3xl border-2 border-[#D99B26]/45 bg-[#F7EFE1] p-6 shadow-inner sm:p-8">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#B91C1C] text-[#FFFDF9]">
                  <Gift size={22} weight="light" aria-hidden="true" />
                </div>
                <p className="text-sm font-medium text-[#4E5F54]">
                  You are Secret Santa for
                </p>

                <div className="my-4 rounded-2xl border border-[#D99B26]/35 bg-[#FFFDF9] px-5 py-6 shadow-sm">
                  {hideMatchText ? (
                    <p className="font-mono text-sm uppercase tracking-[0.2em] text-[#6B7A70]">
                      Hidden from screen
                    </p>
                  ) : (
                    <p className="break-words font-serif text-4xl italic leading-tight text-[#B91C1C] sm:text-5xl">
                      {revealed.recipientName}
                    </p>
                  )}
                </div>

                {state.budget.trim() && (
                  <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#143D2B]">
                    Gift Guideline: {state.budget}
                  </p>
                )}

                <p className="text-xs leading-relaxed text-[#5F6F65]">
                  Keep it a Christmas secret! You can hide the name before locking your screen or
                  switch guests if you are sharing this device.
                </p>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setHideMatchText((v) => !v)}
                    className="atelier-btn inline-flex items-center gap-2 rounded-full border border-[#D8CBB5] bg-[#FFFDF9] px-5 py-2.5 text-xs font-semibold text-[#143D2B] transition-colors hover:border-[#143D2B]"
                  >
                    {hideMatchText ? (
                      <>
                        <Eye size={15} weight="regular" aria-hidden="true" />
                        Peek at Name
                      </>
                    ) : (
                      <>
                        <EyeSlash size={15} weight="regular" aria-hidden="true" />
                        Hide Name
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={onClearGuest}
                    className="atelier-btn inline-flex items-center gap-2 rounded-full bg-[#143D2B] px-5 py-2.5 text-xs font-semibold text-[#FFFDF9] transition-colors hover:bg-[#0F291E]"
                  >
                    <Check size={15} weight="bold" aria-hidden="true" />
                    Done / Switch Guest
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
