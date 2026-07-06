/**
 * KunlunOS — 昆仑OS主类
 *
 * 认知操作系统入口，集成所有子系统
 * 参考设计文档第23章
 */

import type { KunlunOSConfig, OSState, OSStatus } from './types';
import { defaultOSConfig } from './types';
import { CogBoot } from './boot';
import type { BootResult } from './boot';

import type { CogScheduler, CogMultiInstanceManager, CogIPC } from '@kunlun/cogkal';
import type { CognEventBus } from '@kunlun/cogbus';
import type { CogAlgorithmRegistry } from '@kunlun/cog-algo';
import type { CogCapabilityRegistry } from '@kunlun/cog-capability';
import type { TrustManager } from '@kunlun/cog-trust';
import type { TokenManager, AttentionScheduler } from '@kunlun/cog-memory';
import type { CognitivePipeline } from '@kunlun/cog-pipeline';
import type { CogProcessManager } from '@kunlun/cog-process';
import type { HumanChannel } from '@kunlun/cog-human';
import type { MetaSynthesisEngine } from '@kunlun/cog-metasynthesis';
import type { CogTaskExecutor } from '@kunlun/cog-executor';
import type { BootPhaseLog } from './types';

// ═══════════════════════════════════════════════════════════════
// KunlunOS 主类
// ═══════════════════════════════════════════════════════════════

export class KunlunOS {
  private config: KunlunOSConfig;
  private status: OSStatus = 'stopped';
  private bootResult: BootResult | null = null;
  private bootLogs: BootPhaseLog[] = [];
  private startTime: number = 0;
  private pausedAt: number = 0;
  private pipelineRuns: number = 0;

  constructor(config?: Partial<KunlunOSConfig>) {
    this.config = { ...defaultOSConfig(), ...config };
    // 浅合并嵌套对象
    if (config?.kal) this.config.kal = { ...defaultOSConfig().kal, ...config.kal };
    if (config?.bus) this.config.bus = { ...defaultOSConfig().bus, ...config.bus };
    if (config?.algo) this.config.algo = { ...defaultOSConfig().algo, ...config.algo };
    if (config?.capability) this.config.capability = { ...defaultOSConfig().capability, ...config.capability };
    if (config?.trust) this.config.trust = { ...defaultOSConfig().trust, ...config.trust };
    if (config?.memory) this.config.memory = { ...defaultOSConfig().memory, ...config.memory };
    if (config?.pipeline) this.config.pipeline = { ...defaultOSConfig().pipeline, ...config.pipeline };
    if (config?.process) this.config.process = { ...defaultOSConfig().process, ...config.process };
    if (config?.human) this.config.human = { ...defaultOSConfig().human, ...config.human };
    if (config?.metasynthesis) this.config.metasynthesis = { ...defaultOSConfig().metasynthesis, ...config.metasynthesis };
    if (config?.executor) this.config.executor = { ...defaultOSConfig().executor, ...config.executor };
  }

  // ─── init: 执行CogBoot引导 ─────────────────────

  async init(): Promise<BootResult> {
    this.status = 'booting';
    const boot = new CogBoot(this.config);
    this.bootResult = await boot.start();
    this.bootLogs = boot.getLogs();
    return this.bootResult;
  }

  // ─── start: 启动OS ─────────────────────────────

  async start(): Promise<void> {
    if (this.status === 'stopped' || this.status === 'error') {
      await this.init();
    }
    if (!this.bootResult) {
      throw new Error('OS not initialized. Call init() first.');
    }
    this.status = 'running';
    this.startTime = Date.now();
    this.pipelineRuns = 0;
  }

  // ─── stop: 停止OS ──────────────────────────────

  stop(): void {
    this.status = 'stopped';
    this.startTime = 0;
    this.pipelineRuns = 0;
  }

  // ─── pause: 暂停 ───────────────────────────────

  pause(): void {
    if (this.status === 'running') {
      this.status = 'paused';
      this.pausedAt = Date.now();
    }
  }

  // ─── resume: 恢复 ──────────────────────────────

  resume(): void {
    if (this.status === 'paused') {
      this.status = 'running';
      // 调整startTime以排除暂停时间
      const pausedDuration = Date.now() - this.pausedAt;
      this.startTime += pausedDuration;
    }
  }

  // ─── getState: 获取OS运行时状态 ─────────────────

  getState(): OSState {
    const uptime = this.status === 'running' || this.status === 'paused'
      ? Date.now() - this.startTime
      : 0;

    const instanceCount = this.bootResult?.scheduler.getInstanceIds().length ?? 0;
    const taskCount = this.bootResult?.scheduler.getStats().totalTasks ?? 0;

    return {
      status: this.status,
      uptime,
      instanceCount,
      taskCount,
      pipelineRuns: this.pipelineRuns,
    };
  }

  // ─── getConfig: 获取配置 ───────────────────────

  getConfig(): KunlunOSConfig {
    return this.config;
  }

  // ─── getBootLogs: 获取引导日志 ──────────────────

  getBootLogs(): BootPhaseLog[] {
    return [...this.bootLogs];
  }

  // ─── 子系统访问器 ──────────────────────────────

  getScheduler(): CogScheduler {
    this.requireBooted();
    return this.bootResult!.scheduler;
  }

  getMultiInstanceManager(): CogMultiInstanceManager {
    this.requireBooted();
    return this.bootResult!.multiInstance;
  }

  getIPC(): CogIPC {
    this.requireBooted();
    return this.bootResult!.ipc;
  }

  getBus(): CognEventBus {
    this.requireBooted();
    return this.bootResult!.bus;
  }

  getAlgoRegistry(): CogAlgorithmRegistry {
    this.requireBooted();
    return this.bootResult!.algoRegistry;
  }

  getCapabilityRegistry(): CogCapabilityRegistry {
    this.requireBooted();
    return this.bootResult!.capabilityRegistry;
  }

  getTrustManager(): TrustManager {
    this.requireBooted();
    return this.bootResult!.trustManager;
  }

  getTokenManager(): TokenManager {
    this.requireBooted();
    return this.bootResult!.tokenManager;
  }

  getAttentionScheduler(): AttentionScheduler {
    this.requireBooted();
    return this.bootResult!.attentionScheduler;
  }

  getPipeline(): CognitivePipeline {
    this.requireBooted();
    return this.bootResult!.pipeline;
  }

  getProcessManager(): CogProcessManager {
    this.requireBooted();
    return this.bootResult!.processManager;
  }

  getHumanChannel(): HumanChannel {
    this.requireBooted();
    return this.bootResult!.humanChannel;
  }

  getMetasynthesisEngine(): MetaSynthesisEngine {
    this.requireBooted();
    return this.bootResult!.metasynthesisEngine;
  }

  getExecutor(): CogTaskExecutor {
    this.requireBooted();
    return this.bootResult!.executor;
  }

  // ─── 内部辅助 ──────────────────────────────────

  private requireBooted(): void {
    if (!this.bootResult) {
      throw new Error('OS not booted. Call init() or start() first.');
    }
  }

  /** 记录一次pipeline运行（供外部或测试调用） */
  incrementPipelineRuns(): void {
    this.pipelineRuns++;
  }
}
