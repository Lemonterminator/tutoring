import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { setExamMode, setLang } from '../i18n/state';
import { Lesson } from './Lesson';

type BodyProps = { components?: Record<string, any> };

const En = ({ components = {} }: BodyProps) => {
  const { Syllabus } = components;
  return (
    <>
      <h2 id="sec-0" data-b="0">Hello</h2>
      <p data-b="1">English text</p>
      <Syllabus>
        <p data-b="2">Box</p>
      </Syllabus>
    </>
  );
};
const Fi = () => (
  <>
    <h2 id="sec-0" data-b="0">Hei</h2>
    <p data-b="1">Suomenkielinen teksti</p>
  </>
);
const meta = { id: 'math-test', subject: 'math' as const, title: { en: 'Test lesson', fi: 'Testitunti' } };
const terms = { wave: { en: 'wave', fi: 'aalto' } };

afterEach(() => {
  cleanup();
  setLang('en');
  setExamMode(false);
});

test('renders the English body, a table of contents and the glossary', () => {
  const { container } = render(<Lesson meta={meta} En={En} Fi={Fi} terms={terms} />);
  expect(container.querySelector('article h1')?.textContent).toBe('Test lesson');
  expect(container.querySelector('.toc li a')?.getAttribute('href')).toBe('#sec-0');
  expect(container.querySelector('.box--syllabus')).not.toBeNull();
  expect(container.querySelector('.glossary dt')?.textContent).toBe('aalto');
});

test('switching to Finnish swaps the body and the document language', () => {
  render(<Lesson meta={meta} En={En} Fi={Fi} terms={terms} />);
  act(() => setLang('fi'));
  expect(screen.getByText('Suomenkielinen teksti')).toBeTruthy();
  expect(document.documentElement.lang).toBe('fi');
});

test('in exam mode hovering a Finnish block shows the matching English block', () => {
  render(<Lesson meta={meta} En={En} Fi={Fi} terms={terms} />);
  act(() => setExamMode(true));
  fireEvent.mouseOver(screen.getByText('Suomenkielinen teksti'));
  expect(document.querySelector('.en-tip')?.textContent).toBe('English text');
  expect(screen.getByRole('button', { name: 'EN' }).hasAttribute('disabled')).toBe(true);
});
