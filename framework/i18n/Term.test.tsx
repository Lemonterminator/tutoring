import { act, cleanup, render } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { LessonContext } from '../layout/LessonContext';
import { setExamMode, setLang } from './state';
import { Term } from './Term';

const ctx = {
  meta: { id: 'x', subject: 'math' as const, title: { en: 'X', fi: 'X' } },
  terms: { frequency: { en: 'frequency', fi: 'taajuus' } },
};

function view(id: string, surface: string) {
  return render(
    <LessonContext.Provider value={ctx}>
      <Term id={id}>{surface}</Term>
    </LessonContext.Provider>,
  );
}

afterEach(() => {
  cleanup();
  setLang('en');
  setExamMode(false);
});

test('English mode shows the Finnish base form in brackets', () => {
  expect(view('frequency', 'frequency').container.textContent).toBe('frequency (taajuus)');
});

test('Finnish mode keeps the inflected surface text and adds English', () => {
  act(() => setLang('fi'));
  expect(view('frequency', 'taajuuden').container.textContent).toBe('taajuuden (frequency)');
});

test('exam mode hides English except on hover', () => {
  act(() => setExamMode(true));
  const { container } = view('frequency', 'taajuuden');
  expect(container.textContent).toBe('taajuuden');
  expect(container.querySelector('.term')?.getAttribute('title')).toBe('frequency');
});

test('an unknown id is visibly flagged', () => {
  expect(view('nope', 'x').container.querySelector('.term--missing')).not.toBeNull();
});
