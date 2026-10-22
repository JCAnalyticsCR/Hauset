import {
  NEEDS,
  MAX_ITEMS,
  MAX_MESSAGE_CHARS,
  createEmptyQuote,
  sanitizeQuoteState,
  mergeProjectAddition,
  getQuoteRecommendations,
  buildWhatsAppHandoff,
  serializeQuoteDraft,
  parseQuoteDraft,
} from './quote-model.mjs';
import type { QuoteState } from './quote-model.mjs';

const DRAFT_KEY = 'hauset:quote-draft:v1';

export function initQuoteWizard(closeMenu?: () => void) {
  const wizard = document.querySelector<HTMLElement>('#quote-wizard');
  if (!wizard || wizard.dataset.quoteReady === 'true') return;
  wizard.dataset.quoteReady = 'true';
  const query = <T extends Element>(selector: string) =>
    wizard.querySelector<T>(selector);
  const all = <T extends Element>(selector: string) => [
    ...wizard.querySelectorAll<T>(selector),
  ];
  const steps = all<HTMLElement>('.wizard-step');
  const properties = all<HTMLButtonElement>('[data-property]');
  const needsButtons = all<HTMLButtonElement>('[data-need]');
  const progressButtons = all<HTMLButtonElement>('[data-quote-step]');
  const nextButtons = all<HTMLButtonElement>('[data-quote-next]');
  const preview = query<HTMLElement>('#brief-preview');
  const previewDetails = query<HTMLDetailsElement>('#quote-preview-details');
  const summary = query<HTMLElement>('#wizard-summary');
  const feedback = query<HTMLElement>('#quote-feedback');
  const whatsappLink = query<HTMLAnchorElement>('#wizard-whatsapp');
  const spaceDetails = query<HTMLDetailsElement>('#quote-space-details');
  const context = query<HTMLSelectElement>('#project-context');
  const area = query<HTMLInputElement>('#project-area');
  const floors = query<HTMLInputElement>('#project-floors');
  const location = query<HTMLInputElement>('#project-location');
  const timing = query<HTMLSelectElement>('#project-timing');
  const message = query<HTMLTextAreaElement>('#project-message');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let state: QuoteState = createEmptyQuote();
  let currentStep = 0;
  let started = false;
  let summaryKey = '';
  let itemRenderKey = '';
  let guidanceKey = '';
  let handoff = buildWhatsAppHandoff(state);

  const announce = (text: string) => {
    if (feedback) feedback.textContent = text;
  };
  const conversion = (
    event: 'quote_start' | 'quote_step' | 'quote_review' | 'whatsapp_click',
  ) => {
    // Fixed categories only. No written fields, item labels, collector or network.
    window.dispatchEvent(
      new CustomEvent('hauset:conversion', {
        detail: {
          event,
          step: currentStep + 1,
          property: state.property || 'not_selected',
          services: [...state.needs],
        },
      }),
    );
  };
  const start = () => {
    if (!started) {
      started = true;
      conversion('quote_start');
    }
  };
  const readFields = () => {
    state.context = context?.value || '';
    // Native number inputs also accept forms like 1e2. Keep the visible value
    // meaningful in the brief by normalizing any finite value before modeling.
    state.area =
      area?.value && Number.isFinite(area.valueAsNumber)
        ? String(area.valueAsNumber)
        : area?.value || '';
    state.floors =
      floors?.value && Number.isFinite(floors.valueAsNumber)
        ? String(floors.valueAsNumber)
        : floors?.value || '';
    state.location = location?.value || '';
    state.timing = timing?.value || '';
    state.message = message?.value || '';
  };
  const writeFields = () => {
    if (context) context.value = state.context;
    if (area) area.value = state.area;
    if (floors) floors.value = state.floors;
    if (location) location.value = state.location;
    if (timing) timing.value = state.timing;
    if (message) message.value = state.message;
  };
  const render = () => {
    properties.forEach((button) =>
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.property === state.property),
      ),
    );
    needsButtons.forEach((button) =>
      button.setAttribute(
        'aria-pressed',
        String(state.needs.includes(button.dataset.need || '')),
      ),
    );
    nextButtons.forEach((button) => {
      button.disabled =
        !state.property ||
        (button.dataset.quoteNext === '2' && !state.needs.length);
    });
    progressButtons.forEach((button, index) => {
      button.disabled =
        index > 0 && (!state.property || (index === 2 && !state.needs.length));
      if (index === currentStep) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    const count = query<HTMLElement>('#wizard-count');
    if (count) count.textContent = `0${currentStep + 1} / 03`;
    handoff = buildWhatsAppHandoff(state, wizard.dataset.whatsapp);
    if (whatsappLink) {
      whatsappLink.href = handoff.ready
        ? handoff.url
        : wizard.dataset.whatsapp || 'https://wa.me/50660902549';
      whatsappLink.setAttribute('aria-disabled', String(!handoff.ready));
    }
    if (preview) preview.textContent = handoff.message;
    const messageCount = query<HTMLElement>('#quote-message-count');
    if (messageCount)
      messageCount.textContent = `${handoff.message.length} / ${MAX_MESSAGE_CHARS}`;
    const commentCount = query<HTMLElement>('#quote-comment-count');
    if (commentCount)
      commentCount.textContent = String(message?.value.length || 0);
    const lengthError = query<HTMLElement>('#quote-length-error');
    if (lengthError) lengthError.hidden = handoff.ready;

    const nextSummaryKey = JSON.stringify([state.property, state.needs]);
    if (summary && summaryKey !== nextSummaryKey) {
      summaryKey = nextSummaryKey;
      summary.replaceChildren(
        ...[state.property, ...state.needs]
          .filter(Boolean)
          .map((label, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.quoteEdit = index === 0 ? '0' : '1';
            button.textContent = label;
            button.setAttribute(
              'aria-label',
              `Cambiar ${index === 0 ? 'espacio' : 'prioridades'}: ${label}`,
            );
            return button;
          }),
      );
    }
    const clean = sanitizeQuoteState(state);
    const contextLine = query<HTMLElement>('#quote-context-line');
    if (contextLine)
      contextLine.textContent = [
        clean.context,
        clean.area ? `${clean.area} m² aproximados` : '',
        clean.floors
          ? `${clean.floors} ${clean.floors === '1' ? 'piso' : 'pisos'}`
          : '',
      ]
        .filter(Boolean)
        .join(' · ');
    const nextGuidanceKey = JSON.stringify([
      clean.property,
      clean.context,
      clean.needs,
    ]);
    if (guidanceKey !== nextGuidanceKey) {
      guidanceKey = nextGuidanceKey;
      query<HTMLUListElement>('#quote-recommendations')?.replaceChildren(
        ...getQuoteRecommendations(clean).map((text) => {
          const item = document.createElement('li');
          item.textContent = text;
          return item;
        }),
      );
    }
    const nextItemsKey = JSON.stringify(state.items);
    all<HTMLElement>('[data-quote-items-panel]').forEach((panel) => {
      panel.hidden = !state.items.length;
    });
    all<HTMLElement>('[data-quote-items-count]').forEach((element) => {
      element.textContent = String(state.items.length);
    });
    if (itemRenderKey !== nextItemsKey) {
      itemRenderKey = nextItemsKey;
      all<HTMLUListElement>('[data-quote-items]').forEach((list) =>
        list.replaceChildren(
          ...state.items.map((item, index) => {
            const row = document.createElement('li');
            const label = document.createElement('span');
            label.textContent = item.label;
            const service = document.createElement('small');
            service.textContent = item.need;
            label.append(service);
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.dataset.removeQuoteItem = String(index);
            remove.textContent = '×';
            remove.setAttribute('aria-label', `Quitar idea: ${item.label}`);
            row.append(label, remove);
            return row;
          }),
        ),
      );
    }
  };
  const validateSpace = () => {
    if (!state.property) {
      announce('Elegí casa o negocio para continuar.');
      return false;
    }
    const invalid = [area, floors].find(
      (input) => input && !input.checkValidity(),
    );
    [area, floors].forEach((input) => {
      if (input)
        input.setAttribute('aria-invalid', String(!input.validity.valid));
    });
    if (invalid) {
      if (spaceDetails) spaceDetails.open = true;
      announce(
        invalid === area
          ? 'Revisá el área: usá un valor entre 0,01 y 100 000 m², con hasta dos decimales, o dejala vacía.'
          : 'Revisá los pisos: usá un número entero entre 1 y 100, o dejalo vacío.',
      );
      return false;
    }
    return true;
  };
  const focusSpaceProblem = () => {
    if (!state.property) {
      properties[0]?.focus();
      return;
    }
    const invalid = [area, floors].find(
      (input) => input && !input.validity.valid,
    );
    invalid?.focus();
    invalid?.reportValidity();
  };
  const goToStep = (requested: number, focus = true) => {
    readFields();
    let step = Math.max(0, Math.min(2, requested));
    const invalidSpace = step > 0 && !validateSpace();
    if (invalidSpace) step = 0;
    else if (step === 2 && !state.needs.length) {
      step = 1;
      announce(
        'Elegí al menos una prioridad. Si no sabés por dónde empezar, podés pedir orientación.',
      );
    }
    currentStep = step;
    steps.forEach((element, index) => {
      element.hidden = index !== step;
    });
    render();
    if (focus && invalidSpace) focusSpaceProblem();
    else if (focus) {
      const heading =
        steps[step]?.querySelector<HTMLElement>('.wizard-question');
      heading?.focus({ preventScroll: true });
      const position = heading?.getBoundingClientRect();
      if (
        heading &&
        position &&
        (position.top < 95 || position.bottom > innerHeight)
      )
        heading.scrollIntoView({
          block: 'start',
          behavior: motion.matches ? 'instant' : 'smooth',
        });
    }
    conversion('quote_step');
    if (step === 2) conversion('quote_review');
  };
  const openWizard = (need?: string) => {
    readFields();
    if (need && NEEDS.includes(need) && !state.needs.includes(need))
      state.needs.push(need);
    start();
    closeMenu?.();
    goToStep(state.property ? 1 : 0);
    wizard.scrollIntoView({
      block: 'start',
      behavior: motion.matches ? 'instant' : 'smooth',
    });
  };

  properties.forEach((button) =>
    button.addEventListener('click', () => {
      state.property = button.dataset.property || '';
      start();
      announce(
        'Espacio elegido. Podés añadir detalles o seguir con tus prioridades.',
      );
      render();
    }),
  );
  needsButtons.forEach((button) =>
    button.addEventListener('click', () => {
      const need = button.dataset.need || '';
      if (!NEEDS.includes(need)) return;
      start();
      if (state.needs.includes(need)) {
        state.needs = state.needs.filter((value) => value !== need);
        const removedItems = state.items.some((item) => item.need === need);
        state.items = state.items.filter((item) => item.need !== need);
        announce(
          removedItems
            ? 'Quitamos esta prioridad y sus ideas relacionadas de la ficha.'
            : 'Prioridad quitada.',
        );
      } else {
        state.needs.push(need);
        announce('Prioridad añadida. Podés combinarla con otras.');
      }
      render();
    }),
  );
  nextButtons.forEach((button) =>
    button.addEventListener('click', () => {
      announce('');
      goToStep(Number(button.dataset.quoteNext));
    }),
  );
  progressButtons.forEach((button) =>
    button.addEventListener('click', () =>
      goToStep(Number(button.dataset.quoteStep)),
    ),
  );
  all<HTMLButtonElement>('[data-quote-back]').forEach((button) =>
    button.addEventListener('click', () =>
      goToStep(Number(button.dataset.quoteBack)),
    ),
  );
  [context, area, floors, location, timing, message].forEach((input) =>
    input?.addEventListener(
      input.tagName === 'SELECT' ? 'change' : 'input',
      () => {
        readFields();
        if (input instanceof HTMLInputElement)
          input.removeAttribute('aria-invalid');
        render();
      },
    ),
  );
  summary?.addEventListener('click', (event) => {
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('[data-quote-edit]')
        : null;
    if (target) goToStep(Number(target.dataset.quoteEdit));
  });
  wizard.addEventListener('click', (event) => {
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('[data-remove-quote-item]')
        : null;
    if (!target) return;
    const index = Number(target.dataset.removeQuoteItem);
    if (!Number.isInteger(index) || index < 0 || index >= state.items.length)
      return;
    const list = target.closest<HTMLUListElement>('[data-quote-items]');
    const panel = target.closest<HTMLDetailsElement>(
      '[data-quote-items-panel]',
    );
    state.items.splice(index, 1);
    render();
    const remaining = list?.querySelectorAll<HTMLButtonElement>(
      '[data-remove-quote-item]',
    );
    if (remaining?.length)
      remaining[Math.min(index, remaining.length - 1)].focus();
    else
      steps[currentStep]
        ?.querySelector<HTMLElement>('.wizard-question')
        ?.focus({ preventScroll: true });
    if (panel && !state.items.length) panel.open = false;
    announce('Idea quitada de la ficha.');
  });
  document
    .querySelectorAll<HTMLAnchorElement>(
      '[data-quote-entry], [data-quote-need]',
    )
    .forEach((link) =>
      link.addEventListener('click', (event) => {
        if (
          event.button !== 0 ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        openWizard(link.dataset.quoteNeed);
      }),
    );
  window.addEventListener('hauset:project-add', (event) => {
    if (!(event instanceof CustomEvent)) return;
    readFields();
    const result = mergeProjectAddition(state, event.detail);
    if (!result.valid) return;
    state = {
      ...result.state,
      location: state.location,
      message: state.message,
      area: state.area,
      floors: state.floors,
    };
    writeFields();
    openWizard();
    announce(
      result.limited
        ? `Tu ficha admite hasta ${MAX_ITEMS} ideas. Quitá alguna si querés incorporar más.`
        : result.added
          ? 'Selección incorporada. Podés revisar o quitar las ideas en tu ficha.'
          : 'Selección actualizada. Conservamos el resto de tu consulta.',
    );
  });

  whatsappLink?.addEventListener('click', (event) => {
    readFields();
    render();
    if (!handoff.ready) {
      event.preventDefault();
      announce(
        'Acortá el comentario o quitá ideas para continuar por este enlace. Copiar y descargar conservan la ficha completa.',
      );
      return;
    }
    conversion('whatsapp_click');
    announce(
      'Revisá el mensaje en WhatsApp y envialo cuando esté listo. Tu ficha queda aquí.',
    );
  });
  query<HTMLButtonElement>('[data-quote-copy]')?.addEventListener(
    'click',
    async () => {
      readFields();
      render();
      try {
        if (!navigator.clipboard?.writeText)
          throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(handoff.message);
        announce('Mensaje copiado. Todavía no se envió.');
      } catch {
        if (previewDetails) previewDetails.open = true;
        let selected = false;
        if (preview) {
          preview.focus();
          const range = document.createRange();
          range.selectNodeContents(preview);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
          selected = Boolean(selection?.toString());
        }
        announce(
          selected
            ? 'La copia automática no estuvo disponible. El mensaje está seleccionado para que lo copies desde tu dispositivo.'
            : 'La copia automática no estuvo disponible. Abrimos el mensaje completo para que lo selecciones y copies desde tu dispositivo.',
        );
      }
    },
  );
  query<HTMLButtonElement>('[data-quote-download]')?.addEventListener(
    'click',
    () => {
      readFields();
      render();
      try {
        const url = URL.createObjectURL(
          new Blob([handoff.message], { type: 'text/plain;charset=utf-8' }),
        );
        const link = document.createElement('a');
        link.href = url;
        link.download = 'consulta-hauset.txt';
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        announce(
          'Se solicitó la descarga de tu ficha .txt. Podés compartirla cuando querás.',
        );
      } catch {
        announce(
          'No pudimos iniciar la descarga. Podés copiar el mensaje o seleccionarlo en la vista previa.',
        );
      }
    },
  );
  query<HTMLButtonElement>('[data-quote-save]')?.addEventListener(
    'click',
    () => {
      readFields();
      if (!state.property || !state.needs.length) {
        announce('Elegí un espacio y al menos una prioridad antes de guardar.');
        return;
      }
      if (!validateSpace()) {
        goToStep(0);
        focusSpaceProblem();
        return;
      }
      try {
        localStorage.setItem(DRAFT_KEY, serializeQuoteDraft(state));
        announce(
          'Servicios y espacio guardados en este navegador. La ubicación, el comentario y las ideas de las demos no se guardaron.',
        );
      } catch {
        announce(
          'Este navegador no permitió guardar. Podés copiar o descargar la ficha al terminar.',
        );
      }
    },
  );
  query<HTMLButtonElement>('[data-quote-restore]')?.addEventListener(
    'click',
    () => {
      try {
        const restored = parseQuoteDraft(localStorage.getItem(DRAFT_KEY));
        if (!restored) {
          announce(
            'No encontramos una selección compatible guardada en este navegador.',
          );
          return;
        }
        readFields();
        state = {
          ...restored,
          location: state.location,
          message: state.message,
          items: state.items.filter((item) =>
            restored.needs.includes(item.need),
          ),
        };
        writeFields();
        start();
        goToStep(state.property ? 1 : 0);
        announce(
          'Servicios y espacio restaurados. Podés revisarlos antes de seguir.',
        );
      } catch {
        announce(
          'Este navegador no permitió acceder a la selección guardada. Tu consulta actual sigue disponible.',
        );
      }
    },
  );
  query<HTMLButtonElement>('[data-quote-delete]')?.addEventListener(
    'click',
    () => {
      try {
        localStorage.removeItem(DRAFT_KEY);
        announce(
          'Selección guardada borrada. La ficha de esta visita sigue en pantalla.',
        );
      } catch {
        announce(
          'No pudimos acceder al almacenamiento. Podés borrarlo desde los ajustes del navegador.',
        );
      }
    },
  );
  render();
}
