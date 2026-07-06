/**
 * 昆仑日志模块 — 替换所有 silent catch 块
 *
 * 写日志到 extension 目录下的 kunlun.log，同时支持 pi UI 通知。
 * 按级别: error > warn > info > debug
 */

import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOG_DIR = join(dirname(fileURLToPath(import.meta.url)), 'logs');
const LOG_FILE = join(LOG_DIR, 'kunlun.log');

// 确保日志目录存在
if (!existsSync(LOG_DIR)) {
  try { mkdirSync(LOG_DIR, { recursive: true }); } catch { /* log dir creation failure is non-fatal */ }
}

type LogLevel = 'error' | 'warn' | 'info' | 'debug';
const LOG_LEVELS: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 };

const currentLevel: LogLevel = (process.env.KUNLUN_LOG_LEVEL as LogLevel) || 'warn';

function formatTime(): string {
  return new Date().toISOString();
}

function formatError(err: unknown): string {
  if (err instanceof Error) {
    return `${err.message}\n${err.stack?.split('\n').slice(1, 4).join('\n') ?? ''}`;
  }
  return String(err);
}

function writeLog(level: LogLevel, tag: string, message: string): void {
  if (LOG_LEVELS[level] > (LOG_LEVELS[currentLevel] ?? 0)) return;
  try {
    appendFileSync(LOG_FILE, `[${formatTime()}] [${level.toUpperCase()}] [${tag}] ${message}\n`);
  } catch {
    // 日志写入失败不抛出 — 不干扰主流程
  }
}

function formatArgs(args: unknown[]): string {
  return args.map(a => (typeof a === 'object' ? JSON.stringify(a, null, 0).slice(0, 200) : String(a))).join(' ');
}

// ═══════════════════════════════════════════════════════════════
// 公开 API
// ═══════════════════════════════════════════════════════════════

export const log = {
  /** 错误：引擎异常、关键路径失败 */
  error(tag: string, ...args: unknown[]): void {
    const msg = formatArgs(args);
    writeLog('error', tag, msg);
    console.error(`[昆仑] [${tag}]`, ...args);
  },

  /** 警告：降级、非关键失败 */
  warn(tag: string, ...args: unknown[]): void {
    const msg = formatArgs(args);
    writeLog('warn', tag, msg);
    console.warn(`[昆仑] [${tag}]`, ...args);
  },

  /** 信息：关键路径状态变化 */
  info(tag: string, ...args: unknown[]): void {
    const msg = formatArgs(args);
    writeLog('info', tag, msg);
    console.info(`[昆仑] [${tag}]`, ...args);
  },

  /** 调试：分析详情、决策日志 */
  debug(tag: string, ...args: unknown[]): void {
    const msg = formatArgs(args);
    writeLog('debug', tag, msg);
  },

  /**
   * 带上下文的错误 — 替换 catch { /* 静默 *​/ }
   * 自动关联操作名称和错误对象
   */
  catchError(tag: string, operation: string, error: unknown): void {
    const detail = formatError(error);
    writeLog('error', tag, `[${operation}] ${detail}`);
    console.error(`[昆仑] [${tag}] [${operation}]`, error);
  },
};

/** 获取当前日志文件路径 */
export function getLogPath(): string {
  return LOG_FILE;
}

/** 获取当前日志级别 */
export function getLogLevel(): LogLevel {
  return currentLevel;
}
