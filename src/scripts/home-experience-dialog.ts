type CloseHomeExperienceOptions = { restoreFocus?: boolean };
type SavedStyle = { name: string; value: string; priority: string };
type ScrollLock = {
  x: number;
  y: number;
  html: SavedStyle[];
  body: SavedStyle[];
};

let dialog: HTMLDialogElement | null = null;
let opener: HTMLElement | null = null;
let scrollLock: ScrollLock | null = null;
let animation: Animation | null = null;
let motionGeneration = 0;
let closing = false;

const saveStyles = (element: HTMLElement, names: string[]): SavedStyle[] =>
  names.map((name) => ({
    name,
    value: element.style.getPropertyValue(name),
    priority: element.style.getPropertyPriority(name),
  }));

const restoreStyles = (element: HTMLElement, saved: SavedStyle[]) => {
  saved.forEach(({ name, value, priority }) => {
    if (value) element.style.setProperty(name, value, priority);
    else element.style.removeProperty(name);
  });
};

function lockPageScroll() {
  if (scrollLock) return;
  const html = document.documentElement;
  const body = document.body;
  const gap = Math.max(0, innerWidth - html.clientWidth);
  const padding = Number.parseFloat(getComputedStyle(body).paddingRight) || 0;
  scrollLock = {
    x: scrollX,
    y: scrollY,
    html: saveStyles(html, ['overflow', 'overscroll-behavior']),
    body: saveStyles(body, [
      'position',
      'top',
      'left',
      'width',
      'overflow',
      'padding-right',
    ]),
  };
  html.style.setProperty('overflow', 'hidden');
  html.style.setProperty('overscroll-behavior', 'none');
  body.style.setProperty('position', 'fixed');
  body.style.setProperty('top', `${-scrollLock.y}px`);
  body.style.setProperty('left', `${-scrollLock.x}px`);
  body.style.setProperty('width', '100%');
  body.style.setProperty('overflow', 'hidden');
  if (gap) body.style.setProperty('padding-right', `${padding + gap}px`);
}

function unlockPageScroll() {
  if (!scrollLock) return;
  const saved = scrollLock;
  scrollLock = null;
  restoreStyles(document.documentElement, saved.html);
  restoreStyles(document.body, saved.body);
  // Override the page's smooth-scroll style when restoring its exact position.
  scrollTo({ left: saved.x, top: saved.y, behavior: 'instant' });
}

function cancelMotion() {
  motionGeneration++;
  animation?.cancel();
  animation = null;
}

function finishClose(restoreFocus: boolean) {
  cancelMotion();
  closing = false;
  const target = restoreFocus ? opener : null;
  // Clear before close(): the queued native close event must never steal focus
  // after the project configurator has received the handoff.
  opener = null;
  if (dialog?.open) dialog.close();
  unlockPageScroll();
  if (target?.isConnected) target.focus({ preventScroll: true });
}

/**
 * Call closeHomeExperience({ restoreFocus: false }) immediately BEFORE emitting
 * hauset:project-add. That path closes and unlocks synchronously; no delayed
 * animation or focus restoration can compete with the configurator afterward.
 */
export function closeHomeExperience(options: CloseHomeExperienceOptions = {}) {
  if (!dialog?.open) return;
  const restoreFocus = options.restoreFocus !== false;
  if (!restoreFocus) {
    finishClose(false);
    return;
  }
  if (closing) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || typeof dialog.animate !== 'function') {
    finishClose(true);
    return;
  }
  const style = getComputedStyle(dialog);
  const initial = { opacity: style.opacity, transform: style.transform };
  cancelMotion();
  closing = true;
  const generation = motionGeneration;
  const destination = matchMedia('(max-width: 650px)').matches
    ? 'translateY(24px)'
    : 'translateX(-18px)';
  animation = dialog.animate(
    [initial, { opacity: 0, transform: destination }],
    { duration: 150, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' },
  );
  void animation.finished
    .then(() => {
      if (generation === motionGeneration && closing) finishClose(true);
    })
    .catch(() => {
      /* A new open/instant handoff canceled this animation. */
    });
}

export function initHomeExperienceDialog() {
  const element = document.querySelector<HTMLDialogElement>(
    '#home-experience-dialog',
  );
  if (!element || element.dataset.homeDialogReady === 'true') return;
  dialog = element;
  element.dataset.homeDialogReady = 'true';

  const open = (trigger: HTMLElement) => {
    if (!dialog || typeof dialog.showModal !== 'function') return;
    if (dialog.open) return;
    cancelMotion();
    closing = false;
    opener = trigger;
    dialog.showModal();
    lockPageScroll();
    const panel = dialog.querySelector<HTMLElement>('.home-experience-panel');
    if (panel) panel.scrollTop = 0;
    dialog
      .querySelector<HTMLButtonElement>('[data-home-close]')
      ?.focus({ preventScroll: true });
    if (
      matchMedia('(prefers-reduced-motion: reduce)').matches ||
      typeof dialog.animate !== 'function'
    )
      return;
    const origin = matchMedia('(max-width: 650px)').matches
      ? 'translateY(28px)'
      : 'translateX(-22px)';
    animation = dialog.animate(
      [
        { opacity: 0.3, transform: origin },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 210, easing: 'cubic-bezier(.2,.7,.2,1)' },
    );
    const generation = motionGeneration;
    void animation.finished
      .then(() => {
        if (generation === motionGeneration) animation = null;
      })
      .catch(() => {
        /* Closing replaced the entrance animation. */
      });
  };

  document.addEventListener('click', (event) => {
    const trigger =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-home-open]')
        : null;
    if (
      !trigger ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    open(trigger);
  });
  element
    .querySelector('[data-home-close]')
    ?.addEventListener('click', () => closeHomeExperience());
  element.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeHomeExperience();
  });

  // Dismiss only when BOTH ends of a primary pointer gesture are on the
  // backdrop. Dragging a slider or selecting content out of bounds stays safe.
  let backdropPointer: number | null = null;
  const outside = (event: PointerEvent) => {
    const rect = element.getBoundingClientRect();
    return (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    );
  };
  element.addEventListener('pointerdown', (event) => {
    backdropPointer =
      event.button === 0 && event.target === element && outside(event)
        ? event.pointerId
        : null;
  });
  element.addEventListener('pointerup', (event) => {
    const dismiss =
      backdropPointer === event.pointerId &&
      event.target === element &&
      outside(event);
    backdropPointer = null;
    if (dismiss) closeHomeExperience();
  });
  element.addEventListener('pointercancel', () => {
    backdropPointer = null;
  });
  element.addEventListener('close', () => {
    if (element.open) return; // A queued close event from an earlier open cycle.
    cancelMotion();
    closing = false;
    unlockPageScroll();
    // Handle an external native close as well. Explicit close paths clear this.
    const target = opener;
    opener = null;
    if (target?.isConnected) target.focus({ preventScroll: true });
  });
}
