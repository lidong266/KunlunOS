/**
 * 谛听 Diting (S6) — 三元矛盾感知
 * V2 职责: 从信号中识别「矛盾的对立面」，信号三元化标注
 *
 * 关键变化:
 *  - 信号三元化: 每个感知信号标注 Trit(确认/可疑/否定)
 *  - ContradictionSignalDetector: 从噪音中识别矛盾对
 *  - 信号来源信度初始化: 根据 SignalSource 自动设置初始 Tryte 信度
 */

import {
  Trit, T_TRUE, T_UNKNOWN, T_FALSE,
  Tryte,
} from '@kunlun/ternary';
import type { ContradictionPair } from '../types.js';
import { tryteFromTrits } from '../types.js';

// ═══════════════════════════════════════════════════════════
// SignalSource — 信号来源分类
// ═══════════════════════════════════════════════════════════

export enum SignalSource {
  /** 用户主动输入（矛盾对、问题、指令） */
  HUMAN_INPUT = 'human_input',

  /** 外部数据源（API、数据库、文件系统） */
  EXTERNAL_DATA = 'external_data',

  /** 搜索/爬取结果 */
  WEB_SEARCH = 'web_search',

  /** 子代理输出 */
  SUBAGENT_OUTPUT = 'subagent_output',

  /** 系统内部事件（状态变化、定时脉冲） */
  SYSTEM_INTERNAL = 'system_internal',

  /** MCP 插件输出 */
  MCP_PLUGIN = 'mcp_plugin',
}

// ═══════════════════════════════════════════════════════════
// SIGNAL_RELIABILITY_INIT — 信号来源 → 初始 Tryte 信度
// ═══════════════════════════════════════════════════════════

/**
 * Tryte 6 维 Trit:
 *   [0] 来源权威性  [1] 验证充分性  [2] 逻辑一致性
 *   [3] 实践佐证度  [4] 时效性      [5] 共识程度
 */
export const SIGNAL_RELIABILITY_INIT: Record<SignalSource, Tryte> = {
  human_input: tryteFromTrits([0, -1, 0, -1, 1, 0]),
  external_data: tryteFromTrits([1, -1, 0, -1, 1, 0]),
  web_search: tryteFromTrits([0, -1, 0, -1, 1, 0]),
  subagent_output: tryteFromTrits([0, -1, 0, -1, 1, 0]),
  system_internal: tryteFromTrits([1, 1, 1, 0, 1, 1]),
  mcp_plugin: tryteFromTrits([0, -1, 0, -1, 1, 0]),
};

// ═══════════════════════════════════════════════════════════
// SignalTrit — 信号三元标注
// ═══════════════════════════════════════════════════════════

export interface SignalTrit {
  /** 原始信号内容 */
  rawSignal: string;
  /** 信号来源 */
  source: SignalSource;
  /** 三元判断: T_TRUE=确认信号, T_UNKNOWN=可疑信号, T_FALSE=否定信号 */
  judgment: Trit;
  /** 判断理由 */
  reason: string;
  /** 初始信度向量 */
  initialConfidence: Tryte;
  /** 时间戳 */
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════
// ContradictionAwarePerception — 谛听感知输出
// ═══════════════════════════════════════════════════════════

export interface ContradictionAwarePerception {
  /** 原始信号内容 */
  rawSignal: string;
  /** 信号来源 */
  source: SignalSource;
  /** 来源元数据（URL、插件名等） */
  sourceMeta?: Record<string, string>;
  /** 提取的矛盾对 */
  contradictions: ContradictionPair[];
  /** 初始信度向量（基于来源自动赋值） */
  initialConfidence: Tryte;
  /** 信号三元标注 */
  signalTrits: SignalTrit[];
  /** 信号接收时间 */
  receivedAt: number;
}

// ═══════════════════════════════════════════════════════════
// ContradictionSignalDetector — 矛盾信号检测器
// ═══════════════════════════════════════════════════════════

export interface DetectionConfig {
  /** 最小矛盾对数量才触发 */
  minContradictions: number;
  /** 是否启用对立面识别 */
  enableOppositionDetection: boolean;
  /** 对立面关键词 */
  oppositionKeywords: string[];
}

const DEFAULT_DETECTION_CONFIG: DetectionConfig = {
  minContradictions: 1,
  enableOppositionDetection: true,
  oppositionKeywords: [
    'vs', 'versus', '对立', '矛盾', '冲突', '对抗',
    '相反', '但是', '然而', 'although', 'however',
    '一方面', '另一方面', 'pro', 'con', 'advantage', 'disadvantage',
  ],
};

export class ContradictionSignalDetector {
  private config: DetectionConfig;
  private perceivedSignals: ContradictionAwarePerception[] = [];

  constructor(config: Partial<DetectionConfig> = {}) {
    this.config = { ...DEFAULT_DETECTION_CONFIG, ...config };
  }

  /**
   * 接收原始信号并标注三元判断
   */
  perceiveSignal(
    rawSignal: string,
    source: SignalSource,
    sourceMeta?: Record<string, string>,
  ): ContradictionAwarePerception {
    const contradictions = this.extractContradictions(rawSignal);
    const signalTrits = this.annotateSignal(rawSignal, source, contradictions);
    const initialConfidence = SIGNAL_RELIABILITY_INIT[source];

    const perception: ContradictionAwarePerception = {
      rawSignal,
      source,
      sourceMeta,
      contradictions,
      initialConfidence,
      signalTrits,
      receivedAt: Date.now(),
    };

    this.perceivedSignals.push(perception);
    return perception;
  }

  /**
   * 从信号文本中提取矛盾对
   */
  private extractContradictions(signal: string): ContradictionPair[] {
    if (!signal || signal.trim().length === 0) return [];

    const pairs: ContradictionPair[] = [];
    const oppositionMarkers = [
      { pattern: /\b(vs\.?|versus)\b/i, delimiter: /vs\.?|versus/i },
      { pattern: /但是|然而|不过|却/, delimiter: /但是|然而|不过|却/ },
      { pattern: /一方面.*另一方面/, delimiter: /一方面|另一方面/ },
      { pattern: /although.*\,/i, delimiter: /although/i },
      { pattern: /冲突|对立|矛盾/, delimiter: /冲突|对立|矛盾/ },
    ];

    for (const marker of oppositionMarkers) {
      if (marker.pattern.test(signal)) {
        const parts = signal.split(marker.delimiter).filter(p => p.trim().length > 0);
        if (parts.length >= 2) {
          pairs.push({
            thesis: parts[0].trim().substring(0, 100),
            antithesis: parts[1].trim().substring(0, 100),
          });
        }
      }
    }

    // 检测对立关键词
    if (pairs.length === 0 && this.config.enableOppositionDetection) {
      const lowerSignal = signal.toLowerCase();
      for (const kw of this.config.oppositionKeywords) {
        if (lowerSignal.includes(kw.toLowerCase())) {
          const idx = lowerSignal.indexOf(kw.toLowerCase());
          const before = signal.substring(Math.max(0, idx - 30), idx).trim();
          const after = signal.substring(idx + kw.length, idx + kw.length + 100).trim();
          if (before && after) {
            pairs.push({ thesis: before, antithesis: after });
          }
        }
      }
    }

    return pairs;
  }

  /**
   * 对信号进行三元标注
   */
  private annotateSignal(
    signal: string,
    source: SignalSource,
    contradictions: ContradictionPair[],
  ): SignalTrit[] {
    const trits: SignalTrit[] = [];

    // 系统内部信号默认确认
    if (source === SignalSource.SYSTEM_INTERNAL) {
      trits.push({
        rawSignal: signal,
        source,
        judgment: T_TRUE,
        reason: 'system_internal signals default to verified',
        initialConfidence: SIGNAL_RELIABILITY_INIT[source],
        timestamp: Date.now(),
      });
    } else if (contradictions.length > 0) {
      // 有矛盾对 → 可疑（需要进一步分析）
      trits.push({
        rawSignal: signal,
        source,
        judgment: T_UNKNOWN,
        reason: `contains ${contradictions.length} potential contradiction(s)`,
        initialConfidence: SIGNAL_RELIABILITY_INIT[source],
        timestamp: Date.now(),
      });
    } else {
      // 无矛盾对 → 待确认
      trits.push({
        rawSignal: signal,
        source,
        judgment: T_UNKNOWN,
        reason: 'no contradictions detected, awaiting analysis',
        initialConfidence: SIGNAL_RELIABILITY_INIT[source],
        timestamp: Date.now(),
      });
    }

    return trits;
  }

  /**
   * 根据来源获取初始信度
   */
  getReliabilityInit(source: SignalSource): Tryte {
    return SIGNAL_RELIABILITY_INIT[source];
  }

  /**
   * 获取所有已感知信号
   */
  getPerceivedSignals(): ContradictionAwarePerception[] {
    return [...this.perceivedSignals];
  }

  /**
   * 获取感知统计
   */
  getStats(): { total: number; bySource: Record<string, number>; contradictionsFound: number } {
    const bySource: Record<string, number> = {};
    let contradictionsFound = 0;

    for (const sig of this.perceivedSignals) {
      bySource[sig.source] = (bySource[sig.source] || 0) + 1;
      contradictionsFound += sig.contradictions.length;
    }

    return {
      total: this.perceivedSignals.length,
      bySource,
      contradictionsFound,
    };
  }

  /**
   * 重置感知器状态
   */
  reset(): void {
    this.perceivedSignals = [];
  }
}
