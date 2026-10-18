import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { nodeContent, type Language, type NodeContent } from './NvidiaGraphContent';
import { coreStudySequence, teachingLessons } from './teaching';
import { TeachingView } from './teaching/TeachingView';

type Kind = 'hub' | 'direction' | 'concept' | 'case' | 'source';
type Filter = 'all' | Exclude<Kind, 'hub'>;
type DetailTab = 'core' | 'mechanism' | 'interview';
type LocalizedText = { en: string; zh: string };


type GraphNode = {
  id: string;
  kind: Kind;
  x: number;
  y: number;
  label: { en: string; zh: string };
  summary: { en: string; zh: string };
};

type GraphEdge = { from: string; to: string };

const nodes: GraphNode[] = [
  { id: 'hub', kind: 'hub', x: 660, y: 34, label: { en: 'NVIDIA Graduate Program', zh: 'NVIDIA Graduate Program' }, summary: { en: 'The target assessment and interview preparation graph.', zh: '目标测验与面试准备图谱。' } },
  { id: 'hpc', kind: 'direction', x: 70, y: 150, label: { en: 'High-performance computing', zh: '高性能计算' }, summary: { en: 'Scaling, performance models, decomposition, and communication.', zh: '扩展性、性能模型、任务分解与通信。' } },
  { id: 'arch', kind: 'direction', x: 355, y: 150, label: { en: 'Chip architecture', zh: '芯片架构' }, summary: { en: 'CPU/GPU execution, memory systems, and latency hiding.', zh: 'CPU/GPU 执行、存储系统与延迟隐藏。' } },
  { id: 'cpp', kind: 'direction', x: 640, y: 150, label: { en: 'C++ systems', zh: 'C++ 系统基础' }, summary: { en: 'Lifetime, ownership, polymorphism, and concurrency semantics.', zh: '生命周期、所有权、多态与并发语义。' } },
  { id: 'ai', kind: 'direction', x: 925, y: 150, label: { en: 'AI engineering', zh: 'AI 工程' }, summary: { en: 'Kernels, numerical formats, inference, and profiling.', zh: 'Kernel、数值格式、推理与 profiling。' } },
  { id: 'infra', kind: 'direction', x: 1210, y: 150, label: { en: 'AI infrastructure', zh: 'AI 基础设施' }, summary: { en: 'OS, networking, distributed systems, and serving.', zh: 'OS、网络、分布式系统与服务化。' } },
  { id: 'scaling', kind: 'concept', x: 35, y: 335, label: { en: 'Amdahl / scaling', zh: 'Amdahl / 扩展性' }, summary: { en: 'Speedup, strong scaling, weak scaling, and serial fractions.', zh: '加速比、强扩展、弱扩展与串行部分。' } },
  { id: 'roofline', kind: 'concept', x: 205, y: 465, label: { en: 'Roofline model', zh: 'Roofline 模型' }, summary: { en: 'Use arithmetic intensity to reason about compute or bandwidth limits.', zh: '用算术强度判断计算受限还是带宽受限。' } },
  { id: 'decomp', kind: 'concept', x: 35, y: 595, label: { en: 'Decomposition', zh: '任务分解' }, summary: { en: 'Partition work while managing load balance and communication.', zh: '分配工作，同时处理负载均衡与通信。' } },
  { id: 'simt', kind: 'concept', x: 320, y: 335, label: { en: 'SIMD / SIMT', zh: 'SIMD / SIMT' }, summary: { en: 'Compare vector lanes, warps, and the execution model exposed by GPUs.', zh: '比较向量 lane、warp 与 GPU 暴露的执行模型。' } },
  { id: 'memory', kind: 'concept', x: 490, y: 465, label: { en: 'Memory hierarchy', zh: 'Memory hierarchy' }, summary: { en: 'Cache, registers, shared memory, HBM, and access locality.', zh: 'Cache、寄存器、shared memory、HBM 与访问局部性。' } },
  { id: 'occupancy', kind: 'concept', x: 320, y: 595, label: { en: 'Occupancy', zh: 'Occupancy' }, summary: { en: 'Active warps are constrained by registers, shared memory, and block limits.', zh: '活跃 warp 受寄存器、shared memory 与 block 限制。' } },
  { id: 'raii', kind: 'concept', x: 605, y: 335, label: { en: 'RAII / ownership', zh: 'RAII / 所有权' }, summary: { en: 'Tie resource lifetime to scope and make ownership explicit.', zh: '把资源生命周期绑定到作用域并明确所有权。' } },
  { id: 'polymorphism', kind: 'concept', x: 775, y: 465, label: { en: 'Virtual / vtable', zh: 'Virtual / vtable' }, summary: { en: 'Understand dynamic dispatch, object layout, and its cost model.', zh: '理解动态派发、对象布局及其成本。' } },
  { id: 'memory-model', kind: 'concept', x: 605, y: 595, label: { en: 'C++ memory model', zh: 'C++ memory model' }, summary: { en: 'Reason about data races, atomics, locks, and happens-before.', zh: '分析数据竞争、atomic、锁与 happens-before。' } },
  { id: 'gemm', kind: 'concept', x: 890, y: 335, label: { en: 'GEMM / convolution', zh: 'GEMM / 卷积' }, summary: { en: 'The recurring bridge from mathematical work to kernel and hardware mapping.', zh: '从数学计算连接到 kernel 与硬件映射的核心桥梁。' } },
  { id: 'formats', kind: 'concept', x: 1060, y: 465, label: { en: 'FP formats / quantization', zh: 'FP 格式 / 量化' }, summary: { en: 'Trade accuracy, range, throughput, and memory traffic.', zh: '权衡精度、范围、吞吐与内存流量。' } },
  { id: 'attention', kind: 'concept', x: 890, y: 595, label: { en: 'Attention / KV cache', zh: 'Attention / KV cache' }, summary: { en: 'Separate compute cost from the movement and storage of attention state.', zh: '区分 attention 计算成本与状态的移动和存储。' } },
  { id: 'os', kind: 'concept', x: 1175, y: 335, label: { en: 'Process / thread / VM', zh: '进程 / 线程 / VM' }, summary: { en: 'User/kernel boundaries, address spaces, scheduling, and memory.', zh: '用户态/内核态、地址空间、调度与内存。' } },
  { id: 'network', kind: 'concept', x: 1345, y: 465, label: { en: 'TCP / DMA / interrupt', zh: 'TCP / DMA / 中断' }, summary: { en: 'Trace data movement from network protocol to device and memory.', zh: '追踪数据从网络协议到设备与内存的移动。' } },
  { id: 'collectives', kind: 'concept', x: 1175, y: 595, label: { en: 'NCCL / collectives', zh: 'NCCL / collective' }, summary: { en: 'Connect all-reduce and communication topology to distributed training.', zh: '把 all-reduce、通信拓扑与分布式训练连接起来。' } },
  { id: 'case-gemm', kind: 'case', x: 90, y: 785, label: { en: 'Naive → tiled GEMM', zh: 'Naive → tiled GEMM' }, summary: { en: 'Follow mapping, reuse, bank conflicts, registers, and Roofline.', zh: '追踪映射、复用、bank conflict、寄存器与 Roofline。' } },
  { id: 'case-reduction', kind: 'case', x: 330, y: 900, label: { en: 'Parallel reduction', zh: '并行 reduction' }, summary: { en: 'Balance work, synchronization, memory traffic, and numerical order.', zh: '平衡工作量、同步、内存流量与数值顺序。' } },
  { id: 'case-attention', kind: 'case', x: 570, y: 785, label: { en: 'FlashAttention traffic', zh: 'FlashAttention 流量' }, summary: { en: 'Explain why tiling and fusion reduce HBM traffic.', zh: '解释 tiling 与 fusion 如何减少 HBM 流量。' } },
  { id: 'case-inference', kind: 'case', x: 810, y: 900, label: { en: 'LLM inference path', zh: 'LLM 推理路径' }, summary: { en: 'Relate prefill, decode, KV cache, batching, and latency.', zh: '连接 prefill、decode、KV cache、batching 与延迟。' } },
  { id: 'case-multigpu', kind: 'case', x: 1050, y: 785, label: { en: 'Multi-GPU scaling', zh: '多 GPU 扩展' }, summary: { en: 'Diagnose why communication prevents linear speedup.', zh: '分析通信为什么阻止线性加速。' } },
  { id: 'case-memmove', kind: 'case', x: 1290, y: 900, label: { en: 'Overlapping copy', zh: '重叠内存复制' }, summary: { en: 'Use memory overlap to reason about copy direction and semantics.', zh: '用内存重叠理解复制方向与语义。' } },
  { id: 'source-hpc-jd', kind: 'source', x: 35, y: 1040, label: { en: 'HPC / DL JD', zh: 'HPC / DL JD' }, summary: { en: 'Role requirements: GPU computing, profiling, and performance modelling.', zh: '岗位要求：GPU computing、profiling 与性能建模。' } },
  { id: 'source-arch-jd', kind: 'source', x: 215, y: 1040, label: { en: 'GPU Architecture JD', zh: 'GPU Architecture JD' }, summary: { en: 'Role requirements: memory systems, simulation, compilers, and AI workloads.', zh: '岗位要求：memory systems、simulation、compiler 与 AI workload。' } },
  { id: 'source-devtech', kind: 'source', x: 395, y: 1040, label: { en: 'DevTech interview', zh: 'DevTech 面经' }, summary: { en: 'Personal report covering CUDA, performance, C++, and distributed GEMM.', zh: '个人回忆：CUDA、性能、C++ 与分布式 GEMM。' } },
  { id: 'source-infra', kind: 'source', x: 575, y: 1040, label: { en: 'AI Infra interview', zh: 'AI Infra 面经' }, summary: { en: 'Personal report covering system calls, TCP, BST, and overlapping copy.', zh: '个人回忆：系统调用、TCP、BST 与重叠复制。' } },
  { id: 'source-software', kind: 'source', x: 755, y: 1040, label: { en: 'Software / C++ reports', zh: 'Software / C++ 面经' }, summary: { en: 'Reports mentioning move semantics, mutexes, DMA, and networking.', zh: '涉及 move semantics、mutex、DMA 与 networking 的回忆。' } },
  { id: 'source-hackerrank', kind: 'source', x: 935, y: 1040, label: { en: 'Historical HackerRank', zh: '历史 HackerRank' }, summary: { en: 'Historical test format only; it does not establish the current exam format.', zh: '只记录历史测验形式，不能证明当前考试形式。' } },
  { id: 'source-grad', kind: 'source', x: 1115, y: 1040, label: { en: 'Graduate reports', zh: '校招生经验' }, summary: { en: 'Historical recruiting process and role-related fundamentals.', zh: '历史招聘流程与岗位基础知识。' } },
  { id: 'source-synthesis', kind: 'source', x: 1295, y: 1040, label: { en: 'User synthesis', zh: '用户整理摘要' }, summary: { en: 'Navigation aid assembled from the supplied research; verify against original sources.', zh: '根据用户提供资料整理的导航节点，需回到原始来源核验。' } },
];

const edges: GraphEdge[] = [
  ...['hpc', 'arch', 'cpp', 'ai', 'infra'].map((id) => ({ from: 'hub', to: id })),
  ...[
    ['hpc', 'scaling'], ['hpc', 'roofline'], ['hpc', 'decomp'],
    ['arch', 'simt'], ['arch', 'memory'], ['arch', 'occupancy'],
    ['cpp', 'raii'], ['cpp', 'polymorphism'], ['cpp', 'memory-model'],
    ['ai', 'gemm'], ['ai', 'formats'], ['ai', 'attention'],
    ['infra', 'os'], ['infra', 'network'], ['infra', 'collectives'],
    ['scaling', 'decomp'], ['roofline', 'gemm'], ['memory', 'roofline'], ['memory', 'occupancy'],
    ['simt', 'occupancy'], ['raii', 'memory-model'], ['memory-model', 'os'],
    ['gemm', 'formats'], ['gemm', 'attention'], ['attention', 'collectives'], ['network', 'collectives'],
    ['case-gemm', 'gemm'], ['case-gemm', 'memory'], ['case-gemm', 'roofline'], ['case-gemm', 'occupancy'],
    ['case-reduction', 'decomp'], ['case-reduction', 'memory-model'], ['case-reduction', 'occupancy'],
    ['case-attention', 'attention'], ['case-attention', 'memory'], ['case-attention', 'formats'],
    ['case-inference', 'attention'], ['case-inference', 'collectives'], ['case-inference', 'network'],
    ['case-multigpu', 'scaling'], ['case-multigpu', 'collectives'], ['case-multigpu', 'decomp'],
    ['case-memmove', 'memory-model'], ['case-memmove', 'os'], ['case-memmove', 'network'],
    ['source-hpc-jd', 'hpc'], ['source-hpc-jd', 'roofline'],
    ['source-arch-jd', 'arch'], ['source-arch-jd', 'memory'],
    ['source-devtech', 'hpc'], ['source-devtech', 'arch'], ['source-devtech', 'cpp'], ['source-devtech', 'case-gemm'],
    ['source-infra', 'infra'], ['source-infra', 'os'], ['source-infra', 'network'], ['source-infra', 'case-memmove'],
    ['source-software', 'cpp'], ['source-software', 'infra'], ['source-software', 'memory-model'],
    ['source-hackerrank', 'cpp'], ['source-grad', 'hub'], ['source-synthesis', 'hub'],
  ].map(([from, to]) => ({ from, to })),
];

const kindLabel: Record<Kind, { en: string; zh: string }> = {
  hub: { en: 'hub', zh: '总览' },
  direction: { en: 'direction', zh: '方向' },
  concept: { en: 'concept', zh: '概念' },
  case: { en: 'analysis case', zh: '分析案例' },
  source: { en: 'source', zh: '来源' },
};

const filterLabel: Record<Filter, { en: string; zh: string }> = {
  all: { en: 'All', zh: '全部' },
  direction: { en: 'Directions', zh: '方向' },
  concept: { en: 'Concepts', zh: '概念' },
  case: { en: 'Cases', zh: '案例' },
  source: { en: 'Sources', zh: '来源' },
};

const nodeById = new Map(nodes.map((node) => [node.id, node]));

const coreStudySet = new Set<string>(coreStudySequence);
const studyStorageKey = 'nvidia.study.v2';


function center(node: GraphNode) {
  return { x: node.x + 77, y: node.y + 24 };
}

function nodeIsConnected(nodeId: string, selectedId: string) {
  return selectedId === nodeId || edges.some((edge) => (edge.from === nodeId && edge.to === selectedId) || (edge.to === nodeId && edge.from === selectedId));
}

function fallbackContent(node: GraphNode): NodeContent {
  return {
    takeaway: { en: node.summary.en, zh: node.summary.zh },
    keyPoints: { en: [node.summary.en], zh: [node.summary.zh] },
    definition: { en: node.summary.en, zh: node.summary.zh },
    mechanism: { en: ['Use the connected nodes to expand this topic.'], zh: ['沿着相邻节点继续展开这个主题。'] },
    applications: { en: ['Interview explanation and review.'], zh: ['面试解释与复习。'] },
    caseStudy: {
      title: { en: 'Study case', zh: '学习案例' },
      context: { en: node.summary.en, zh: node.summary.zh },
      lesson: { en: 'Verify the mechanism against a primary source.', zh: '回到原始来源验证机制。' },
    },
    tradeoffs: { en: ['Depth versus review speed.'], zh: ['深度与复习速度之间的权衡。'] },
    interview: { en: ['Explain the concept in 60 seconds.'], zh: ['用 60 秒讲清这个概念。'] },
    pitfalls: { en: ['Do not treat a summary as a complete definition.'], zh: ['不要把摘要当成完整定义。'] },
    prerequisites: { en: [], zh: [] },
    evidence: [],
    confidence: 'UNREVIEWED',
  };
}

function LegacyNvidiaGraph({ language }: { language: Language }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState('hub');
  const [detailTab, setDetailTab] = useState<DetailTab>('core');
  const selected = nodeById.get(selectedId) ?? nodes[0];
  const content = nodeContent[selected.id] ?? fallbackContent(selected);
  const related = useMemo(() => edges
    .filter((edge) => edge.from === selected.id || edge.to === selected.id)
    .map((edge) => nodeById.get(edge.from === selected.id ? edge.to : edge.from))
    .filter((node): node is GraphNode => Boolean(node)), [selected.id]);

  const onNodeKeyDown = (event: KeyboardEvent, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSelectedId(id);
    }
  };

  return (
    <div class="nvidia-graph" aria-label={language === 'zh' ? 'NVIDIA 面试知识图谱' : 'NVIDIA interview knowledge graph'}>
      <div class="nvidia-graph__toolbar">
        <div class="nvidia-graph__legend" aria-label={language === 'zh' ? '节点类型筛选' : 'Filter node types'}>
          {(Object.keys(filterLabel) as Filter[]).map((value) => (
            <button
              type="button"
              class={`nvidia-graph__filter ${filter === value ? 'nvidia-graph__filter--active' : ''}`}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {filterLabel[value][language]}
            </button>
          ))}
        </div>
        <span class="nvidia-graph__hint">
          {language === 'zh' ? '点击节点查看摘要和相邻关系' : 'Select a node to inspect its summary and neighbours'}
        </span>
      </div>

      <div class="nvidia-graph__viewport">
        <svg class="nvidia-graph__svg" viewBox="0 0 1500 1115" role="img" aria-labelledby="nvidia-graph-title nvidia-graph-description">
          <title id="nvidia-graph-title">{language === 'zh' ? 'NVIDIA 面试知识图谱' : 'NVIDIA interview knowledge graph'}</title>
          <desc id="nvidia-graph-description">{language === 'zh' ? '从面试目标连接到五个方向、共享概念、分析案例和来源。' : 'The interview target connects to five directions, shared concepts, analysis cases, and sources.'}</desc>
          <g class="nvidia-graph__edges" aria-hidden="true">
            {edges.map((edge) => {
              const from = nodeById.get(edge.from);
              const to = nodeById.get(edge.to);
              if (!from || !to) return null;
              const a = center(from);
              const b = center(to);
              const active = nodeIsConnected(edge.from, selected.id) && nodeIsConnected(edge.to, selected.id);
              return <line class={active ? 'nvidia-graph__edge nvidia-graph__edge--active' : 'nvidia-graph__edge'} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
            })}
          </g>
          <g class="nvidia-graph__nodes">
            {nodes.map((node) => {
              const matchesFilter = filter === 'all' || node.kind === filter || node.kind === 'hub';
              const connected = nodeIsConnected(node.id, selected.id);
              const className = [
                'nvidia-graph__node',
                `nvidia-graph__node--${node.kind}`,
                connected ? 'nvidia-graph__node--connected' : '',
                matchesFilter ? '' : 'nvidia-graph__node--dimmed',
              ].filter(Boolean).join(' ');
              return (
                <g
                  class={className}
                  transform={`translate(${node.x} ${node.y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${node.label[language]}: ${node.summary[language]}`}
                  aria-pressed={selected.id === node.id}
                  onClick={() => setSelectedId(node.id)}
                  onKeyDown={(event) => onNodeKeyDown(event, node.id)}
                >
                  <rect width="154" height="48" rx="9" />
                  <text x="77" y="20" text-anchor="middle">{node.label[language]}</text>
                  <text class="nvidia-graph__node-kind" x="77" y="37" text-anchor="middle">{kindLabel[node.kind][language]}</text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <aside class="nvidia-graph__details" aria-live="polite">
        <div class="nvidia-graph__details-summary">
          <span class="nvidia-graph__details-kind">{kindLabel[selected.kind][language]}</span>
          <h3>{selected.label[language]}</h3>
          <p>{selected.summary[language]}</p>
          <div class="nvidia-graph__confidence">
            {language === 'zh' ? '证据等级' : 'Evidence'}: {content.confidence}
          </div>
        </div>

        <div class="nvidia-graph__details-body">
          <div class="nvidia-graph__tabs" role="tablist" aria-label={language === 'zh' ? '节点内容层级' : 'Node content layers'}>
            {(['core', 'mechanism', 'interview'] as DetailTab[]).map((value) => (
              <button
                type="button"
                role="tab"
                aria-selected={detailTab === value}
                class={detailTab === value ? 'nvidia-graph__tab nvidia-graph__tab--active' : 'nvidia-graph__tab'}
                onClick={() => setDetailTab(value)}
              >
                {value === 'core' ? (language === 'zh' ? '核心' : 'Core') : value === 'mechanism' ? (language === 'zh' ? '机制与应用' : 'Mechanism') : (language === 'zh' ? '面试扩展' : 'Interview')}
              </button>
            ))}
          </div>

          {detailTab === 'core' && (
            <div class="nvidia-graph__content-grid">
              <section>
                <h4>{language === 'zh' ? '一句话结论' : 'One-line takeaway'}</h4>
                <p>{content.takeaway[language]}</p>
              </section>
              <section>
                <h4>{language === 'zh' ? '核心记忆点' : 'Key takeaways'}</h4>
                <ul>{content.keyPoints[language].map((item) => <li>{item}</li>)}</ul>
              </section>
              <section>
                <h4>{language === 'zh' ? '概念定义' : 'Definition'}</h4>
                <p>{content.definition[language]}</p>
              </section>
              <section>
                <h4>{language === 'zh' ? '应用' : 'Applications'}</h4>
                <ul>{content.applications[language].map((item) => <li>{item}</li>)}</ul>
              </section>
              <section class="nvidia-graph__case">
                <h4>{language === 'zh' ? '真实案例' : 'Real-world case'}</h4>
                <strong>{content.caseStudy.title[language]}</strong>
                <p>{content.caseStudy.context[language]}</p>
                <p><em>{content.caseStudy.lesson[language]}</em></p>
              </section>
            </div>
          )}

          {detailTab === 'mechanism' && (
            <div class="nvidia-graph__content-grid">
              <section>
                <h4>{language === 'zh' ? '工作机制' : 'How it works'}</h4>
                <ol>{content.mechanism[language].map((item) => <li>{item}</li>)}</ol>
              </section>
              <section>
                <h4>{language === 'zh' ? '优势、局限与权衡' : 'Trade-offs'}</h4>
                <ul>{content.tradeoffs[language].map((item) => <li>{item}</li>)}</ul>
              </section>
              <section>
                <h4>{language === 'zh' ? '前置知识' : 'Prerequisites'}</h4>
                <ul>{content.prerequisites[language].map((item) => <li>{item}</li>)}</ul>
              </section>
              <section>
                <h4>{language === 'zh' ? '证据与来源' : 'Evidence'}</h4>
                {content.evidence.length ? (
                  <ul class="nvidia-graph__sources">
                    {content.evidence.map((source) => <li>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.label[language]}</a> : source.label[language]} <span>({source.level})</span></li>)}
                  </ul>
                ) : <p>{language === 'zh' ? '暂无独立来源；请把它当作待复核的综合整理。' : 'No independent source attached; treat this as synthesis pending review.'}</p>}
              </section>
            </div>
          )}

          {detailTab === 'interview' && (
            <div class="nvidia-graph__content-grid">
              <section>
                <h4>{language === 'zh' ? '常见面试问法' : 'Interview angles'}</h4>
                <ul>{content.interview[language].map((item) => <li>{item}</li>)}</ul>
              </section>
              <section>
                <h4>{language === 'zh' ? '易混概念 / 常见误区' : 'Common pitfalls'}</h4>
                <ul>{content.pitfalls[language].map((item) => <li>{item}</li>)}</ul>
              </section>
              <section>
                <h4>{language === 'zh' ? '相邻节点' : 'Connected nodes'}</h4>
                <div class="nvidia-graph__related">
                  {related.map((node) => (
                    <button type="button" onClick={() => { setSelectedId(node.id); setDetailTab('core'); }}>{node.label[language]}</button>
                  ))}
                </div>
              </section>
              <section>
                <h4>{language === 'zh' ? '自测' : 'Self-check'}</h4>
                <ul>
                  <li>{language === 'zh' ? '能否在 60 秒内先给结论？' : 'Can you lead with the conclusion in 60 seconds?'}</li>
                  <li>{language === 'zh' ? '能否说明一个权衡和一个反例？' : 'Can you state one trade-off and one counterexample?'}</li>
                  <li>{language === 'zh' ? '能否指出证据等级？' : 'Can you identify the evidence level?'}</li>
                </ul>
              </section>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

type StudyState = {
  selectedId: string;
  checkedIds: string[];
  deferredIds: string[];
};

function asNodeId(value: unknown): string | null {
  return typeof value === 'string' && nodeById.has(value) ? value : null;
}

function sanitizeNodeIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(asNodeId).filter((id): id is string => Boolean(id))));
}

function readStoredStudyState(): Partial<StudyState> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(studyStorageKey);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const record = parsed as Record<string, unknown>;
    const selectedId = asNodeId(record.selectedId);
    return {
      ...(selectedId ? { selectedId } : {}),
      checkedIds: sanitizeNodeIds(record.checkedIds),
      deferredIds: sanitizeNodeIds(record.deferredIds),
    };
  } catch {
    return {};
  }
}

function readHashNodeId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return asNodeId(new URLSearchParams(window.location.hash.replace(/^#/, '')).get('node'));
  } catch {
    return null;
  }
}

function getInitialStudyState(): StudyState {
  const stored = readStoredStudyState();
  return {
    selectedId: readHashNodeId() ?? stored.selectedId ?? 'hub',
    checkedIds: stored.checkedIds ?? [],
    deferredIds: stored.deferredIds ?? [],
  };
}

function replaceNodeHash(id: string) {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    url.hash = `node=${encodeURIComponent(id)}`;
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // Selection remains usable if history is unavailable.
  }
}

function findNextUncheckedId(currentId: string, checkedIds: string[]): string | null {
  const checked = new Set(checkedIds);
  const currentIndex = coreStudySequence.findIndex((id) => id === currentId);
  const ordered = currentIndex >= 0
    ? [...coreStudySequence.slice(currentIndex + 1), ...coreStudySequence.slice(0, currentIndex + 1)]
    : [...coreStudySequence];
  return ordered.find((id) => !checked.has(id)) ?? null;
}


export function NvidiaGraph({ language }: { language: Language }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [studyState, setStudyState] = useState<StudyState>(getInitialStudyState);
  const studyRef = useRef<HTMLElement | null>(null);
  const hasMountedRef = useRef(false);
  const { selectedId, checkedIds, deferredIds } = studyState;
  const selected = nodeById.get(selectedId) ?? nodes[0];
  const content = nodeContent[selected.id] ?? fallbackContent(selected);
  const lesson = teachingLessons[selected.id];
  const related = useMemo(() => edges
    .filter((edge) => edge.from === selected.id || edge.to === selected.id)
    .map((edge) => nodeById.get(edge.from === selected.id ? edge.to : edge.from))
    .filter((node): node is GraphNode => Boolean(node)), [selected.id]);
  const checkedCoreCount = coreStudySequence.filter((id) => checkedIds.includes(id)).length;
  const currentCoreIndex = coreStudySequence.findIndex((id) => id === selected.id);
  const currentIsChecked = checkedIds.includes(selected.id);
  const currentIsCore = coreStudySet.has(selected.id);
  const firstUncheckedId = coreStudySequence.find((id) => !checkedIds.includes(id)) ?? null;
  const nextUncheckedId = findNextUncheckedId(selected.id, checkedIds);
  const nextActionId = currentIsCore && !currentIsChecked ? null : nextUncheckedId;
  const nextNode = nextActionId ? nodeById.get(nextActionId) : null;
  const isDeferred = deferredIds.includes(selected.id);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(studyStorageKey, JSON.stringify(studyState));
    } catch {
      // Private browsing or a full storage quota should not block studying.
    }
  }, [studyState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHashChange = () => {
      const hashId = readHashNodeId();
      if (!hashId) return;
      setStudyState((state) => state.selectedId === hashId ? state : { ...state, selectedId: hashId });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    const scrollToStudy = () => {
      const target = studyRef.current;
      if (target && typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(scrollToStudy);
    else scrollToStudy();
  }, [selectedId]);

  const selectNode = (id: string) => {
    if (!nodeById.has(id)) return;
    replaceNodeHash(id);
    setStudyState((state) => state.selectedId === id ? state : { ...state, selectedId: id });
  };

  const scrollToStudy = () => {
    const target = studyRef.current;
    if (target && typeof target.scrollIntoView === 'function') target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const onNodeKeyDown = (event: KeyboardEvent, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectNode(id);
    }
  };

  const toggleChecked = () => {
    setStudyState((state) => ({
      ...state,
      checkedIds: state.checkedIds.includes(selected.id)
        ? state.checkedIds.filter((id) => id !== selected.id)
        : [...state.checkedIds, selected.id],
    }));
  };

  const toggleDeferred = () => {
    setStudyState((state) => ({
      ...state,
      deferredIds: state.deferredIds.includes(selected.id)
        ? state.deferredIds.filter((id) => id !== selected.id)
        : [...state.deferredIds, selected.id],
    }));
  };

  const continueStudy = () => {
    if (selected.id === 'hub' && firstUncheckedId) selectNode(firstUncheckedId);
    else scrollToStudy();
  };

  const checkQuestionId = `nvidia-study-check-question-${selected.id}`;
  const focusLabel = currentIsCore
    ? (language === 'zh' ? `核心单元 ${currentCoreIndex + 1}/${coreStudySequence.length}` : `Core unit ${currentCoreIndex + 1}/${coreStudySequence.length}`)
    : (language === 'zh' ? '导航节点 · 不计入核心进度' : 'Navigation node · outside core progress');

  return (
    <div class="nvidia-graph" aria-label={language === 'zh' ? 'NVIDIA 面试知识图谱与连续学习视图' : 'NVIDIA interview knowledge graph and study view'}>
      <section class="nvidia-graph__study" ref={studyRef} aria-labelledby="nvidia-study-title">
        <div class="nvidia-graph__study-top">
          <div class="nvidia-graph__study-meta">
            <span class="nvidia-graph__focus-badge">{focusLabel}</span>
            <span class="nvidia-graph__details-kind">{kindLabel[selected.kind][language]}</span>
            {/* This dynamic widget title is not a static lesson-TOC entry. */}
            <h2><span id="nvidia-study-title">{selected.label[language]}</span></h2>
          </div>
          <div class="nvidia-graph__study-progress" role="progressbar" aria-valuemin={0} aria-valuemax={coreStudySequence.length} aria-valuenow={checkedCoreCount} aria-valuetext={language === 'zh' ? `已检查 ${checkedCoreCount} 个，共 ${coreStudySequence.length} 个核心单元` : `${checkedCoreCount} of ${coreStudySequence.length} core units checked`}>
            <strong>{language === 'zh' ? `核心路线 ${checkedCoreCount}/${coreStudySequence.length}` : `Core path ${checkedCoreCount}/${coreStudySequence.length}`}</strong>
            <span>{language === 'zh' ? '方向与来源节点用于导航，不计入进度。' : 'Directions and sources are navigation only.'}</span>
            <span class="nvidia-graph__study-progress-track" aria-hidden="true"><span style={`width: ${(checkedCoreCount / coreStudySequence.length) * 100}%`} /></span>
          </div>
          <div class="nvidia-graph__study-actions">
            <button type="button" class="nvidia-graph__study-continue" aria-label={language === 'zh' ? (selected.id === 'hub' ? '开始核心学习' : '继续上次学习') : (selected.id === 'hub' ? 'Start the core study path' : 'Continue the last study position')} onClick={continueStudy}>
              {language === 'zh' ? (selected.id === 'hub' ? '开始核心学习' : '继续上次学习') : (selected.id === 'hub' ? 'Start core path' : 'Continue last session')}
            </button>
            <button type="button" class="nvidia-graph__study-next-action" aria-label={nextNode ? (language === 'zh' ? `下一项：${nextNode.label.zh}` : `Next: ${nextNode.label.en}`) : (language === 'zh' ? '当前节点完成后才能进入下一项' : 'Check the current node before moving on')} disabled={!nextNode} onClick={() => nextNode && selectNode(nextNode.id)}>
              {nextNode ? (language === 'zh' ? `下一项：${nextNode.label.zh}` : `Next: ${nextNode.label.en}`) : (language === 'zh' ? '请先检查本节' : 'Check this unit first')}
            </button>
            <button type="button" class="nvidia-graph__study-defer" aria-label={language === 'zh' ? (isDeferred ? '取消之后深挖' : '加入之后深挖') : (isDeferred ? 'Remove from later deep dive' : 'Save for later deep dive')} aria-pressed={isDeferred} onClick={toggleDeferred}>
              {language === 'zh' ? (isDeferred ? '已加入深挖' : '之后深挖') : (isDeferred ? 'Saved for deep dive' : 'Deep dive later')}
            </button>
          </div>
        </div>

        <div class="nvidia-graph__study-main">
          <div class="nvidia-graph__study-side" aria-label={language === 'zh' ? '本节学习状态' : 'Current study status'}>
            <span class="nvidia-graph__study-status" role="status">
              {currentIsChecked ? (language === 'zh' ? '本节已检查' : 'Checked') : (language === 'zh' ? '本节待检查' : 'Not checked yet')}
            </span>
            {isDeferred && <span class="nvidia-graph__study-status">{language === 'zh' ? '已加入之后深挖' : 'Queued for deep dive'}</span>}
          </div>

          <div class="nvidia-graph__study-content" key={selected.id}>
            {lesson ? <TeachingView
              key={`${selected.id}-${language}`}
              lesson={lesson}
              nodeId={selected.id}
              language={language}
              onSelectNode={selectNode}
              labelForNode={(id) => nodeById.get(id)?.label[language] ?? id}
            /> : <>
            <section class="nvidia-graph__study-section">
              <h3>{language === 'zh' ? '本节目标' : 'Goal for this unit'}</h3>
              <p>{selected.summary[language]}</p>
              <h3>{language === 'zh' ? '一句话结论' : 'One-line conclusion'}</h3>
              <p>{content.takeaway[language]}</p>
            </section>

            <section class="nvidia-graph__study-section">
              <h3>{language === 'zh' ? '核心记忆点' : 'Core memory points'}</h3>
              <ul class="nvidia-graph__compact-list">{content.keyPoints[language].map((item) => <li key={item}>{item}</li>)}</ul>
            </section>

            <section class="nvidia-graph__study-section">
              <h3>{language === 'zh' ? '概念定义' : 'Definition'}</h3>
              <p>{content.definition[language]}</p>
            </section>

            <section class="nvidia-graph__study-section">
              <h3>{language === 'zh' ? '工作机制' : 'How it works'}</h3>
              <ol class="nvidia-graph__compact-list">{content.mechanism[language].map((item) => <li key={item}>{item}</li>)}</ol>
            </section>

            <section class="nvidia-graph__study-section">
              <h3>{language === 'zh' ? '应用与真实案例' : 'Applications and real-world case'}</h3>
              <ul class="nvidia-graph__compact-list">{content.applications[language].map((item) => <li key={item}>{item}</li>)}</ul>
              <div class="nvidia-graph__case">
                <strong>{content.caseStudy.title[language]}</strong>
                <p>{content.caseStudy.context[language]}</p>
                <p><em>{content.caseStudy.lesson[language]}</em></p>
              </div>
            </section>

            <section class="nvidia-graph__study-section">
              <h3>{language === 'zh' ? '权衡、边界与前置知识' : 'Trade-offs, boundaries, and prerequisites'}</h3>
              <ul class="nvidia-graph__compact-list">{content.tradeoffs[language].map((item) => <li key={item}>{item}</li>)}</ul>
              {content.prerequisites[language].length > 0 && (
                <>
                  <h4>{language === 'zh' ? '前置知识' : 'Prerequisites'}</h4>
                  <ul class="nvidia-graph__compact-list">{content.prerequisites[language].map((item) => <li key={item}>{item}</li>)}</ul>
                </>
              )}
              <h4>{language === 'zh' ? '常见误区' : 'Common pitfalls'}</h4>
              <ul class="nvidia-graph__compact-list">{content.pitfalls[language].map((item) => <li key={item}>{item}</li>)}</ul>
            </section>

            <section class="nvidia-graph__study-section">
              <h3>{language === 'zh' ? '证据与来源' : 'Evidence and sources'}</h3>
              <p class="nvidia-graph__confidence">{language === 'zh' ? '证据等级' : 'Evidence level'}: {content.confidence}</p>
              {content.evidence.length ? (
                <ul class="nvidia-graph__sources nvidia-graph__compact-list">
                  {content.evidence.map((source) => <li key={`${source.label.en}-${source.level}`}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.label[language]}</a> : source.label[language]} <span>({source.level})</span></li>)}
                </ul>
              ) : <p>{language === 'zh' ? '暂无独立来源；请把它当作待复核的综合整理。' : 'No independent source attached; treat this as synthesis pending review.'}</p>}
            </section>

            </>}
            {lesson && currentIsCore && <section class="nvidia-graph__study-section">
                <p>{language === 'zh' ? '能独立说明推导与适用边界后，再标记已检查。旧的检查记录仍保留；新版内容可重新自测。' : 'Mark checked after explaining the derivation and its limits independently. Previous check records are preserved; re-test against the new material.'}</p>
                <button type="button" class="nvidia-graph__study-status" aria-label={language === 'zh' ? (currentIsChecked ? '取消标记本节已检查' : '标记本节已检查') : (currentIsChecked ? 'Unmark this unit as checked' : 'Mark this unit as checked')} aria-pressed={currentIsChecked} aria-describedby={checkQuestionId} disabled={!currentIsCore} onClick={toggleChecked}>
                  {currentIsCore ? (currentIsChecked ? (language === 'zh' ? '取消已检查' : 'Unmark checked') : (language === 'zh' ? '标记本节已检查' : 'Mark unit checked')) : (language === 'zh' ? '导航节点不计入核心检查' : 'Navigation node is outside the core checks')}
                </button>
            </section>}

            <section class="nvidia-graph__study-section">
              <h3>{language === 'zh' ? '关联节点' : 'Connected nodes'}</h3>
              <div class="nvidia-graph__related">
                {related.map((node) => (
                  <button type="button" aria-label={language === 'zh' ? `打开关联节点 ${node.label.zh}` : `Open connected node ${node.label.en}`} onClick={() => selectNode(node.id)}>{node.label[language]}</button>
                ))}
              </div>
            </section>

            <section class="nvidia-graph__study-next" aria-label={language === 'zh' ? '学习路线下一项' : 'Next item in the study path'}>
              {nextNode ? (
                <>
                  <strong>{language === 'zh' ? '完成当前节点后，下一项未检查单元' : 'Next unchecked unit after this one'}</strong>
                  <button type="button" aria-label={language === 'zh' ? `打开下一项 ${nextNode.label.zh}` : `Open next item ${nextNode.label.en}`} onClick={() => selectNode(nextNode.id)}>{nextNode.label[language]}</button>
                </>
              ) : checkedCoreCount === coreStudySequence.length ? (
                <p>{language === 'zh' ? '21 个核心单元都已检查。现在可以从“之后深挖”队列或关联案例复测。' : 'All 21 core units are checked. Revisit the deep-dive queue or connected cases.'}</p>
              ) : (
                <p>{language === 'zh' ? '先完成本节自测，再进入下一个未检查单元。' : 'Complete this self-check before moving to the next unchecked unit.'}</p>
              )}
            </section>
          </div>
        </div>
      </section>

      <details class="nvidia-graph__map">
        <summary class="nvidia-graph__map-summary">
          <span>{language === 'zh' ? '打开知识图谱' : 'Open knowledge graph'}</span>
          <span>{language === 'zh' ? '将图谱作为关联导航，不阻塞学习路线' : 'Use the map for navigation without blocking the study path'}</span>
        </summary>
        <div class="nvidia-graph__map-panel">
          <div class="nvidia-graph__toolbar">
            <div class="nvidia-graph__legend" aria-label={language === 'zh' ? '节点类型筛选' : 'Filter node types'}>
              {(Object.keys(filterLabel) as Filter[]).map((value) => (
                <button
                  type="button"
                  class={`nvidia-graph__filter ${filter === value ? 'nvidia-graph__filter--active' : ''}`}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {filterLabel[value][language]}
                </button>
              ))}
            </div>
            <span class="nvidia-graph__hint">
              {language === 'zh' ? '点击或用键盘选择节点；当前节点会同步到学习正文。' : 'Select a node with a pointer or keyboard; the study view stays in sync.'}
            </span>
          </div>

          <div class="nvidia-graph__viewport">
            <svg class="nvidia-graph__svg" viewBox="0 0 1500 1115" role="img" aria-labelledby="nvidia-graph-title nvidia-graph-description">
              <title id="nvidia-graph-title">{language === 'zh' ? 'NVIDIA 面试知识图谱' : 'NVIDIA interview knowledge graph'}</title>
              <desc id="nvidia-graph-description">{language === 'zh' ? '从面试目标连接到五个方向、共享概念、分析案例和来源。' : 'The interview target connects to five directions, shared concepts, analysis cases, and sources.'}</desc>
              <g class="nvidia-graph__edges" aria-hidden="true">
                {edges.map((edge) => {
                  const from = nodeById.get(edge.from);
                  const to = nodeById.get(edge.to);
                  if (!from || !to) return null;
                  const a = center(from);
                  const b = center(to);
                  const active = nodeIsConnected(edge.from, selected.id) && nodeIsConnected(edge.to, selected.id);
                  return <line class={active ? 'nvidia-graph__edge nvidia-graph__edge--active' : 'nvidia-graph__edge'} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
                })}
              </g>
              <g class="nvidia-graph__nodes">
                {nodes.map((node) => {
                  const matchesFilter = filter === 'all' || node.kind === filter || node.kind === 'hub';
                  const connected = nodeIsConnected(node.id, selected.id);
                  const className = [
                    'nvidia-graph__node',
                    `nvidia-graph__node--${node.kind}`,
                    connected ? 'nvidia-graph__node--connected' : '',
                    matchesFilter ? '' : 'nvidia-graph__node--dimmed',
                  ].filter(Boolean).join(' ');
                  return (
                    <g
                      class={className}
                      transform={`translate(${node.x} ${node.y})`}
                      role="button"
                      tabIndex={0}
                      aria-label={`${node.label[language]}: ${node.summary[language]}`}
                      aria-pressed={selected.id === node.id}
                      onClick={() => selectNode(node.id)}
                      onKeyDown={(event) => onNodeKeyDown(event, node.id)}
                    >
                      <rect width="154" height="48" rx="9" />
                      <text x="77" y="20" text-anchor="middle">{node.label[language]}</text>
                      <text class="nvidia-graph__node-kind" x="77" y="37" text-anchor="middle">{kindLabel[node.kind][language]}</text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
        </div>
      </details>
    </div>
  );
}
