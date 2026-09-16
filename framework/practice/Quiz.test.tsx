import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { Choice, ChoiceQuiz, Hint, NumericQuiz, Solution } from './Quiz';

afterEach(cleanup);

test('numeric quiz accepts a decimal comma and reveals the solution after an attempt', () => {
  render(
    <NumericQuiz answer={0.5} unit="s">
      <p>How long?</p>
      <Hint>Use T = 2π/ω</Hint>
      <Solution>T is half a second</Solution>
    </NumericQuiz>,
  );
  expect(screen.queryByText('T is half a second')).toBeNull();

  const input = screen.getByLabelText('Your answer');
  fireEvent.input(input, { target: { value: '0,7' } });
  fireEvent.submit(input.closest('form')!);
  expect(screen.getByRole('status').textContent).toContain('Not yet');
  expect(screen.getByText('T is half a second')).toBeTruthy();

  fireEvent.input(input, { target: { value: '0,5' } });
  fireEvent.submit(input.closest('form')!);
  expect(screen.getByRole('status').textContent).toBe('Correct!');
});

test('choice quiz marks the picked option', () => {
  render(
    <ChoiceQuiz correct={1}>
      <p>Sign at a crest?</p>
      <Choice>Positive</Choice>
      <Choice>Negative</Choice>
      <Solution>Negative.</Solution>
    </ChoiceQuiz>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Positive' }));
  expect(screen.getByRole('button', { name: 'Positive' }).className).toContain('choice--wrong');
  expect(screen.getByRole('status').textContent).toContain('Not yet');

  fireEvent.click(screen.getByRole('button', { name: 'Negative' }));
  expect(screen.getByRole('status').textContent).toBe('Correct!');
  expect(screen.getByText('Negative.')).toBeTruthy();
});
