import { expect, test } from 'vitest';
import { createForceLayout, layeredLayout, validLayoutCache } from './layout';
import { fixture, edge } from './fixtures';
import { graphSignature, indexGraph, matchesQuery, parseGraph, prerequisiteClosure, prerequisitePath, visibleEdges, visibleNodes, quoteIsVerified } from './model';

test('excluded cycle edges cannot enter prerequisite chains and cross-course filters do not alter traversal', () => {
  const index = indexGraph(fixture);
  expect(prerequisitePath(index, 'Target').map((node) => node.id)).toEqual(['Foundation', 'Middle']);
  expect([...prerequisiteClosure(index, 'Foundation', 'descendants')]).toEqual(['Middle', 'Target']);
  const visible = visibleNodes(fixture, new Set(['ELEC-E8125']));
  expect(visible.map((node) => node.id)).toEqual(['Middle', 'Target']);
  expect(visibleEdges(fixture, new Set(visible.map((node) => node.id)), false)).toHaveLength(1);
  expect(visibleEdges(fixture, new Set(fixture.nodes.map((node) => node.id)), false)).toHaveLength(4);
  expect(visibleNodes(fixture, new Set())).toHaveLength(0);
});

test('search includes all three alias languages and each quote retains its own verification flag', () => {
  for (const query of [' BASE ', '基础', 'PERUSTA', 'Foundation']) expect(matchesQuery(fixture.nodes[0], query)).toBe(true);
  expect(matchesQuery(fixture.nodes[0], 'absent')).toBe(false);
  const relation = fixture.edges[0];
  expect(quoteIsVerified(relation, relation.evidence[0])).toBe(true);
  expect(quoteIsVerified(relation, relation.evidence[1])).toBe(false);
});

test('layouts stay deterministic without mutating source data and changed topology invalidates cached coordinates', () => {
  const original = JSON.stringify(fixture);
  const first = createForceLayout(fixture), second = createForceLayout(fixture);
  first.step(260);
  for (let i = 0; i < 130; i++) second.step(2);
  expect(second.positions()).toEqual(first.positions());
  expect(Object.values(first.positions()).every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
  layeredLayout(fixture);
  expect(JSON.stringify(fixture)).toBe(original);
  const cache = { signature: graphSignature(fixture), positions: first.positions() };
  expect(validLayoutCache(cache, fixture)).toBe(true);
  expect(validLayoutCache(cache, { ...fixture, edges: [...fixture.edges, edge('Foundation', 'Target')] })).toBe(false);
  expect(validLayoutCache({ ...cache, positions: {} }, fixture)).toBe(false);
});

test('bad JSON, duplicate IDs, missing targets, and unspecified DAG membership produce actionable loading errors', () => {
  expect(() => parseGraph({})).toThrow(/nodes/);
  expect(() => parseGraph({ ...fixture, nodes: [...fixture.nodes, fixture.nodes[0]] })).toThrow(/ID 重复/);
  expect(() => parseGraph({ ...fixture, edges: [edge('absent', 'Target')] })).toThrow(/引用缺失/);
  expect(() => parseGraph({ ...fixture, edges: [{ ...fixture.edges[0], in_dag: undefined }] })).toThrow(/关系字段/);
  expect(parseGraph(fixture)).toBe(fixture);
});
