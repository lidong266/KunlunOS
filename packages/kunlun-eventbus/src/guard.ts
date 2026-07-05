/**
 * L2 事件总线保护器 — 风暴检测 / 循环检测 / Handler 隔离
 */

import type { Trit } from '@kunlun/ternary';

// ─── 风暴保护器 ───

export class StormProtector {
  private window: Array<{ timestamp: number; eventType: string }> = [];
  private readonly STORM_THRESHOLD: number;

  constructor(thresholdPerSec = 1000) {
    this.STORM_THRESHOLD = thresholdPerSec;
  }

  /**
   * 判断是否允许此事件通过。
   * 风暴模式下只放行 Trit=+1 的关键事件。
   */
  shouldAllow(eventType: string, trit: Trit): boolean {
    const now = Date.now();
    // 清理过期窗口（保留最近 1 秒）
    this.window = this.window.filter(e => now - e.timestamp < 1000);

    if (this.window.length >= this.STORM_THRESHOLD) {
      // 背压模式：只放行关键事件
      return trit === +1 ? true : false;
    }

    this.window.push({ timestamp: now, eventType });
    return true;
  }

  /** 获取当前窗口内的事件数 */
  get currentRate(): number {
    return this.window.length;
  }

  /** 重置窗口 */
  reset(): void {
    this.window = [];
  }
}

// ─── 循环检测器 ───

export class LoopDetector {
  private emitStack: string[] = [];
  private readonly MAX_DEPTH: number;

  constructor(maxDepth = 16) {
    this.MAX_DEPTH = maxDepth;
  }

  /**
   * 入栈 — 返回 false 表示检测到循环或超深度，调用方应丢弃此事件。
   */
  enter(eventType: string): boolean {
    // 深度检查
    if (this.emitStack.length >= this.MAX_DEPTH) {
      console.error(`[EventBus] MAX_DEPTH(${this.MAX_DEPTH}) exceeded: ${eventType}`);
      return false;
    }

    // 循环检查
    if (this.emitStack.includes(eventType)) {
      console.error(
        `[EventBus] LOOP DETECTED: ${eventType} → ${this.emitStack.join(' → ')} → ${eventType}`
      );
      return false;
    }

    this.emitStack.push(eventType);
    return true;
  }

  /** 出栈 */
  exit(): void {
    this.emitStack.pop();
  }

  /** 当前深度 */
  get depth(): number {
    return this.emitStack.length;
  }
}

// ─── Handler 安全调用 ───

export type HandlerResult = 'ok' | 'timeout' | 'error';

/**
 * 在隔离的 try/catch 中执行 handler，带超时保护。
 * 单一 handler 崩溃不影响其他 handler，也不影响总线。
 */
export async function safeInvokeHandler(
  handler: (payload: unknown) => void | Promise<void>,
  payload: unknown,
  timeoutMs = 5000
): Promise<HandlerResult> {
  try {
    const result = handler(payload);
    if (result instanceof Promise) {
      // 超时保护
      await Promise.race([
        result.catch(() => {}), // 吞掉 handler 自身的异常
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('HANDLER_TIMEOUT')), timeoutMs)
        ),
      ]);
    }
    return 'ok';
  } catch (err) {
    if (err instanceof Error && err.message === 'HANDLER_TIMEOUT') {
      console.warn(`[EventBus] Handler timeout (>${timeoutMs}ms), continuing...`);
      return 'timeout';
    }
    console.error('[EventBus] Handler error (non-fatal, bus continues):', err);
    return 'error';
  }
}
