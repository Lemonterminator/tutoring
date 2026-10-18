import { readFileSync, writeFileSync } from 'node:fs';
import { createForceLayout } from '../framework/concept-graph/layout';
import { graphSignature, parseGraph } from '../framework/concept-graph/model';
import { mergeOpenCourses, type OpenCourseExtension } from '../framework/concept-graph/open-course-extension';

const base = parseGraph(JSON.parse(readFileSync('public/concept-graph/graph.json', 'utf8')));
const extension = JSON.parse(readFileSync('public/concept-graph/open-courses.json', 'utf8')) as OpenCourseExtension;
const graph = mergeOpenCourses(base, extension);
const solver = createForceLayout(graph);
solver.step(260);
writeFileSync('public/concept-graph/layout.open.json', JSON.stringify({ signature: graphSignature(graph), positions: solver.positions() }));
console.log(`Cached combined layout: ${graph.nodes.length} nodes, ${graph.edges.length} edges.`);
