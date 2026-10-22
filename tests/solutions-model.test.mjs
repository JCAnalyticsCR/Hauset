import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lightingSummary,
  lightPresets,
  networkAssessment,
  securityViews,
} from '../src/scripts/solutions-model.ts';

test('light scenes preserve the chosen rooms and an explicit all-off state', () => {
  assert.equal(
    lightingSummary(new Set(lightPresets.llegar)).item,
    'Iluminación por zonas: Sala, Entrada',
  );
  assert.equal(
    lightingSummary(new Set(lightPresets.salir)).title,
    'Todo en pausa.',
  );
  const custom = new Set(lightPresets.descansar);
  custom.delete('sala');
  assert.match(lightingSummary(custom).title, /^1 ambiente encendido/);
  assert.equal(
    lightingSummary(custom).item,
    'Iluminación por zonas: Dormitorio',
  );
  assert.deepEqual(lightPresets.descansar, ['sala', 'dormitorio']);
  assert.ok(
    lightingSummary(new Set(['sala', 'dormitorio', 'cocina', 'entrada'])).item
      .length <= 70,
  );
});

test('each access moves both camera and illustrative field of view', () => {
  assert.equal(
    new Set(Object.values(securityViews).map((view) => view.camera)).size,
    3,
  );
  assert.equal(
    new Set(Object.values(securityViews).map((view) => view.cone)).size,
    3,
  );
  for (const view of Object.values(securityViews))
    assert.ok(view.label && view.blind);
});

test('network advice changes with distribution and physical obstacles, without invented measurements', () => {
  assert.notDeepEqual(
    networkAssessment('router', 'sala', 'abierto'),
    networkAssessment('router', 'terraza', 'abierto'),
  );
  assert.notDeepEqual(
    networkAssessment('router', 'dormitorio', 'muros'),
    networkAssessment('distribuida', 'dormitorio', 'muros'),
  );
  assert.match(
    networkAssessment('distribuida', 'dormitorio', 'plantas').text,
    /otro nivel/,
  );
  for (const layout of ['router', 'distribuida'])
    for (const zone of ['sala', 'dormitorio', 'terraza'])
      for (const obstacle of ['abierto', 'muros', 'plantas']) {
        const assessment = networkAssessment(layout, zone, obstacle);
        assert.ok(assessment.title && assessment.text);
        assert.doesNotMatch(assessment.text, /\d|Mbps|dBm|garantiza/i);
      }
});
