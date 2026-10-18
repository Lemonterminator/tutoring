import { t, type TeachingLesson } from './types';

export const architectureLessons: Record<string, TeachingLesson> = {
  decomp: {
    minutes: 45,
    question: t(
      'In the Mie post-processing program, one folder can contain many plumes, each plume can produce several output artifacts, and the GPU and CPU do different parts of the work. What is the useful unit of parallelism, and where must the program still remain ordered?',
      '在 Mie 后处理程序中，一个文件夹可以包含许多 plume，每个 plume 可以产生多个输出文件，而 GPU 与 CPU 负责不同阶段。什么是有用的并行单位，哪些地方仍然必须保持有序？',
    ),
    terms: [
      { name: t('decomposition', '任务分解'), definition: t('Splitting work into units that can run independently or with controlled coordination.', '把工作切分成可以独立运行或通过受控协调运行的单元。') },
      { name: t('granularity', '粒度'), definition: t('The amount of work assigned to one unit; it trades scheduling overhead against load balance.', '分配给一个单元的工作量；它在调度开销与负载均衡之间做权衡。') },
      { name: t('dependency', '依赖'), definition: t('A condition saying that one result, buffer, or stage must be complete before another can safely begin.', '表示某个结果、缓冲区或阶段必须完成后，另一个工作才能安全开始的条件。') },
      { name: t('pipeline', '流水线'), definition: t('Overlapping different stages of different items when each stage has a safe hand-off.', '当每个阶段都能安全交接时，让不同项目的不同阶段重叠执行。') },
      { name: t('merge', '合并'), definition: t('The step that combines partial results or output fragments into a usable result.', '把局部结果或输出片段组合成可用结果的步骤。') },
    ],
    sections: [
      {
        title: t('Start by naming the work units', '先明确工作单元'),
        paragraphs: t([
          'The Mie program has several possible decomposition levels: folder, input file, plume, frame, and output artifact. The source facts do not include measured timings, so they do not prove which level is fastest. They do show that the parent folders and files in the main processing path are handled sequentially, while per-plume work has more independent structure.',
          'A good decomposition question is therefore not “where can I add threads?” It is “which unit has a complete input, a predictable output, and little shared mutable state?” A plume is a plausible unit for CPU metric work because the code submits per-plume metric tasks to a ThreadPoolExecutor. A frame or file may be a better unit for GPU preprocessing only if its buffers and ordering rules are independent.',
        ], [
          'Mie 程序有多个可能的分解层级：文件夹、输入文件、plume、frame 和输出文件。现有事实没有实测时间，因此不能证明哪个层级最快；但可以确认主处理路径中的父文件夹与文件是顺序处理的，而每个 plume 的工作更具有独立结构。',
          '所以好的分解问题不是“哪里能加线程”，而是“哪个单元拥有完整输入、可预测输出，并且几乎不共享可变状态？”plume 适合作为 CPU metric 工作的候选单元，因为代码会把每个 plume 的 metric 任务提交给 ThreadPoolExecutor。GPU 预处理是否适合按 frame 或 file 分解，则取决于其 buffer 与顺序规则是否真正独立。',
        ]),
        checkpoint: t('Can you name the unit, its input, its output, and its shared state before discussing worker count?', '在讨论 worker 数量前，你能否说清单元、输入、输出和共享状态？'),
      },
      {
        title: t('Dependencies define the legal schedule', '依赖关系决定合法调度'),
        paragraphs: t([
          'The observed Mie path explicitly performs cp.asarray for host-to-device transfer and then synchronizes. For metrics, it completes the sequential device-to-host copies for all plumes first, and only then uses the CPU ThreadPoolExecutor to process the returned plume data. Preview preparation calls cp.asnumpy synchronously before the writer submission. These are causal edges, not merely implementation details: a consumer cannot safely use a result before the transfer or preparation it depends on is complete.',
          'The program also has one read-prefetch worker and three background writer workers, and it drains all writer futures at the end of the folder. That structure permits overlap between safe stages, but it does not make the whole folder parallel. The final drain is a completion barrier, and the sequential parent traversal can still determine when work enters the system.',
        ], [
          '已知的 Mie 路径会先执行 cp.asarray 完成主机到设备传输，再显式同步。对于 metric，它会先完成所有 plume 的顺序设备到主机回传，然后才用 CPU ThreadPoolExecutor 处理回传的 plume 数据。preview 准备会在提交 writer 前同步调用 cp.asnumpy。这些都是因果边，而不只是实现细节：消费者不能在依赖的传输或准备完成前安全使用结果。',
          '程序还有一个读取预取 worker、三个后台 writer worker，并在文件夹结束时等待所有 writer future。这个结构允许安全阶段重叠，但不会让整个文件夹自动并行。末尾等待是完成屏障，而顺序遍历父目录仍可能决定工作何时进入系统。',
        ]),
        equation: 'usable overlap requires: producer complete → safe hand-off → consumer begins',
        assumptions: t('The stated ordering is treated as a correctness constraint; no timing or queue-depth claim is inferred from the source.', '把已知顺序视为正确性约束；不从源代码推断任何耗时或队列深度。'),
      },
      {
        title: t('Balance work without hiding the bottleneck', '均衡工作，但不要隐藏瓶颈'),
        paragraphs: t([
          'The three writer workers do not imply three times the write throughput. They share storage, serialization, CPU, and possibly memory-bandwidth constraints. Likewise, one prefetch worker may or may not keep the GPU supplied. The right diagnostic is to identify which queue grows, which resource is saturated, and whether a downstream dependency prevents useful overlap.',
          'Granularity controls this trade-off. A task that is too large causes one slow plume or file to leave workers idle. A task that is too small increases submission, synchronization, and bookkeeping overhead. In the current Mie code, the metric pool follows the all-plumes-D2H phase rather than overlapping plume D2H with metric computation. A refactor could change that boundary, but it would need explicit buffer-lifetime and ordering reasoning. The final writer drain is another completion boundary to measure; none of these facts identifies the current bottleneck without timings.',
        ], [
          '三个 writer worker 不代表写出吞吐必然是单 worker 的三倍；它们仍共享存储、序列化、CPU 和可能的内存带宽约束。同样，一个预取 worker 是否能持续供应 GPU 也不能凭数量判断。正确的诊断是观察哪个队列增长、哪个资源饱和，以及下游依赖是否阻止了有用重叠。',
          '粒度控制这个权衡。任务太大时，一个慢 plume 或 file 会让其他 worker 空闲；任务太小时，会增加提交、同步和记账开销。当前 Mie 代码中，metric pool 位于“所有 plume 完成 D2H”之后，而不是让 plume D2H 与 metric 计算重叠。重构可以改变这个边界，但必须明确 buffer 生命周期与顺序。文件夹末尾等待 writer future 是另一个需要测量的完成边界；没有耗时，这些事实都不能确定当前瓶颈。',
        ]),
        equation: 'completion time ≈ critical path + exposed queueing and coordination overhead',
        assumptions: t('The equation is a reasoning model, not a measured performance model for the Mie code.', '该式是推理模型，不是 Mie 代码的实测性能模型。'),
      },
      {
        title: t('Adapt the decomposition vocabulary to LLM systems', '把分解词汇迁移到 LLM 系统'),
        paragraphs: t([
          'Data parallelism (DP) copies a model or replica and divides examples or requests across replicas. Tensor parallelism (TP) splits parts of one operator, such as matrix dimensions, across devices; it therefore creates communication inside the model step. Pipeline parallelism (PP) assigns consecutive model layers to stages and moves activations between stages; it creates stage dependencies and pipeline bubbles.',
          'These are not interchangeable names for “use more GPUs.” DP resembles assigning independent plumes, but batch synchronization can create a merge edge. TP resembles splitting one calculation, but its partial results must communicate within a step. PP resembles the Mie stage pipeline, but its layers are a fixed dependency chain with activation transfers. The analogy helps locate boundaries; it does not claim that the Python Mie program implements any of these LLM strategies or uses multiple GPUs.',
        ], [
          '数据并行（DP）复制模型或副本，把样本或请求分给不同副本。张量并行（TP）把一个算子的一部分，例如矩阵维度，切分到多个设备上，因此在单个模型步骤内部产生通信。流水线并行（PP）把连续模型层分给不同阶段，在阶段之间传递 activation，因此会产生阶段依赖和 pipeline bubble。',
          '这些并不是“使用更多 GPU”的同义词。DP 像分配独立 plume，但 batch 同步可能形成合并边；TP 像切分一次计算，但局部结果必须在步骤内通信；PP 像 Mie 的阶段流水线，但模型层是固定依赖链，并且需要传递 activation。这个类比可以帮助定位边界，却不表示 Mie Python 程序实现了这些 LLM 策略或使用了多 GPU。',
        ]),
        assumptions: t('LLM terms are introduced as transfer concepts; their actual performance depends on topology, batch shape, communication, and runtime behavior.', 'LLM 术语只作为迁移概念引入；实际性能取决于拓扑、batch 形状、通信和 runtime 行为。'),
      },
    ],
    workedExample: {
      title: t('Hypothetical Mie queue schedule', '假设的 Mie 队列调度'),
      assumptions: t('Assume four independent plumes, one prefetch worker, three writer workers, and one CPU metric task per plume. Assume each plume produces one 12 MB NPZ and one 4 MB CSV. These quantities are invented for calculation and are not measured facts about the program.', '假设有四个相互独立的 plume、一个预取 worker、三个 writer worker，以及每个 plume 一个 CPU metric 任务。假设每个 plume 产生一个 12 MB NPZ 和一个 4 MB CSV。这些数量是为计算而编造的示例，不是程序的实测事实。'),
      steps: t([
        'Name the unit: plume. Its input is the plume data; its GPU result must be copied back before the CPU metric task can consume it.',
        'Keep the stated order: cp.asarray and explicit synchronization precede GPU consumption; all sequential per-plume D2H copies finish before the CPU metric pool begins; preview cp.asnumpy precedes its writer submission.',
        'Do not infer D2H/metric overlap from the existence of a pool. In the current path, safe overlap is between the read-prefetch worker, the main path, and submitted writers; a per-plume D2H-to-metric pipeline would be a separate refactor.',
        'Compute output volume: 4 plumes × (12 MB + 4 MB) = 64 MB. This is output volume only; it is not the actual device traffic, because intermediate transfers and repeated reads are not specified.',
        'At folder end, drain every writer future. The schedule is correct only if each future’s buffer remains valid until its writer completes.',
      ], [
        '确定单元：plume。输入是 plume 数据；GPU 结果必须先完成回传，CPU metric 任务才能消费它。',
        '保持已知顺序：cp.asarray 与显式同步先于 GPU 消费；按 plume 顺序的 D2H 全部完成后，CPU metric pool 才开始；preview 的 cp.asnumpy 先于 writer 提交。',
        '不要因为存在线程池就推断 D2H/metric 已经重叠。当前路径中可安全重叠的是读取预取、主路径和已提交 writer；按 plume 把 D2H 与 metric 串成流水线需要另行重构。',
        '计算输出量：4 个 plume ×（12 MB + 4 MB）= 64 MB。这只是输出量，不是真实设备流量，因为中间传输和重复读取没有被指定。',
        '文件夹结束时等待所有 writer future。只有在 writer 完成前对应 buffer 始终有效时，这个调度才正确。',
      ]),
      result: t('The decomposition exposes safe overlap while preserving transfer, metric, and writer dependencies; it does not prove a speedup without measurements.', '该分解在保留传输、metric 和 writer 依赖的同时暴露安全重叠；没有测量就不能证明加速。'),
    },
    transfer: {
      title: t('Transfer to LLM parallelism', '迁移到 LLM 并行'),
      paragraphs: t([
        'Ask the same four questions for an LLM: what is the unit, what data does it own, what must be communicated, and where is the merge or barrier? DP usually owns examples or requests, TP owns tensor slices inside an operator, and PP owns layer stages.',
        'The useful analogy is dependency accounting: a Mie plume result cannot enter CPU metrics before D2H, just as a PP stage cannot consume an activation before the prior stage sends it. The analogy boundary is strict: the Mie source has one GPU path and no claim of distributed LLM execution, while DP/TP/PP add model replicas, tensor collectives, or layer-to-layer activation traffic.',
      ], [
        '对 LLM 也问四个问题：单元是什么、它拥有哪些数据、必须通信什么、哪里发生合并或屏障？DP 通常拥有样本或请求，TP 拥有算子内部的张量切片，PP 拥有模型层阶段。',
        '有用的类比是依赖记账：Mie plume 结果必须先 D2H 才能进入 CPU metric，就像 PP 阶段必须等待前一阶段发送 activation 才能消费。类比边界很严格：Mie 源码只有一条 GPU 路径，并没有分布式 LLM 执行的结论；DP/TP/PP 会额外引入模型副本、张量 collective 或层间 activation 流量。',
      ]),
      boundary: t('Do not infer parallel strategy, scaling, or a bottleneck from the existence of workers alone; measure the critical path, queues, transfers, and synchronization.', '不要仅凭 worker 的存在推断并行策略、扩展性或瓶颈；必须测量关键路径、队列、传输和同步。'),
    },
    checks: [
      {
        question: t('Why is “three writer workers” not enough evidence that writing is the bottleneck or that throughput will triple?', '为什么“三个 writer worker”不足以证明写出是瓶颈，或吞吐会变成三倍？'),
        answer: t('Because workers share downstream limits such as storage bandwidth, serialization, CPU time, memory traffic, and buffer lifetime. The source tells us the worker count and final future drain, but provides no timings or saturation counters.', '因为 worker 仍共享存储带宽、序列化、CPU 时间、内存流量和 buffer 生命周期等下游限制。源代码告诉我们 worker 数量和最后等待 future，但没有提供耗时或饱和计数器。'),
        reasoning: t(['Separate concurrency from capacity.', 'Find the queue or resource that actually limits the critical path.', 'Use measurements before naming the bottleneck.'], ['区分并发度与容量。', '找出真正限制关键路径的队列或资源。', '在命名瓶颈前先测量。']),
        rubric: t(['Full: names at least two shared limits and states that no timing evidence is available.', 'Partial: says “I/O may limit it” without connecting it to measurement.', 'Weak: assumes three workers guarantee three times the throughput.'], ['完整：至少指出两个共享限制，并说明没有耗时证据。', '部分：只说“可能受 I/O 限制”，没有联系测量。', '不足：假设三个 worker 必然带来三倍吞吐。']),
        boundary: t('The answer does not deny possible scaling; it denies that worker count alone proves it.', '这个答案不否认可能存在扩展收益，只是否认 worker 数量本身足以证明收益。'),
      },
      {
        question: t('How do DP, TP, and PP differ when mapped to “independent plumes, one split calculation, and ordered stages”?', '把 DP、TP 和 PP 映射到“独立 plume、一次被切分的计算、顺序阶段”时，它们有什么不同？'),
        answer: t('DP is closest to independent plumes because replicas process separate items, but synchronization or gradient merging can follow. TP splits one operator across devices and communicates partial results within a step. PP assigns ordered layers to stages and passes activations between them.', 'DP 最接近独立 plume，因为不同副本处理不同项目，但之后可能需要同步或梯度合并。TP 把一个算子切分到多个设备，并在单步内通信局部结果。PP 把有序层分给多个阶段，并在阶段之间传递 activation。'),
        reasoning: t(['Classify by ownership of data and work.', 'Identify whether communication is per item, inside an operator, or between ordered stages.', 'Do not collapse all three into generic multi-GPU execution.'], ['按数据与工作的所有权分类。', '判断通信发生在项目之间、算子内部，还是有序阶段之间。', '不要把三者都简化成一般的多 GPU 执行。']),
        rubric: t(['Full: distinguishes all three and names their characteristic communication.', 'Partial: distinguishes two but misses the dependency boundary.', 'Weak: treats DP, TP, and PP as interchangeable.'], ['完整：区分三者，并指出各自特征通信。', '部分：区分两个，但漏掉依赖边界。', '不足：把 DP、TP、PP 当成可互换。']),
        boundary: t('This is a conceptual mapping, not a claim that the Mie Python program implements any LLM parallel strategy.', '这是概念映射，不是声称 Mie Python 程序实现了任何 LLM 并行策略。'),
      },
    ],
    takeaways: t([
      'Decompose around complete work units and explicit dependencies, not around thread count.',
      'A pipeline overlaps safe stages; it does not erase transfer, buffer, merge, or completion barriers.',
      'Use Mie to practise dependency accounting, then distinguish DP, TP, and PP by data ownership and communication boundaries.',
    ], [
      '围绕完整工作单元和明确依赖分解，而不是围绕线程数量分解。',
      '流水线可以重叠安全阶段，但不会消除传输、buffer、合并或完成屏障。',
      '用 Mie 练习依赖记账，再按数据所有权与通信边界区分 DP、TP 和 PP。',
    ]),
    prerequisites: [],
    sources: [
      { title: 'CUDA C++ Programming Guide', url: 'https://docs.nvidia.com/cuda/cuda-programming-guide/', note: t('Supports CUDA execution hierarchy, synchronization, memory, and kernel programming concepts used to reason about decomposition.', '支持用于分析任务分解的 CUDA 执行层次、同步、内存和 kernel 编程概念。') },
      { title: 'Megatron-LM: Training Multi-Billion Parameter Language Models Using Model Parallelism', url: 'https://arxiv.org/abs/1909.08053', note: t('Supports the distinction between data, tensor, and pipeline parallelism as different workload and communication choices.', '支持区分数据、张量和流水线并行，说明它们是不同的 workload 与通信选择。') },
    ],
    visualSpec: t('A causal swimlane: input read → H2D/synchronize → GPU work → per-plume D2H → CPU metric → CSV/NPZ/AVI writer, with a separate completion barrier; annotate DP, TP, and PP as three distinct boundary patterns.', '因果泳道图：读取输入 → H2D/同步 → GPU 工作 → 按 plume 的 D2H → CPU metric → CSV/NPZ/AVI writer，另标出完成屏障；再用三种不同边界标注 DP、TP 和 PP。'),
  },

  memory: {
    minutes: 45,
    question: t(
      'When the Mie code moves an array from CPU to GPU, later copies results back, and prepares previews with cp.asnumpy, how can you tell whether the real cost is capacity, latency, bandwidth, cache locality, or synchronization rather than the array’s nominal size?',
      '当 Mie 代码把数组从 CPU 搬到 GPU、之后再把结果拷回，并用 cp.asnumpy 准备 preview 时，怎样判断真实成本来自容量、延迟、带宽、cache 局部性还是同步，而不是数组名义大小？',
    ),
    terms: [
      { name: t('cache line', 'cache line'), definition: t('The fixed-size unit fetched between a cache and the next memory level; a byte access can bring nearby bytes with it.', 'cache 与下一层内存之间搬运的固定大小单位；一次字节访问可能连同附近字节一起带入。') },
      { name: t('spatial locality', '空间局部性'), definition: t('The tendency to access addresses near one another.', '倾向于访问彼此相近地址的性质。') },
      { name: t('temporal locality', '时间局部性'), definition: t('The tendency to reuse the same data before it is evicted.', '在数据被驱逐前再次使用同一数据的倾向。') },
      { name: t('latency', '延迟'), definition: t('The time before a request begins to deliver a result.', '请求开始交付结果之前所需的时间。') },
      { name: t('bandwidth', '带宽'), definition: t('The rate at which data can be transferred once transfers are in flight.', '传输已经进行时，数据可以被搬运的速率。') },
      { name: t('working set', '工作集'), definition: t('The data actively needed during a time window, including reuse and live intermediates.', '某段时间内实际需要的数据，包括复用数据和仍存活的中间结果。') },
    ],
    sections: [
      {
        title: t('The hierarchy is a set of contracts, not one “memory”', '层次是一组契约，而不是一种“内存”'),
        paragraphs: t([
          'On a typical CPU hierarchy, a load that misses in the core’s L1 is looked up in L2, then often in a shared last-level cache commonly called L3, and then in DRAM if it misses there. The exact levels and sharing are architecture-dependent: some CPUs have different cache organizations, and “shared L3” is not a universal rule. The teaching path is useful because each miss can move the request to a larger, usually slower level.',
          'On a typical NVIDIA GPU, a thread first uses registers; an SM (streaming multiprocessor) schedules its warps and has an SM-local L1 path, while L2 is device-shared before a miss reaches HBM or another device-memory backing store. Shared memory is an explicitly managed block-scoped storage space, not the same thing as L1. Cache scope, inclusivity, and exact paths vary by GPU, so use this as a conditional model rather than a fixed universal diagram.',
        ], [
          '在典型 CPU 层次中，如果某个核心的 L1 未命中，load 会继续查 L2，然后通常查共享的末级 cache（常称 L3），再未命中才到 DRAM。具体层次与共享方式取决于架构：有些 CPU 的组织不同，“共享 L3”不是普遍规则。这个教学路径有用，是因为每次 miss 都可能把请求推向容量更大、通常更慢的层级。',
          '在典型 NVIDIA GPU 上，线程首先使用寄存器；SM（streaming multiprocessor，流式多处理器）调度其 warp，并有 SM 本地的 L1 路径；L2 在设备范围共享，L2 未命中后才到 HBM 或其他 device-memory backing store。shared memory 是显式管理的 block 作用域存储，不等于 L1。cache 作用域、包含关系和具体路径会随 GPU 改变，因此这里是有条件的模型，不是固定普遍图。',
        ]),
        equation: 'closer storage usually lowers latency, but capacity and sharing constraints still apply',
        assumptions: t('The hierarchy is described conceptually; exact sizes, policies, and latencies depend on the CPU or GPU architecture.', '这里描述的是概念层次；具体大小、策略和延迟取决于 CPU 或 GPU 架构。'),
      },
      {
        title: t('Cache lines turn access pattern into traffic', 'cache line 把访问模式变成真实流量'),
        paragraphs: t([
          'A cache normally moves a cache line, not one isolated scalar. Sequential access can use spatial locality because one fetched line contains nearby elements. Reusing a value soon can use temporal locality. A strided or scattered pattern may fetch many lines while using only a small fraction of each, so the array size understates the traffic that matters to the bottleneck.',
          'The same distinction appears on the GPU as coalescing and transaction behavior: adjacent lanes with adjacent addresses can be served more efficiently than lanes scattered across memory. A 4 MB array does not imply exactly 4 MB of traffic. It may be read more than once, fetched in larger line or transaction units, written back, evicted and reloaded, or copied between host and device. Count the path and reuse, not only the allocation size.',
        ], [
          'cache 通常搬运的是 cache line，而不是一个孤立标量。顺序访问可以利用空间局部性，因为一次取入的 line 包含附近元素；短时间内重复使用值可以利用时间局部性。跨步或散乱访问可能取入很多 line，却只使用每条的一小部分，因此数组大小会低估真正限制性能的流量。',
          'GPU 上也有类似区别，表现为 coalescing 和 transaction 行为：相邻 lane 访问相邻地址通常比 lane 分散访问更高效。一个 4 MB 数组不代表流量一定是 4 MB；它可能被多次读取，以更大的 line 或 transaction 单位搬运，被写回、驱逐后再次加载，或在主机与设备之间复制。要统计路径与复用，而不只是分配大小。',
        ]),
        equation: 'actual traffic ≠ array size; actual traffic depends on reuse, line/transaction size, reads, writes, and copies',
        assumptions: t('No Mie counter data is available, so this is a measurement checklist rather than a diagnosis of its bottleneck.', '没有 Mie 计数器数据，因此这里是测量清单，不是对其瓶颈的诊断。'),
      },
      {
        title: t('Capacity, latency, bandwidth, and synchronization are different failures', '容量、延迟、带宽和同步是不同故障'),
        paragraphs: t([
          'Capacity asks whether the live working set fits. Latency asks how long a dependent request waits. Bandwidth asks how much data can pass per unit time once requests are in flight. Synchronization asks whether the program is forced to wait even when hardware could otherwise make progress. A workload can fit in memory yet suffer from latency; it can have enough bandwidth in theory yet waste it through poor locality; it can have fast storage yet stall at an explicit synchronize.',
          'The Mie facts illustrate why the distinction matters. cp.asarray followed by explicit synchronization is a hand-off boundary. Sequential per-plume D2H adds an ordering constraint. cp.asnumpy for preview is synchronous before writer submission. These operations may expose transfer latency or synchronization, but without timings and counters we cannot label the path memory-bound, bandwidth-bound, or latency-bound.',
        ], [
          '容量问的是存活工作集能否放下；延迟问的是依赖请求要等多久；带宽问的是请求在飞行后单位时间能搬多少数据；同步问的是程序是否被迫等待，即使硬件本来可以继续工作。工作集能放下仍可能受延迟影响；理论带宽足够仍可能因局部性差而浪费；存储很快仍可能在显式 synchronize 处停顿。',
          'Mie 的事实说明了这种区分的重要性。cp.asarray 后的显式同步是交接边界；按 plume 顺序的 D2H 增加了顺序约束；preview 的 cp.asnumpy 在提交 writer 前同步完成。这些操作可能暴露传输延迟或同步，但没有耗时与计数器，就不能把这条路径称为 memory-bound、bandwidth-bound 或 latency-bound。',
        ]),
        checkpoint: t('Can you state whether your hypothesis concerns fitting, waiting, moving, or coordinating?', '你的假设针对的是放不下、等待、搬运，还是协调？'),
      },
      {
        title: t('SRAM is not automatic cache, and not every design has the same boundary', 'SRAM 不是自动 cache，也不是所有设计都有相同边界'),
        paragraphs: t([
          'SRAM describes a physical storage technology; it does not by itself say who manages the data, how it is addressed, or whether it behaves as an automatic cache. GPU shared memory is an explicitly managed on-chip storage space, while a hardware cache uses a policy to retain lines without the program naming every line. “Put it in SRAM” is therefore not a complete optimization plan: capacity, layout, synchronization, bank behavior, and movement still matter.',
          'The Cerebras WSE3 and CS-3 example is useful because it makes the boundary visible: the system can use distributed SRAM across systems so model state can be partitioned when it is too large for one system. That does not mean every accelerator has no off-chip memory, nor that SRAM automatically solves capacity or communication. It is an architectural example of changing the storage and partitioning contract.',
        ], [
          'SRAM 描述的是物理存储技术；它本身不说明谁管理数据、如何寻址，也不说明它是否表现为自动 cache。GPU shared memory 是显式管理的片上存储，而硬件 cache 通过策略自动保留 cache line，程序不必命名每一条 line。因此“放进 SRAM”不是完整优化方案：容量、布局、同步、bank 行为和搬运仍然重要。',
          'Cerebras WSE3 与 CS-3 的例子能把边界讲清楚：系统可以在多个系统之间使用分布式 SRAM，让模型状态在单个系统放不下时进行分区。这不表示每个 accelerator 都没有片外内存，也不表示 SRAM 自动解决容量或通信问题；它是一个改变存储与分区契约的架构例子。',
        ]),
        assumptions: t('The Cerebras statement follows the cited official blog’s architectural example; it is not generalized to all accelerators.', 'Cerebras 的表述遵循所引用官方博客的架构例子，不推广到所有 accelerator。'),
      },
    ],
    workedExample: {
      title: t('Hypothetical traffic from a strided read', '假设的跨步读取流量'),
      assumptions: t('Assume a 4 MiB array of 4-byte values, a 64-byte cache line, and a kernel that reads one value every 16 values exactly once. These are invented assumptions, not measured Mie or GPU facts.', '假设有一个包含 4 MiB、每个值 4 字节的数组，cache line 为 64 字节，kernel 每隔 16 个值读取一个值且只读一次。这些是假设的计算条件，不是 Mie 或 GPU 的实测事实。'),
      steps: t([
        'The array contains 4 MiB ÷ 4 bytes = 1,048,576 values.',
        'A 64-byte line contains 64 ÷ 4 = 16 values. Reading every 16th value touches one value in each line.',
        'The useful bytes are 1,048,576 ÷ 16 × 4 bytes = 262,144 bytes = 256 KiB.',
        'If every touched line is fetched once, fetched traffic is approximately 1,048,576 ÷ 16 × 64 bytes = 4 MiB. The useful-to-fetched ratio is 256 KiB ÷ 4 MiB = 1/16.',
        'The result changes if the cache reuses lines, hardware combines requests differently, the access is coalesced across lanes, or the kernel writes and rereads data. Therefore the calculation is a reasoning baseline, not a counter result.',
      ], [
        '数组包含 4 MiB ÷ 4 字节 = 1,048,576 个值。',
        '一条 64 字节 cache line 包含 64 ÷ 4 = 16 个值。每隔 16 个值读取一次时，每条 line 只使用一个值。',
        '有效字节数为 1,048,576 ÷ 16 × 4 字节 = 262,144 字节 = 256 KiB。',
        '如果每条被触及的 line 只取入一次，取入流量约为 1,048,576 ÷ 16 × 64 字节 = 4 MiB。有效字节与取入流量之比为 256 KiB ÷ 4 MiB = 1/16。',
        '如果 cache 复用 line、硬件以不同方式合并请求、lane 访问能够合并，或 kernel 写回并再次读取，结果都会变化。因此这个计算是推理基线，不是计数器结果。',
      ]),
      result: t('Nominal array size and useful bytes are not interchangeable with actual traffic; access pattern and reuse determine the difference.', '数组名义大小和有效字节不能与真实流量互换；访问模式与复用决定两者差异。'),
    },
    transfer: {
      title: t('Transfer memory reasoning to LLMs', '把内存推理迁移到 LLM'),
      paragraphs: t([
        'For an LLM, ask where weights, activations, KV cache, and temporary tiles live at each phase. Prefill may reuse large matrix tiles differently from decode, where reading a growing KV cache can dominate one-token work. The same vocabulary—working set, locality, capacity, latency, bandwidth, and synchronization—helps separate a cache-capacity problem from a transfer or scheduling problem.',
        'The analogy boundary is important: Mie arrays and previews are not LLM weights or KV cache, and the Mie source gives no measured traffic counters. Use the code as a concrete exercise in tracing ownership and copies, then measure the LLM runtime’s actual memory path before claiming a bottleneck.',
      ], [
        '对 LLM，要问每个阶段的 weights、activations、KV cache 和临时 tile 位于哪一层。prefill 可能以一种方式复用大型矩阵 tile，而 decode 可能主要读取不断增长的 KV cache，使单 token 工作被读取成本主导。同样的词汇——工作集、局部性、容量、延迟、带宽和同步——可以帮助区分 cache 容量问题、传输问题和调度问题。',
        '类比边界很重要：Mie 数组与 preview 不是 LLM weights 或 KV cache，Mie 源码也没有提供真实流量计数器。可以用它练习追踪所有权与复制，但在声称 LLM 瓶颈前，仍要测量 runtime 的真实内存路径。',
      ]),
      boundary: t('Do not call a workload memory-bound from tensor size or from the existence of a copy; use traffic, stalls, achieved bandwidth, and timing evidence.', '不要仅凭张量大小或存在复制就称 workload 为 memory-bound；需要流量、stall、实际带宽和耗时证据。'),
    },
    checks: [
      {
        question: t('Why can a 4 MiB array generate about 4 MiB of fetched traffic while delivering only 256 KiB of useful values in the hypothetical example?', '在假设例子中，为什么一个 4 MiB 数组可能产生约 4 MiB 的取入流量，却只交付 256 KiB 有效值？'),
        answer: t('Because the 64-byte cache line brings in 16 four-byte values, while the strided access uses only one of them. The unused values are traffic caused by the access granularity and poor spatial locality.', '因为 64 字节 cache line 会带入 16 个四字节值，而跨步访问只使用其中一个。未使用的值是访问粒度和较差空间局部性造成的流量。'),
        reasoning: t(['Compute values per line.', 'Compare useful bytes with fetched line bytes.', 'State that reuse or coalescing could change the result.'], ['计算每条 line 的值数量。', '比较有效字节与取入 line 字节。', '说明复用或合并访问可能改变结果。']),
        rubric: t(['Full: includes the 16:1 line-to-use ratio and explains locality.', 'Partial: notices wasted traffic but omits the unit calculation.', 'Weak: equates array size with useful traffic without assumptions.'], ['完整：包含 16:1 的 line 与有效使用比例，并解释局部性。', '部分：注意到流量浪费，但漏掉单位计算。', '不足：不写假设就把数组大小等同于有效流量。']),
        boundary: t('The numbers are hypothetical and do not describe measured Mie traffic.', '这些数字是假设值，不描述 Mie 的实测流量。'),
      },
      {
        question: t('Why does cp.asarray followed by synchronize not prove that Mie is bandwidth-bound?', '为什么 cp.asarray 后跟 synchronize 不能证明 Mie 是 bandwidth-bound？'),
        answer: t('It proves that the program establishes a transfer and completion boundary. It does not tell us whether time is dominated by bytes transferred, request latency, synchronization, GPU computation, CPU work, or another stage.', '它证明程序建立了传输与完成边界，但不能告诉我们耗时是否主要来自传输字节数、请求延迟、同步、GPU 计算、CPU 工作或其他阶段。'),
        reasoning: t(['Identify what the source establishes: ordering.', 'List competing causes of elapsed time.', 'Require timing and counters before naming the bottleneck.'], ['指出源代码确立的是顺序。', '列出耗时的竞争原因。', '在命名瓶颈前要求耗时与计数器。']),
        rubric: t(['Full: separates correctness ordering from performance diagnosis and names evidence needed.', 'Partial: says “need profiling” but does not identify alternatives.', 'Weak: treats every explicit copy as bandwidth saturation.'], ['完整：区分正确性顺序与性能诊断，并指出所需证据。', '部分：说“需要 profiling”，但没有列出替代原因。', '不足：把每次显式复制都当成带宽饱和。']),
        boundary: t('A measured transfer can still be bandwidth-limited; the point is that the code alone cannot establish it.', '实测传输仍可能受带宽限制；关键是仅凭代码不能建立这个结论。'),
      },
    ],
    takeaways: t([
      'Reason about the hierarchy by capacity, latency, bandwidth, sharing, and management—not by the word “memory.”',
      'Cache lines and reuse make actual traffic differ from array size; measure the traffic at the limiting level.',
      'SRAM, shared memory, and automatic cache have different contracts, and no storage technology removes the need to manage movement and capacity.',
    ], [
      '按容量、延迟、带宽、共享范围和管理方式理解层次，而不是只看到“memory”这个词。',
      'cache line 与复用会让真实流量不同于数组大小；要在真正限制的层级测量流量。',
      'SRAM、shared memory 和自动 cache 的契约不同，任何存储技术都不会消除对搬运和容量的管理。',
    ]),
    prerequisites: ['decomp', 'scaling'],
    sources: [
      { title: 'CUDA C++ Programming Guide', url: 'https://docs.nvidia.com/cuda/cuda-programming-guide/', note: t('Supports CUDA memory hierarchy, execution scopes, synchronization, and memory-access reasoning.', '支持 CUDA 内存层次、执行作用域、同步和访存推理。') },
      { title: 'CUDA programming model refresher', url: 'https://docs.nvidia.com/cuda/cuda-programming-guide/01-introduction/programming-model.html', note: t('Supports the distinction between host/device execution and the CUDA programming memory model.', '支持区分主机/设备执行以及 CUDA 编程内存模型。') },
      { title: 'JaiS 2: A 70B model trained and served on Cerebras CS-3', url: 'https://www.cerebras.ai/blog/jais2', note: t('Supports the WSE3/CS-3 example of distributed SRAM across systems for a model that is too large for one system; it does not establish a universal no-off-chip-memory rule.', '支持 WSE3/CS-3 通过跨系统分布式 SRAM 容纳单系统放不下模型的例子；不支持“所有系统都没有片外内存”的普遍结论。') },
    ],
    visualSpec: t('A two-column hierarchy map: CPU registers/L1/L2/L3/main memory beside GPU registers/shared/L1/L2/HBM, with arrows labeled cache line, locality, latency, and bandwidth; add a separate distributed-SRAM-across-systems boundary.', '双栏层次图：左侧 CPU 的寄存器/L1/L2/L3/主内存，右侧 GPU 的寄存器/shared/L1/L2/HBM，用 cache line、局部性、延迟和带宽标注箭头；另标出跨系统分布式 SRAM 的边界。'),
  },

  simt: {
    minutes: 25,
    question: t('If adjacent Mie data items are sent to adjacent GPU threads, why can a branch or address pattern still make the kernel inefficient?', '如果相邻的 Mie 数据项被交给相邻 GPU 线程，为什么分支或地址模式仍可能让 kernel 效率变差？'),
    terms: [
      { name: t('SIMD', 'SIMD'), definition: t('A model where one instruction operates on multiple vector lanes.', '一条指令同时作用于多个向量 lane 的模型。') },
      { name: t('SIMT', 'SIMT'), definition: t('A model exposing threads with individual state while hardware executes groups of threads together.', '向程序暴露拥有独立状态的线程，但硬件把线程成组执行的模型。') },
      { name: t('warp', 'warp'), definition: t('A hardware execution group whose threads are scheduled together on NVIDIA GPUs.', 'NVIDIA GPU 上被硬件共同调度的线程执行组。') },
      { name: t('divergence', '发散'), definition: t('Different threads in one execution group choose different control-flow paths.', '同一执行组中的不同线程选择不同控制流路径。') },
      { name: t('coalescing', '合并访存'), definition: t('Combining lane memory requests efficiently when their addresses have a suitable pattern.', '当 lane 地址模式合适时高效合并多个访存请求。') },
    ],
    sections: [
      {
        title: t('SIMD and SIMT expose different programming choices', 'SIMD 与 SIMT 暴露不同的编程选择'),
        paragraphs: t([
          'SIMD presents vector lanes: one instruction conceptually applies to several values. SIMT presents threads with their own registers and control-flow state, but the hardware schedules a warp together. This lets a kernel be written in thread terms while still making group-level execution and memory behavior important.',
          'For the Mie anchor, imagine a GPU preprocessing loop over adjacent samples. The source confirms GPU preprocessing/postprocessing exists, but it does not provide a kernel listing or counters. We can therefore use the loop as a reasoning exercise without claiming that its actual threads are mapped in a particular way.',
        ], [
          'SIMD 暴露向量 lane：概念上，一条指令作用于多个值。SIMT 暴露拥有自身寄存器和控制流状态的线程，但硬件会共同调度一个 warp。这样 kernel 可以用线程的语言编写，同时仍然受到执行组和访存行为的影响。',
          '以 Mie 为锚点，可以想象一个处理相邻 sample 的 GPU 预处理循环。源代码确认存在 GPU 预处理/后处理，但没有提供 kernel 列表或计数器。因此这里只把它作为推理练习，不声称实际线程采用了某种映射。',
        ]),
      },
      {
        title: t('Divergence turns one group into serialized paths', '发散会把一个执行组变成串行路径'),
        paragraphs: t([
          'If threads in one warp choose different branches, the hardware may execute one path for the participating threads and then the other path for the remaining threads, masking inactive lanes during each path. The work is still correct, but the group has less useful parallel progress for that region.',
          'Removing a branch is not automatically better: it can replace control-flow overhead with redundant computation. The correct question is whether the branch pattern, work per path, and downstream memory behavior improve the measured result.',
        ], [
          '如果一个 warp 中的线程选择不同分支，硬件可能先执行参与第一条路径的线程，再执行剩余线程的另一条路径；每条路径执行时，未参与的 lane 会被屏蔽。结果仍然正确，但该区域的有效并行进度变少。',
          '去掉分支也不一定更好：它可能用重复计算替代控制流开销。正确的问题是：结合分支模式、每条路径的工作量和后续访存行为，实测结果是否改善。',
        ]),
        equation: 'useful warp work ≈ active lanes × work per path, with inactive lanes masked on divergent paths',
      },
      {
        title: t('Coalescing connects lane layout to memory transactions', '合并访存把 lane 布局连接到内存事务'),
        paragraphs: t([
          'When adjacent lanes access adjacent addresses, the hardware can often satisfy the group with fewer or more efficient memory transactions than when lanes scatter across distant addresses. This is why a data layout is an execution decision, not just a storage-format decision.',
          'For Mie, a hypothetical contiguous sample array may be friendly to adjacent lanes, while an array-of-structures or indirect index pattern may expose more lines or transactions. The source does not establish which pattern the actual kernels use, so the lesson must stop at the testable hypothesis: inspect the kernel’s address calculation and memory counters.',
        ], [
          '当相邻 lane 访问相邻地址时，硬件通常可以用比地址分散时更少或更高效的内存事务服务整个执行组。因此数据布局不仅是存储格式选择，也是执行选择。',
          '对 Mie 而言，假设的连续 sample 数组可能适合相邻 lane，而 array-of-structures 或间接索引模式可能暴露更多 line 或 transaction。源代码没有证明实际 kernel 使用哪种模式，因此这里应停在可检验假设：检查 kernel 地址计算和内存计数器。',
        ]),
      },
    ],
    workedExample: {
      title: t('Hypothetical warp branch', '假设的 warp 分支'),
      assumptions: t('Assume a 32-thread warp. Sixteen threads take a 10-operation path and sixteen take a 4-operation path. Ignore memory stalls and instruction issue details; this is an illustrative control-flow calculation.', '假设一个 32 线程 warp，其中 16 个线程走 10 次操作的路径，另外 16 个线程走 4 次操作的路径。忽略内存 stall 和指令发射细节；这是控制流示意计算。'),
      steps: t([
        'The first path requires 10 operation slots while half the lanes are active.',
        'The second path requires 4 operation slots while the other half are active.',
        'The group executes 10 + 4 = 14 path-operation slots, while only 16 lanes contribute on each path.',
        'A branch-free rewrite that performs 10 + 4 operations for all 32 lanes would perform 32 × 14 lane-operations, so it is not automatically cheaper.',
      ], [
        '第一条路径需要 10 个操作槽位，执行时只有一半 lane 活跃。',
        '第二条路径需要 4 个操作槽位，执行时另一半 lane 活跃。',
        '执行组总共经历 10 + 4 = 14 个路径操作槽位，每条路径只有 16 个 lane 贡献工作。',
        '如果无分支改写让全部 32 个 lane 都执行 10 + 4 次操作，则会执行 32 × 14 个 lane-operation，因此去分支并不自动更便宜。',
      ]),
      result: t('Divergence reduces simultaneous useful lanes, but eliminating it must be compared with the redundant work it removes.', '发散会减少同时有效的 lane，但去掉发散必须和它引入的重复工作进行比较。'),
    },
    transfer: {
      title: t('Transfer to LLM kernels', '迁移到 LLM kernel'),
      paragraphs: t([
        'LLM kernels also map tensor elements to threads and warps. The same questions apply: are lanes reading a friendly layout, do masks create divergence, and does the mapping preserve enough independent work to hide latency?',
        'The analogy boundary is that a Mie preprocessing loop is not an attention or GEMM kernel. Do not infer Tensor Core use, model parallelism, or a particular warp mapping from the Mie source; transfer the reasoning questions, then inspect the target kernel.',
      ], [
        'LLM kernel 也会把张量元素映射到线程和 warp。相同的问题仍然适用：lane 是否读取友好布局，mask 是否造成发散，映射是否保留足够独立工作来隐藏延迟？',
        '类比边界是：Mie 预处理循环不是 attention 或 GEMM kernel。不要从 Mie 源码推断 Tensor Core、模型并行或具体 warp 映射；只迁移推理问题，再检查目标 kernel。',
      ]),
      boundary: t('SIMT vocabulary predicts questions to ask, not the performance of an unmeasured kernel.', 'SIMT 词汇告诉你该问什么，不会直接预测未测量 kernel 的性能。'),
    },
    checks: [
      {
        question: t('What happens when half a warp takes each of two branches?', '当一个 warp 的一半线程走一条分支、另一半走另一条分支时会怎样？'),
        answer: t('The warp may execute the paths serially with inactive lanes masked, so both paths still consume execution slots even though only half the lanes contribute on each path.', 'warp 可能在屏蔽非参与 lane 的情况下串行执行两条路径，因此即使每条路径只有一半 lane 贡献工作，两条路径仍都消耗执行槽位。'),
        reasoning: t(['Identify the group as the scheduling unit.', 'Explain masking and serialized paths.', 'Mention redundant computation as the trade-off of branch removal.'], ['把执行组识别为调度单位。', '解释屏蔽与路径串行。', '指出去分支的代价可能是重复计算。']),
        rubric: t(['Full: explains both masked lanes and the non-automatic benefit of branch removal.', 'Partial: says divergence is slower but gives no mechanism.', 'Weak: assumes all 32 threads execute both paths usefully.'], ['完整：解释屏蔽 lane，并说明去分支收益不是自动的。', '部分：说发散更慢，但没有机制。', '不足：假设 32 个线程都能同时有效执行两条路径。']),
        boundary: t('Exact cost depends on instruction mix, path lengths, and memory behavior.', '具体成本取决于指令组合、路径长度和访存行为。'),
      },
      {
        question: t('Why can adjacent lane addresses help without proving that a Mie kernel is fast?', '为什么相邻 lane 地址有帮助，却不能证明 Mie kernel 很快？'),
        answer: t('Adjacent addresses can improve coalescing and reduce wasted memory transactions, but total performance also depends on arithmetic, latency hiding, occupancy, synchronization, and other stages. The source has no kernel counters.', '相邻地址可能改善合并访存并减少浪费的内存事务，但总性能还取决于算术、延迟隐藏、occupancy、同步和其他阶段。源代码没有 kernel 计数器。'),
        reasoning: t(['Separate one favorable access property from end-to-end performance.', 'Name at least one non-memory constraint.', 'Keep the Mie conclusion hypothetical without measurements.'], ['把一种有利访存属性与端到端性能分开。', '至少指出一种非内存限制。', '没有测量时保持 Mie 结论为假设。']),
        rubric: t(['Full: connects layout to transactions and lists independent constraints.', 'Partial: mentions coalescing but treats it as sufficient.', 'Weak: equates contiguous data with guaranteed speed.'], ['完整：把布局连接到事务，并列出独立限制。', '部分：提到 coalescing，却把它当成充分条件。', '不足：把连续数据等同于必然更快。']),
        boundary: t('Coalescing is a hypothesis about memory behavior, not a complete benchmark result.', '合并访存只是关于内存行为的假设，不是完整 benchmark 结果。'),
      },
    ],
    takeaways: t([
      'SIMT exposes threads but executes them in groups, so control flow and memory layout have group-level costs.',
      'Divergence masks lanes; coalescing makes lane addresses matter to transaction efficiency.',
      'Use the Mie path as a hypothesis anchor, not as evidence of an unmeasured kernel mapping or bottleneck.',
    ], [
      'SIMT 暴露线程但按组执行，因此控制流和内存布局会产生执行组级成本。',
      '发散会屏蔽 lane；合并访存让 lane 地址影响事务效率。',
      '把 Mie 路径作为假设锚点，而不是未测量 kernel 映射或瓶颈的证据。',
    ]),
    prerequisites: ['memory'],
    sources: [
      { title: 'CUDA C++ Programming Guide', url: 'https://docs.nvidia.com/cuda/cuda-programming-guide/', note: t('Supports CUDA thread hierarchy, SIMT execution, control-flow behavior, and memory access concepts.', '支持 CUDA 线程层次、SIMT 执行、控制流行为和访存概念。') },
      { title: 'Writing CUDA kernels', url: 'https://docs.nvidia.com/cuda/cuda-programming-guide/02-basics/writing-cuda-kernels.html', note: t('Supports the CUDA kernel execution model and the distinction between threads, blocks, and grids.', '支持 CUDA kernel 执行模型以及 thread、block、grid 的区别。') },
    ],
    visualSpec: t('A 32-lane warp strip showing adjacent coalesced addresses, then a divergent split with masked lanes; annotate that both are conceptual and not a visualization of the Mie kernel.', '32 lane warp 条带图：先展示相邻地址的合并访问，再展示 lane 发散与屏蔽；标注两者都是概念图，不是 Mie kernel 的实际可视化。'),
  },

  occupancy: {
    minutes: 25,
    question: t('A kernel uses more registers per thread and its occupancy falls. When is that a warning, and when might the lower occupancy be an acceptable trade for better reuse?', '一个 kernel 每线程使用更多寄存器，occupancy 下降。什么时候这是警告，什么时候较低 occupancy 可能是更好复用的可接受代价？'),
    terms: [
      { name: t('streaming multiprocessor (SM)', '流式多处理器（SM）'), definition: t('A GPU execution unit that schedules warps and provides per-SM resources such as registers and shared memory.', '负责调度 warp，并提供寄存器和 shared memory 等每个 SM 资源的 GPU 执行单元。') },
      { name: t('occupancy', 'occupancy'), definition: t('Active warps on an SM divided by the maximum active warps supported by that SM.', '一个 SM 上的 active warp 数除以该 SM 支持的最大 active warp 数。') },
      { name: t('resident block', '驻留 block'), definition: t('A block whose resources have been allocated on an SM and whose warps can be scheduled.', '资源已在 SM 上分配、其 warp 可以被调度的 block。') },
      { name: t('register pressure', '寄存器压力'), definition: t('The amount of register storage demanded by each thread and the resulting constraint on resident blocks.', '每个线程所需寄存器存储量，以及它对驻留 block 的限制。') },
      { name: t('latency hiding', '延迟隐藏'), definition: t('Using other ready warps while one warp waits for a dependent operation.', '一个 warp 等待依赖操作时，调度其他就绪 warp 来掩盖等待。') },
      { name: t('spill', 'spill'), definition: t('Moving register values to a slower memory level because register demand exceeds the available allocation.', '当寄存器需求超过可分配资源时，把寄存器值移到更慢内存层级。') },
    ],
    sections: [
      {
        title: t('Occupancy is a capacity ratio', 'Occupancy 是容量比例'),
        paragraphs: t([
          'Occupancy counts how many warps can be resident, not how many instructions the kernel completes per second. Registers per thread, shared memory per block, threads per block, blocks per SM, and the SM’s maximum warps all compete to cap resident blocks. The limiting resource is the smallest of these resource-based block counts.',
          'For the Mie anchor, the source establishes GPU preprocessing and postprocessing, but no launch configuration, register count, shared-memory allocation, or occupancy counter. Therefore an occupancy lesson can show a hypothetical calculation while making no claim about the actual Mie kernel.',
        ], [
          'Occupancy 统计可以驻留多少 warp，而不是 kernel 每秒完成多少指令。每线程寄存器、每 block shared memory、每 block 线程数、每 SM block 上限和每 SM 最大 warp 数共同限制驻留 block 数。真正的限制资源是这些资源约束得到的 block 数中的最小值。',
          '以 Mie 为锚点，源代码确认存在 GPU 预处理和后处理，但没有 launch 配置、寄存器数量、shared-memory 分配或 occupancy 计数器。因此这里可以展示假设计算，但不能对实际 Mie kernel 作出结论。',
        ]),
        equation: 'occupancy = resident warps ÷ maximum resident warps',
      },
      {
        title: t('Calculate the limiting resource explicitly', '明确计算限制资源'),
        paragraphs: t([
          'Suppose a hypothetical SM supports 2,048 threads, 64 warps, 32 blocks, and 65,536 32-bit registers, with 100 KiB shared memory. A 256-thread block has 8 warps. At 32 registers per thread, it uses 8,192 registers per block, so registers permit floor(65,536 ÷ 8,192) = 8 blocks. If shared memory is 12 KiB per block, shared memory permits floor(100 KiB ÷ 12 KiB) = 8 blocks, while threads also permit 8 blocks. This idealized arithmetic ignores register/shared-memory allocation granularity and any real per-block or per-SM constraint not listed here.',
          'The minimum is 8 blocks, which is 64 resident warps and 100% occupancy on this hypothetical architecture. If register use rises to 80 per thread, each block needs 20,480 registers and registers permit only floor(65,536 ÷ 20,480) = 3 blocks. That is 24 resident warps, or 37.5% occupancy, before considering other limits.',
        ], [
          '假设一个 SM 支持 2,048 个线程、64 个 warp、32 个 block 和 65,536 个 32-bit 寄存器，并有 100 KiB shared memory。一个 256 线程 block 包含 8 个 warp。当每线程使用 32 个寄存器时，每 block 使用 8,192 个寄存器，因此寄存器允许 floor(65,536 ÷ 8,192) = 8 个 block。若每 block 使用 12 KiB shared memory，shared memory 也允许 floor(100 KiB ÷ 12 KiB) = 8 个 block，线程数同样允许 8 个 block。这个理想化计算忽略寄存器/shared-memory 分配粒度，以及这里未列出的真实 per-block 或 per-SM 限制。',
          '最小值是 8 个 block，即 64 个驻留 warp，在这个假设架构上是 100% occupancy。如果每线程寄存器增加到 80 个，每 block 需要 20,480 个寄存器，寄存器只允许 floor(65,536 ÷ 20,480) = 3 个 block。于是有 24 个驻留 warp，即 37.5% occupancy，还没有考虑其他限制。',
        ]),
        equation: 'resident blocks = min(floor(registers per SM ÷ registers per block), floor(shared memory per SM ÷ shared memory per block), floor(threads per SM ÷ threads per block), block limit)',
        assumptions: t('All architecture values and register usages in this calculation are hypothetical and are not Mie measurements or universal NVIDIA limits.', '这里所有架构数值和寄存器使用量都是假设值，不是 Mie 测量，也不是 NVIDIA 的普适限制。'),
      },
      {
        title: t('Lower occupancy can be the right trade', '较低 occupancy 可能是正确权衡'),
        paragraphs: t([
          'More resident warps can help when warps frequently wait on memory or another long-latency dependency. But if the kernel already hides the relevant latency, extra warps may not raise throughput. More registers can preserve values, reduce reloads, and improve reuse; a larger tile can reduce repeated global-memory traffic. Those gains can outweigh a lower occupancy if the limiting metric improves.',
          'The opposite can also happen: high register use can cause spills, a large shared-memory tile can reduce resident blocks, and low occupancy can leave too few ready warps to cover latency. The decision must connect occupancy to achieved bandwidth, instruction throughput, stall reasons, spills, and elapsed kernel time. A percentage without those measurements is a capacity fact, not a performance conclusion.',
        ], [
          '当 warp 经常等待内存或其他长延迟依赖时，更多驻留 warp 可能有助于隐藏延迟。但如果相关延迟已经被隐藏，额外 warp 不一定提高吞吐。更多寄存器可以保留值、减少重新加载并改善复用；更大的 tile 可以减少重复 global-memory 流量。如果限制指标因此改善，这些收益可能超过较低 occupancy 的代价。',
          '反过来也可能成立：寄存器过多会导致 spill，大 shared-memory tile 会减少驻留 block，低 occupancy 会让可用于覆盖延迟的就绪 warp 太少。决策必须把 occupancy 与实际带宽、指令吞吐、stall 原因、spill 和 kernel 耗时连接起来。没有这些测量，百分比只是容量事实，不是性能结论。',
        ]),
        checkpoint: t('What evidence would distinguish “fewer warps but better reuse” from “too few warps to hide latency”?', '什么证据能区分“warp 更少但复用更好”和“warp 太少导致无法隐藏延迟”？'),
      },
    ],
    workedExample: {
      title: t('Hypothetical occupancy calculation', '假设的 occupancy 计算'),
      assumptions: t('Use the hypothetical SM above: 2,048 threads, 64 maximum warps, 65,536 registers, 100 KiB shared memory, and 32 block maximum. Use 256 threads per block, 12 KiB shared memory per block, and either 32 or 80 registers per thread. The formula is idealized: ignore allocation granularity, real per-block limits, and any architectural constraint not explicitly listed.', '使用上面的假设 SM：2,048 线程、最多 64 warp、65,536 个寄存器、100 KiB shared memory 和最多 32 个 block。每 block 使用 256 线程、12 KiB shared memory，并比较每线程 32 或 80 个寄存器。公式是理想化的：忽略分配粒度、真实 per-block 限制，以及没有明确列出的架构约束。'),
      steps: t([
        'Each block has 256 ÷ 32 = 8 warps.',
        'At 32 registers per thread: 256 × 32 = 8,192 registers per block; register limit = floor(65,536 ÷ 8,192) = 8 blocks.',
        'Shared-memory limit = floor(100 KiB ÷ 12 KiB) = 8 blocks; thread limit = floor(2,048 ÷ 256) = 8 blocks; block limit = 32 blocks.',
        'Resident blocks = min(8, 8, 8, 32) = 8; resident warps = 8 × 8 = 64; occupancy = 64 ÷ 64 = 100%.',
        'At 80 registers per thread: 256 × 80 = 20,480 registers per block; register limit = floor(65,536 ÷ 20,480) = 3 blocks; resident warps = 3 × 8 = 24; occupancy = 24 ÷ 64 = 37.5%.',
      ], [
        '每个 block 有 256 ÷ 32 = 8 个 warp。',
        '每线程 32 个寄存器时：256 × 32 = 8,192 个寄存器/block；寄存器限制 = floor(65,536 ÷ 8,192) = 8 个 block。',
        'shared-memory 限制 = floor(100 KiB ÷ 12 KiB) = 8 个 block；线程限制 = floor(2,048 ÷ 256) = 8 个 block；block 限制 = 32 个 block。',
        '驻留 block = min(8, 8, 8, 32) = 8；驻留 warp = 8 × 8 = 64；occupancy = 64 ÷ 64 = 100%。',
        '每线程 80 个寄存器时：256 × 80 = 20,480 个寄存器/block；寄存器限制 = floor(65,536 ÷ 20,480) = 3 个 block；驻留 warp = 3 × 8 = 24；occupancy = 24 ÷ 64 = 37.5%。',
      ]),
      result: t('Register pressure changes the capacity ratio, but only measurements can tell whether the resulting kernel is faster or slower.', '寄存器压力会改变容量比例，但只有测量才能说明最终 kernel 更快还是更慢。'),
    },
    transfer: {
      title: t('Transfer occupancy reasoning to LLM kernels', '把 occupancy 推理迁移到 LLM kernel'),
      paragraphs: t([
        'LLM kernels also trade registers, shared memory, tile size, and resident warps. A fused attention or GEMM kernel may use more registers to keep intermediate values close, while a smaller tile may admit more blocks. Ask which resource limits residency and whether the change improves the actual bottleneck.',
        'The analogy boundary is that the Mie source supplies no launch-resource data and does not implement an LLM kernel. Do not turn the hypothetical percentages into a claim about its GPU preprocessing or into a claim that 100% occupancy is optimal for an LLM.',
      ], [
        'LLM kernel 也会在寄存器、shared memory、tile 大小和驻留 warp 之间权衡。融合的 attention 或 GEMM kernel 可能使用更多寄存器来让中间值保持靠近，而更小 tile 可能允许更多 block 驻留。要问哪个资源限制驻留，以及变化是否改善真实瓶颈。',
        '类比边界是：Mie 源代码没有提供 launch 资源数据，也没有实现 LLM kernel。不要把假设百分比变成对其 GPU 预处理的结论，也不要声称 100% occupancy 对 LLM 总是最优。',
      ]),
      boundary: t('Occupancy is a resource diagnosis step; it is never a substitute for achieved-work and timing evidence.', 'Occupancy 是资源诊断步骤，绝不能替代实际工作量和耗时证据。'),
    },
    checks: [
      {
        question: t('In the hypothetical calculation, why does raising registers from 32 to 80 per thread reduce occupancy?', '在假设计算中，为什么每线程寄存器从 32 增加到 80 会降低 occupancy？'),
        answer: t('A 256-thread block grows from 8,192 to 20,480 registers. The 65,536-register SM can then admit only floor(65,536 ÷ 20,480) = 3 blocks, or 24 warps, which is 37.5% of the 64-warp maximum.', '一个 256 线程 block 使用的寄存器从 8,192 增长到 20,480。65,536 个寄存器的 SM 于是只能容纳 floor(65,536 ÷ 20,480) = 3 个 block，即 24 个 warp，占 64 warp 上限的 37.5%。'),
        reasoning: t(['Calculate registers per block.', 'Apply the floor division at the SM limit.', 'Convert resident warps to the occupancy ratio.'], ['计算每 block 寄存器数。', '在 SM 限制处应用向下取整。', '把驻留 warp 转换为 occupancy 比例。']),
        rubric: t(['Full: gives 20,480 registers/block, 3 blocks, 24 warps, and 37.5%.', 'Partial: identifies register pressure but misses one calculation.', 'Weak: treats occupancy as registers per thread directly.'], ['完整：给出 20,480 个寄存器/block、3 个 block、24 个 warp 和 37.5%。', '部分：识别寄存器压力，但漏掉一个计算。', '不足：把 occupancy 直接等同于每线程寄存器数。']),
        boundary: t('All architecture values are hypothetical; the arithmetic does not describe a production GPU.', '所有架构数值都是假设值；计算不描述生产 GPU。'),
      },
      {
        question: t('Why is 100% occupancy not proof that a kernel is optimal?', '为什么 100% occupancy 不能证明 kernel 最优？'),
        answer: t('It only says the resident-warp capacity ratio reaches the stated maximum. The kernel may still be limited by bandwidth, instruction throughput, synchronization, poor locality, or another resource, and a lower-occupancy version may improve reuse.', '它只说明驻留 warp 容量比例达到给定上限。kernel 仍可能受带宽、指令吞吐、同步、局部性或其他资源限制，而较低 occupancy 的版本可能改善复用。'),
        reasoning: t(['Separate capacity from achieved throughput.', 'Name a competing bottleneck.', 'Require elapsed time or relevant counters.'], ['区分容量与实际吞吐。', '指出一个竞争瓶颈。', '要求耗时或相关计数器。']),
        rubric: t(['Full: explains the metric’s scope and gives a concrete counterexample.', 'Partial: says occupancy is not everything without naming evidence.', 'Weak: ranks kernels by occupancy alone.'], ['完整：解释指标范围，并给出具体反例。', '部分：说 occupancy 不是全部，但不指出证据。', '不足：只按 occupancy 给 kernel 排名。']),
        boundary: t('High occupancy can still be useful for a latency-sensitive kernel; the claim is not that it never matters.', '对延迟敏感 kernel，高 occupancy 仍可能有用；这里不是说它永远不重要。'),
      },
    ],
    takeaways: t([
      'Occupancy is resident-warp capacity, calculated from the tightest resource limit.',
      'More registers or shared memory can lower occupancy while improving reuse; measure the trade.',
      'Use occupancy to form a latency-hiding hypothesis, then verify it with stalls, throughput, spills, and time.',
    ], [
      'Occupancy 是驻留 warp 容量，由最紧的资源限制计算得到。',
      '更多寄存器或 shared memory 可能降低 occupancy，却改善复用；必须测量这种权衡。',
      '用 occupancy 提出延迟隐藏假设，再用 stall、吞吐、spill 和耗时验证。',
    ]),
    prerequisites: ['simt', 'memory'],
    sources: [
      { title: 'CUDA C++ Programming Guide', url: 'https://docs.nvidia.com/cuda/cuda-programming-guide/', note: t('Supports CUDA execution resources, registers, shared memory, thread blocks, and occupancy-related constraints.', '支持 CUDA 执行资源、寄存器、shared memory、thread block 和 occupancy 相关限制。') },
      { title: 'CUDA C++ Programming Guide PDF', url: 'https://docs.nvidia.com/cuda/cuda-programming-guide/pdf/cuda-programming-guide.pdf', note: t('Supports the official CUDA resource and occupancy terminology used for the hypothetical calculation.', '支持假设计算使用的官方 CUDA 资源与 occupancy 术语。') },
    ],
    visualSpec: t('A resource ledger for one hypothetical SM: registers, shared memory, threads, and block limit each point to resident blocks, then to warps and occupancy; show a second ledger with 80 registers per thread.', '一个假设 SM 的资源账本：寄存器、shared memory、线程数和 block 上限分别指向驻留 block，再指向 warp 与 occupancy；旁边展示每线程 80 个寄存器的第二本账。'),
  },

  arch: {
    minutes: 7,
    question: t('When an architecture answer says “the GPU is faster,” what chain of resources and constraints must connect that claim to the observed workload?', '当架构回答说“GPU 更快”时，必须用怎样的资源与约束链条把这个结论连接到实际 workload？'),
    terms: [
      { name: t('execution unit', '执行单元'), definition: t('A hardware resource that performs or schedules part of the instruction work.', '执行或调度部分指令工作的硬件资源。') },
      { name: t('memory hierarchy', '内存层次'), definition: t('Storage levels with different capacity, latency, bandwidth, and sharing behavior.', '具有不同容量、延迟、带宽和共享行为的存储层次。') },
      { name: t('topology', '拓扑'), definition: t('The arrangement and connectivity of compute, memory, and communication resources.', '计算、内存和通信资源的排列与连接方式。') },
    ],
    sections: [
      {
        title: t('Architecture is a causal chain', '架构是一条因果链'),
        paragraphs: t([
          'A useful architecture explanation follows work from instruction mapping to execution resources, storage levels, scheduling, synchronization, and interconnect. It then names an observable consequence: more useful work per cycle, fewer bytes moved, less waiting, or a different critical path.',
          'The Mie program is a good anchor because its facts cross boundaries: GPU preprocessing/postprocessing, explicit H2D synchronization, sequential per-plume D2H, CPU metrics, and background writers. They show why architecture answers must include the host, device, and hand-offs, while still not proving a measured bottleneck.',
        ], [
          '有用的架构解释要追踪工作如何映射到执行资源、存储层、调度、同步和互联，然后指出可观察后果：每周期完成更多有效工作、搬运更少字节、减少等待，或改变关键路径。',
          'Mie 程序是很好的锚点，因为它跨越多个边界：GPU 预处理/后处理、显式 H2D 同步、按 plume 顺序的 D2H、CPU metric 和后台 writer。它说明架构回答必须包含主机、设备与交接，但仍不能证明某个已测瓶颈。',
        ]),
      },
      {
        title: t('Use measurements to close the chain', '用测量闭合因果链'),
        paragraphs: t([
          'A claim such as “memory is slow” is incomplete. Say which level, which access pattern, which capacity or transaction effect, and which measurement would change the diagnosis. Likewise, “more occupancy is better” is incomplete unless it connects to latency hiding and achieved work.',
          'For LLMs, the same discipline applies to DP, TP, PP, attention, and serving. Architecture vocabulary is valuable when it predicts a test; it is not a replacement for one.',
        ], [
          '“内存很慢”这样的结论并不完整。要说明是哪一层、什么访问模式、什么容量或事务效应，以及什么测量会改变诊断。同样，“occupancy 越高越好”也不完整，除非它连接到延迟隐藏和实际完成工作量。',
          '对 LLM 的 DP、TP、PP、attention 和 serving 也要遵守同样纪律。架构词汇的价值在于它能预测测试，而不是替代测试。',
        ]),
      },
    ],
    workedExample: {
      title: t('Hypothetical architecture answer', '假设的架构回答'),
      assumptions: t('Assume only that a workload performs GPU preprocessing, an explicit host/device hand-off, CPU metrics, and asynchronous file writing. No timing or counter is assumed.', '只假设 workload 包含 GPU 预处理、显式主机/设备交接、CPU metric 和异步文件写出。不假设任何耗时或计数器。'),
      steps: t([
        'Name the stages and ownership: GPU handles preprocessing, CPU handles metrics, and writers handle output artifacts.',
        'Name the edges: H2D synchronization, per-plume D2H, preview preparation, and final writer-future drain.',
        'State the test: measure stage time, transfer time, queue depth, and relevant GPU memory or stall counters.',
      ], [
        '说明阶段与所有权：GPU 负责预处理，CPU 负责 metric，writer 负责输出文件。',
        '说明边界：H2D 同步、按 plume 的 D2H、preview 准备以及最后等待 writer future。',
        '说明测试：测量阶段耗时、传输耗时、队列深度以及相关 GPU 内存或 stall 计数器。',
      ]),
      result: t('The defensible answer is a causal measurement plan, not an unsupported label such as “memory-bound.”', '可辩护的回答是因果测量计划，而不是“memory-bound”这类未经支持的标签。'),
    },
    transfer: {
      title: t('Transfer architecture reasoning to LLMs', '把架构推理迁移到 LLM'),
      paragraphs: t([
        'Trace an LLM request or training step through model layers, memory, communication, scheduling, and user-visible latency. Reuse the Mie habit of naming ownership and hand-off, but replace plume/file stages with model-specific stages such as DP synchronization, TP collectives, or PP activation transfers.',
      ], [
        '追踪一次 LLM 请求或训练步骤如何经过模型层、内存、通信、调度和用户可见延迟。保留 Mie 中明确所有权与交接的习惯，但把 plume/file 阶段替换成 DP 同步、TP collective 或 PP activation 传输等模型阶段。',
      ]),
      boundary: t('Mie is an end-to-end data-movement anchor, not evidence of C++ semantics, multiple GPUs, or a particular LLM runtime.', 'Mie 是端到端数据移动的锚点，不是 C++ 语义、多 GPU 或某个 LLM runtime 的证据。'),
    },
    checks: [
      {
        question: t('What makes an architecture explanation stronger than “the GPU is faster”?', '什么能让架构解释强于“GPU 更快”？'),
        answer: t('It names the mapped work, resource or memory level, dependency or communication edge, expected consequence, and measurement that could confirm or falsify the claim.', '它会指出工作如何映射、涉及哪个资源或内存层、依赖或通信边在哪里、预期后果是什么，以及什么测量可以确认或推翻结论。'),
        reasoning: t(['Follow the workload causally.', 'Separate mechanism from outcome.', 'Keep the claim falsifiable.'], ['按因果追踪 workload。', '区分机制与结果。', '让结论可以被证伪。']),
        rubric: t(['Full: includes resource, boundary, consequence, and evidence.', 'Partial: gives a mechanism but no measurement.', 'Weak: uses hardware labels as conclusions.'], ['完整：包含资源、边界、后果和证据。', '部分：给出机制但没有测量。', '不足：把硬件名称当成结论。']),
        boundary: t('A good causal explanation still does not replace a benchmark or counter trace.', '好的因果解释仍不能替代 benchmark 或计数器追踪。'),
      },
    ],
    takeaways: t([
      'Architecture answers should connect mapping, resources, movement, dependencies, and measurements.',
      'Host/device hand-offs and queues are part of performance, not implementation noise.',
      'Use Mie as a concrete anchor, then state clearly where the analogy stops before discussing LLM systems.',
    ], [
      '架构回答要连接映射、资源、搬运、依赖和测量。',
      '主机/设备交接和队列属于性能的一部分，不是实现噪声。',
      '用 Mie 作为具体锚点，再在讨论 LLM 系统前明确类比边界。',
    ]),
    prerequisites: ['decomp', 'memory', 'simt', 'occupancy'],
    sources: [
      { title: 'CUDA C++ Programming Guide', url: 'https://docs.nvidia.com/cuda/cuda-programming-guide/', note: t('Supports the official CUDA execution, memory, synchronization, and architecture-facing programming model.', '支持官方 CUDA 执行、内存、同步和面向架构的编程模型。') },
    ],
    visualSpec: t('A compact causal chain from workload unit to execution resource to memory path to synchronization edge to measured outcome; annotate Mie and LLM examples on separate branches.', '紧凑因果链：workload 单元 → 执行资源 → 内存路径 → 同步边 → 测量结果；在分支上分别标注 Mie 与 LLM 例子。'),
  },
};
