import { cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { setLang } from '../../../framework/i18n/state';
import {
  displacementReflection,
  displacementTransmission,
  ImpedanceReflection,
  reflectedFraction,
  transmittedFraction,
} from './ImpedanceReflection';

afterEach(() => {
  cleanup();
  setLang('en');
});

test('a fixed end and a free end are the two extremes of the same slider', () => {
  expect(displacementReflection(1e9)).toBeCloseTo(-1, 6); // immovable second medium
  expect(displacementReflection(1e-9)).toBeCloseTo(1, 6); // weightless second medium
  expect(displacementReflection(1)).toBeCloseTo(0, 12); // matched: nothing comes back
  expect(displacementTransmission(1)).toBeCloseTo(1, 12);
});

test('reflected and transmitted energy always add up to all of it', () => {
  for (const ratio of [0.01, 0.4, 1, 2.5, 40, 4000]) {
    expect(reflectedFraction(ratio) + transmittedFraction(ratio)).toBeCloseTo(1, 9);
  }
});

test('the air to tissue preset reports that almost everything reflects', () => {
  const { container, getByText } = render(<ImpedanceReflection />);
  fireEvent.click(getByText('Air to tissue'));
  expect(container.textContent).toContain('99.9');
});
