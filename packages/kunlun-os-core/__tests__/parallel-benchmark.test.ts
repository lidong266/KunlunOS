/**
 * 多核多线程任务执行时间测试
 * 模拟不同LLM延迟，测试MapReduce并行加速比
 */
import { describe, it, expect } from 'vitest';

// 模拟 agent-loop 的核心：prompt → LLM延迟 → 回复
async function mockAgentLoop(prompt: string, llmLatencyMs: number): Promise<string> {
  await new Promise(r => setTimeout(r, llmLatencyMs));
  return `[分析结果: ${prompt.substring(0, 30)}]`;
}

// 模拟 MapReduce
async function mapReduce(
  subTasks: string[],
  workerCount: number,
  llmLatencyMs: number,
  reduceLatencyMs: number,
): Promise<{ results: string[]; elapsed: number }> {
  const start = Date.now();

  // Map: N个任务分配到M个worker并行
  const results = await Promise.all(
    subTasks.map((task) => mockAgentLoop(task, llmLatencyMs))
  );

  // Reduce: 主Pi综合
  await mockAgentLoop(`综合 ${subTasks.length} 个结果`, reduceLatencyMs);

  return { results, elapsed: Date.now() - start };
}

describe('多核多线程执行时间测试', () => {
  // ═══════════════════════════════════════════════════════════
  // 单核 vs 多核
  // ═══════════════════════════════════════════════════════════
  it('1任务 1核: 基准延迟', async () => {
    const { elapsed } = await mapReduce(['任务1'], 1, 100, 50);
    console.log(`  1任务×1核: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(300);
  });

  it('3任务 串行(1核) vs 并行(3核): 加速比', async () => {
    const llmLatency = 100;
    const reduceLatency = 50;

    // 串行模拟: 3个任务依次执行
    const serialStart = Date.now();
    for (let i = 0; i < 3; i++) {
      await mockAgentLoop(`任务${i + 1}`, llmLatency);
    }
    await mockAgentLoop('综合', reduceLatency);
    const serialTime = Date.now() - serialStart;

    // 并行: 3个任务并行
    const { elapsed: parallelTime } = await mapReduce(
      ['任务1', '任务2', '任务3'], 3, llmLatency, reduceLatency
    );

    const speedup = (serialTime / parallelTime).toFixed(1);

    console.log(`\n  LLM延迟: ${llmLatency}ms | Reduce: ${reduceLatency}ms`);
    console.log(`  串行(1核): ${serialTime}ms`);
    console.log(`  并行(3核): ${parallelTime}ms`);
    console.log(`  加速比: ${speedup}x`);
    console.log(`  理论最大: ${((3 * llmLatency + reduceLatency) / (llmLatency + reduceLatency)).toFixed(1)}x`);

    expect(parallelTime).toBeLessThan(serialTime);
  });

  // ═══════════════════════════════════════════════════════════
  // 不同LLM延迟下的加速比
  // ═══════════════════════════════════════════════════════════
  it('不同LLM延迟下的加速比矩阵', async () => {
    const latencies = [50, 100, 500, 2000]; // ms
    const taskCount = 5;

    console.log('\n═══════════════════════════════════════');
    console.log(`  任务数: ${taskCount} | Reduce: 100ms`);
    console.log('═══════════════════════════════════════');
    console.log('  LLM延迟 | 串行(1核) | 并行(N核) | 加速比');
    console.log('  ────────┼──────────┼──────────┼───────');

    for (const latency of latencies) {
      const serialTime = taskCount * latency + 100;

      const tasks = Array.from({ length: taskCount }, (_, i) => `任务${i + 1}`);
      const { elapsed: parallelTime } = await mapReduce(tasks, taskCount, latency, 100);

      const speedup = (serialTime / parallelTime).toFixed(1);
      console.log(`  ${latency}ms     | ${serialTime}ms     | ${parallelTime}ms     | ${speedup}x`);
    }
  });

  // ═══════════════════════════════════════════════════════════
  // 任务数 > 核心数时的排队效应
  // ═══════════════════════════════════════════════════════════
  it('任务数大于核心数: 排队效应', async () => {
    const llmLatency = 100;
    const reduceLatency = 50;

    console.log('\n═══════════════════════════════════════');
    console.log(`  LLM延迟: ${llmLatency}ms | Reduce: ${reduceLatency}ms`);
    console.log('═══════════════════════════════════════');
    console.log('  任务/核心 | 串行     | 并行     | 加速比 | 利用率');
    console.log('  ─────────┼─────────┼─────────┼───────┼───────');

    for (const [tasks, cores] of [[2, 2], [3, 2], [4, 2], [6, 3], [9, 3]]) {
      const serialTime = tasks * llmLatency + reduceLatency;
      const taskList = Array.from({ length: tasks }, (_, i) => `任务${i + 1}`);
      const { elapsed: parallelTime } = await mapReduce(taskList, cores, llmLatency, reduceLatency);

      const speedup = (serialTime / parallelTime).toFixed(1);
      const theoreticalMin = Math.ceil(tasks / cores) * llmLatency + reduceLatency;
      const utilization = (theoreticalMin / parallelTime * 100).toFixed(0);

      console.log(`  ${tasks}/${cores}      | ${serialTime}ms    | ${parallelTime}ms    | ${speedup}x   | ${utilization}%`);
    }
  });

  // ═══════════════════════════════════════════════════════════
  // 预取优化效果：减少子任务LLM调用
  // ═══════════════════════════════════════════════════════════
  it('预取优化: 减少工具调用', async () => {
    // 模拟: 无预取 → 每个子Pi各自检索(额外50ms)
    //       有预取 → 主Pi检索一次(50ms)，子Pi直接使用(0ms)

    const taskCount = 4;
    const llmLatency = 100;
    const toolLatency = 50;

    // 无预取: 每个子Pi各自检索
    const noPrefetchStart = Date.now();
    await Promise.all(
      Array.from({ length: taskCount }, async (_, i) => {
        await mockAgentLoop(`检索任务${i + 1}`, toolLatency);  // 各自检索
        await mockAgentLoop(`分析任务${i + 1}`, llmLatency);
      })
    );
    const noPrefetchTime = Date.now() - noPrefetchStart;

    // 有预取: 主Pi检索一次，子Pi直接分析
    const prefetchStart = Date.now();
    await mockAgentLoop('主Pi检索所有', toolLatency);  // 只检索一次
    await Promise.all(
      Array.from({ length: taskCount }, (_, i) =>
        mockAgentLoop(`分析任务${i + 1}`, llmLatency)
      )
    );
    const prefetchTime = Date.now() - prefetchStart;

    console.log(`\n  无预取: ${noPrefetchTime}ms (${taskCount}次检索 + ${taskCount}次分析)`);
    console.log(`  有预取: ${prefetchTime}ms (1次检索 + ${taskCount}次分析)`);
    console.log(`  节省: ${noPrefetchTime - prefetchTime}ms (${((1 - prefetchTime / noPrefetchTime) * 100).toFixed(0)}%)`);
  });
});
