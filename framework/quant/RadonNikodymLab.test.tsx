import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { setCourseLang } from '../i18n/course-state';
import { RadonNikodymLab } from './RadonNikodymLab';

afterEach(() => {
  cleanup();
  setCourseLang('en');
});

test('reweights an edited probability and retains it through an EN/ZH remount', () => {
  setCourseLang('en');
  const view = render(<RadonNikodymLab />);
  fireEvent.input(screen.getByRole('slider', { name: /^Up probability under P/ }), { target: { value: '0.4' } });
  expect(screen.getByText('1.250')).toBeTruthy();
  expect(screen.getByText('0.833')).toBeTruthy();
  expect(screen.getByText('8.000')).toBeTruthy();
  expect(screen.getByText('10.000')).toBeTruthy();
  view.unmount();
  setCourseLang('zh');
  render(<RadonNikodymLab />);
  expect((screen.getByRole('slider', { name: /^P 下上涨概率/ }) as HTMLInputElement).value).toBe('0.4');
  expect(screen.getByText('1.250')).toBeTruthy();
  fireEvent.input(screen.getByRole('slider'), { target: { value: '0.7' } });
});
