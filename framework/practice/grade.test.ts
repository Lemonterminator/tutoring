import { expect, test } from 'vitest';
import { gradeNumeric, parseNumber } from './grade';

test.each([
  ['0,5', 0.5],
  [' −3 ', -3],
  ['6.0e1', 60],
  ['1 000', 1000],
  ['abc', null],
  ['', null],
  ['1,2,3', null],
])('parseNumber(%j) = %j', (input, expected) => {
  expect(parseNumber(input)).toBe(expected);
});

test('relative tolerance defaults to 2 %', () => {
  expect(gradeNumeric('59', 60)).toBe(true);
  expect(gradeNumeric('58', 60)).toBe(false);
});

test('absolute tolerance for rounded answers', () => {
  expect(gradeNumeric('73', 73, 0, 0.5)).toBe(true);
  expect(gradeNumeric('72', 73, 0, 0.5)).toBe(false);
});
