import { expect, test } from 'vitest';
import { collectDocumentIds, resolveSourceDocuments } from './concept-sources';

test('collects and deduplicates node and edge source IDs', () => {
  expect(collectDocumentIds({
    nodes: [
      { introduced_in: [{ doc: 'doc-b' }], used_in: [{ doc: 'doc-a' }, { doc: 'doc-b' }] },
      { introduced_in: [{ doc: '' }, { doc: 4 }] },
    ],
    edges: [{ evidence: [{ doc: 'doc-c' }, { doc: 'doc-a' }] }],
  })).toEqual(['doc-a', 'doc-b', 'doc-c']);
});

test('maps only an exact migrated path suffix and emits the source URL contract', () => {
  const result = resolveSourceDocuments(
    { nodes: [{ introduced_in: [{ doc: 'course-a__lecture-1' }] }], edges: [] },
    [{ id: 'course-a__lecture-1', file: 'C:\\Users\\Jiang\\Downloads\\Course_A\\Lectures\\Lecture 1.pdf', pages: 24 }],
    '/materials',
    ['/materials/Course_A/Lectures/Lecture 1.pdf'],
  );

  expect(result.documents['course-a__lecture-1']).toEqual({
    url: 'sources/course-a__lecture-1.pdf',
    filename: 'Lecture 1.pdf',
    pages: 24,
    available: true,
  });
  expect(result.summary).toEqual({ referenced: 1, available: 1, missing: 0 });
});

test('reports duplicate suffixes and unknown document IDs instead of guessing', () => {
  const result = resolveSourceDocuments(
    { nodes: [{ used_in: [{ doc: 'ambiguous' }, { doc: 'synthetic' }] }], edges: [] },
    [{ id: 'ambiguous', file: 'C:\\Users\\Jiang\\Downloads\\Course_A\\Lecture.pdf', pages: 8 }],
    '/materials',
    ['/materials/Course_A/Lecture.pdf', '/materials/course_a/lecture.PDF'],
  );

  expect(result.documents.ambiguous).toEqual({ url: '', filename: 'Lecture.pdf', pages: 8, available: false });
  expect(result.documents.synthetic).toEqual({ url: '', filename: '', pages: 0, available: false });
  expect(result.issues.map(({ docId, kind }) => ({ docId, kind }))).toEqual([
    { docId: 'ambiguous', kind: 'ambiguous' },
    { docId: 'synthetic', kind: 'missing' },
  ]);
  expect(result.summary).toEqual({ referenced: 2, available: 0, missing: 2 });
});

test('does not substitute a similarly named PDF from another course', () => {
  const result = resolveSourceDocuments(
    { nodes: [{ used_in: [{ doc: 'missing' }] }], edges: [] },
    [{ id: 'missing', file: 'C:\\Downloads\\Course_A\\Lecture.pdf', pages: 8 }],
    '/materials', ['/materials/Course_B/Lecture.pdf'],
  );
  expect(result.documents.missing.available).toBe(false);
});

test('URL decoding preserves the encoded physical filename for unusual document IDs', () => {
  const docId = 'Lecture A/å';
  const result = resolveSourceDocuments(
    { nodes: [{ used_in: [{ doc: docId }] }], edges: [] },
    [{ id: docId, file: 'C:\\Downloads\\Course_A\\Lecture.pdf', pages: 8 }],
    '/materials', ['/materials/Course_A/Lecture.pdf'],
  );
  expect(decodeURIComponent(result.documents[docId].url)).toBe(`sources/${encodeURIComponent(docId)}.pdf`);
});
