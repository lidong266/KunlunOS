/**
 * 归藏 Guicang (S10) — 三元记忆模型
 * V2 职责: 三元记忆系统，强化/模糊/消退
 *
 * 关键变化:
 *  - 记忆三元状态: +1=强化记忆, 0=模糊记忆, -1=消退记忆
 *  - 三元衰减: +1事件逆转衰减, 0无事件自然衰减, -1加速衰减
 *  - ResonantMemoryNetwork: 记忆间的三元共鸣网络
 */

import {
  Trit, T_TRUE, T_UNKNOWN, T_FALSE,
} from '@kunlun/ternary';

// ═══════════════════════════════════════════════════════════
// MemoryEntry — 记忆条目
// ═══════════════════════════════════════════════════════════

export interface MemoryEntry {
  id: string;
  /** 记忆内容 */
  content: string;
  /** 三元记忆状态 */
  ternaryState: Trit;
  /** 当前强度 (0-1) */
  strength: number;
  /** 衰减速率 */
  decayRate: number;
  /** 关联的记忆 ID 列表 */
  associations: string[];
  /** 最后访问时间 */
  lastAccessed: number;
  /** 创建时间 */
  createdAt: number;
  /** 被强化次数 */
  reinforcementCount: number;
  /** 被否定次数 */
  negationCount: number;
  /** 记忆来源 */
  source: string;
  /** 记忆标签 */
  tags: string[];
}

// ═══════════════════════════════════════════════════════════
// 衰减参数
// ═══════════════════════════════════════════════════════════

export interface DecayParams {
  /** 自然衰减速率 / 天 */
  naturalDecayRate: number;
  /** 强化事件衰减逆转幅度 */
  reinforcementBoost: number;
  /** 否定事件衰减加速倍率 */
  negationPenalty: number;
  /** 最低强度阈值 (低于此值进入消退) */
  fadingThreshold: number;
  /** 模糊阈值 (低于此值进入模糊) */
  blurThreshold: number;
}

export const DEFAULT_DECAY_PARAMS: DecayParams = {
  naturalDecayRate: 0.05,
  reinforcementBoost: 0.2,
  negationPenalty: 2.0,
  fadingThreshold: 0.1,
  blurThreshold: 0.5,
};

// ═══════════════════════════════════════════════════════════
// TernaryMemoryModel — 三元记忆模型
// ═══════════════════════════════════════════════════════════

export interface MemoryConfig {
  maxEntries: number;
  decayParams: DecayParams;
}

const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  maxEntries: 5000,
  decayParams: DEFAULT_DECAY_PARAMS,
};

export class TernaryMemoryModel {
  private config: MemoryConfig;
  private memories: Map<string, MemoryEntry> = new Map();
  private memCounter = 0;

  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
  }

  /**
   * 存储新记忆
   */
  store(
    content: string,
    source = 'unknown',
    tags: string[] = [],
  ): MemoryEntry {
    const id = `mem-${++this.memCounter}`;
    const now = Date.now();

    const entry: MemoryEntry = {
      id,
      content,
      ternaryState: T_UNKNOWN,
      strength: 0.5,
      decayRate: this.config.decayParams.naturalDecayRate,
      associations: [],
      lastAccessed: now,
      createdAt: now,
      reinforcementCount: 0,
      negationCount: 0,
      source,
      tags,
    };

    this.memories.set(id, entry);
    return entry;
  }

  /**
   * 强化记忆 (+1 事件)
   */
  reinforce(id: string): boolean {
    const entry = this.memories.get(id);
    if (!entry) return false;

    entry.strength = Math.min(
      1.0,
      entry.strength + this.config.decayParams.reinforcementBoost,
    );
    entry.reinforcementCount++;
    entry.lastAccessed = Date.now();
    entry.decayRate = Math.max(
      0.01,
      entry.decayRate - this.config.decayParams.reinforcementBoost,
    );

    // 更新三元状态
    if (entry.strength > this.config.decayParams.blurThreshold) {
      entry.ternaryState = T_TRUE; // 强化记忆
    }

    return true;
  }

  /**
   * 否定记忆 (-1 事件)
   */
  negate(id: string): boolean {
    const entry = this.memories.get(id);
    if (!entry) return false;

    entry.negationCount++;
    entry.decayRate *= this.config.decayParams.negationPenalty;
    entry.strength *= 0.7; // 立即削弱 30%
    entry.lastAccessed = Date.now();

    if (entry.strength < this.config.decayParams.fadingThreshold) {
      entry.ternaryState = T_FALSE; // 消退记忆
    }

    return true;
  }

  /**
   * 三元衰减计算
   */
  applyDecay(id: string, elapsedDays = 1): Trit {
    const entry = this.memories.get(id);
    if (!entry) return T_FALSE;

    const decay = entry.decayRate * elapsedDays;
    entry.strength = Math.max(0, entry.strength - decay);

    // 三元状态判断
    if (entry.strength < this.config.decayParams.fadingThreshold) {
      entry.ternaryState = T_FALSE;
    } else if (entry.strength < this.config.decayParams.blurThreshold) {
      entry.ternaryState = T_UNKNOWN;
    } else {
      entry.ternaryState = T_TRUE;
    }

    return entry.ternaryState;
  }

  /**
   * 全局衰减所有记忆
   */
  applyGlobalDecay(elapsedDays = 1): Map<string, Trit> {
    const results = new Map<string, Trit>();
    for (const [id] of this.memories) {
      results.set(id, this.applyDecay(id, elapsedDays));
    }
    return results;
  }

  /**
   * 检索记忆
   */
  recall(id: string): MemoryEntry | undefined {
    const entry = this.memories.get(id);
    if (entry) {
      entry.lastAccessed = Date.now();
    }
    return entry;
  }

  /**
   * 按三元状态查询
   */
  queryByState(state: Trit): MemoryEntry[] {
    return Array.from(this.memories.values()).filter(
      e => e.ternaryState === state,
    );
  }

  /**
   * 按标签查询
   */
  queryByTags(tags: string[]): MemoryEntry[] {
    return Array.from(this.memories.values()).filter(e =>
      tags.some(t => e.tags.includes(t)),
    );
  }

  /**
   * 全文搜索
   */
  search(query: string): MemoryEntry[] {
    const lower = query.toLowerCase();
    return Array.from(this.memories.values()).filter(e =>
      e.content.toLowerCase().includes(lower) ||
      e.tags.some(t => t.toLowerCase().includes(lower)),
    );
  }

  /**
   * 创建记忆关联
   */
  associate(id1: string, id2: string): boolean {
    const e1 = this.memories.get(id1);
    const e2 = this.memories.get(id2);
    if (!e1 || !e2) return false;

    if (!e1.associations.includes(id2)) e1.associations.push(id2);
    if (!e2.associations.includes(id1)) e2.associations.push(id1);
    return true;
  }

  /**
   * 删除记忆
   */
  forget(id: string): boolean {
    return this.memories.delete(id);
  }

  /**
   * 获取统计
   */
  getStats() {
    const all = Array.from(this.memories.values());
    return {
      total: all.length,
      reinforced: all.filter(e => e.ternaryState === T_TRUE).length,
      fading: all.filter(e => e.ternaryState === T_UNKNOWN).length,
      faded: all.filter(e => e.ternaryState === T_FALSE).length,
      avgStrength: all.reduce((s, e) => s + e.strength, 0) / (all.length || 1),
      totalReinforcements: all.reduce((s, e) => s + e.reinforcementCount, 0),
      totalNegations: all.reduce((s, e) => s + e.negationCount, 0),
    };
  }

  /**
   * 获取所有记忆
   */
  getAllMemories(): MemoryEntry[] {
    return Array.from(this.memories.values());
  }

  /**
   * 重置
   */
  reset(): void {
    this.memories.clear();
    this.memCounter = 0;
  }
}

// ═══════════════════════════════════════════════════════════
// ResonantMemoryNetwork — 三元共鸣网络
// ═══════════════════════════════════════════════════════════

export interface ResonanceEvent {
  sourceId: string;
  resonatedIds: string[];
  resonanceType: Trit;
  strength: number;
  timestamp: number;
}

export class ResonantMemoryNetwork {
  private model: TernaryMemoryModel;
  private resonanceHistory: ResonanceEvent[] = [];

  constructor(model: TernaryMemoryModel) {
    this.model = model;
  }

  /**
   * 触发记忆共鸣 — 当访问某记忆时，关联记忆也被激活
   */
  resonate(sourceId: string): ResonanceEvent | null {
    const source = this.model.recall(sourceId);
    if (!source) return null;

    const resonatedIds: string[] = [];
    for (const assocId of source.associations) {
      const assoc = this.model.recall(assocId);
      if (assoc) {
        // 关联记忆获得微强化
        assoc.strength = Math.min(1.0, assoc.strength + 0.02);
        resonatedIds.push(assocId);
      }
    }

    const resonanceType = resonatedIds.length > 2 ? T_TRUE
      : resonatedIds.length > 0 ? T_UNKNOWN
      : T_FALSE;

    const event: ResonanceEvent = {
      sourceId,
      resonatedIds,
      resonanceType,
      strength: resonatedIds.length / Math.max(1, source.associations.length),
      timestamp: Date.now(),
    };

    this.resonanceHistory.push(event);
    return event;
  }

  /**
   * 获取共鸣历史
   */
  getResonanceHistory(): ResonanceEvent[] {
    return [...this.resonanceHistory];
  }

  /**
   * 获取共鸣统计
   */
  getStats(): { total: number; strong: number; weak: number; failed: number } {
    return {
      total: this.resonanceHistory.length,
      strong: this.resonanceHistory.filter(e => e.resonanceType === T_TRUE).length,
      weak: this.resonanceHistory.filter(e => e.resonanceType === T_UNKNOWN).length,
      failed: this.resonanceHistory.filter(e => e.resonanceType === T_FALSE).length,
    };
  }

  /**
   * 重置
   */
  reset(): void {
    this.resonanceHistory = [];
  }
}
