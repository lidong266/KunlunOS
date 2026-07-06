/**
 * KunlunOS 多微内核调度器 — MultiKernelOrchestrator
 *
 * 架构：
 *   KunlunOS
 *   └── MultiKernelOrchestrator
 *       ├── Pi 微内核池 (N 个 Pi 实例)
 *       │   ├── pi-main        (前台交互，优先级 HIGH)
 *       │   ├── pi-analysis-1  (后台分析，优先级 NORMAL)
 *       │   ├── pi-analysis-2  (后台分析，优先级 NORMAL)
 *       │   └── pi-daemon      (记忆归纳/进化，优先级 IDLE)
 *       │
 *       └── CogScheduler (三策略: EDF/HPF/Spiral)
 *           └── CogMultiInstanceManager
 *               └── CogIPC (跨实例通信)
 *
 * 子代理模型：
 *   每个 Pi 微内核内部，工具调用可以并行执行（agent-loop 的 parallel mode）。
 *   子代理 = 同 session 内的并行工具调用线程。
 *   Pi 不管理子代理——这是 agent-loop 的 toolExecution: "parallel" 模式。
 *
 * 调度策略：
 *   1. 用户交互 → pi-main, CRITICAL 优先级
 *   2. 后台分析 → pi-analysis-N, NORMAL/HIGH 按矛盾优先级
 *   3. 记忆归纳 → pi-daemon, IDLE 优先级（空闲时运行）
 *   4. 工具调用 → 同 Pi 实例内 parallel 模式
 */

import { CogScheduler, CogMultiInstanceManager, CogIPC } from '@kunlun/cogkal';
import { CogPriority, CogTaskStatus } from '@kunlun/cogkal';
import type { CogTaskCB } from '@kunlun/cogkal';
import { KunlunAgent } from './kunlun-agent.js';
import type { KunlunAgentOptions } from './kunlun-agent.js';
import type { AgentTool } from '@kunlun/pi-agent-core';

// ═══════════════════════════════════════════════════════════════
// Pi 微内核实例描述
// ═══════════════════════════════════════════════════════════════

export interface PiKernelDescriptor {
  /** 实例 ID */
  id: string;
  /** 角色 */
  role: 'main' | 'analysis' | 'daemon' | 'custom';
  /** Agent 实例 */
  agent: KunlunAgent;
  /** 调度优先级 */
  basePriority: CogPriority;
  /** 是否繁忙 */
  busy: boolean;
  /** 当前任务数 */
  taskCount: number;
}

// ═══════════════════════════════════════════════════════════════
// 内核池配置
// ═══════════════════════════════════════════════════════════════

export interface KernelPoolConfig {
  /** 分析内核数量（默认2） */
  analysisKernels?: number;
  /** 是否启用守护内核（默认 true） */
  enableDaemon?: boolean;
  /** 每个内核的最大并发任务数 */
  maxTasksPerKernel?: number;
}

// ═══════════════════════════════════════════════════════════════
// MultiKernelOrchestrator
// ═══════════════════════════════════════════════════════════════

export class MultiKernelOrchestrator {
  private scheduler: CogScheduler;
  private multiInstance: CogMultiInstanceManager;
  private ipc: CogIPC;
  private kernels: Map<string, PiKernelDescriptor> = new Map();
  private config: Required<KernelPoolConfig>;
  private baseOptions: KunlunAgentOptions;

  constructor(baseOptions: KunlunAgentOptions, config: KernelPoolConfig = {}) {
    this.config = {
      analysisKernels: config.analysisKernels ?? 2,
      enableDaemon: config.enableDaemon ?? true,
      maxTasksPerKernel: config.maxTasksPerKernel ?? 4,
    };
    this.baseOptions = baseOptions;

    this.scheduler = new CogScheduler();
    this.multiInstance = new CogMultiInstanceManager(this.scheduler);
    this.ipc = new CogIPC();
  }

  /**
   * 启动内核池
   * 创建 1 个 main + N 个 analysis + 1 个 daemon
   */
  async start(): Promise<void> {
    // ── 主内核（前台交互） ──
    await this.spawnKernel('main', {
      ...this.baseOptions,
      osConfig: { instanceId: 'kunlun-main' },
    });

    // ── 分析内核（后台并行分析） ──
    for (let i = 0; i < this.config.analysisKernels; i++) {
      await this.spawnKernel('analysis', {
        ...this.baseOptions,
        osConfig: { instanceId: `kunlun-analysis-${i}` },
      });
    }

    // ── 守护内核（记忆归纳/进化） ──
    if (this.config.enableDaemon) {
      await this.spawnKernel('daemon', {
        ...this.baseOptions,
        osConfig: { instanceId: 'kunlun-daemon' },
      });
    }
  }

  private async spawnKernel(
    role: PiKernelDescriptor['role'],
    options: KunlunAgentOptions,
  ): Promise<PiKernelDescriptor> {
    const instanceId = options.osConfig?.instanceId ?? `kunlun-${role}-${Date.now()}`;

    await this.multiInstance.spawnInstance(instanceId);

    const agent = new KunlunAgent(options);
    await agent.start();

    const basePriority = role === 'main' ? CogPriority.HIGH
      : role === 'analysis' ? CogPriority.NORMAL
      : CogPriority.IDLE;

    const desc: PiKernelDescriptor = {
      id: instanceId,
      role,
      agent,
      basePriority,
      busy: false,
      taskCount: 0,
    };

    this.kernels.set(instanceId, desc);
    return desc;
  }

  // ═══════════════════════════════════════════════════════════
  // 核心 API
  // ═══════════════════════════════════════════════════════════

  /**
   * 获取主内核（前台交互用）
   */
  getMainKernel(): PiKernelDescriptor | undefined {
    return this.findIdleKernel('main');
  }

  /**
   * 提交分析任务到最空闲的分析内核
   */
  async submitAnalysisTask(
    query: string,
    priority: CogPriority = CogPriority.NORMAL,
  ): Promise<{ kernelId: string; result: any }> {
    const kernel = this.findIdleKernel('analysis');
    if (!kernel) {
      throw new Error('No idle analysis kernel available');
    }

    kernel.busy = true;
    kernel.taskCount++;

    try {
      // 创建认知任务
      const task = this.scheduler.createTask({
        name: `analysis-${query.substring(0, 20)}`,
        type: 'think',
        priority,
        deadline: Date.now() + 60000, // 60s 超时
        context: { input: query },
        instanceId: kernel.id,
        schedPolicy: {
          type: 'contradiction-priority',
          priority,
          basePrio: kernel.basePriority,
          timeSlice: 100,
        },
      });

      this.scheduler.enqueueTask(task, kernel.id);

      // 执行分析
      const analysis = await kernel.agent.os.injectCognition(
        [{ role: 'user', content: query }],
        '',
      );

      return { kernelId: kernel.id, result: analysis };
    } finally {
      kernel.busy = false;
      kernel.taskCount--;
    }
  }

  /**
   * 并行分析多个查询
   * 自动分配到不同的分析内核
   */
  async analyzeParallel(queries: string[]): Promise<Array<{ query: string; kernelId: string; result: any }>> {
    const results = await Promise.all(
      queries.map(q => this.submitAnalysisTask(q))
    );
    return queries.map((q, i) => ({
      query: q,
      kernelId: results[i]!.kernelId,
      result: results[i]!.result,
    }));
  }

  /**
   * 提交守护任务（记忆归纳等，空闲时运行）
   */
  async submitDaemonTask(name: string, fn: () => Promise<any>): Promise<any> {
    const kernel = this.findIdleKernel('daemon');
    if (!kernel) return null;

    kernel.busy = true;
    try {
      return await fn();
    } finally {
      kernel.busy = false;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 查询
  // ═══════════════════════════════════════════════════════════

  /** 获取所有内核状态 */
  getKernelStatus(): Array<{ id: string; role: string; busy: boolean; tasks: number }> {
    return [...this.kernels.values()].map(k => ({
      id: k.id,
      role: k.role,
      busy: k.busy,
      tasks: k.taskCount,
    }));
  }

  /** 获取调度器统计 */
  getSchedulerStats() {
    return this.scheduler.getStats();
  }

  /** 关闭所有内核 */
  stop(): void {
    for (const kernel of this.kernels.values()) {
      kernel.agent.stop();
    }
    this.kernels.clear();
    this.scheduler.stopGC();
    this.scheduler.reset();
  }

  // ═══════════════════════════════════════════════════════════
  // 内部
  // ═══════════════════════════════════════════════════════════

  private findIdleKernel(role: PiKernelDescriptor['role']): PiKernelDescriptor | undefined {
    const candidates = [...this.kernels.values()]
      .filter(k => k.role === role)
      .sort((a, b) => a.taskCount - b.taskCount);

    // 找最空闲的
    for (const k of candidates) {
      if (!k.busy && k.taskCount < this.config.maxTasksPerKernel) {
        return k;
      }
    }

    // 全忙时找任务最少的
    if (candidates.length > 0) {
      return candidates[0];
    }

    return undefined;
  }
}

// ═══════════════════════════════════════════════════════════════
// 便捷工厂
// ═══════════════════════════════════════════════════════════════

/**
 * 创建默认的多内核编排器
 * 1 main + 2 analysis + 1 daemon = 4 个 Pi 微内核
 */
export async function createOrchestrator(
  options: KunlunAgentOptions,
  config?: KernelPoolConfig,
): Promise<MultiKernelOrchestrator> {
  const orch = new MultiKernelOrchestrator(options, config);
  await orch.start();
  return orch;
}
