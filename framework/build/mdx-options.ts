import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import type { PluggableList } from 'unified';
import { rehypeBlockIds } from './rehype-block-ids';

export const remarkPlugins: PluggableList = [remarkMath];
// MathML output: browsers render it natively, so no KaTeX CSS or fonts end up in the bundle.
export const rehypePlugins: PluggableList = [[rehypeKatex, { output: 'mathml' }], rehypeBlockIds];
export const mdxOptions = { jsxImportSource: 'preact', remarkPlugins, rehypePlugins };
