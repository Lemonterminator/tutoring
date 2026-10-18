import { cleanup, render, screen } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { setCourseLang } from '../i18n/course-state';
import { CourseWidget } from './CourseWidget';

afterEach(() => {
  cleanup();
  setCourseLang('en');
});

test('renders the equation, derivation ID, controls, and canvas shell', () => {
  render(<CourseWidget id="V-M0-a" />);
  expect(screen.getByText('Computation-graph gradient viewer')).toBeTruthy();
  expect(screen.getByText('V-M0-a · D-M0.1-05')).toBeTruthy();
  expect(screen.getByText('dL/dx = Jᵀ · dL/dy')).toBeTruthy();
  expect(screen.getByRole('img', { name: 'Computation-graph gradient viewer visualization' })).toBeTruthy();
});

test('uses the Simplified-Chinese widget label when the course locale changes', () => {
  setCourseLang('zh');
  render(<CourseWidget id="V-M3-c" />);
  expect(screen.getByText('RoPE 探索器')).toBeTruthy();
});
