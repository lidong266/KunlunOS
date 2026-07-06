/**
 * KunlunOS 主入口 — 以 Pi Agent 为微内核的认知操作系统
 *
 * 架构：
 *   Pi Agent (Agent/AgentHarness) → 微内核层（LLM调用 + 工具执行 + 消息流）
 *   昆仑OS                         → 认知调度层（三元分析 + 矛盾引擎 + 策略 + 记忆）
 *
 * 关键原则：昆仑OS 调度 Pi，不是 Pi 调度昆仑OS。
 * 昆仑OS 在每次 LLM 调用前注入三元认知分析到 system prompt，
 * 在每次工具调用前通过安全管线决策是否放行。
 */

import type { Trit, Tryte } from '@kunlun/ternary';
import { T_TRUE, T_UNKNOWN, T_FALSE } from '@kunlun/ternary';
import { createContradictionEngine } from '@kunlun/contradiction';
import type { ContradictionEngine } from '@kunlun/contradiction';
import { PracticeSpiralEngine } from '@kunlun/spiral';
import { ProtractedWarEngine } from '@kunlun/pw';

import type { KunlunOSConfig, OSStatus, OSState, BootPhaseLog } from './types';
import { defaultOSConfig } from './types';
import { CogBoot } from './boot';
import type { BootResult } from './boot';

// ─── 认知分析结果 ──────────────────────────────────────────

export interface KunlunAnalysis {
  contradictions: Array<{ thesis: string; antithesis: string }>;
  unifiability: Trit;
  dominantAspect: Trit;
  qualitativeState: Trit;
  strategy?: string;
  memoryContext?: string;
  ecosystemHealth?: Trit;
  summary: string;
  /** 注入到 LLM system prompt 的格式化文本 */
  promptInjection: string;
}

// ─── 工具安全决策 ──────────────────────────────────────────

export interface KunlunToolDecision {
  allowed: boolean;
  blockReason?: string;
  suggestedAlternative?: string;
  priority?: number;
}

// ═══════════════════════════════════════════════════════════════
// KunlunOS 主类
// ═══════════════════════════════════════════════════════════════

export class KunlunOS {
  private config: KunlunOSConfig;
  private status: OSStatus = 'stopped';
  private startTime: number = 0;
  private _pipelineRuns = 0;
  private _bootLogs: BootPhaseLog[] = [];

  // CogBoot 引导结果（init/start 后可用）
  private bootResult: BootResult | null = null;

  // 核心引擎（在 init 期间通过 CogBoot 初始化）
  private _contradiction!: ContradictionEngine;
  private _spiral!: PracticeSpiralEngine;
  private _protractedWar!: ProtractedWarEngine;

  // Pi Agent 引用
  piAgent: unknown = null;

  constructor(config: Partial<KunlunOSConfig> = {}) {
    this.config = { ...defaultOSConfig(), ...config };
  }

  // ═══════════════════════════════════════════════════════════
  // 生命周期
  // ═══════════════════════════════════════════════════════════

  /**
   * 初始化昆仑OS（执行 CogBoot 引导，但不启动运行时）
   * 调用后状态变为 'booting'
   */
  async init(): Promise<void> {
    if (this.status !== 'stopped') return;
    this.status = 'booting';
    this.startTime = Date.now();

    this.log('昆仑OS 认知操作系统初始化中...');

    // 执行 CogBoot 6 阶段引导
    const boot = new CogBoot(this.config);
    this.bootResult = await boot.start();
    this._bootLogs = [...this.bootResult.logs];

    // 初始化核心引擎
    this._contradiction = createContradictionEngine();
    this._spiral = new PracticeSpiralEngine();
    this._protractedWar = new ProtractedWarEngine();

    this.log(`  - 矛盾引擎: 就绪 (8分析器)`);
    this.log(`  - 持久战引擎: 就绪 (三阶段)`);
    this.log(`  - 实践螺旋: 就绪 (四阶段)`);
    this.log(`  - 调度器: 就绪 (${this.bootResult.instanceIds.length} 实例)`);
    this.log(`  - 事件总线: 就绪 (双通道)`);
    this.log(`  - 算法注册表: ${this.bootResult.algoRegistry.listAlgorithms().length} 个插件`);

    this.log(`✅ ${this.config.instanceId} 初始化完成`);
  }

  /**
   * 启动昆仑OS（等同于 init + 启动运行时）
   * 调用后状态变为 'running'
   */
  async start(): Promise<void> {
    if (this.status === 'running') return;

    // 如果尚未初始化，先执行 init
    if (!this.bootResult) {
      await this.init();
    }

    this.status = 'running';
    this.log(`${this.config.instanceId} 已启动`);
  }

  /** 停止昆仑OS */
  stop(): void {
    if (this.bootResult) {
      this.bootResult.scheduler.stopGC();
      this.bootResult.scheduler.reset();
    }
    this.status = 'stopped';
    this.startTime = 0;
    this.log('昆仑OS 已停止');
  }

  /** 暂停 */
  pause(): void {
    if (this.status === 'running') this.status = 'paused';
  }

  /** 恢复 */
  resume(): void {
    if (this.status === 'paused') this.status = 'running';
  }

  // ═══════════════════════════════════════════════════════════
  // 子系统访问器（需在 boot 后调用）
  // ═══════════════════════════════════════════════════════════

  private ensureBooted(): BootResult {
    if (!this.bootResult) {
      throw new Error('KunlunOS has not been booted. Call start() or init() first.');
    }
    return this.bootResult;
  }

  getScheduler() { return this.ensureBooted().scheduler; }
  getMultiInstance() { return this.ensureBooted().multiInstance; }
  getIpc() { return this.ensureBooted().ipc; }
  getBus() { return this.ensureBooted().bus; }
  getAlgoRegistry() { return this.ensureBooted().algoRegistry; }
  getCapabilityRegistry() { return this.ensureBooted().capabilityRegistry; }
  getTrustManager() { return this.ensureBooted().trustManager; }
  getTokenManager() { return this.ensureBooted().tokenManager; }
  getAttentionScheduler() { return this.ensureBooted().attentionScheduler; }
  getPipeline() { return this.ensureBooted().pipeline; }
  getProcessManager() { return this.ensureBooted().processManager; }
  getHumanChannel() { return this.ensureBooted().humanChannel; }
  getMetasynthesisEngine() { return this.ensureBooted().metasynthesisEngine; }
  getMetasynthesisWorkshop() { return this.ensureBooted().metasynthesisWorkshop; }
  getExecutor() { return this.ensureBooted().executor; }

  /** 获取引导日志 */
  getBootLogs(): BootPhaseLog[] {
    return [...this._bootLogs];
  }

  /** 递增管道运行计数 */
  incrementPipelineRuns(): void {
    this._pipelineRuns++;
  }

  // ═══════════════════════════════════════════════════════════
  // 核心引擎访问器（兼容旧 API）
  // ═══════════════════════════════════════════════════════════

  get contradiction(): ContradictionEngine {
    return this._contradiction;
  }

  get spiral(): PracticeSpiralEngine {
    return this._spiral;
  }

  get protractedWar(): ProtractedWarEngine {
    return this._protractedWar;
  }

  // ═══════════════════════════════════════════════════════════
  // 核心 API：认知注入（兼容 pi-adapter）
  // ═══════════════════════════════════════════════════════════

  /**
   * 将昆仑OS 认知分析注入到 LLM system prompt
   * 在 Pi 的 agent-loop 中，每次 LLM 调用前会自动调用此方法
   */
  async injectCognition(
    messages: Array<{ role: string; content: unknown }>,
    systemPrompt: string,
  ): Promise<KunlunAnalysis> {
    if (!this._contradiction) {
      return this.emptyAnalysis();
    }

    // 提取最新用户消息
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    const queryText = lastUserMsg
      ? (typeof lastUserMsg.content === 'string'
        ? lastUserMsg.content
        : Array.isArray(lastUserMsg.content)
          ? lastUserMsg.content.map((c: any) => typeof c === 'string' ? c : c.text || '').join(' ')
          : '')
      : '';

    if (!queryText) return this.emptyAnalysis();

    const contradictions: Array<{ thesis: string; antithesis: string }> = [];
    let unifiability: Trit = T_UNKNOWN;
    let dominantAspect: Trit = T_UNKNOWN;
    let qualitativeState: Trit = T_FALSE;
    let strategy: string | undefined;
    let memoryContext: string | undefined;
    let ecosystemHealth: Trit | undefined;

    // 谛听：矛盾感知
    const extracted = this.extractContradictions(queryText);
    contradictions.push(...extracted);

    if (contradictions.length > 0) {
      try {
        const result = this._contradiction.analyzeSingle({
          id: `kunlun-${Date.now()}`,
          thesis: {
            id: `th-${Date.now()}`,
            statement: contradictions[0]!.thesis,
            domain: 'general',
            evidence: [],
            counterEvidence: [],
            confidenceTrit: T_UNKNOWN,
            confidenceVector: [0, 0, 0, 0, 0, 0] as Tryte,
            source: { type: 'perception', signalId: 'kunlun' },
            dependencies: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          antithesis: {
            id: `at-${Date.now()}`,
            statement: contradictions[0]!.antithesis,
            domain: 'general',
            evidence: [],
            counterEvidence: [],
            confidenceTrit: T_UNKNOWN,
            confidenceVector: [0, 0, 0, 0, 0, 0] as Tryte,
            source: { type: 'perception', signalId: 'kunlun' },
            dependencies: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          contradictionType: 'non_antagonistic',
          discoveredBy: 'diting_perception',
          discoveredAt: Date.now(),
          relatedContradictions: [],
          priority: 0.5,
          presenceStateAtDiscovery: 'active',
          warPhaseAtDiscovery: 'stalemate',
        });

        unifiability = result.analysis.unifiability;
        dominantAspect = result.analysis.dominantAspect;
        qualitativeState = result.qualitativeChange.approachingThreshold;
      } catch {
        // 降级：纯规则模式
      }
    }

    // 持久战策略
    if (this._protractedWar && this.matchesStrategy(queryText)) {
      try {
        const pwCtx = {
          totalRuntime: Date.now() - this.startTime,
          currentPhaseDuration: 0,
          phaseHistory: [] as any[],
          powerSnapshot: {
            relativeStrengthRatio: 0.5,
            strengthTrend: [0.4, 0.45, 0.5] as number[],
            capabilities: {} as Record<string, number>,
          },
          activeContradictions: [] as any[],
          spiralMetrics: {
            recentAscensionRatio: { ascension: 1, flat: 2, regression: 0 },
            recentBreakthroughs: 0,
          },
          criticalEvents: [] as any[],
        };
        const phase = await this._protractedWar.assessPhase(pwCtx);
        const labels: Record<string, string> = {
          defense: '🛡️ 防御阶段', stalemate: '⚔️ 相持阶段', counteroffensive: '⚡ 反攻阶段',
        };
        strategy = `策略阶段: ${labels[phase.currentPhase] ?? phase.currentPhase}`;
      } catch { /* ignore */ }
    }

    // 实践螺旋
    if (this._spiral && this.matchesSpiral(queryText)) {
      try {
        const ctx = {
          domain: queryText,
          hypothesis: queryText,
          environment: { type: 'simulation' as const, constraints: [] },
          relatedContradictions: [] as any[],
        };
        const result = await this._spiral.engagePractice(ctx);
        if (result.emergentObservations?.length) {
          strategy = (strategy ? strategy + '；' : '') + `实践洞察: ${result.emergentObservations.join('; ')}`;
        }
      } catch { /* ignore */ }
    }

    // 构建 prompt 注入文本
    const summary = contradictions.length > 0
      ? `检测到 ${contradictions.length} 组矛盾，可统一性: ${unifiability === 1 ? '可统一' : unifiability === 0 ? '待分析' : '不可调和'}`
      : strategy
        ? `策略分析进行中`
        : '基础认知模式';

    const promptInjection = this.buildPromptInjection({
      contradictions,
      unifiability,
      dominantAspect,
      strategy,
      summary,
    });

    return {
      contradictions,
      unifiability,
      dominantAspect,
      qualitativeState,
      strategy,
      memoryContext,
      ecosystemHealth,
      summary,
      promptInjection,
    };
  }

  /**
   * 工具安全决策 — 在 Pi 执行工具前调用
   * 用作 Pi AgentLoopConfig.beforeToolCall 的回调
   */
  decideTool(
    toolName: string,
    toolArgs: Record<string, unknown>,
    latestAnalysis?: KunlunAnalysis | null,
  ): KunlunToolDecision {
    const name = toolName.toLowerCase();

    // 读操作始终放行
    if (/^(read|list|search|ls|cat|get|fetch|find|rg|grep)/.test(name)) {
      return { allowed: true, priority: 8 };
    }

    // 写操作：矛盾激烈时阻止
    if (/^(write|edit|delete|remove|mv|cp|patch)/.test(name)) {
      if (latestAnalysis && latestAnalysis.contradictions.length > 0 && latestAnalysis.unifiability === T_FALSE) {
        return {
          allowed: false,
          blockReason: `🔒 昆仑OS: 检测到不可调和矛盾，建议先分析再修改`,
          suggestedAlternative: 'read',
          priority: 0,
        };
      }
      return { allowed: true, priority: 2 };
    }

    // 执行类：中等优先级
    if (/^(bash|run|exec|test)/.test(name)) {
      return { allowed: true, priority: 5 };
    }

    return { allowed: true, priority: 3 };
  }

  // ═══════════════════════════════════════════════════════════
  // 查询与状态
  // ═══════════════════════════════════════════════════════════

  getState(): OSState {
    const instanceCount = this.bootResult
      ? this.bootResult.scheduler.getInstanceIds().length
      : 0;
    const taskCount = this.bootResult
      ? this.bootResult.scheduler.getTasks().length
      : 0;

    return {
      status: this.status,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      instanceCount,
      taskCount,
      pipelineRuns: this._pipelineRuns,
    };
  }

  getConfig(): KunlunOSConfig {
    return { ...this.config };
  }

  isRunning(): boolean {
    return this.status === 'running';
  }

  // ═══════════════════════════════════════════════════════════
  // 内部方法
  // ═══════════════════════════════════════════════════════════

  private emptyAnalysis(): KunlunAnalysis {
    return {
      contradictions: [],
      unifiability: T_UNKNOWN,
      dominantAspect: T_UNKNOWN,
      qualitativeState: T_FALSE,
      summary: '无用户输入',
      promptInjection: '',
    };
  }

  private extractContradictions(query: string): Array<{ thesis: string; antithesis: string }> {
    const pairs: Array<{ thesis: string; antithesis: string }> = [];

    // "A vs B" 模式
    const vsMatch = query.match(/(.+?)\s+(?:vs|VS|和|与|跟)\s+(.+?)(?:\s+的[矛盾冲突]|$|[，。])/);
    if (vsMatch) {
      pairs.push({ thesis: vsMatch[1]!.trim(), antithesis: vsMatch[2]!.trim() });
      return pairs;
    }

    // "A 但 B" 模式
    const butMatch = query.match(/(.+?)但(?:是)?(.+?)(?:$|[，。])/);
    if (butMatch) {
      pairs.push({ thesis: butMatch[1]!.trim(), antithesis: butMatch[2]!.trim() });
      return pairs;
    }

    // 常见矛盾对
    const patterns: Array<[string, string, string[]]> = [
      ['性能', '成本', ['性能', '成本']],
      ['效率', '质量', ['效率', '质量']],
      ['创新', '稳定', ['创新', '稳定']],
      ['安全', '便捷', ['安全', '便捷']],
      ['开放', '控制', ['开放', '管控']],
      ['速度', '质量', ['快', '好', '速度', '质量']],
    ];

    for (const [a, b, keywords] of patterns) {
      if (keywords.some(k => query.includes(k))) {
        pairs.push({ thesis: `追求${a}`, antithesis: `保证${b}` });
      }
    }

    return pairs;
  }

  private matchesStrategy(query: string): boolean {
    return /战略|规划|计划|持久战|阶段|发展|转型|升级|策略/.test(query);
  }

  private matchesSpiral(query: string): boolean {
    return /学习|反思|迭代|改进|优化|复盘|实践/.test(query);
  }

  private buildPromptInjection(analysis: {
    contradictions: Array<{ thesis: string; antithesis: string }>;
    unifiability: Trit;
    dominantAspect: Trit;
    strategy?: string;
    summary: string;
  }): string {
    const lines: string[] = [];
    lines.push('');
    lines.push('─── 三元认知分析（昆仑OS） ───');
    lines.push('');

    if (analysis.contradictions.length > 0) {
      lines.push('【矛盾感知】');
      for (const c of analysis.contradictions) {
        lines.push(`  · ${c.thesis} ↔ ${c.antithesis}`);
      }
      const unifLabel = analysis.unifiability === 1 ? '可统一 ✅' : analysis.unifiability === 0 ? '待分析 ⚪' : '不可调和 ❌';
      lines.push(`  整体矛盾状态：${unifLabel}`);
      const aspectLabel = analysis.dominantAspect === 1 ? '正题主导' : analysis.dominantAspect === -1 ? '反题主导' : '均势';
      lines.push(`  主导方面：${aspectLabel}`);
      lines.push('');
    }

    if (analysis.strategy) {
      lines.push('【策略建议】');
      lines.push(`  ${analysis.strategy}`);
      lines.push('');
    }

    lines.push('【分析摘要】' + analysis.summary);
    lines.push('────────────────────────────');
    lines.push('');

    return lines.join('\n');
  }

  private log(message: string): void {
    if (this.config.verbose) {
      const ts = new Date().toISOString().split('T')[1]!.slice(0, 8);
      console.log(`[${ts}] [KunlunOS] ${message}`);
    }
  }
}

// ─── 便捷工厂 ──────────────────────────────────────────────

let globalOS: KunlunOS | null = null;

/** 获取或创建全局昆仑OS 实例 */
export function getKunlunOS(config?: Partial<KunlunOSConfig>): KunlunOS {
  if (!globalOS) {
    globalOS = new KunlunOS(config);
  }
  return globalOS;
}

/** 启动全局昆仑OS */
export async function bootKunlunOS(config?: Partial<KunlunOSConfig>): Promise<KunlunOS> {
  const os = getKunlunOS(config);
  await os.start();
  return os;
}
