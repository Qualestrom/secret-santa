import { useEffect, useState } from 'react';
import {
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
import { AnimatePresence, motion } from 'framer-motion';
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

export function StickPackStage({
  state,
  currentGuest,
  onSelectGuest,
  onClearGuest,
  onStateUpdate,
}: StickPackStageProps) {
  const [hoveredStick, setHoveredStick] = useState<number | null>(null);
  const [pullingStick, setPullingStick] = useState<number | null>(null);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<{
    stickNumber: number;
    giverName: string;
    recipientName: string;
  } | null>(null);
  const [hideMatchText, setHideMatchText] = useState(false);

  // Clear local reveal if guest switches or phase resets
  useEffect(() => {
    setRevealed(null);
    setDrawError(null);
    setHideMatchText(false);
    setPullingStick(null);
  }, [currentGuest?.id, state.phase]);

  const participants = state.participants;
  const totalCount = participants.length;
  const drawnCount = participants.filter((p) => p.hasDrawn).length;
  const stickCount = Math.min(Math.max(totalCount, 5), 12);

  const fireChristmasConfetti = () => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    confetti({
      particleCount: 65,
      spread: 74,
      origin: { y: 0.56 },
      colors: ['#B91C1C', '#D99B26', '#1E5B3E', '#FFFDF9'],
      disableForReducedMotion: true,
    });
  };

  const handlePullStick = async (stickIndex: number) => {
    if (!currentGuest || pullingStick !== null) return;
    setDrawError(null);
    setPullingStick(stickIndex);

    try {
      const [result] = await Promise.all([
        revealDrawMatch(currentGuest.id),
        new Promise((resolve) => setTimeout(resolve, 460)),
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

  // Step 1: Guest selection (if arriving on a fresh browser or after clicking "Switch guest")
  if (!currentGuest) {
    return (
      <div className="parchment-card mx-auto max-w-2xl rounded-[30px] bg-[#D99B26]/25 p-1.5 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.5)]">
        <div className="rounded-[24px] border border-[#D99B26]/35 bg-[#FFFDF9] p-6 text-[#1B2E24] sm:p-9">
          <div className="mb-6 flex flex-col items-center text-center">
            <HollySprig className="mb-2 h-8 w-22" />
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#B91C1C]">
              Stick Draw Is Live
            </span>
            <h2 className="mt-2 font-serif text-4xl leading-none text-[#143D2B] sm:text-5xl">
              Tap Your Name to Pick a Stick
            </h2>
            <p className="mt-3 max-w-[44ch] text-sm leading-relaxed text-[#4E5F54]">
              Choose yourself from the Christmas list below to step up to the stick cup and pull
              your Secret Santa match.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {participants.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectGuest(p)}
                className={`atelier-btn group flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98] ${
                  p.hasDrawn
                    ? 'border-[#D8CBB5] bg-[#F7EFE1]/65 hover:border-[#D99B26]'
                    : 'border-[#D99B26]/40 bg-white shadow-sm hover:-translate-y-0.5 hover:border-[#B91C1C] hover:shadow-md'
                }`}
              >
                <span className="font-semibold text-[#143D2B] truncate">{p.name}</span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold ${
                    p.hasDrawn
                      ? 'bg-[#143D2B]/10 text-[#143D2B]'
                      : 'bg-[#B91C1C]/10 text-[#B91C1C]'
                  }`}
                >
                  {p.hasDrawn ? 'Pulled' : 'Ready'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="parchment-card mx-auto max-w-3xl rounded-[30px] bg-[#D99B26]/25 p-1.5 shadow-[0_28px_70px_-15px_rgba(0,0,0,0.55)]">
      <div className="rounded-[24px] border border-[#D99B26]/35 bg-[#FFFDF9] p-6 text-[#1B2E24] sm:p-9">
        {/* Top Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E7DCCB] pb-4">
          <div>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B91C1C]">
              Drawing For
            </span>
            <p className="font-serif text-3xl leading-tight text-[#143D2B]">
              {currentGuest.name}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[#143D2B]/[0.08] px-3 py-1 font-mono text-xs font-semibold text-[#143D2B]">
              {drawnCount} / {totalCount} pulled
            </span>
            <button
              type="button"
              onClick={onClearGuest}
              className="atelier-btn inline-flex items-center gap-1.5 rounded-full border border-[#D8CBB5] bg-[#F7EFE1] px-3.5 py-1.5 text-xs font-semibold text-[#1B2E24] transition-colors hover:border-[#B91C1C] hover:text-[#B91C1C]"
            >
              <ArrowsLeftRight size={14} weight="regular" aria-hidden="true" />
              Switch Guest
            </button>
          </div>
        </div>

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
              <div className="mx-auto max-w-[46ch]">
                <h2 className="font-serif text-4xl leading-none text-[#143D2B] sm:text-5xl">
                  {currentGuest.hasDrawn ? 'Peek at Your Stick Again' : 'Pick a Stick from the Pack'}
                </h2>
                <p className="mt-2.5 text-sm leading-relaxed text-[#4E5F54]">
                  {currentGuest.hasDrawn
                    ? 'You already pulled a stick earlier. Tap any stick below if you need a quick reminder of your match.'
                    : 'Tap any wooden stick fanned inside the Christmas tin below to pull it out and reveal your Secret Santa recipient.'}
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

              {/* Interactive Stick Pack Visual */}
              <div className="relative mx-auto mt-8 flex h-[310px] w-full max-w-[440px] flex-col items-center justify-end select-none">
                {/* Warm candlelight radial halo */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-10 h-44 w-56 rounded-full bg-[#D99B26]/20 blur-2xl"
                />

                {/* Fanned Wooden Sticks */}
                <div className="relative bottom-[92px] flex w-full items-end justify-center">
                  {Array.from({ length: stickCount }).map((_, idx) => {
                    const spread = 56;
                    const angle =
                      stickCount === 1
                        ? 0
                        : -spread / 2 + (idx / (stickCount - 1)) * spread;
                    const horizontalShift = (idx - (stickCount - 1) / 2) * 14;
                    const isHovered = hoveredStick === idx;
                    const isPulling = pullingStick === idx;

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
                          y: isPulling ? -145 : isHovered ? -22 : 0,
                          rotate: isPulling ? 0 : angle,
                          x: isPulling ? 0 : horizontalShift,
                          scale: isPulling ? 1.08 : isHovered ? 1.04 : 1,
                        }}
                        transition={{
                          type: 'spring',
                          stiffness: 260,
                          damping: 20,
                        }}
                        style={{ zIndex: isPulling ? 30 : isHovered ? 25 : 10 + idx }}
                        className="group absolute bottom-0 flex h-44 w-8 origin-bottom cursor-pointer flex-col items-center rounded-t-full border border-[#8D643B]/45 bg-gradient-to-r from-[#DFB78A] via-[#F2D9BA] to-[#C89B6E] shadow-[0_6px_14px_rgba(27,46,36,0.18)] focus-visible:ring-2 focus-visible:ring-[#B91C1C] disabled:cursor-wait"
                      >
                        {/* Painted Christmas Tip */}
                        <span className="h-7 w-full rounded-t-full bg-gradient-to-b from-[#DC2626] to-[#B91C1C]" />
                        <span className="h-1.5 w-full bg-[#D99B26]" />
                        <span className="mt-3 font-mono text-[10px] font-bold text-[#6E4926]">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        {/* Gold star motif near tip */}
                        <Star
                          size={10}
                          weight="fill"
                          className="mt-1.5 text-[#B91C1C]/75 transition-transform group-hover:scale-125"
                          aria-hidden="true"
                        />
                      </motion.button>
                    );
                  })}
                </div>

                {/* Foreground Christmas Stick Tin / Cup */}
                <svg
                  viewBox="0 0 240 132"
                  className="pointer-events-none relative z-30 h-32 w-60 drop-shadow-[0_18px_28px_rgba(15,41,30,0.3)]"
                  fill="none"
                  aria-hidden="true"
                >
                  <ellipse cx="120" cy="18" rx="88" ry="14" fill="#7F1D1D" stroke="#D99B26" strokeWidth="2.5" />
                  <path
                    d="M34 20L52 112C54 122 83 128 120 128C157 128 186 122 188 112L206 20C192 28 159 32 120 32C81 32 48 28 34 20Z"
                    fill="url(#tinBody)"
                    stroke="#D99B26"
                    strokeWidth="2.4"
                  />
                  {/* Gold Ribbon Band */}
                  <path
                    d="M41 58C64 66 91 69 120 69C149 69 176 66 199 58L196 76C174 84 148 87 120 87C92 87 66 84 44 76L41 58Z"
                    fill="#D99B26"
                  />
                  {/* Center Evergreen Medallion */}
                  <circle cx="120" cy="70" r="18" fill="#0F291E" stroke="#FFFDF9" strokeWidth="2" />
                  <path d="M120 58L127 69H122.5L129 78H111L117.5 69H113L120 58Z" fill="#D99B26" />
                  <defs>
                    <linearGradient id="tinBody" x1="34" y1="20" x2="206" y2="124" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#DC2626" />
                      <stop offset="0.5" stopColor="#B91C1C" />
                      <stop offset="1" stopColor="#7F1D1D" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              {/* Accessible Keyboard / One-Tap Alternative */}
              <div className="mt-5 flex flex-col items-center gap-2">
                <button
                  type="button"
                  disabled={pullingStick !== null}
                  onClick={() => handlePullStick(Math.floor(Math.random() * stickCount))}
                  className="atelier-btn group inline-flex items-center gap-3 rounded-full bg-[#B91C1C] py-2 pl-6 pr-2 text-sm font-semibold text-[#FFFDF9] shadow-[0_12px_28px_-8px_rgba(185,28,28,0.45)] transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-[#991B1B] active:scale-[0.98] disabled:opacity-60"
                >
                  <span>
                    {pullingStick !== null
                      ? 'Pulling Your Stick...'
                      : currentGuest.hasDrawn
                        ? 'Pull & Peek at My Match'
                        : 'Pick a Random Stick for Me'}
                  </span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/20 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:-translate-y-0.5">
                    <HandPointing size={17} weight="regular" aria-hidden="true" />
                  </span>
                </button>
                <span className="font-mono text-[11px] text-[#6B7A70]">
                  Tap any stick above or press the button to pull
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
                    <p className="font-serif italic text-4xl leading-tight text-[#B91C1C] sm:text-5xl break-words">
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
