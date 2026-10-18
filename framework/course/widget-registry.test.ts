import { expect, test } from 'vitest';
import { getWidget, widgetRegistry } from './widget-registry';

const expectedIds = [
  'V-M0-a', 'V-M0.5-a', 'V-M0.5-b', 'V-M0.5-c', 'V-M0.5-d', 'V-M0.5-e', 'V-M0.5-f',
  'V-M1-a', 'V-M1-b', 'V-M1-c', 'V-M2-a', 'V-M2-b', 'V-M2-c', 'V-M3-a', 'V-M3-b',
  'V-M3-c', 'V-M3-d', 'V-M3-e', 'V-M4-a', 'V-M4-b', 'V-M4-c', 'V-M4-d', 'V-M4-e',
  'V-M4-f', 'V-M5-a', 'V-M5-b', 'V-M5-c', 'V-M7-a', 'V-M7-b', 'V-M7-c', 'V-M7-d', 'V-M7-e',
];

test('the frontend registry covers every course widget ID', () => {
  expect(Object.keys(widgetRegistry).sort()).toEqual([...expectedIds].sort());
});

test('every default widget computation is deterministic and callable', () => {
  for (const id of expectedIds) {
    const definition = getWidget(id);
    const first = definition.compute({ ...definition.defaults }, { ...definition.state, step: 0, max_steps: definition.maxSteps ?? 40 });
    const second = definition.compute({ ...definition.defaults }, { ...definition.state, step: 0, max_steps: definition.maxSteps ?? 40 });
    expect(first).toEqual(second);
  }
});
