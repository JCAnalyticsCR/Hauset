export const NEEDS = Object.freeze([
  'Automatización e iluminación',
  'Seguridad y cámaras',
  'Redes y cobertura WiFi',
  'Asesoría para empezar',
]);
export const TIMINGS = Object.freeze([
  'Quiero avanzar pronto',
  'En los próximos meses',
  'Estoy explorando opciones',
]);
export const MAX_ITEMS = 10;
export const MAX_MESSAGE_CHARS = 2200;
export const MAX_WHATSAPP_URL_CHARS = 6500;

const properties = ['Mi casa', 'Mi negocio'];
const contexts = ['Espacio existente', 'En construcción o remodelación'];
const sources = ['explorador', 'casa'];
const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, max) => {
  if (typeof value !== 'string') return '';
  const limited = value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .slice(0, max)
    .trim();
  // Encoding must also be safe if a character limit splits a surrogate pair.
  return new TextDecoder().decode(new TextEncoder().encode(limited));
};
const category = (value, values) => (values.includes(value) ? value : '');
const numeric = (value, max, integer = false) => {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(value.trim()))
    return '';
  const number = Number(value);
  return number > 0 && number <= max && (!integer || Number.isInteger(number))
    ? String(number)
    : '';
};
const itemKey = (item) => `${item.need}|${item.label.toLocaleLowerCase('es')}`;

export function createEmptyQuote() {
  return {
    property: '',
    context: '',
    area: '',
    floors: '',
    needs: [],
    items: [],
    location: '',
    timing: '',
    message: '',
  };
}

export function sanitizeQuoteState(raw) {
  const state = createEmptyQuote();
  if (!isObject(raw)) return state;
  state.property = category(raw.property, properties);
  state.context = category(raw.context, contexts);
  state.area = numeric(raw.area, 100000);
  state.floors = numeric(raw.floors, 100, true);
  state.needs = Array.isArray(raw.needs)
    ? [...new Set(raw.needs.filter((need) => NEEDS.includes(need)))]
    : [];
  state.location = text(raw.location, 80).replace(/[\r\n]/g, ' ');
  state.timing = category(raw.timing, TIMINGS);
  state.message = text(raw.message, 500);
  const seen = new Set();
  if (Array.isArray(raw.items))
    for (const candidate of raw.items) {
      if (
        !isObject(candidate) ||
        !state.needs.includes(candidate.need) ||
        !sources.includes(candidate.source)
      )
        continue;
      const label = text(candidate.label, 70).replace(/\s+/g, ' ');
      if (!label) continue;
      const item = { label, need: candidate.need, source: candidate.source };
      const key = itemKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      state.items.push(item);
      if (state.items.length === MAX_ITEMS) break;
    }
  return state;
}

export function validateProjectAddition(raw) {
  if (
    !isObject(raw) ||
    !NEEDS.includes(raw.need) ||
    !sources.includes(raw.source) ||
    !Array.isArray(raw.items)
  )
    return null;
  const labels = raw.items.filter(
    (item) =>
      typeof item === 'string' &&
      item.trim() &&
      item.length <= 70 &&
      !/[\r\n\u0000-\u001f\u007f]/.test(item),
  );
  const seen = new Set();
  const items = [];
  for (const label of labels) {
    const normalized = label.trim().replace(/\s+/g, ' ');
    const key = normalized.toLocaleLowerCase('es');
    if (!seen.has(key)) {
      seen.add(key);
      items.push(normalized);
    }
    if (items.length === MAX_ITEMS) break;
  }
  return { need: raw.need, source: raw.source, items };
}

export function mergeProjectAddition(rawState, rawAddition) {
  const state = sanitizeQuoteState(rawState);
  const addition = validateProjectAddition(rawAddition);
  if (!addition) return { state, added: 0, limited: false, valid: false };
  if (!state.needs.includes(addition.need)) state.needs.push(addition.need);
  const previousKeys = new Set(state.items.map(itemKey));
  // A changed explorer/house configuration replaces its earlier contribution.
  state.items = state.items.filter(
    (item) => item.need !== addition.need || item.source !== addition.source,
  );
  const known = new Set(state.items.map(itemKey));
  let added = 0;
  let limited = false;
  for (const label of addition.items) {
    const item = { label, need: addition.need, source: addition.source };
    if (known.has(itemKey(item))) continue;
    if (state.items.length >= MAX_ITEMS) {
      limited = true;
      continue;
    }
    state.items.push(item);
    known.add(itemKey(item));
    if (!previousKeys.has(itemKey(item))) added++;
  }
  return { state, added, limited, valid: true };
}

export function getQuoteRecommendations(rawState) {
  const state = sanitizeQuoteState(rawState);
  const recommendations = [];
  if (state.context === 'En construcción o remodelación')
    recommendations.push(
      'Compartí planos o la etapa de obra cuando conversemos: ayuda a coordinar canalizaciones y puntos de instalación.',
    );
  if (state.needs.includes(NEEDS[0]))
    recommendations.push(
      state.context === 'Espacio existente'
        ? 'Empezá por una rutina y contanos qué iluminación ya existe; revisaremos compatibilidad y condiciones de instalación.'
        : 'Elegí una rutina concreta —llegar, descansar o salir— para definir qué controles te resultarían útiles.',
    );
  if (state.needs.includes(NEEDS[1]))
    recommendations.push(
      'Pensá qué accesos o situaciones querés supervisar. La ubicación y el alcance de la protección se definen después de evaluar el espacio.',
    );
  if (state.needs.includes(NEEDS[2]))
    recommendations.push(
      state.property === 'Mi negocio'
        ? 'Comentanos dónde trabaja el equipo y dónde se conectan visitantes; evaluaremos las prioridades de la red por separado.'
        : 'Identificá dónde se corta la conexión y qué hacés ahí. La cobertura requiere revisar distribución, materiales y red actual.',
    );
  if (!recommendations.length || state.needs.includes(NEEDS[3]))
    recommendations.push(
      'No hace falta elegir equipos. Contanos el problema que más te importa y podremos ordenar las opciones con vos.',
    );
  return recommendations.slice(0, 3);
}

export function buildQuoteBrief(rawState) {
  const state = sanitizeQuoteState(rawState);
  const lines = [
    'Hola HAUSET, quiero conversar sobre una solución para mi espacio.',
    'Origen: sitio web HAUSET',
    '',
    `Espacio: ${state.property || 'Por definir'}`,
    `Me interesa: ${state.needs.join(', ') || 'Asesoría para empezar'}`,
  ];
  if (state.context) lines.push(`Situación: ${state.context}`);
  if (state.area) lines.push(`Área aproximada: ${state.area} m²`);
  if (state.floors) lines.push(`Pisos: ${state.floors}`);
  if (state.items.length)
    lines.push(
      '',
      'Ideas que quiero revisar:',
      ...state.items.map((item) => `• ${item.label} (${item.need})`),
    );
  if (state.location) lines.push('', `Ubicación: ${state.location}`);
  if (state.timing) lines.push(`Cuándo me gustaría empezar: ${state.timing}`);
  if (state.message) lines.push('', state.message);
  return lines.join('\n');
}

export function buildWhatsAppHandoff(
  rawState,
  base = 'https://wa.me/50660902549',
) {
  const message = buildQuoteBrief(rawState);
  const url = `${base}?text=${encodeURIComponent(message)}`;
  return {
    message,
    url,
    ready:
      message.length <= MAX_MESSAGE_CHARS &&
      url.length <= MAX_WHATSAPP_URL_CHARS,
  };
}

// Saving is explicit and intentionally excludes written fields and item labels.
export function serializeQuoteDraft(rawState) {
  const state = sanitizeQuoteState(rawState);
  return JSON.stringify({
    version: 1,
    property: state.property,
    context: state.context,
    area: state.area,
    floors: state.floors,
    needs: state.needs,
    timing: state.timing,
  });
}

export function parseQuoteDraft(raw) {
  if (typeof raw !== 'string' || raw.length > 3000) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!isObject(parsed) || parsed.version !== 1) return null;
    // Whitelist rather than accepting fields from local storage as form data.
    return sanitizeQuoteState({
      property: parsed.property,
      context: parsed.context,
      area: parsed.area,
      floors: parsed.floors,
      needs: parsed.needs,
      timing: parsed.timing,
    });
  } catch {
    return null;
  }
}
