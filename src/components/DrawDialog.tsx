import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, Gift, LockKey, X } from '@phosphor-icons/react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { revealDrawMatch, ApiError } from '../lib/api';
import {
  resetFormValidationState,
  setupLightDismissFallback,
  syncElementAria,
} from '../lib/validation';
import type { EventState, PublicParticipant } from '../types';
import { ErrorMark } from './ErrorMark';

interface DrawDialogProps {
  participant: PublicParticipant | null;
  budget: string;
  onClose: () => void;
  onStateUpdate: (state: EventState) => void;
}

export function DrawDialog({
  participant,
  budget,
  onClose,
  onStateUpdate,
}: DrawDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const doneBtnRef = useRef<HTMLButtonElement>(null);

  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<{
    giverName: string;
    recipientName: string;
  } | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const cleanupDismiss = setupLightDismissFallback(dialog);
    const handleClose = () => {
      dialog.returnValue = '';
      setPin('');
      setServerError(null);
      setRevealed(null);
      resetFormValidationState(formRef.current);
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

    if (participant) {
      setPin('');
      setServerError(null);
      setRevealed(null);
      if (!dialog.open) {
        dialog.showModal();
      }
      requestAnimationFrame(() => {
        if (pinInputRef.current) {
          syncElementAria(pinInputRef.current, false);
          pinInputRef.current.focus();
        }
      });
    } else if (dialog.open) {
      dialog.close();
    }
  }, [participant]);

  const fireSubtleRevealConfetti = () => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    confetti({
      particleCount: 48,
      spread: 64,
      origin: { y: 0.58 },
      colors: ['#C83E31', '#C5A059', '#F5F2EB'],
      disableForReducedMotion: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!participant) return;

    setServerError(null);
    setSubmitting(true);

    try {
      const result = await revealDrawMatch(participant.id, pin.trim());
      onStateUpdate(result.state);
      setRevealed({
        giverName: result.participantName,
        recipientName: result.assignedToName,
      });
      fireSubtleRevealConfetti();
      requestAnimationFrame(() => {
        doneBtnRef.current?.focus();
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to reveal match.';
      setServerError(message);
      pinInputRef.current?.select();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      id="draw-dialog"
      className="atelier-dialog"
      aria-labelledby="draw-dialog-title"
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      <div className="atelier-dialog-scroll rounded-[28px] bg-white/[0.03] p-1.5 ring-1 ring-white/[0.08]">
        <div className="rounded-[22px] bg-[#111715] p-6 sm:p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-4 mb-5">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.18em] text-[#C5A059]">
                <LockKey size={13} weight="regular" aria-hidden="true" />
                Private Unsealing
              </span>
              <h2
                id="draw-dialog-title"
                className="mt-1 font-serif text-3xl leading-none tracking-tight text-[#F5F2EB]"
              >
                {revealed
                  ? 'Correspondence Unsealed'
                  : participant?.hasDrawn
                    ? 'Re-open Your Envelope'
                    : 'Unseal Your Envelope'}
              </h2>
            </div>

            <form method="dialog">
              <button
                type="submit"
                value="close"
                aria-label="Close envelope dialog"
                className="atelier-btn inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04] text-[#9E988E] ring-1 ring-white/[0.08] transition-colors duration-200 hover:bg-white/[0.08] hover:text-[#F5F2EB] active:scale-[0.97]"
              >
                <X size={18} weight="light" aria-hidden="true" />
              </button>
            </form>
          </div>

          <AnimatePresence mode="wait">
            {!revealed ? (
              <motion.div
                key="pin-step"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              >
                <p className="mb-5 text-sm leading-relaxed text-[#9E988E]">
                  Verifying identity for{' '}
                  <strong className="font-semibold text-[#F5F2EB]">
                    {participant?.name || 'Guest'}
                  </strong>
                  . Enter your 4-digit PIN to inspect who you are gifting to.
                </p>

                <form
                  ref={formRef}
                  method="POST"
                  action="/api/event"
                  aria-labelledby="draw-dialog-title"
                  onSubmit={handleSubmit}
                >
                  <div className="mb-5 flex flex-col gap-1.5">
                    <label
                      htmlFor="draw-pin-input"
                      className="text-sm font-medium text-[#F5F2EB]"
                    >
                      4-Digit Secret PIN <span className="text-[#C83E31]" aria-hidden="true">*</span>
                    </label>
                    <span id="draw-pin-hint" className="text-xs text-[#9E988E]">
                      Enter the 4 digits you selected when joining the guest ledger
                    </span>
                    <input
                      ref={pinInputRef}
                      id="draw-pin-input"
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
                      autoFocus
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      aria-describedby="draw-pin-hint"
                      data-error="draw-pin-error"
                      placeholder="0000"
                      className="atelier-input font-mono tracking-[0.35em] text-center"
                    />
                    <div id="draw-pin-error" className="error-msg">
                      <ErrorMark />
                      <span>Please enter your 4-digit numeric PIN.</span>
                    </div>
                  </div>

                  {serverError && (
                    <div
                      role="alert"
                      className="mb-4 flex items-start gap-2 rounded-xl border border-[#C83E31]/40 bg-[#C83E31]/12 px-3.5 py-2.5 text-sm text-[#F28B7D]"
                    >
                      <ErrorMark />
                      <span>{serverError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="atelier-btn group flex w-full items-center justify-between rounded-full bg-[#C83E31] py-2 pl-6 pr-2 text-sm font-semibold text-[#F5F2EB] shadow-[0_12px_30px_-10px_rgba(200,62,49,0.6)] transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-[#d64538] active:scale-[0.98] disabled:opacity-60"
                  >
                    <span>{submitting ? 'Unsealing...' : 'Unseal Match'}</span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/20 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                      <ArrowUpRight size={17} weight="regular" aria-hidden="true" />
                    </span>
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="reveal-step"
                initial={{ opacity: 0, scale: 0.97, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
                className="text-center"
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#C5A059]/15 text-[#C5A059] ring-1 ring-[#C5A059]/30">
                  <Gift size={22} weight="light" aria-hidden="true" />
                </div>

                <p className="text-sm text-[#9E988E]">
                  <span className="font-medium text-[#F5F2EB]">{revealed.giverName}</span>, you are
                  gifting to
                </p>

                <div className="my-5 rounded-2xl border border-[#C5A059]/30 bg-gradient-to-b from-[#17211D] to-[#0E1412] px-5 py-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <p className="font-serif italic text-4xl sm:text-5xl tracking-tight text-[#F5F2EB] break-words">
                    {revealed.recipientName}
                  </p>
                </div>

                {budget.trim() && (
                  <p className="mb-3 font-mono text-xs uppercase tracking-[0.14em] text-[#C5A059]">
                    Guideline: {budget}
                  </p>
                )}

                <p className="mb-6 text-xs leading-relaxed text-[#9E988E]">
                  Keep this name private. You may re-open your envelope anytime with your PIN if you
                  need a reminder.
                </p>

                <form method="dialog">
                  <button
                    ref={doneBtnRef}
                    type="submit"
                    value="done"
                    className="atelier-btn group flex w-full items-center justify-between rounded-full bg-[#F5F2EB] py-2 pl-6 pr-2 text-sm font-semibold text-[#0B0F0E] transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-white active:scale-[0.98]"
                  >
                    <span>Hide &amp; Seal Correspondence</span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/10 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-105">
                      <Check size={16} weight="bold" aria-hidden="true" />
                    </span>
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </dialog>
  );
}
