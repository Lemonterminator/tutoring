import { compute as alignmentMatrix } from './compute/alignment_matrix';
import { compute as ar1Explorer } from './compute/ar1_explorer';
import { compute as architectureComparator } from './compute/architecture_comparator';
import { compute as architectureGenealogy } from './compute/architecture_genealogy';
import { compute as attentionExplorer } from './compute/attention_explorer';
import { compute as attentionScale } from './compute/attention_scale';
import { compute as bpeStepper } from './compute/bpe_stepper';
import { compute as chinchilla } from './compute/chinchilla';
import { compute as copyDelayTrainer } from './compute/copy_delay_trainer';
import { compute as designSpaceCalculator } from './compute/design_space_calculator';
import { compute as distributionShaper } from './compute/distribution_shaper';
import { compute as exposureBias } from './compute/exposure_bias';
import { compute as gateTimeline } from './compute/gate_timeline';
import { compute as gaussianMixtureTrainer } from './compute/gaussian_mixture_trainer';
import { compute as gradientHighway } from './compute/gradient_highway';
import { compute as gradientViewer } from './compute/gradient_viewer';
import { compute as hopfieldRetrieval } from './compute/hopfield_retrieval';
import { compute as kvCacheLineage } from './compute/kv_cache_lineage';
import { compute as linearState } from './compute/linear_state';
import { compute as modelCalculator } from './compute/model_calculator';
import { compute as moeRouting } from './compute/moe_routing';
import { compute as ngramTrainer } from './compute/ngram_trainer';
import { compute as onlineRegression } from './compute/online_regression';
import { compute as onlineSoftmax } from './compute/online_softmax';
import { compute as particlesSphere } from './compute/particles_sphere';
import { compute as prePostLn } from './compute/pre_post_ln';
import { compute as rope } from './compute/rope';
import { compute as rnnGradientHeatmap } from './compute/rnn_gradient_heatmap';
import { compute as spectralGradient } from './compute/spectral_gradient';
import { compute as spectralMeasure } from './compute/spectral_measure';
import { compute as structuredMatrix } from './compute/structured_matrix';
import { compute as yarn } from './compute/yarn';

export type WidgetKind = 'interactive' | 'trainer' | 'animation';
export type NumberControl = { kind: 'number'; name: string; label: string; min: number; max: number; step: number };
export type SelectControl = { kind: 'select'; name: string; label: string; options: Array<{ value: string; label: string }> };
export type BooleanControl = { kind: 'boolean'; name: string; label: string };
export type Control = NumberControl | SelectControl | BooleanControl;
export type ComputeFn = (inputs: Record<string, unknown>, state: Record<string, unknown>) => unknown;

export type WidgetDefinition = {
  id: string;
  title: { en: string; zh: string };
  equation: string;
  derivation: string;
  insight: { en: string; zh: string };
  kind: WidgetKind;
  defaults: Record<string, unknown>;
  state: Record<string, unknown>;
  controls: Control[];
  compute: ComputeFn;
  maxSteps?: number;
};

type AnyCompute = (inputs: unknown, state: unknown) => unknown;

function adapt(fn: unknown): ComputeFn {
  return (inputs, state) => (fn as AnyCompute)(inputs, state);
}

function numberControl(name: string, label: string, min: number, max: number, step: number): NumberControl {
  return { kind: 'number', name, label, min, max, step };
}

function selectControl(name: string, label: string, options: string[]): SelectControl {
  return { kind: 'select', name, label, options: options.map((value) => ({ value, label: value })) };
}

function booleanControl(name: string, label: string): BooleanControl {
  return { kind: 'boolean', name, label };
}

function widget(
  id: string,
  title: string,
  titleZh: string,
  equation: string,
  derivation: string,
  compute: unknown,
  options: Partial<Omit<WidgetDefinition, 'id' | 'title' | 'equation' | 'derivation' | 'compute'>> = {},
): WidgetDefinition {
  return {
    id,
    title: { en: title, zh: titleZh },
    equation,
    derivation,
    insight: options.insight ?? { en: 'Change a control and inspect the recomputed output.', zh: '调整控件并检查重新计算的输出。' },
    kind: options.kind ?? 'interactive',
    defaults: options.defaults ?? {},
    state: options.state ?? { seed: 7, step: 0, max_steps: 40, x0: 0 },
    controls: options.controls ?? [],
    compute: adapt(compute),
    maxSteps: options.maxSteps ?? 40,
  };
}

const comparatorCompute: ComputeFn = (inputs) => architectureComparator({
  selectedIds: inputs.cardPair === 'qwen3-next-vs-gpt-oss' ? ['qwen3-next', 'gpt-oss-120b'] : ['deepseek-v3', 'gpt-oss-120b'],
});

export const widgetRegistry: Record<string, WidgetDefinition> = {
  'V-M0-a': widget('V-M0-a', 'Computation-graph gradient viewer', '计算图梯度查看器', 'dL/dx = Jᵀ · dL/dy', 'D-M0.1-05', gradientViewer, { defaults: { graph: 'rnn_cell', node: 'state', upstreamGradient: [1, -0.5] }, controls: [selectControl('graph', 'graph', ['rnn_cell', 'lstm_cell', 'attention_head']), selectControl('node', 'node', ['state', 'gate', 'logits'])], insight: { en: 'Reverse-mode gradients multiply by transposed local Jacobians.', zh: '反向模式梯度乘以局部雅可比矩阵的转置。' } }),
  'V-M0.5-a': widget('V-M0.5-a', 'AR(1) explorer', 'AR(1) 过程探索器', 'xₜ = φxₜ₋₁ + εₜ', 'D-M0.5-01', ar1Explorer, { defaults: { phi: 0.8, sigma: 0.3, horizon: 40, seed: 7 }, state: { seed: 7, x0: 0 }, controls: [numberControl('phi', 'φ', -0.99, 0.99, 0.01), numberControl('sigma', 'σ', 0, 1, 0.05), numberControl('horizon', 'horizon', 4, 80, 1), numberControl('seed', 'seed', 0, 99, 1)] }),
  'V-M0.5-b': widget('V-M0.5-b', 'N-gram trainer', 'N 元语法训练器', 'P(xₜ | xₜ₋ₙ:ₜ₋₁)', 'D-M0.5-02', ngramTrainer, { kind: 'trainer', defaults: { n: 2, smoothing_lambda: 0.1, corpus: 'toy_markov' }, controls: [numberControl('n', 'n', 1, 4, 1), numberControl('smoothing_lambda', 'λ', 0, 1, 0.05), selectControl('corpus', 'corpus', ['toy_markov', 'toy_words'])] }),
  'V-M0.5-c': widget('V-M0.5-c', 'Gaussian-mixture trainer', '高斯混合训练器', 'p(x) = Σₖ πₖ 𝓝(x; μₖ, σₖ²)', 'D-M0.5-03', gaussianMixtureTrainer, { kind: 'trainer', defaults: { K: 2, data_shape: 'bimodal' }, controls: [numberControl('K', 'K', 1, 4, 1), selectControl('data_shape', 'data', ['bimodal', 'unimodal'])] }),
  'V-M0.5-d': widget('V-M0.5-d', 'Distribution shaper', '分布塑形器', 'softmax(z / T) → top-k → top-p', 'D-M0.5-04', distributionShaper, { kind: 'trainer', defaults: { logits: 'toy', temperature: 1, top_k: 3, top_p: 0.9 }, controls: [selectControl('logits', 'logits', ['toy', 'peaked']), numberControl('temperature', 'temperature', 0.1, 3, 0.1), numberControl('top_k', 'top-k', 1, 5, 1), numberControl('top_p', 'top-p', 0.1, 1, 0.05)] }),
  'V-M0.5-e': widget('V-M0.5-e', 'Exposure-bias simulator', '暴露偏差模拟器', 'P(off-manifold by t) ≤ εt', 'D-M0.5-05', exposureBias, { kind: 'animation', defaults: { epsilon: 0.05, horizon: 20 }, controls: [numberControl('epsilon', 'ε', 0, 0.2, 0.01), numberControl('horizon', 'horizon', 4, 60, 1)] }),
  'V-M0.5-f': widget('V-M0.5-f', 'BPE merge stepper', 'BPE 合并步进器', 'argmax₍a,b₎ count(a,b)', 'D-M0.5-06', bpeStepper, { kind: 'trainer', defaults: { num_merges: 4, corpus: 'hug_pug_pun_bun_hugs' }, controls: [numberControl('num_merges', 'merges', 1, 8, 1)] }),
  'V-M1-a': widget('V-M1-a', 'RNN gradient heatmap', 'RNN 梯度热图', '∥∏ₜ Wₕ∥ ≈ ρ(Wₕ)ᵀ', 'D-M1.1-01', rnnGradientHeatmap, { kind: 'animation', defaults: { spectral_radius: 0.9, hidden_size: 8, seed: 7 }, controls: [numberControl('spectral_radius', 'spectral radius', 0.3, 1.5, 0.05), numberControl('hidden_size', 'hidden size', 2, 32, 1), numberControl('seed', 'seed', 0, 99, 1)] }),
  'V-M1-b': widget('V-M1-b', 'Spectral-gradient explorer', '谱梯度探索器', 'log ∥gₖ∥ ≈ k log ρ', 'D-M1.1-02', spectralGradient, { kind: 'animation', defaults: { spectral_radii: '0.5_0.9_1.1', horizon: 40 }, controls: [selectControl('spectral_radii', 'radii', ['0.5_0.9_1.1', '0.3_0.7_1.3']), numberControl('horizon', 'horizon', 4, 80, 1)] }),
  'V-M1-c': widget('V-M1-c', 'Copy-delay trainer', '复制延迟训练器', 'accuracy(t; Δ, h)', 'D-M1.2-03', copyDelayTrainer, { kind: 'trainer', defaults: { delay: 8, hidden_size: 16, steps: 40 }, controls: [numberControl('delay', 'delay', 2, 40, 1), numberControl('hidden_size', 'hidden size', 2, 64, 2), numberControl('steps', 'steps', 10, 100, 5)] }),
  'V-M2-a': widget('V-M2-a', 'LSTM gate timeline', 'LSTM 门时间线', 'cₜ = fₜ ⊙ cₜ₋₁ + iₜ ⊙ ĝₜ', 'D-M2.1-01', gateTimeline, { defaults: { text: 'sequence', hidden_size: 8, seed: 7 }, controls: [numberControl('hidden_size', 'hidden size', 2, 16, 1), numberControl('seed', 'seed', 0, 99, 1)] }),
  'V-M2-b': widget('V-M2-b', 'Gradient highway', '梯度高速公路', '∂cₜ/∂cₜ₋₁ = fₜ', 'D-M2.2-01', gradientHighway, { defaults: { horizon: 40, forget_bias: 2, rnn_factor: 0.9 }, controls: [numberControl('horizon', 'horizon', 4, 100, 1), numberControl('forget_bias', 'forget bias', -4, 6, 0.1), numberControl('rnn_factor', 'RNN factor', 0.1, 1.1, 0.05)] }),
  'V-M2-c': widget('V-M2-c', 'Alignment matrix', '对齐矩阵', 'Aᵢⱼ = softmaxⱼ(score(sᵢ, hⱼ))', 'D-M2.3-01', alignmentMatrix, { defaults: { length: 8, mode: 'copy', temperature: 0.5 }, controls: [numberControl('length', 'length', 2, 16, 1), selectControl('mode', 'mode', ['copy', 'reverse']), numberControl('temperature', 'temperature', 0.1, 2, 0.1)] }),
  'V-M3-a': widget('V-M3-a', 'Attention explorer', '注意力探索器', 'A = softmax(QKᵀ / √dₖ)', 'D-M3.1-01', attentionExplorer, { defaults: { layer: 0, head: 0 }, controls: [numberControl('layer', 'layer', 0, 8, 1), numberControl('head', 'head', 0, 8, 1)] }),
  'V-M3-b': widget('V-M3-b', 'Attention scaling', '注意力缩放', 'Var(q·k) = dₖ; Var(q·k/√dₖ) = 1', 'D-M3.2-01', attentionScale, { defaults: { dk: 64, scaled: true, seed: 7 }, controls: [numberControl('dk', 'dₖ', 4, 256, 4), booleanControl('scaled', 'divide by √dₖ'), numberControl('seed', 'seed', 0, 99, 1)] }),
  'V-M3-c': widget('V-M3-c', 'RoPE explorer', 'RoPE 探索器', '⟨Rₘq, Rₙk⟩ = ⟨q, Rₙ₋ₘk⟩', 'D-M3.3-01', rope, { defaults: { d: 8, base: 10000, relative_distance: 16, single_frequency: false, rotate_values: false }, controls: [numberControl('d', 'dimension', 2, 32, 2), numberControl('relative_distance', 'distance', 0, 128, 1), booleanControl('single_frequency', 'single frequency'), booleanControl('rotate_values', 'rotate values')] }),
  'V-M3-d': widget('V-M3-d', 'Pre-LN / Post-LN scaling', 'Pre-LN / Post-LN 缩放', '∥g(L)∥ ∝ L⁻¹ᐟ² (Pre-LN baseline)', 'D-M3.4-01', prePostLn, { defaults: { depth: 32, width: 64, placement: 'pre', seed: 7 }, controls: [numberControl('depth', 'depth', 2, 64, 2), numberControl('width', 'width', 8, 256, 8), selectControl('placement', 'placement', ['pre', 'post']), numberControl('seed', 'seed', 0, 99, 1)] }),
  'V-M3-e': widget('V-M3-e', 'Model-size calculator', '模型规模计算器', 'KV bytes = 2Lnhₖᵥ(d/h)·bytes', 'D-M3.5-01', modelCalculator, { defaults: { d: 4096, h: 32, h_kv: 8, L: 32, V: 100000, n: 2048, dtype: 'fp16' }, controls: [numberControl('d', 'model width', 64, 8192, 64), numberControl('h_kv', 'KV heads', 1, 32, 1), numberControl('L', 'layers', 1, 128, 1), numberControl('n', 'sequence length', 128, 32768, 128), selectControl('dtype', 'dtype', ['fp32', 'fp16', 'bf16', 'int8'])] }),
  'V-M4-a': widget('V-M4-a', 'Chinchilla calculator', 'Chinchilla 计算器', 'L(N,D) = E + A/Nᵅ + B/Dᵝ', 'D-M4.1-01', chinchilla, { defaults: { compute: 1e21, points: 33 }, controls: [numberControl('compute', 'compute', 1e19, 1e23, 1e19), numberControl('points', 'points', 5, 64, 1)] }),
  'V-M4-b': widget('V-M4-b', 'Online softmax', '在线 softmax', 'm′ = max(m, m̃); ℓ′ = eᵐ⁻ᵐ′ℓ + eᵐ̃⁻ᵐ′ℓ̃', 'D-M4.2-01', onlineSoftmax, { defaults: { blockSize: 2 }, controls: [numberControl('blockSize', 'block size', 1, 8, 1)] }),
  'V-M4-c': widget('V-M4-c', 'KV-cache lineage', 'KV-cache 继承关系', 'cacheₗ₊₁ = cacheₗ ∪ {Kₜ,Vₜ}', 'D-M4.3-01', kvCacheLineage),
  'V-M4-d': widget('V-M4-d', 'MoE routing and balancing', 'MoE 路由与均衡', 'L_aux = α E Σₑ fₑ Pₑ', 'D-M4.4-01', moeRouting, { defaults: { topK: 1, alpha: 0.01, balancing: 'aux' }, controls: [numberControl('topK', 'top-k', 1, 3, 1), numberControl('alpha', 'α', 0, 0.1, 0.005), selectControl('balancing', 'balancing', ['aux', 'bias'])] }),
  'V-M4-e': widget('V-M4-e', 'YaRN length extension', 'YaRN 长度扩展', 'θ′ᵢ = (1 − γᵢ) θᵢ/s + γᵢθᵢ', 'D-M4.5-01', yarn, { defaults: { dimension: 8, base: 10000, originalTrainLength: 2048, targetLength: 8192, alpha: 1, beta: 32 }, controls: [numberControl('targetLength', 'target length', 2048, 32768, 512), numberControl('alpha', 'α', 0, 8, 0.5), numberControl('beta', 'β', 8, 64, 1)] }),
  'V-M4-f': widget('V-M4-f', 'Linear-attention state', '线性注意力状态', 'Sₜ = αSₜ₋₁ + βvₜkₜᵀ', 'D-M4.6-01', linearState, { defaults: { mode: 'hebbian', alpha: 0.95, beta: 0.2 }, controls: [selectControl('mode', 'rule', ['hebbian', 'delta', 'gated']), numberControl('alpha', 'α', 0, 1, 0.05), numberControl('beta', 'β', 0, 1, 0.05)] }),
  'V-M5-a': widget('V-M5-a', 'Architecture genealogy', '架构谱系', 'architecture = attention × cache × position × routing × recurrence', 'D-M5.1-01', architectureGenealogy, { defaults: { axis: 'all', family: 'all', includeUnknown: false }, controls: [selectControl('axis', 'axis', ['all', 'attention', 'cache', 'position', 'routing', 'recurrence', 'window', 'sparse', 'residual']), booleanControl('includeUnknown', 'include unknown')] }),
  'V-M5-b': widget('V-M5-b', 'Sourced architecture comparator', '有来源的架构比较器', 'compare(card₁, card₂) field by field', 'D-M5.2-01', comparatorCompute, { defaults: { cardPair: 'deepseek-v3-vs-gpt-oss' }, controls: [selectControl('cardPair', 'cards', ['deepseek-v3-vs-gpt-oss', 'qwen3-next-vs-gpt-oss'])], insight: { en: 'Only source-backed fields are asserted; unknowns stay visible.', zh: '只断言有来源的字段；未知项保持可见。' } }),
  'V-M5-c': widget('V-M5-c', 'Design-space calculator', '设计空间计算器', 'design = dense/sparse × attention/recurrence × cache', 'D-M5.3-01', designSpaceCalculator, { defaults: { totalParamsB: 100, activeParamsB: 20, layers: 32, sequenceLength: 4096, heads: 32, kvHeads: 8, headDim: 128, attentionVariant: 'gqa', recurrenceRatio: 0 }, controls: [numberControl('totalParamsB', 'total params (B)', 1, 1000, 1), numberControl('activeParamsB', 'active params (B)', 1, 500, 1), numberControl('sequenceLength', 'sequence length', 512, 32768, 512), selectControl('attentionVariant', 'attention', ['mha', 'gqa', 'mla', 'sliding', 'sparse', 'hybrid']), numberControl('recurrenceRatio', 'recurrence ratio', 0, 1, 0.05)] }),
  'V-M7-a': widget('V-M7-a', 'Structured matrix explorer', '结构化矩阵探索器', 'Kᵢⱼ = Σₗ fₗ(i)gₗ(j) or Kᵢⱼ = Πₜ Aₜ', 'D-M7.1-01', structuredMatrix, { defaults: { mode: 'toeplitz', length: 16, stateDim: 3, delta: 0.2, selective: true, seed: 7 }, controls: [selectControl('mode', 'mode', ['toeplitz', 'semiseparable', 'low-rank', 'dense']), numberControl('length', 'length', 4, 32, 1), numberControl('stateDim', 'state dim', 1, 8, 1), numberControl('delta', 'delta', 0.05, 1, 0.05), booleanControl('selective', 'selective')] }),
  'V-M7-b': widget('V-M7-b', 'Particles on the sphere', '球面粒子', 'dXᵢ = −∇ₓᵢF dt + √(2τ) dWᵢ', 'D-M7.2-01', particlesSphere, { kind: 'animation', defaults: { beta: 1, depth: 2, qk: true, residual: true, ffn: true, length: 64, seed: 7 }, controls: [numberControl('beta', 'β', 0.1, 8, 0.1), numberControl('depth', 'depth', 1, 8, 1), numberControl('length', 'particles', 8, 128, 8), booleanControl('qk', 'QK interaction'), booleanControl('residual', 'residual'), booleanControl('ffn', 'FFN'), numberControl('seed', 'seed', 0, 99, 1)] }),
  'V-M7-c': widget('V-M7-c', 'Hopfield retrieval', 'Hopfield 检索', 'y = softmax(βXq)X', 'D-M7.3-01', hopfieldRetrieval, { defaults: { beta: 4, steps: 4 }, controls: [numberControl('beta', 'β', 0.1, 16, 0.1), numberControl('steps', 'steps', 1, 12, 1)] }),
  'V-M7-d': widget('V-M7-d', 'Online regression rule', '在线回归规则', 'Wₜ₊₁ = Wₜ + β(vₜ − Wₜkₜ)kₜᵀ', 'D-M7.4-01', onlineRegression, { defaults: { mode: 'delta', alpha: 0.95, beta: 0.2, length: 8, seed: 7 }, controls: [selectControl('mode', 'rule', ['hebbian', 'delta', 'gated']), numberControl('alpha', 'α', 0, 1, 0.05), numberControl('beta', 'β', 0, 1, 0.05), numberControl('length', 'length', 2, 24, 1), numberControl('seed', 'seed', 0, 99, 1)] }),
  'V-M7-e': widget('V-M7-e', 'Spectral positional measure', '位置编码谱测量', 'K(Δ) = Σᵢ wᵢ cos(Δθᵢ)', 'D-M7.5-01', spectralMeasure, { defaults: { mode: 'rope', length: 32, scale: 4, slope: 0.13 }, controls: [selectControl('mode', 'mode', ['rope', 'yarn', 'alibi', 't5']), numberControl('length', 'length', 4, 96, 4), numberControl('scale', 'scale', 0.5, 16, 0.5), numberControl('slope', 'slope', 0, 1, 0.01)] }),
};

export function getWidget(id: string): WidgetDefinition {
  const definition = widgetRegistry[id];
  if (!definition) throw new Error(`Unknown LLM course widget: ${id}`);
  return definition;
}
