import { closeHomeExperience } from './home-experience-dialog';
import { detectGraphicsTier, prefersReducedMotion } from './graphics-tier';
import type { ApplyReason, RoomState, RoomView } from './room-3d';

type SceneKey = 'welcome' | 'cinema' | 'away';
type Tone = 'warm' | 'neutral' | 'cool';
type HomeState = {
  light: number;
  curtains: number;
  armed: boolean;
  tone: Tone;
};

const LITE_NOTE =
  'Activamos la vista ligera para que la experiencia vaya fluida en este dispositivo.';

export function initHomeLab() {
  const host = document.querySelector<HTMLElement>('.home-lab');
  if (!host) return;
  const light = host.querySelector<HTMLInputElement>('#light-level')!;
  const curtain = host.querySelector<HTMLInputElement>('#curtain-level')!;
  const lightOutput = host.querySelector<HTMLOutputElement>('#light-output')!;
  const curtainOutput =
    host.querySelector<HTMLOutputElement>('#curtain-output')!;
  const lightPoint =
    host.querySelector<HTMLButtonElement>('[data-room-light]')!;
  const curtainPoint = host.querySelector<HTMLButtonElement>(
    '[data-room-curtains]',
  )!;
  const security = host.querySelector<HTMLButtonElement>('#home-security')!;
  const feedback = host.querySelector<HTMLElement>('#scene-feedback')!;
  const sceneTitle = host.querySelector<HTMLElement>('#scene-title')!;
  const buttons = [...host.querySelectorAll<HTMLButtonElement>('[data-scene]')];
  const toneButtons = [
    ...host.querySelectorAll<HTMLButtonElement>('[data-tone]'),
  ];
  const presets: Record<
    SceneKey,
    HomeState & { title: string; label: string }
  > = {
    welcome: {
      light: 80,
      curtains: 100,
      armed: false,
      tone: 'warm',
      title: 'Ya estás en casa.',
      label: 'Llegar',
    },
    cinema: {
      light: 18,
      curtains: 0,
      armed: false,
      tone: 'warm',
      title: 'Tu momento de cine.',
      label: 'Cine',
    },
    away: {
      light: 0,
      curtains: 0,
      armed: true,
      tone: 'neutral',
      title: 'Todo en su lugar.',
      label: 'Salir',
    },
  };
  const tones: Record<Tone, { color: string; label: string }> = {
    warm: { color: '#ffd18d', label: 'cálida' },
    neutral: { color: '#fff5df', label: 'neutra' },
    cool: { color: '#c2e3ff', label: 'fría' },
  };
  let state: HomeState = { ...presets.welcome };
  let scene: SceneKey = 'welcome';
  let custom = false;
  let lastLight = 80;
  let announceTimer: ReturnType<typeof setTimeout>;
  const clamp = (value: string) =>
    Math.max(0, Math.min(100, Number(value) || 0));
  const curtainLabel = () =>
    state.curtains === 100
      ? 'abiertas'
      : state.curtains === 0
        ? 'cerradas'
        : `${state.curtains}% abiertas`;
  const describe = () =>
    `Luz ${state.light}% · Cortinas ${curtainLabel()} · ${state.armed ? 'Alarma activada' : 'Modo hogar'}`;

  // Optional Three.js room. It loads only when the dialog opens on a capable
  // device; the SVG stays in place as the fallback and as the accessible name.
  const stage = host.querySelector<HTMLElement>('.room-stage');
  const mount = host.querySelector<HTMLElement>('[data-room-3d]');
  const viewToggle =
    host.querySelector<HTMLButtonElement>('[data-view-toggle]');
  const viewNote = host.querySelector<HTMLElement>('[data-view-note]');
  const dialog = host.closest<HTMLDialogElement>('dialog');
  let view: RoomView | null = null;
  let viewLoading: Promise<RoomView | null> | null = null;
  let viewUnavailable = false;
  let prefers2D = false;
  const snapshot = (): RoomState => ({ ...state, scene, custom });
  const viewMode = () => stage?.dataset.view ?? '2d';
  const setViewMode = (mode: '3d' | '2d') => {
    if (stage) stage.dataset.view = mode;
    if (mount) mount.hidden = mode !== '3d';
    if (viewToggle) {
      viewToggle.dataset.mode = mode;
      viewToggle.textContent = mode === '3d' ? 'Vista ligera' : 'Vista 3D';
    }
    if (mode === '3d') {
      view?.apply(snapshot(), 'init');
      view?.setVisible(true);
    } else view?.setVisible(false);
  };
  const dropView = (message: string) => {
    viewUnavailable = true;
    view?.dispose();
    view = null;
    setViewMode('2d');
    if (viewToggle) viewToggle.hidden = true;
    if (viewNote) viewNote.textContent = message;
  };
  const loadView = (): Promise<RoomView | null> => {
    if (!mount || !stage || viewUnavailable) return Promise.resolve(null);
    if (view) return Promise.resolve(view);
    viewLoading ??= (async () => {
      const tier = detectGraphicsTier();
      if (tier === 'none') {
        viewUnavailable = true;
        return null;
      }
      try {
        const { createRoomView } = await import('./room-3d');
        view = createRoomView(mount, {
          tier,
          reducedMotion: prefersReducedMotion(),
          hotspots: { light: lightPoint, curtains: curtainPoint },
          onTapLight: () => lightPoint.click(),
          onTapCurtains: () => curtainPoint.click(),
          onDegrade: () => dropView(LITE_NOTE),
        });
        if (viewToggle) viewToggle.hidden = false;
        return view;
      } catch {
        viewUnavailable = true;
        return null;
      }
    })();
    return viewLoading;
  };
  const showView = async () => {
    const ready = await loadView();
    if (!ready || prefers2D || (dialog && !dialog.open)) return;
    setViewMode('3d');
    ready.enter();
  };
  if (dialog) {
    new MutationObserver(() => {
      if (dialog.open) void showView();
      else view?.setVisible(false);
    }).observe(dialog, { attributes: true, attributeFilter: ['open'] });
    const prefetch = () => {
      if (!viewUnavailable && detectGraphicsTier() !== 'none')
        void import('./room-3d');
    };
    document
      .querySelectorAll<HTMLElement>('[data-home-open]')
      .forEach((trigger) => {
        trigger.addEventListener('pointerenter', prefetch, { once: true });
        trigger.addEventListener('focus', prefetch, { once: true });
      });
  } else void showView();
  viewToggle?.addEventListener('click', () => {
    prefers2D = viewMode() === '3d';
    if (viewNote) viewNote.textContent = '';
    if (prefers2D) setViewMode('2d');
    else void showView();
  });

  const render = (announce = true, reason: ApplyReason = 'custom') => {
    host.style.setProperty('--room-light', String(state.light / 100));
    host.style.setProperty('--curtain-offset', `${-state.curtains * 1.45}px`);
    host.style.setProperty('--lamp-color', tones[state.tone].color);
    host.dataset.armed = String(state.armed);
    host.dataset.light = String(state.light);
    host.dataset.custom = String(custom);
    host.dataset.scene = scene;
    light.value = String(state.light);
    curtain.value = String(state.curtains);
    lightOutput.value = `${state.light}%`;
    curtainOutput.value = `${state.curtains}%`;
    light.setAttribute('aria-valuetext', `${state.light} por ciento`);
    curtain.setAttribute(
      'aria-valuetext',
      `${state.curtains} por ciento abiertas`,
    );
    lightPoint.setAttribute(
      'title',
      `${state.light ? 'Apagar' : 'Encender'} la luz de la sala`,
    );
    lightPoint.setAttribute('aria-pressed', String(state.light > 0));
    curtainPoint.setAttribute(
      'title',
      `${state.curtains ? 'Cerrar' : 'Abrir'} las cortinas`,
    );
    curtainPoint.setAttribute('aria-pressed', String(state.curtains === 0));
    security.setAttribute('aria-checked', String(state.armed));
    host.querySelector('#security-state')!.textContent = state.armed
      ? 'Activada en la simulación'
      : 'Modo hogar';
    host.querySelector('#home-scene-summary')!.textContent = describe();
    host.querySelector('#room-description')!.textContent =
      `Sala ilustrada: ${describe()}. Luz ${tones[state.tone].label}.`;
    const customLabel = host.querySelector<HTMLElement>('.room-custom-label')!;
    customLabel.hidden = !custom;
    sceneTitle.textContent = custom ? 'A tu manera.' : presets[scene].title;
    buttons.forEach((button) => {
      const selected = !custom && button.dataset.scene === scene;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('active', selected);
    });
    toneButtons.forEach((button) =>
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.tone === state.tone),
      ),
    );
    if (view && viewMode() === '3d') view.apply(snapshot(), reason);
    if (announce) {
      const preview = document.querySelector('[data-home-preview]');
      if (preview)
        preview.textContent = `${custom ? 'Tu ambiente' : presets[scene].label} · Luz ${state.light}% · Seguí explorando`;
      clearTimeout(announceTimer);
      announceTimer = setTimeout(() => {
        feedback.textContent = `${custom ? 'Tu ambiente' : presets[scene].label}: ${describe()}.`;
      }, 180);
    }
  };
  const update = (patch: Partial<HomeState>) => {
    state = { ...state, ...patch };
    custom = true;
    render();
  };
  buttons.forEach((button) =>
    button.addEventListener('click', () => {
      const key = button.dataset.scene as SceneKey;
      if (!presets[key]) return;
      scene = key;
      state = { ...presets[key] };
      custom = false;
      if (state.light) lastLight = state.light;
      render(true, 'scene');
    }),
  );
  light.addEventListener('input', () => {
    const value = clamp(light.value);
    if (value) lastLight = value;
    update({ light: value });
  });
  curtain.addEventListener('input', () =>
    update({ curtains: clamp(curtain.value) }),
  );
  lightPoint.addEventListener('click', () => {
    if (state.light) lastLight = state.light;
    update({ light: state.light ? 0 : lastLight });
  });
  curtainPoint.addEventListener('click', () =>
    update({ curtains: state.curtains ? 0 : 100 }),
  );
  security.addEventListener('click', () => update({ armed: !state.armed }));
  toneButtons.forEach((button) =>
    button.addEventListener('click', () => {
      const tone = button.dataset.tone as Tone;
      if (tones[tone]) update({ tone });
    }),
  );
  host.querySelector('#home-add-project')?.addEventListener('click', () => {
    closeHomeExperience({ restoreFocus: false });
    window.dispatchEvent(
      new CustomEvent('hauset:project-add', {
        detail: {
          need: 'Automatización e iluminación',
          source: 'casa',
          items: [
            `Escena ${custom ? 'propia' : presets[scene].label}: luz ${tones[state.tone].label} ${state.light}%; cortinas abiertas ${state.curtains}%; alarma ${state.armed ? 'sí' : 'no'}.`,
          ],
        },
      }),
    );
  });
  const clock = host.querySelector<HTMLElement>('.console-time');
  const updateClock = () => {
    if (clock)
      clock.textContent = new Intl.DateTimeFormat('es-CR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'America/Costa_Rica',
      }).format(new Date());
  };
  updateClock();
  setInterval(updateClock, 60000);
  render(false, 'init');
}
