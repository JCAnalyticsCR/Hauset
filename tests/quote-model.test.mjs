import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NEEDS,
  MAX_ITEMS,
  createEmptyQuote,
  sanitizeQuoteState,
  validateProjectAddition,
  mergeProjectAddition,
  buildQuoteBrief,
  buildWhatsAppHandoff,
  getQuoteRecommendations,
  serializeQuoteDraft,
  parseQuoteDraft,
} from '../src/scripts/quote-model.mjs';

test('el modelo descarta valores ajenos y valida números opcionales', () => {
  const state = sanitizeQuoteState({
    property: 'Mi casa',
    context: 'Inventado',
    area: '-20',
    floors: '1.2',
    needs: [NEEDS[0], NEEDS[0], 'Otro'],
    location: 'Heredia\nCentro',
    email: 'privado@example.com',
  });
  assert.equal(state.property, 'Mi casa');
  assert.equal(state.context, '');
  assert.equal(state.area, '');
  assert.equal(state.floors, '');
  assert.deepEqual(state.needs, [NEEDS[0]]);
  assert.equal(state.location, 'Heredia Centro');
  assert.equal(state.email, undefined);
  assert.equal(
    sanitizeQuoteState({ area: '100.50', floors: '2' }).area,
    '100.5',
  );
});

test('incorporaciones externas validan origen/necesidad, deduplican y respetan capacidad', () => {
  assert.equal(
    validateProjectAddition({ need: 'Otro', source: 'casa', items: [] }),
    null,
  );
  assert.equal(
    validateProjectAddition({ need: NEEDS[0], source: 'sitio', items: [] }),
    null,
  );
  const addition = {
    need: NEEDS[0],
    source: 'casa',
    items: ['Luces de sala', ' luces de sala ', '\nInválido', 'x'.repeat(71)],
  };
  const first = mergeProjectAddition(createEmptyQuote(), addition);
  assert.equal(first.added, 1);
  assert.deepEqual(first.state.needs, [NEEDS[0]]);
  assert.equal(first.state.items[0].label, 'Luces de sala');
  assert.equal(mergeProjectAddition(first.state, addition).added, 0);
  const changed = mergeProjectAddition(first.state, {
    need: NEEDS[0],
    source: 'casa',
    items: ['Cortinas de sala'],
  });
  assert.deepEqual(
    changed.state.items.map((item) => item.label),
    ['Cortinas de sala'],
  );
  const separate = mergeProjectAddition(changed.state, {
    need: NEEDS[0],
    source: 'explorador',
    items: ['Entrada'],
  });
  assert.deepEqual(
    separate.state.items.map((item) => item.label),
    ['Cortinas de sala', 'Entrada'],
  );
  const filled = mergeProjectAddition(first.state, {
    need: NEEDS[1],
    source: 'explorador',
    items: Array.from({ length: MAX_ITEMS }, (_, i) => `Acceso ${i}`),
  });
  assert.equal(filled.state.items.length, MAX_ITEMS);
  assert.equal(filled.limited, true);
});

test('el mensaje es el texto exacto del enlace y mantiene el detalle de la ficha', () => {
  const state = {
    ...createEmptyQuote(),
    property: 'Mi negocio',
    context: 'Espacio existente',
    area: '120',
    floors: '2',
    needs: [NEEDS[2]],
    items: [
      { label: 'Oficina y recepción', need: NEEDS[2], source: 'explorador' },
    ],
    location: 'Alajuela',
    timing: 'Estoy explorando opciones',
    message: 'Se corta la conexión durante las llamadas.',
  };
  const handoff = buildWhatsAppHandoff(state);
  assert.equal(
    new URL(handoff.url).searchParams.get('text'),
    buildQuoteBrief(state),
  );
  assert.equal(handoff.ready, true);
  assert.match(handoff.message, /Área aproximada: 120 m²/);
  assert.match(handoff.message, /Oficina y recepción/);
  assert.match(handoff.message, /Alajuela/);
  assert.match(handoff.message, /Se corta la conexión/);
});

test('el límite de enlace se verifica sin truncar en silencio el mensaje', () => {
  const state = {
    ...createEmptyQuote(),
    property: 'Mi casa',
    needs: [...NEEDS],
    message: '😀'.repeat(250),
    location: '😀'.repeat(40),
    items: Array.from({ length: MAX_ITEMS }, (_, i) => ({
      label: `${i}${'😀'.repeat(34)}`,
      need: NEEDS[0],
      source: 'casa',
    })),
  };
  const handoff = buildWhatsAppHandoff(state);
  assert.equal(handoff.ready, false);
  assert.match(handoff.message, /😀/);
  assert.equal(new URL(handoff.url).searchParams.get('text'), handoff.message);
  assert.doesNotThrow(() =>
    buildWhatsAppHandoff({ message: `${'x'.repeat(499)}😀` }),
  );
});

test('el borrador local excluye ubicación, comentario y etiquetas de ideas', () => {
  const state = {
    ...createEmptyQuote(),
    property: 'Mi casa',
    needs: [NEEDS[0]],
    location: 'Dirección privada',
    message: 'Comentario privado',
    items: [{ label: 'Etiqueta privada', need: NEEDS[0], source: 'casa' }],
  };
  const serialized = serializeQuoteDraft(state);
  assert.doesNotMatch(serialized, /privad/);
  const restored = parseQuoteDraft(serialized);
  assert.equal(restored.property, 'Mi casa');
  assert.deepEqual(restored.needs, [NEEDS[0]]);
  assert.equal(restored.location, '');
  assert.deepEqual(restored.items, []);
  assert.equal(parseQuoteDraft('{"version":9}'), null);
  assert.equal(parseQuoteDraft('{'), null);
  assert.equal(
    parseQuoteDraft('{"version":1,"message":"Inyectado"}').message,
    '',
  );
});

test('orientaciones cualitativas cambian según necesidad/contexto sin presupuestar', () => {
  const recommendations = getQuoteRecommendations({
    property: 'Mi negocio',
    context: 'En construcción o remodelación',
    needs: [NEEDS[2]],
  });
  assert.ok(recommendations.length > 0 && recommendations.length <= 3);
  assert.match(recommendations.join(' '), /planos/);
  assert.match(recommendations.join(' '), /visitantes/);
  assert.doesNotMatch(recommendations.join(' '), /₡|\$|garantiz|100%/);
});
