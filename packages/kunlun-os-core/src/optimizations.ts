/**
 * KunlunOS 多微内核优化方案 v2
 *
 * 当前: 每个Pi独立agent-loop，互不知晓
 * 优化: 昆仑OS在MapReduce中注入共享上下文 + 预取 + 去重
 *
 * 优化1: 共享上下文预注入
 *   主Pi分析后，把关键上下文(文件内容/知识卡片)注入给子Pi的system prompt
 *   子Pi不再各自read_file，节省工具调用
 *
 * 优化2: 工具调用去重
 *   多个子Pi同时请求同一个文件 → 只执行一次，结果广播
 *
 * 优化3: 认知任务预取
 *   injectCognition预测子Pi可能需要的信息，提前检索并注入
 *
 * 优化4: 流式Reduce + 并发控制
 *   不等所有子Pi完成再汇总，完成一个就注入到主Pi的context
 *
 * v2 新增:
 * 优化5: 并发控制(ConcurrencyController)
 *   Promise信号量模式，防止同时发起过多LLM请求压垮下游
 * 优化6: 增量Reduce上下文
 *   每完成一个Worker立即将结果注入共享层，后续Worker可见
 */

import { SharedCognitiveLayer } from './shared-layer.js';
import type { KunlunAnalysis } from './kunlun-os.js';

// ═══════════════════════════════════════════════════════════════
// 工具调用去重器
// ═══════════════════════════════════════════════════════════════

interface PendingToolCall {
  toolName: string;
  args: Record<string, unknown>;
  promise: Promise<any>;
  subscribers: Array<(result: any) => void>;
}

export class ToolDeduplicator {
  private pending = new Map<string, PendingToolCall>();
  private results = new Map<string, { result: any; timestamp: number }>();
  private ttlMs: number;

  constructor(ttlMs = 30000) {
    this.ttlMs = ttlMs;
  }

  /**
   * 去重执行工具调用
   * 如果多个Pi同时请求同一个文件，只执行一次
   */
  async execute(
    toolName: string,
    args: Record<string, unknown>,
    executor: () => Promise<any>,
  ): Promise<any> {
    const key = `${toolName}:${JSON.stringify(args)}`;

    // 检查缓存
    const cached = this.results.get(key);
    if (cached && Date.now() - cached.timestamp < this.ttlMs) {
      return cached.result;
    }

    // 检查是否已有进行中的请求
    const pending = this.pending.get(key);
    if (pending) {
      return new Promise((resolve) => {
        pending.subscribers.push(resolve);
      });
    }

    // 新请求
    const subscribers: Array<(r: any) => void> = [];
    const promise = executor().then((result) => {
      this.results.set(key, { result, timestamp: Date.now() });
      this.pending.delete(key);
      for (const sub of subscribers) sub(result);
      return result;
    });

    this.pending.set(key, { toolName, args, promise, subscribers });
    return promise;
  }

  getStats() {
    return {
      pendingCalls: this.pending.size,
      cachedResults: this.results.size,
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// 并发控制器 — Promise 信号量
// ═══════════════════════════════════════════════════════════════

/**
 * 并发控制器：限制同时进行中的异步操作数
 *
 * 场景: 5个Worker池，但Map阶段可能有8个子任务
 *       → 同时最多5个Worker并行，其余排队
 */
export class ConcurrencyController {
  private running = 0;
  private queue: Array<() => void> = [];
  private _maxConcurrency: number;

  constructor(maxConcurrency: number) {
    this._maxConcurrency = Math.max(1, maxConcurrency);
  }

  /** 获取执行槽位。若已满则排队等待 */
  async acquire(): Promise<void> {
    if (this.running < this._maxConcurrency) {
      this.running++;
      return;
    }
    return new Promise<void>(resolve => {
      this.queue.push(() => {
        this.running++;
        resolve();
      });
    });
  }

  /** 释放槽位，唤醒下一个等待者 */
  release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) {
      // 微任务调度，避免调用栈膨胀
      setImmediate ? setImmediate(next) : setTimeout(next, 0);
    }
  }

  get active(): number { return this.running; }
  get waiting(): number { return this.queue.length; }
  get maxConcurrency(): number { return this._maxConcurrency; }
}

// ═══════════════════════════════════════════════════════════════
// 认知预取器
// ═══════════════════════════════════════════════════════════════

export interface PrefetchContext {
  /** 关键文件路径（预读） */
  filePaths: string[];
  /** 知识卡片 ID */
  cardIds: string[];
  /** 共享记忆条目 */
  memoryIds: string[];
  /** 摘要文本 */
  summary: string;
}

export class CognitivePrefetcher {
  private shared: SharedCognitiveLayer;
  private toolDedup: ToolDeduplicator;

  constructor(shared: SharedCognitiveLayer) {
    this.shared = shared;
    this.toolDedup = new ToolDeduplicator();
  }

  /**
   * 从认知分析结果生成预取上下文
   * 子Pi不需要各自检索——主Pi已经分析过了
   */
  buildPrefetchContext(
    query: string,
    analysis: KunlunAnalysis,
  ): PrefetchContext {
    const ctx: PrefetchContext = {
      filePaths: [],
      cardIds: analysis.knowledgeCards?.map(c => c.id) ?? [],
      memoryIds: [],
      summary: analysis.summary,
    };

    // 从共享记忆检索相关内容
    const memories = this.shared.queryMemory(query);
    ctx.memoryIds = memories.slice(0, 3).map(m => m.id);

    return ctx;
  }

  /**
   * 将预取上下文格式化为子Pi的system prompt注入
   */
  formatPrefetchPrompt(ctx: PrefetchContext): string {
    const lines: string[] = [];
    lines.push('');
    lines.push('─── 共享认知上下文（昆仑OS预取） ───');
    lines.push('');
    lines.push(`【分析摘要】${ctx.summary}`);
    lines.push('');

    if (ctx.memoryIds.length > 0) {
      lines.push(`【共享记忆】${ctx.memoryIds.length}条相关记忆已加载`);
    }
    if (ctx.cardIds.length > 0) {
      lines.push(`【知识卡片】${ctx.cardIds.join(', ')}`);
    }
    lines.push('────────────────────────────');
    lines.push('');
    return lines.join('\n');
  }

  getDeduplicator(): ToolDeduplicator {
    return this.toolDedup;
  }
}

// ═══════════════════════════════════════════════════════════════
// 流式 Reduce 收集器
// ═══════════════════════════════════════════════════════════════

export interface StreamReduceResult {
  taskId: string;
  result: string;
  index: number;
}

/** 增量 Reduce 回调签名：每完成一个 Worker 即触发 */
export type PartialReduceCallback = (
  completed: number,
  total: number,
  result: string,
  index: number,
  /** 当前所有已完成结果（按索引排序，未完成的为空串） */
  allResults: string[],
) => void | Promise<void>;

export class StreamReduceCollector {
  private results: Map<number, string> = new Map();
  private total: number;
  private onPartial?: (completed: number, total: number) => void;
  private onPartialResult?: PartialReduceCallback;
  private resolve!: (results: string[]) => void;
  private promise: Promise<string[]>;

  /**
   * @param total 总子任务数
   * @param onPartial 进度回调（兼容旧接口）
   */
  constructor(total: number, onPartial?: (completed: number, total: number) => void) {
    this.total = total;
    this.onPartial = onPartial;
    this.promise = new Promise((resolve) => { this.resolve = resolve; });
  }

  /** 设置增量结果回调（流式Reduce核心） */
  setPartialResultCallback(cb: PartialReduceCallback): this {
    this.onPartialResult = cb;
    return this;
  }

  /** 收集一个子Pi的结果 */
  collect(index: number, result: string): void {
    this.results.set(index, result);

    // 旧接口兼容
    this.onPartial?.(this.results.size, this.total);

    // 增量 Reduce：立即通知调用方有新的部分结果
    if (this.onPartialResult) {
      const allSorted = this.getAllSorted();
      this.onPartialResult(this.results.size, this.total, result, index, allSorted);
    }

    // 全部完成 → resolve
    if (this.results.size >= this.total) {
      this.resolve(this.getAllSorted());
    }
  }

  /** 等待所有结果收集完成 */
  async waitAll(): Promise<string[]> {
    return this.promise;
  }

  /** 获取当前已收集的结果快照（按索引排序） */
  getPartialResults(): string[] {
    return this.getAllSorted();
  }

  /** 获取已完成的索引集合 */
  get completedIndices(): Set<number> {
    return new Set(this.results.keys());
  }

  private getAllSorted(): string[] {
    const ordered: string[] = [];
    for (let i = 0; i < this.total; i++) {
      ordered.push(this.results.get(i) ?? '');
    }
    return ordered;
  }
}
