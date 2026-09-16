import { expect, test } from 'vitest';
import { termView } from './terms';

const entry = { en: 'frequency', fi: 'taajuus' };

test('English mode adds the Finnish base form', () => {
  expect(termView(entry, 'en', false)).toEqual({ secondary: 'taajuus', hover: null });
});

test('Finnish mode adds the English base form', () => {
  expect(termView(entry, 'fi', false)).toEqual({ secondary: 'frequency', hover: null });
});

test('exam mode shows no bracket and puts English on hover', () => {
  expect(termView(entry, 'en', true)).toEqual({ secondary: null, hover: 'frequency' });
});
