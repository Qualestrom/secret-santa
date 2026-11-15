const supportsUserInvalid =
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('selector(:user-invalid)');

let announcerEl: HTMLDivElement | null = null;
let announceTimer: ReturnType<typeof setTimeout> | undefined;
let announcedField: Element | null = null;

const flagged = new WeakSet<Element>();
const announced = new WeakSet<Element>();
const dirtyState = new WeakMap<Element, { hasInteracted: boolean; hasBlurred: boolean }>();

function getAnnouncer(): HTMLDivElement {
  if (!announcerEl) {
    announcerEl = document.createElement('div');
    announcerEl.setAttribute('aria-live', 'polite');
    announcerEl.className = 'visually-hidden';
    document.body.append(announcerEl);
  }
  return announcerEl;
}

function linkError(el: HTMLElement, shown: boolean): void {
  const errorId = el.dataset.error;
  if (!errorId) return;
  const ids = (el.getAttribute('aria-describedby') || '')
    .split(/\s+/)
    .filter((id) => id && id !== errorId);
  if (shown) ids.push(errorId);
  if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
  else el.removeAttribute('aria-describedby');
}

function spokenText(node: Node): string {
  const copy = node.cloneNode(true) as Element;
  copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
  copy.querySelectorAll('[role="img"][aria-label]').forEach((n) => {
    n.replaceWith(`${n.getAttribute('aria-label')}: `);
  });
  return (copy.textContent || '').replace(/\s+/g, ' ').trim();
}

function announceError(el: HTMLInputElement): void {
  const errorId = el.dataset.error;
  if (!errorId) return;
  const error = document.getElementById(errorId);
  if (!error) return;
  const label = el.labels && el.labels[0] ? `${spokenText(el.labels[0])}: ` : '';
  const announcer = getAnnouncer();
  clearTimeout(announceTimer);
  announcer.textContent = '';
  announcedField = el;
  announceTimer = setTimeout(() => {
    announcer.textContent = label + spokenText(error);
  }, 500);
}

function isControlInvalid(el: HTMLElement): boolean {
  if (supportsUserInvalid) {
    return el.matches(':user-invalid');
  }
  return el.classList.contains('user-invalid-fallback');
}

export function syncElementAria(el: EventTarget | null, announce = false): void {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) {
    return;
  }
  const invalid = isControlInvalid(el);
  if (invalid) {
    if (announce && el instanceof HTMLInputElement && !announced.has(el)) {
      announceError(el);
      announced.add(el);
    }
    el.setAttribute('aria-invalid', 'true');
    linkError(el, true);
    flagged.add(el);
  } else if (flagged.has(el) || el.getAttribute('aria-invalid') !== 'true') {
    el.setAttribute('aria-invalid', 'false');
    linkError(el, false);
    flagged.delete(el);
    announced.delete(el);
    if (announcedField === el && announcerEl) {
      clearTimeout(announceTimer);
      announcerEl.textContent = '';
    }
  }
}

export function resetFormValidationState(form: HTMLFormElement | null): void {
  if (!form) return;
  for (const el of Array.from(form.elements)) {
    dirtyState.delete(el);
    el.classList.remove('user-invalid-fallback', 'user-valid-fallback');
    syncElementAria(el, false);
  }
}

export function initGlobalFormValidation(): () => void {
  getAnnouncer();
  document
    .querySelectorAll('input, select, textarea')
    .forEach((el) => syncElementAria(el, false));

  const updateFallback = (
    input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
    announce: boolean
  ) => {
    const isValid = input.validity.valid;
    input.classList.toggle('user-invalid-fallback', !isValid);
    input.classList.toggle('user-valid-fallback', isValid);
    syncElementAria(input, announce);
  };

  const onBlur = (e: Event) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) {
      return;
    }
    if (supportsUserInvalid) {
      syncElementAria(target, true);
    } else {
      const state = dirtyState.get(target) || { hasInteracted: false, hasBlurred: false };
      state.hasBlurred = true;
      dirtyState.set(target, state);
      if (state.hasInteracted) updateFallback(target, true);
    }
  };

  const onInput = (e: Event) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) {
      return;
    }
    if (supportsUserInvalid) {
      if (target.hasAttribute('aria-invalid')) syncElementAria(target, false);
    } else {
      const state = dirtyState.get(target) || { hasInteracted: false, hasBlurred: false };
      state.hasInteracted = true;
      dirtyState.set(target, state);
      if (state.hasBlurred) updateFallback(target, false);
    }
  };

  const onChange = (e: Event) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) {
      return;
    }
    if (supportsUserInvalid) {
      syncElementAria(target, true);
    } else {
      const state = dirtyState.get(target) || { hasInteracted: false, hasBlurred: false };
      state.hasInteracted = true;
      dirtyState.set(target, state);
      if (state.hasBlurred) updateFallback(target, true);
    }
  };

  const onInvalid = (e: Event) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) {
      return;
    }
    announced.add(target);
    if (supportsUserInvalid) {
      syncElementAria(target, false);
    } else {
      dirtyState.set(target, { hasInteracted: true, hasBlurred: true });
      updateFallback(target, false);
    }
  };

  const onReset = (e: Event) => {
    const form = e.target;
    if (form instanceof HTMLFormElement) {
      setTimeout(() => resetFormValidationState(form));
    }
  };

  document.addEventListener('blur', onBlur, true);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onChange, true);
  document.addEventListener('invalid', onInvalid, true);
  document.addEventListener('reset', onReset, true);

  return () => {
    document.removeEventListener('blur', onBlur, true);
    document.removeEventListener('input', onInput);
    document.removeEventListener('change', onChange, true);
    document.removeEventListener('invalid', onInvalid, true);
    document.removeEventListener('reset', onReset, true);
  };
}

export function setupLightDismissFallback(dialog: HTMLDialogElement | null): () => void {
  if (!dialog) return () => {};
  if ('closedBy' in HTMLDialogElement.prototype) return () => {};

  const outside = (e: PointerEvent) => {
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };

  let pressedOutside = false;
  const onPointerDown = (e: PointerEvent) => {
    pressedOutside = e.target === dialog && outside(e);
  };
  const onPointerUp = (e: PointerEvent) => {
    if (pressedOutside && e.target === dialog && outside(e)) {
      dialog.close();
    }
    pressedOutside = false;
  };

  dialog.addEventListener('pointerdown', onPointerDown);
  dialog.addEventListener('pointerup', onPointerUp);

  return () => {
    dialog.removeEventListener('pointerdown', onPointerDown);
    dialog.removeEventListener('pointerup', onPointerUp);
  };
}
