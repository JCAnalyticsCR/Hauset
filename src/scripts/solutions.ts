import {
  lightingSummary,
  lightPresets,
  networkAssessment,
  roomLabels,
  securityViews,
  type Access,
  type NetworkLayout,
  type NetworkZone,
  type Obstacle,
  type Room,
} from './solutions-model';
import { detectGraphicsTier, prefersReducedMotion } from './graphics-tier';
import type { PlanReason, PlanScene, PlanView } from './plan-3d';

const visibility = (element: Element | null, visible: boolean) => {
  if (visible) element?.removeAttribute('data-lab-hidden');
  else element?.setAttribute('data-lab-hidden', 'true');
};

export function initSolutions() {
  const root = document.querySelector<HTMLElement>('[data-solutions-lab]');
  if (!root || root.dataset.labReady) return;
  root.dataset.labReady = 'true';
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-lab-tab]')];
  const panels = [...root.querySelectorAll<HTMLElement>('[data-lab-panel]')];
  const floatingConsult = document.querySelector<HTMLElement>('.consult-fab');
  root.querySelector('.solutions-panels')?.classList.add('tabs-ready');
  const selectTab = (tab: HTMLButtonElement, user = false) => {
    tabs.forEach((item) => {
      item.setAttribute('aria-selected', String(item === tab));
      item.tabIndex = item === tab ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.labPanel !== tab.dataset.labTab;
      if (!panel.hidden && user && floatingConsult)
        floatingConsult.dataset.quoteNeed = panel.dataset.solutionNeed;
    });
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab, true));
    tab.addEventListener('keydown', (event) => {
      const destinations: Record<string, number> = {
        ArrowRight: (index + 1) % tabs.length,
        ArrowLeft: (index - 1 + tabs.length) % tabs.length,
        Home: 0,
        End: tabs.length - 1,
      };
      if (!(event.key in destinations)) return;
      event.preventDefault();
      const destination = tabs[destinations[event.key]];
      selectTab(destination, true);
      destination.focus();
    });
  });
  if (tabs[0]) selectTab(tabs[0]);

  const lights = new Set<Room>(lightPresets.descansar);
  let lightScene = 'descansar';
  const sceneLabels: Record<string, string> = {
    llegar: 'Llegar',
    descansar: 'Descansar',
    salir: 'Salir',
    personalizada: 'Personalizada',
  };
  let access: Access = 'entrada';
  let scenario: 'casa' | 'fuera' = 'casa';
  let showBlind = false;
  let layout: NetworkLayout = 'router';
  let zone: NetworkZone = 'dormitorio';
  let obstacle: Obstacle = 'abierto';

  const lab = (mode: string) =>
    root.querySelector<HTMLElement>(`[data-lab-mode="${mode}"]`);
  const result = (mode: string, title: string, text: string) => {
    const element = lab(mode);
    const heading = element?.querySelector('[data-lab-result-title]');
    const description = element?.querySelector('[data-lab-result-text]');
    if (heading) heading.textContent = title;
    if (description) description.textContent = text;
  };
  const pressed = (mode: string, attribute: string, value: string) => {
    lab(mode)
      ?.querySelectorAll<HTMLButtonElement>(`[${attribute}]`)
      .forEach((button) => {
        button.setAttribute(
          'aria-pressed',
          String(button.getAttribute(attribute) === value),
        );
      });
  };
  // Optional Three.js floor plan for the automation explorer. It loads when
  // the plan scrolls into view on a capable device; the SVG remains the fallback.
  const planLab = lab('automatizacion');
  const planMount =
    planLab?.querySelector<HTMLElement>('[data-plan-3d]') ?? null;
  const planHost = planMount?.closest<HTMLElement>('.lab-plan') ?? null;
  const planToggle =
    planLab?.querySelector<HTMLButtonElement>('[data-view-toggle]') ?? null;
  const planNote = planLab?.querySelector<HTMLElement>('[data-view-note]');
  let plan: PlanView | null = null;
  let planLoading: Promise<PlanView | null> | null = null;
  let planUnavailable = false;
  let planPrefers2D = false;
  let planVisible = false;
  const planScene = (): PlanScene =>
    lightScene === 'llegar' ||
    lightScene === 'descansar' ||
    lightScene === 'salir'
      ? lightScene
      : 'personalizada';
  const planState = () => ({ lights: new Set(lights), scene: planScene() });
  const planMode = () => planHost?.dataset.view ?? '2d';
  const setPlanMode = (mode: '3d' | '2d') => {
    if (planHost) planHost.dataset.view = mode;
    if (planMount) planMount.hidden = mode !== '3d';
    if (planToggle) {
      planToggle.dataset.mode = mode;
      planToggle.textContent = mode === '3d' ? 'Vista ligera' : 'Vista 3D';
    }
    if (mode === '3d') {
      plan?.apply(planState(), 'init');
      plan?.setVisible(planVisible);
    } else plan?.setVisible(false);
  };
  const dropPlan = (message: string) => {
    planUnavailable = true;
    plan?.dispose();
    plan = null;
    setPlanMode('2d');
    if (planToggle) planToggle.hidden = true;
    if (planNote) planNote.textContent = message;
  };
  const loadPlan = (): Promise<PlanView | null> => {
    if (!planMount || planUnavailable) return Promise.resolve(null);
    if (plan) return Promise.resolve(plan);
    planLoading ??= (async () => {
      const tier = detectGraphicsTier();
      if (tier === 'none') {
        planUnavailable = true;
        return null;
      }
      try {
        const { createPlanView } = await import('./plan-3d');
        const lightButtons: Partial<Record<Room, HTMLElement>> = {};
        planLab
          ?.querySelectorAll<HTMLElement>('[data-light-zone]')
          .forEach((button) => {
            const key = button.dataset.lightZone as Room;
            if (key in roomLabels) lightButtons[key] = button;
          });
        plan = createPlanView(planMount, {
          tier,
          reducedMotion: prefersReducedMotion(),
          lightButtons,
          onTapRoom: (room) => lightButtons[room]?.click(),
          onDegrade: () =>
            dropPlan(
              'Activamos la vista ligera del plano para que vaya fluido en este dispositivo.',
            ),
        });
        if (planToggle) planToggle.hidden = false;
        return plan;
      } catch {
        planUnavailable = true;
        return null;
      }
    })();
    return planLoading;
  };
  const showPlan = async () => {
    const ready = await loadPlan();
    if (!ready || planPrefers2D) return;
    if (planMode() !== '3d') setPlanMode('3d');
    ready.setVisible(planVisible);
    return ready;
  };
  // Observe the always-visible plan box: the hidden mount has no layout box.
  if (planHost && 'IntersectionObserver' in window) {
    let ratio = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        planVisible = entry.isIntersecting;
        ratio = entry.intersectionRatio;
        if (!planVisible) {
          plan?.setVisible(false);
          return;
        }
        void showPlan().then((ready) => {
          if (ready && planVisible && ratio >= 0.35) ready.enter();
        });
      },
      { threshold: [0, 0.35], rootMargin: '160px 0px' },
    );
    observer.observe(planHost);
  }

  const changed = (mode: string) => {
    const element = lab(mode);
    const status = element?.querySelector('[data-lab-added]');
    if (status)
      status.textContent = element?.dataset.added
        ? 'Ajustaste el ejemplo. Sumalo de nuevo para actualizar tu consulta.'
        : '';
    element?.querySelector('[data-lab-add]')?.classList.remove('is-added');
    const panel = element?.closest<HTMLElement>('[data-solution-need]');
    if (floatingConsult && panel)
      floatingConsult.dataset.quoteNeed = panel.dataset.solutionNeed;
  };
  const updateLights = (reason: PlanReason = 'toggle') => {
    const element = lab('automatizacion');
    element
      ?.querySelectorAll<HTMLButtonElement>('[data-light-zone]')
      .forEach((button) => {
        const key = button.dataset.lightZone as Room;
        const on = lights.has(key);
        button.setAttribute('aria-pressed', String(on));
        button.setAttribute(
          'title',
          `${roomLabels[key]}: ${on ? 'encendida' : 'apagada'}`,
        );
        element
          ?.querySelector(`[data-lab-room="${key}"]`)
          ?.classList.toggle('is-on', on);
      });
    pressed('automatizacion', 'data-light-preset', lightScene);
    const summary = lightingSummary(lights);
    result('automatizacion', summary.title, summary.text);
    if (plan && planMode() === '3d') plan.apply(planState(), reason);
  };
  const updateSecurity = () => {
    const element = lab('seguridad');
    const view = securityViews[access];
    element
      ?.querySelector('[data-security-cone]')
      ?.setAttribute('d', view.cone);
    element
      ?.querySelector('[data-security-camera]')
      ?.setAttribute('transform', view.camera);
    element
      ?.querySelector('[data-security-blind]')
      ?.setAttribute('d', view.blind);
    visibility(
      element?.querySelector('[data-security-blind]') ?? null,
      showBlind,
    );
    visibility(
      element?.querySelector('[data-security-route]') ?? null,
      scenario === 'fuera',
    );
    if (element) element.dataset.securityScenario = scenario;
    pressed('seguridad', 'data-security-access', access);
    pressed('seguridad', 'data-security-scenario', scenario);
    result(
      'seguridad',
      `${view.label}: ${scenario === 'casa' ? 'estás en casa' : 'saliste por un rato'}.`,
      `${scenario === 'casa' ? 'El ejemplo prioriza la vista hacia el acceso exterior, cuidando los espacios de uso privado.' : 'El recorrido punteado sugiere otros accesos que convendría revisar al pensar en alertas.'}${showBlind ? ' La trama marca una posible zona oculta que este ángulo no resuelve.' : ' El ángulo es ilustrativo y cambia al elegir otro acceso.'}`,
    );
    const legend = element?.querySelector('[data-lab-legend]');
    if (legend)
      legend.textContent = showBlind
        ? 'Ángulo + posible zona ciega'
        : 'Ángulo de ejemplo';
  };
  const updateNetwork = () => {
    const element = lab('redes');
    const distributed = layout === 'distribuida';
    const radius =
      obstacle === 'abierto' ? 180 : obstacle === 'muros' ? 127 : 91;
    element?.querySelectorAll('[data-network-wave]').forEach((wave) => {
      const index = Number(wave.getAttribute('data-network-wave'));
      visibility(wave, index === 0 || distributed);
      wave.setAttribute(
        'r',
        String(distributed ? Math.round(radius * 0.74) : radius),
      );
    });
    element
      ?.querySelectorAll('[data-network-node]')
      .forEach((node) =>
        visibility(
          node,
          node.getAttribute('data-network-node') === '0' || distributed,
        ),
      );
    visibility(
      element?.querySelector('[data-network-cable]') ?? null,
      distributed,
    );
    visibility(
      element?.querySelector('[data-network-obstacle]') ?? null,
      obstacle === 'muros',
    );
    visibility(
      element?.querySelector('[data-network-floor]') ?? null,
      obstacle === 'plantas',
    );
    const position = {
      sala: 'translate(160 112)',
      dormitorio: 'translate(374 112)',
      terraza: 'translate(260 321)',
    }[zone];
    element
      ?.querySelector('[data-network-selected]')
      ?.setAttribute('transform', position);
    pressed('redes', 'data-network-layout', layout);
    const assessment = networkAssessment(layout, zone, obstacle);
    result('redes', assessment.title, assessment.text);
    const legend = element?.querySelector('[data-lab-legend]');
    if (legend)
      legend.textContent = `Zona elegida: ${{ sala: 'sala', dormitorio: 'dormitorio', terraza: 'terraza' }[zone]}`;
  };

  root.addEventListener('click', (event) => {
    const button =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('button')
        : null;
    if (!button) return;
    if (button.dataset.lightZone && button.dataset.lightZone in roomLabels) {
      const key = button.dataset.lightZone as Room;
      if (lights.has(key)) lights.delete(key);
      else lights.add(key);
      lightScene = 'personalizada';
      updateLights();
      changed('automatizacion');
    }
    if (
      button.dataset.lightPreset &&
      button.dataset.lightPreset in lightPresets
    ) {
      lightScene = button.dataset.lightPreset;
      lights.clear();
      lightPresets[lightScene].forEach((key) => lights.add(key));
      updateLights('scene');
      changed('automatizacion');
    }
    if (button.hasAttribute('data-view-toggle') && button === planToggle) {
      planPrefers2D = planMode() === '3d';
      if (planNote) planNote.textContent = '';
      if (planPrefers2D) setPlanMode('2d');
      else void showPlan();
    }
    if (
      button.dataset.securityAccess &&
      button.dataset.securityAccess in securityViews
    ) {
      access = button.dataset.securityAccess as Access;
      updateSecurity();
      changed('seguridad');
    }
    if (
      button.dataset.securityScenario === 'casa' ||
      button.dataset.securityScenario === 'fuera'
    ) {
      scenario = button.dataset.securityScenario;
      updateSecurity();
      changed('seguridad');
    }
    if (
      button.dataset.networkLayout === 'router' ||
      button.dataset.networkLayout === 'distribuida'
    ) {
      layout = button.dataset.networkLayout;
      updateNetwork();
      changed('redes');
    }
    if (button.hasAttribute('data-lab-add')) {
      const panel = button.closest<HTMLElement>('[data-lab-panel]');
      const mode = panel?.dataset.labPanel;
      const need = panel?.dataset.solutionNeed;
      if (!mode || !need) return;
      const items =
        mode === 'automatizacion'
          ? [
              lightingSummary(lights).item,
              `Escena de referencia: ${sceneLabels[lightScene]}`,
            ]
          : mode === 'seguridad'
            ? [
                `Acceso a revisar: ${securityViews[access].label}`,
                `Rutina: ${scenario === 'casa' ? 'En casa' : 'Fuera de casa'}`,
                ...(showBlind ? ['Revisar posibles zonas ciegas'] : []),
              ]
            : [
                `Diseño de referencia: ${layout === 'router' ? 'Router central' : 'Puntos de acceso distribuidos'}`,
                `Zona de uso: ${{ sala: 'Sala', dormitorio: 'Dormitorio', terraza: 'Terraza' }[zone]}`,
                `Espacio: ${{ abierto: 'Ambientes abiertos', muros: 'Muros entre ambientes', plantas: 'Otra planta' }[obstacle]}`,
              ];
      window.dispatchEvent(
        new CustomEvent('hauset:project-add', {
          detail: { need, source: 'explorador', items },
        }),
      );
      const element = lab(mode);
      const status = element?.querySelector('[data-lab-added]');
      if (status)
        status.textContent = element?.dataset.added
          ? 'Configuración actualizada en tu consulta.'
          : 'Listo. Sumamos estas preferencias a tu consulta.';
      if (element) element.dataset.added = 'true';
      button.classList.add('is-added');
    }
  });
  root.addEventListener('change', (event) => {
    const target = event.target;
    if (
      target instanceof HTMLInputElement &&
      target.hasAttribute('data-security-blind-toggle')
    ) {
      showBlind = target.checked;
      updateSecurity();
      changed('seguridad');
    }
    if (
      target instanceof HTMLSelectElement &&
      target.hasAttribute('data-network-zone') &&
      ['sala', 'dormitorio', 'terraza'].includes(target.value)
    ) {
      zone = target.value as NetworkZone;
      updateNetwork();
      changed('redes');
    }
    if (
      target instanceof HTMLSelectElement &&
      target.hasAttribute('data-network-obstacle') &&
      ['abierto', 'muros', 'plantas'].includes(target.value)
    ) {
      obstacle = target.value as Obstacle;
      updateNetwork();
      changed('redes');
    }
  });
  updateLights('init');
  updateSecurity();
  updateNetwork();
}
