/**
 * 琅嬛 Langhuan (S9) — 三元知识索引
 * V2 职责: 三元知识索引层，知识矛盾关系图
 *
 * 关键变化:
 *  - 知识分类: +1=已确认知识, 0=待验证知识, -1=已否定知识
 *  - queryByCredibilityVector: 按 Tryte 信度向量查询
 *  - KnowledgeContradictionGraph: 知识间的矛盾关系图
 */

import {
  Trit, T_TRUE, T_UNKNOWN, T_FALSE,
  Tryte,
} from '@kunlun/ternary';
import { tryteFromTrits } from '../types.js';

// ═══════════════════════════════════════════════════════════
// KnowledgeEntry — 知识条目
// ═══════════════════════════════════════════════════════════

export interface KnowledgeEntry {
  id: string;
  /** 知识内容 */
  content: string;
  /** 三元知识分类: +1=已确认, 0=待验证, -1=已否定 */
  classification: Trit;
  /** 三元信度向量 */
  credibilityVector: Tryte;
  /** 来源 */
  source: string;
  /** 关联标签 */
  tags: string[];
  /** 知识间关系 */
  relations: KnowledgeRelation[];
  /** 创建时间 */
  createdAt: number;
  /** 最后更新时间 */
  updatedAt: number;
  /** 被查询次数（用于热数据判断） */
  accessCount: number;
}

export interface KnowledgeRelation {
  /** 关联知识 ID */
  targetId: string;
  /** 关系类型 */
  relationType: RelationType;
  /** 关系强度 */
  strength: number;
}

export enum RelationType {
  SUPPORTS = 'supports',
  CONTRADICTS = 'contradicts',
  EXTENDS = 'extends',
  DERIVES_FROM = 'derives_from',
  ANALOGOUS = 'analogous',
}

// ═══════════════════════════════════════════════════════════
// TernaryKnowledgeIndex — 三元知识索引
// ═══════════════════════════════════════════════════════════

export interface IndexConfig {
  /** 最大条目数 */
  maxEntries: number;
  /** 默认信度向量 */
  defaultCredibility: Tryte;
}

const DEFAULT_INDEX_CONFIG: IndexConfig = {
  maxEntries: 10000,
  defaultCredibility: tryteFromTrits([0, -1, 0, -1, 1, 0]),
};

export class TernaryKnowledgeIndex {
  private config: IndexConfig;
  private entries: Map<string, KnowledgeEntry> = new Map();
  private entryCounter = 0;

  constructor(config: Partial<IndexConfig> = {}) {
    this.config = { ...DEFAULT_INDEX_CONFIG, ...config };
  }

  /**
   * 添加知识条目
   */
  addEntry(
    content: string,
    classification: Trit = T_UNKNOWN,
    source = 'unknown',
    tags: string[] = [],
  ): KnowledgeEntry {
    const id = `k-${++this.entryCounter}`;
    const now = Date.now();

    const entry: KnowledgeEntry = {
      id,
      content,
      classification,
      credibilityVector: this.config.defaultCredibility,
      source,
      tags,
      relations: [],
      createdAt: now,
      updatedAt: now,
      accessCount: 0,
    };

    this.entries.set(id, entry);
    return entry;
  }

  /**
   * 按分类查询
   */
  queryByClassification(classification: Trit): KnowledgeEntry[] {
    return Array.from(this.entries.values()).filter(
      e => e.classification === classification,
    );
  }

  /**
   * 按三元信度向量查询
   */
  queryByCredibilityVector(minTrits: number[]): KnowledgeEntry[] {
    const minTryte = tryteFromTrits(minTrits as [Trit, Trit, Trit, Trit, Trit, Trit]);

    return Array.from(this.entries.values()).filter(e => {
      const eTrits = e.credibilityVector;
      let passCount = 0;
      for (let i = 0; i < 6; i++) {
        if (eTrits[i] >= minTryte[i]) passCount++;
      }
      return passCount >= 4; // 至少 4 个维度满足
    });
  }

  /**
   * 按标签查询
   */
  queryByTags(tags: string[]): KnowledgeEntry[] {
    return Array.from(this.entries.values()).filter(e =>
      tags.some(t => e.tags.includes(t)),
    );
  }

  /**
   * 全文搜索
   */
  search(query: string): KnowledgeEntry[] {
    const lower = query.toLowerCase();
    return Array.from(this.entries.values()).filter(e =>
      e.content.toLowerCase().includes(lower) ||
      e.tags.some(t => t.toLowerCase().includes(lower)),
    );
  }

  /**
   * 更新知识分类
   */
  updateClassification(id: string, classification: Trit): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;
    entry.classification = classification;
    entry.updatedAt = Date.now();
    return true;
  }

  /**
   * 更新信度向量
   */
  updateCredibilityVector(id: string, vector: Tryte): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;
    entry.credibilityVector = vector;
    entry.updatedAt = Date.now();
    return true;
  }

  /**
   * 添加知识间关系
   */
  addRelation(fromId: string, toId: string, relationType: RelationType, strength = 0.5): boolean {
    const entry = this.entries.get(fromId);
    if (!entry || !this.entries.has(toId)) return false;

    entry.relations.push({ targetId: toId, relationType, strength });
    entry.updatedAt = Date.now();
    return true;
  }

  /**
   * 记录访问
   */
  recordAccess(id: string): void {
    const entry = this.entries.get(id);
    if (entry) entry.accessCount++;
  }

  /**
   * 获取条目
   */
  getEntry(id: string): KnowledgeEntry | undefined {
    const entry = this.entries.get(id);
    if (entry) this.recordAccess(id);
    return entry;
  }

  /**
   * 删除条目
   */
  deleteEntry(id: string): boolean {
    return this.entries.delete(id);
  }

  /**
   * 获取统计
   */
  getStats() {
    const all = Array.from(this.entries.values());
    return {
      total: all.length,
      confirmed: all.filter(e => e.classification === T_TRUE).length,
      pending: all.filter(e => e.classification === T_UNKNOWN).length,
      falsified: all.filter(e => e.classification === T_FALSE).length,
      totalRelations: all.reduce((sum, e) => sum + e.relations.length, 0),
    };
  }

  /**
   * 获取所有条目
   */
  getAllEntries(): KnowledgeEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * 重置
   */
  reset(): void {
    this.entries.clear();
    this.entryCounter = 0;
  }
}

// ═══════════════════════════════════════════════════════════
// KnowledgeContradictionGraph — 知识矛盾关系图
// ═══════════════════════════════════════════════════════════

export interface ContradictionEdge {
  sourceId: string;
  targetId: string;
  sourceContent: string;
  targetContent: string;
  severity: Trit;
  description: string;
}

export class KnowledgeContradictionGraph {
  private index: TernaryKnowledgeIndex;

  constructor(index: TernaryKnowledgeIndex) {
    this.index = index;
  }

  /**
   * 检测知识间的矛盾关系
   */
  detectContradictions(): ContradictionEdge[] {
    const entries = this.index.getAllEntries();
    const edges: ContradictionEdge[] = [];

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];

        // 检查是否已有矛盾关系
        const hasContradict = a.relations.some(
          r => r.targetId === b.id && r.relationType === RelationType.CONTRADICTS,
        );

        // 检查分类冲突：一个确认一个否定 → 矛盾
        if (a.classification === T_TRUE && b.classification === T_FALSE) {
          edges.push({
            sourceId: a.id,
            targetId: b.id,
            sourceContent: a.content,
            targetContent: b.content,
            severity: T_TRUE,
            description: `Classification conflict: confirmed vs falsified`,
          });
        }
        // 检查显式矛盾关系
        else if (hasContradict) {
          edges.push({
            sourceId: a.id,
            targetId: b.id,
            sourceContent: a.content,
            targetContent: b.content,
            severity: T_UNKNOWN,
            description: `Explicit contradiction relation between ${a.id} and ${b.id}`,
          });
        }
        // 信度向量冲突
        else if (this.vectorConflict(a.credibilityVector, b.credibilityVector)) {
          edges.push({
            sourceId: a.id,
            targetId: b.id,
            sourceContent: a.content,
            targetContent: b.content,
            severity: T_FALSE,
            description: `Credibility vector misalignment`,
          });
        }
      }
    }

    return edges;
  }

  /**
   * 检测两个信度向量是否存在维度冲突
   */
  private vectorConflict(a: Tryte, b: Tryte): boolean {
    let conflicts = 0;
    for (let i = 0; i < 6; i++) {
      // 一个 +1 另一个 -1 = 冲突
      if ((a[i] === 1 && b[i] === -1) || (a[i] === -1 && b[i] === 1)) {
        conflicts++;
      }
    }
    return conflicts >= 2; // 至少 2 个维度冲突
  }

  /**
   * 获取矛盾关系统计
   */
  getStats(): { totalContradictions: number; severity: { high: number; medium: number; low: number } } {
    const edges = this.detectContradictions();
    return {
      totalContradictions: edges.length,
      severity: {
        high: edges.filter(e => e.severity === T_TRUE).length,
        medium: edges.filter(e => e.severity === T_UNKNOWN).length,
        low: edges.filter(e => e.severity === T_FALSE).length,
      },
    };
  }
}
