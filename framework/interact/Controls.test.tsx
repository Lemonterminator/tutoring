import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { Segmented, Slider } from './Controls';

afterEach(cleanup);

test('slider reports numbers, segmented reports the chosen value', () => {
  const seen: unknown[] = [];
  render(
    <>
      <Slider label="ω" min={0} max={4} step={0.1} value={1} onInput={(v) => seen.push(v)} display="1.0 rad/s" />
      <Segmented label="mode" value="a" onChange={(v) => seen.push(v)} options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} />
    </>,
  );
  fireEvent.input(screen.getByRole('slider'), { target: { value: '2.5' } });
  fireEvent.click(screen.getByRole('button', { name: 'B' }));
  expect(seen).toEqual([2.5, 'b']);
  expect(screen.getByRole('button', { name: 'A' }).getAttribute('aria-pressed')).toBe('true');
});
