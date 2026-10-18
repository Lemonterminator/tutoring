import { describe, expect, test } from 'vitest';
import { coreStudySequence, directionIds, teachingLessons } from './index';
import { nodeContent } from '../NvidiaGraphContent';

describe('NVIDIA teaching contract', () => {
  test('covers the unchanged 21 core IDs and five directions, within the 12-hour teaching budget', () => {
    const ids = [...coreStudySequence, ...directionIds];
    expect(new Set(coreStudySequence).size).toBe(21);
    expect(Object.keys(teachingLessons).sort()).toEqual([...ids].sort());
    expect(ids.every((id) => nodeContent[id])).toBe(true);
    expect(ids.reduce((sum, id) => sum + teachingLessons[id].minutes, 0)).toBe(720);
  });

  test('prerequisites exist, precede their dependent core node and cannot form a cycle', () => {
    for (const [id, lesson] of Object.entries(teachingLessons)) {
      const current = (coreStudySequence as readonly string[]).indexOf(id);
      for (const prereq of lesson.prerequisites) {
        expect(teachingLessons[prereq], `${id} -> ${prereq}`).toBeDefined();
        if (current >= 0) {
          const position = (coreStudySequence as readonly string[]).indexOf(prereq);
          expect(position, `${id} -> ${prereq}`).toBeGreaterThanOrEqual(0);
          expect(position, `${id} -> ${prereq}`).toBeLessThan(current);
        }
      }
    }
  });

  test('both languages retain the same explanation, calculation and assessment structure', () => {
    const checkLocalized = (value: unknown, path: string): void => {
      if (!value || typeof value !== 'object') return;
      const obj = value as Record<string, unknown>;
      if ('en' in obj || 'zh' in obj) {
        for (const lang of ['en', 'zh']) {
          expect(obj[lang], `${path}.${lang}`).toBeDefined();
          const text = obj[lang];
          if (Array.isArray(text)) {
            expect(text.length, `${path}.${lang}`).toBeGreaterThan(0);
            text.forEach((s, i) => expect(typeof s === 'string' && s.trim().length > 0, `${path}.${lang}[${i}]`).toBe(true));
          } else expect(typeof text === 'string' && text.trim().length > 0, path).toBe(true);
        }
        if (Array.isArray(obj.en)) expect((obj.zh as string[]).length, path).toBe(obj.en.length);
      } else Object.entries(obj).forEach(([k, v]) => checkLocalized(v, `${path}.${k}`));
    };
    for (const [id, lesson] of Object.entries(teachingLessons)) {
      checkLocalized(lesson, id);
      expect(lesson.terms.length, id).toBeGreaterThan(0);
      expect(lesson.sources.length, id).toBeGreaterThan(0);
      lesson.sources.forEach((source) => expect(new URL(source.url).protocol).toBe('https:'));
      if ((coreStudySequence as readonly string[]).includes(id)) {
        expect(lesson.sections.length, id).toBeGreaterThanOrEqual(3);
        expect(lesson.checks.length, id).toBeGreaterThanOrEqual(2);
      }
      for (const check of lesson.checks) {
        expect(check.answer.zh, id).not.toBe(lesson.takeaways.zh[0]);
        expect(check.reasoning.zh.length, id).toBeGreaterThan(0);
        expect(check.rubric.zh.length, id).toBeGreaterThan(0);
      }
    }
  });

  test('Amdahl answers the numeric question and Roofline distinguishes bounds from measurements', () => {
    const check = teachingLessons.scaling.checks[0];
    const speedup = 1 / (0.05 + 0.95 / 8);
    expect(check.answer.zh).toContain('20');
    expect(check.answer.en).toContain(speedup.toFixed(2));
    expect(check.reasoning.zh.join(' ')).toContain('0.95/8');
    expect(teachingLessons.roofline.checks[0].answer.zh).toContain('20 TFLOP/s');
    expect(teachingLessons.roofline.checks[1].answer.zh).toContain('不能');
  });
});
