/**
 * TernaryEventBus — 三进制事件总线实现
 *
 * 集成四层保护：
 *   1. 风暴检测（StormProtector）— 超阈值时降级为仅放行关键事件
 *   2. 循环检测（LoopDetector）— 检测 A→B→A 事件循环
 *   3. Handler 隔离（safeInvokeHandler）— 单 handler 崩溃不拖垮总线
 *   4. Trit 过滤（onTrit）— 按事件的三元值分流订阅
 */

import type { Trit } from '@kunlun/ternary';
import type {
  ITernaryEventBus,
  TernaryEventHandler,
  TernaryEventMap,
  TernaryEventPayload,
  EventBusStats,
} from './types.js';
import { StormProtector, LoopDetector, safeInvokeHandler } from './guard.js';

interface TritSubscription {
  handler: TernaryEventHandler;
  tritFilter?: Trit;
}

export class TernaryEventBus implements ITernaryEventBus {
  private subscribers = new Map<string, TritSubscription[]>();
  private stormProtector: StormProtector;
  private loopDetector: LoopDetector;

  // 统计
  private totalEmitted = 0;
  private totalDropped = 0;
  private totalLoopsDetected = 0;
  private totalStormsTriggered = 0;
  private totalHandlerErrors = 0;
  private totalHandlerTimeouts = 0;

  constructor(options?: {
    stormThresholdPerSec?: number;
    maxEmitDepth?: number;
    handlerTimeoutMs?: number;
  }) {
    this.stormProtector = new StormProtector(options?.stormThresholdPerSec ?? 1000);
    this.loopDetector = new LoopDetector(options?.maxEmitDepth ?? 16);
  }

  // ─── public API ───

  get currentDepth(): number {
    return this.loopDetector.depth;
  }

  emit<K extends keyof TernaryEventMap = string>(
    event: K,
    payload: TernaryEventMap[K]
  ): void {
    const eventType = event as string;
    const trit = (payload as TernaryEventPayload).trit ?? 0;

    // 第 1 层：风暴检测
    if (!this.stormProtector.shouldAllow(eventType, trit)) {
      this.totalStormsTriggered++;
      this.totalDropped++;
      return;
    }

    // 第 2 层：循环检测
    if (!this.loopDetector.enter(eventType)) {
      this.totalLoopsDetected++;
      this.totalDropped++;
      return;
    }

    this.totalEmitted++;

    // 第 3 层：遍历所有订阅者，隔离执行
    const subs = this.subscribers.get(eventType) || [];
    const promises: Promise<void>[] = [];

    for (const sub of subs) {
      // Trit 过滤
      if (sub.tritFilter !== undefined && sub.tritFilter !== trit) {
        continue;
      }

      const handlerPromise = (async () => {
        const result = await safeInvokeHandler(
          sub.handler as (p: unknown) => void | Promise<void>,
          payload
        );
        if (result === 'error') this.totalHandlerErrors++;
        if (result === 'timeout') this.totalHandlerTimeouts++;
      })();

      promises.push(handlerPromise);
    }

    // 等待所有 handler 完成（或超时）
    Promise.allSettled(promises).finally(() => {
      // 第 4 层：出栈
      this.loopDetector.exit();
    });
  }

  on<K extends keyof TernaryEventMap = string>(
    event: K,
    handler: TernaryEventHandler<TernaryEventMap[K]>
  ): void {
    const eventType = event as string;
    const subs = this.subscribers.get(eventType) || [];
    subs.push({ handler: handler as TernaryEventHandler });
    this.subscribers.set(eventType, subs);
  }

  off<K extends keyof TernaryEventMap = string>(
    event: K,
    handler: TernaryEventHandler<TernaryEventMap[K]>
  ): void {
    const eventType = event as string;
    const subs = this.subscribers.get(eventType) || [];
    this.subscribers.set(
      eventType,
      subs.filter(s => s.handler !== handler)
    );
  }

  onTrit<K extends keyof TernaryEventMap = string>(
    event: K,
    tritFilter: Trit,
    handler: TernaryEventHandler<TernaryEventMap[K]>
  ): void {
    const eventType = event as string;
    const subs = this.subscribers.get(eventType) || [];
    subs.push({
      handler: handler as TernaryEventHandler,
      tritFilter,
    });
    this.subscribers.set(eventType, subs);
  }

  getStats(): EventBusStats {
    let subCount = 0;
    for (const subs of this.subscribers.values()) {
      subCount += subs.length;
    }
    return {
      totalEmitted: this.totalEmitted,
      totalDropped: this.totalDropped,
      totalLoopsDetected: this.totalLoopsDetected,
      totalStormsTriggered: this.totalStormsTriggered,
      totalHandlerErrors: this.totalHandlerErrors,
      totalHandlerTimeouts: this.totalHandlerTimeouts,
      currentDepth: this.loopDetector.depth,
      subscriberCount: subCount,
    };
  }

  /** 重置统计（测试用） */
  resetStats(): void {
    this.totalEmitted = 0;
    this.totalDropped = 0;
    this.totalLoopsDetected = 0;
    this.totalStormsTriggered = 0;
    this.totalHandlerErrors = 0;
    this.totalHandlerTimeouts = 0;
  }
}
