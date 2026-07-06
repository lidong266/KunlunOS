/**
 * 昆仑性能基准模块
 *
 * 记录每次三元分析的性能数据，生成趋势报告。
 * 数据写至 logs/perf.log (JSON Lines)，可用 perf report 命令查看。
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOG_DIR = join(dirname(fileURLToPath(import.meta.url)), 'logs');
const PERF_FILE = join(LOG_DIR, 'perf.log');
const SNAPSHOT_FILE = join(LOG_DIR, 'perf-snapshot.json');

if (!existsSync(LOG_DIR)) {
  try { mkdirSync(LOG_DIR, { recursive: true }); } catch { /* ok */ }
}

// ═══════════════════════════════════════════════════════════════
// 性能记录条目
// ═══════════════════════════════════════════════════════════════

export interface PerfEntry {
  /** 时间戳 */
  ts: string;
  /** 分析耗时 (ms) */
  durationMs: number;
  /** 矛盾对数量 */
  contradictions: number;
  /** 已激活的模块数量 */
  modulesActivated: number;
  /** 已激活的模块名称 */
  modules: string[];
  /** 策略是否触发 */
  hasStrategy: boolean;
  /** 生态感知是否触发 */
  hasEcosystem: boolean;
  /** 记忆条目变化数 (本次新增) */
  memoryDelta: number;
  /** 注入文本长度 (字符数) */
  injectionLength: number;
  /** 备注 */
  note?: string;
}

// ═══════════════════════════════════════════════════════════════
// 记录
// ═══════════════════════════════════════════════════════════════

export function recordPerf(entry: PerfEntry): void {
  try {
    appendFileSync(PERF_FILE, JSON.stringify(entry) + '\n');
  } catch {
    // 不干扰主流程
  }
}

// ═══════════════════════════════════════════════════════════════
// 分析报告
// ═══════════════════════════════════════════════════════════════

export interface PerfReport {
  total: number;
  avgDurationMs: number;
  maxDurationMs: number;
  minDurationMs: number;
  avgContradictions: number;
  modulesCount: Record<string, number>;
  strategyRate: number;
  ecosystemRate: number;
  avgMemoryDelta: number;
  avgInjectionLength: number;
  recentEntries: PerfEntry[];
}

export function getPerfReport(limit = 100): PerfReport {
  const entries = getRecentEntries(limit);
  if (entries.length === 0) {
    return {
      total: 0, avgDurationMs: 0, maxDurationMs: 0, minDurationMs: 0,
      avgContradictions: 0, modulesCount: {}, strategyRate: 0, ecosystemRate: 0,
      avgMemoryDelta: 0, avgInjectionLength: 0, recentEntries: [],
    };
  }

  const modulesCount: Record<string, number> = {};
  let strategyCount = 0;
  let ecosystemCount = 0;
  let totalDuration = 0;
  let totalContradictions = 0;
  let totalMemoryDelta = 0;
  let totalInjectionLength = 0;
  let maxDuration = 0;
  let minDuration = Infinity;

  for (const e of entries) {
    totalDuration += e.durationMs;
    totalContradictions += e.contradictions;
    totalMemoryDelta += e.memoryDelta;
    totalInjectionLength += e.injectionLength;
    maxDuration = Math.max(maxDuration, e.durationMs);
    minDuration = Math.min(minDuration, e.durationMs);
    if (e.hasStrategy) strategyCount++;
    if (e.hasEcosystem) ecosystemCount++;
    for (const m of e.modules) {
      modulesCount[m] = (modulesCount[m] || 0) + 1;
    }
  }

  const n = entries.length;
  return {
    total: n,
    avgDurationMs: Math.round(totalDuration / n),
    maxDurationMs: maxDuration,
    minDurationMs: minDuration === Infinity ? 0 : minDuration,
    avgContradictions: Math.round(totalContradictions / n * 10) / 10,
    modulesCount,
    strategyRate: Math.round(strategyCount / n * 100),
    ecosystemRate: Math.round(ecosystemCount / n * 100),
    avgMemoryDelta: Math.round(totalMemoryDelta / n * 10) / 10,
    avgInjectionLength: Math.round(totalInjectionLength / n),
    recentEntries: entries.slice(-10).reverse(),
  };
}

function getRecentEntries(limit: number): PerfEntry[] {
  try {
    if (!existsSync(PERF_FILE)) return [];
    const content = readFileSync(PERF_FILE, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    const recent = lines.slice(-limit);
    return recent.map(l => JSON.parse(l) as PerfEntry);
  } catch {
    return [];
  }
}

/**
 * 生成性能趋势 JSON 快照（供外部工具读取）
 */
export function savePerfSnapshot(): string {
  const report = getPerfReport(500);
  const data = {
    generatedAt: new Date().toISOString(),
    ...report,
    // 按时间分段统计（每 10 条一个窗口）
    windows: getPerformanceWindows(),
  };
  writeFileSync(SNAPSHOT_FILE, JSON.stringify(data, null, 2));
  return SNAPSHOT_FILE;
}

interface PerfWindow {
  start: number;
  end: number;
  avgDurationMs: number;
  avgContradictions: number;
  count: number;
}

function getPerformanceWindows(windowSize = 10): PerfWindow[] {
  const entries = getRecentEntries(500);
  const windows: PerfWindow[] = [];
  for (let i = 0; i < entries.length; i += windowSize) {
    const slice = entries.slice(i, i + windowSize);
    if (slice.length === 0) continue;
    const avgDur = slice.reduce((s, e) => s + e.durationMs, 0) / slice.length;
    const avgC = slice.reduce((s, e) => s + e.contradictions, 0) / slice.length;
    windows.push({
      start: i,
      end: i + slice.length - 1,
      avgDurationMs: Math.round(avgDur),
      avgContradictions: Math.round(avgC * 10) / 10,
      count: slice.length,
    });
  }
  return windows;
}

/**
 * 获取 perf.log 字节数
 */
export function getPerfLogSize(): number {
  try {
    return statSync(PERF_FILE).size;
  } catch {
    return 0;
  }
}

/**
 * 格式化报告为文本
 */
export function formatPerfReport(report?: PerfReport): string {
  const r = report || getPerfReport();
  const lines: string[] = [];
  lines.push('╔════════════════════════════════════╗');
  lines.push('║  昆仑性能基准报告                   ║');
  lines.push('╚════════════════════════════════════╝');
  lines.push('');
  lines.push(`分析次数:     ${r.total}`);
  lines.push(`平均耗时:     ${r.avgDurationMs}ms`);
  lines.push(`最短耗时:     ${r.minDurationMs}ms`);
  lines.push(`最长耗时:     ${r.maxDurationMs}ms`);
  lines.push(`平均矛盾对:   ${r.avgContradictions}`);
  lines.push(`策略触发率:   ${r.strategyRate}%`);
  lines.push(`生态触发率:   ${r.ecosystemRate}%`);
  lines.push(`平均记忆增量: ${r.avgMemoryDelta}`);
  lines.push(`平均注入长度: ${r.avgInjectionLength} 字符`);
  lines.push('');
  lines.push('模块激活频率:');
  const sorted = Object.entries(r.modulesCount).sort((a, b) => b[1] - a[1]);
  for (const [mod, count] of sorted) {
    const pct = Math.round(count / r.total * 100);
    const bar = '█'.repeat(Math.round(pct / 5));
    lines.push(`  ${mod.padEnd(16)} ${String(count).padStart(4)}次 ${bar}`);
  }
  lines.push('');
  lines.push('最近 10 次分析:');
  for (const e of r.recentEntries.slice(0, 10)) {
    const time = e.ts.slice(11, 19);
    const modules = e.modules.length > 0 ? e.modules.join(',') : '-';
    lines.push(`  ${time} ${String(e.durationMs).padStart(5)}ms | 矛盾:${e.contradictions} | ${modules.slice(0, 20)}`);
  }
  return lines.join('\n');
}
