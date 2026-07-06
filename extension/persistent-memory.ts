/**
 * 归藏 SQLite 持久化存储 — 三元记忆持久化模块
 *
 * 将 TernaryMemoryModel 的数据持久化到 SQLite，
 * 并在启动时从 pi-hermes-memory 的 MEMORY.md 同步种子知识。
 */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ═══════════════════════════════════════════════════════════════
// 三元记忆条目（与 guicang MemoryEntry 对齐）
// ═══════════════════════════════════════════════════════════════

interface PersistentMemoryEntry {
  id: string;
  content: string;
  ternaryState: number;   // Trit: 1 | 0 | -1
  strength: number;
  decayRate: number;
  associations: string;   // JSON array
  lastAccessed: number;
  createdAt: number;
  reinforcementCount: number;
  negationCount: number;
  source: string;
  tags: string;           // JSON array
}

interface MemoryStats {
  total: number;
  reinforced: number;
  fading: number;
  faded: number;
  avgStrength: number;
  totalReinforcements: number;
  totalNegations: number;
}

interface CleanupResult {
  /** 被删除的陈旧记忆数 */
  fadedPurged: number;
  /** 被合并的重复记忆数 */
  duplicatesMerged: number;
  /** 保留的记忆数 */
  kept: number;
  /** 删除原因统计 */
  reasons: Record<string, number>;
}

interface CleanupConfig {
  /** 陈旧记忆的强度阈值（低于此值且长时间未访问则删除） */
  fadedStrengthThreshold: number;
  /** 陈旧记忆的最大未访问天数 */
  maxUnusedDays: number;
  /** 允许的最大记忆数（超过时裁剪最弱的） */
  maxEntries: number;
  /** 重复内容相似度阈值（0-1, 基于内容 overlap） */
  duplicateSimilarityThreshold: number;
}

const DEFAULT_CLEANUP_CONFIG: CleanupConfig = {
  fadedStrengthThreshold: 0.05,
  maxUnusedDays: 90,
  maxEntries: 5000,
  duplicateSimilarityThreshold: 0.8,
};

// ═══════════════════════════════════════════════════════════════
// SQLite 持久化记忆存储
// ═══════════════════════════════════════════════════════════════

export class PersistentMemoryStore {
  private db: DatabaseSync;
  private memCounter: number;
  private initialized = false;
  private cleanupConfig: CleanupConfig;
  private dbPath: string;

  constructor(dbPath?: string, cleanupConfig?: Partial<CleanupConfig>) {
    this.dbPath = dbPath ?? join(dirname(fileURLToPath(import.meta.url)), 'kunlun-memory.db');
    this.cleanupConfig = { ...DEFAULT_CLEANUP_CONFIG, ...cleanupConfig };
    const path = this.dbPath;
    // 确保目录存在
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    this.db = new DatabaseSync(path);
    this.memCounter = 0;
    this.initSchema();
  }

  // ── 初始化表结构 ──

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        ternary_state INTEGER NOT NULL DEFAULT 0,
        strength REAL NOT NULL DEFAULT 0.5,
        decay_rate REAL NOT NULL DEFAULT 0.05,
        associations TEXT NOT NULL DEFAULT '[]',
        last_accessed INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        reinforcement_count INTEGER NOT NULL DEFAULT 0,
        negation_count INTEGER NOT NULL DEFAULT 0,
        source TEXT NOT NULL DEFAULT 'unknown',
        tags TEXT NOT NULL DEFAULT '[]'
      );

      CREATE INDEX IF NOT EXISTS idx_memories_ternary ON memories(ternary_state);
      CREATE INDEX IF NOT EXISTS idx_memories_strength ON memories(strength);
      CREATE INDEX IF NOT EXISTS idx_memories_source ON memories(source);
      CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);

      -- FTS5 全文索引（中文：单字分词，英文：整词保留）
      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        content, id, source,
        tokenize=unicode61
      );
    `);

    // 加载最大计数器
    const row = this.db.prepare('SELECT MAX(CAST(SUBSTR(id, 5) AS INTEGER)) as max_id FROM memories').get() as { max_id: number | null };
    this.memCounter = row?.max_id ?? 0;

    this.initialized = true;
  }

  // ── 基础 CRUD ──

  // ── 中文分词（FTS5 辅助） ──

  /** 对文本分词：中文单字空格分隔，英文保持原词 */
  static tokenizeForFts(text: string): string {
    let result = '';
    let english = '';
    for (const ch of text) {
      if (/[a-zA-Z0-9]/.test(ch)) {
        english += ch;
      } else {
        if (english) { result += english + ' '; english = ''; }
        if (/[\u4e00-\u9fff]/.test(ch)) result += ch + ' ';
        // 标点、空格忽略
      }
    }
    if (english) result += english + ' ';
    return result.trim();
  }

  /** 对搜索词做同样处理 */
  static tokenizeQuery(query: string): string {
    return PersistentMemoryStore.tokenizeForFts(query);
  }

  store(
    content: string,
    source = 'unknown',
    tags: string[] = [],
  ): PersistentMemoryEntry {
    const id = `mem-${++this.memCounter}`;
    const now = Date.now();

    const entry: PersistentMemoryEntry = {
      id,
      content,
      ternaryState: 0,
      strength: 0.5,
      decayRate: 0.05,
      associations: '[]',
      lastAccessed: now,
      createdAt: now,
      reinforcementCount: 0,
      negationCount: 0,
      source,
      tags: JSON.stringify(tags),
    };

    try {
      this.db.exec('BEGIN');
      this.db.prepare(`
        INSERT INTO memories (id, content, ternary_state, strength, decay_rate,
          associations, last_accessed, created_at, reinforcement_count,
          negation_count, source, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        entry.id, entry.content, entry.ternaryState, entry.strength,
        entry.decayRate, entry.associations, entry.lastAccessed,
        entry.createdAt, entry.reinforcementCount, entry.negationCount,
        entry.source, entry.tags,
      );

      // 同时写入 FTS5 索引
      const ftsContent = PersistentMemoryStore.tokenizeForFts(content + ' ' + source + ' ' + JSON.stringify(tags));
      this.db.prepare('INSERT INTO memories_fts(content, id, source) VALUES(?, ?, ?)').run(
        ftsContent, entry.id, source,
      );

      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }

    return entry;
  }

  reinforce(id: string): boolean {
    const result = this.db.prepare(`
      UPDATE memories SET
        strength = MIN(1.0, strength + 0.2),
        reinforcement_count = reinforcement_count + 1,
        last_accessed = ?,
        decay_rate = MAX(0.01, decay_rate - 0.2),
        ternary_state = CASE WHEN strength + 0.2 > 0.5 THEN 1 ELSE ternary_state END
      WHERE id = ?
    `).run(Date.now(), id);
    return result.changes > 0;
  }

  negate(id: string): boolean {
    const result = this.db.prepare(`
      UPDATE memories SET
        negation_count = negation_count + 1,
        decay_rate = decay_rate * 2.0,
        strength = strength * 0.7,
        last_accessed = ?,
        ternary_state = CASE WHEN strength * 0.7 < 0.1 THEN -1 ELSE ternary_state END
      WHERE id = ?
    `).run(Date.now(), id);
    return result.changes > 0;
  }

  get(id: string): PersistentMemoryEntry | null {
    const row = this.db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as Record<string, any> | undefined;
    if (!row) return null;

    // 更新访问时间
    this.db.prepare('UPDATE memories SET last_accessed = ? WHERE id = ?').run(Date.now(), id);

    return this.rowToEntry(row);
  }

  search(query: string): PersistentMemoryEntry[] {
    const tokenized = PersistentMemoryStore.tokenizeQuery(query);

    if (!tokenized) {
      // 空查询：按强度排序返回
      const rows = this.db.prepare('SELECT * FROM memories ORDER BY strength DESC, last_accessed DESC LIMIT 20').all() as Record<string, any>[];
      return rows.map(r => this.rowToEntry(r));
    }

    // FTS5 搜索（BM25 排序）
    try {
      const ftsRows = this.db.prepare(`
        SELECT id, rank FROM memories_fts
        WHERE content MATCH ?
        ORDER BY rank
        LIMIT 20
      `).all(tokenized) as Record<string, any>[];

      if (ftsRows.length > 0) {
        const ids = ftsRows.map(r => r.id);
        const placeholders = ids.map(() => '?').join(',');
        const rows = this.db.prepare(`
          SELECT * FROM memories WHERE id IN (${placeholders})
        `).all(...ids) as Record<string, any>[];

        // 按 FTS5 rank 排序（保持搜索结果顺序）
        const idMap = new Map(rows.map(r => [r.id, r]));
        return ftsRows
          .map(fr => idMap.get(fr.id))
          .filter(Boolean)
          .map(r => this.rowToEntry(r));
      }
    } catch {
      // FTS5 搜索失败，降级到 LIKE
    }

    // 降级：LIKE 搜索
    const like = `%${query.toLowerCase()}%`;
    const rows = this.db.prepare(`
      SELECT * FROM memories
      WHERE LOWER(content) LIKE ? OR LOWER(tags) LIKE ?
      ORDER BY strength DESC, last_accessed DESC
      LIMIT 20
    `).all(like, like) as Record<string, any>[];
    return rows.map(r => this.rowToEntry(r));
  }

  queryByTags(tags: string[]): PersistentMemoryEntry[] {
    if (tags.length === 0) return [];
    const conditions = tags.map(() => "tags LIKE ?");
    const params = tags.map(t => `%"${t}"%`);
    const rows = this.db.prepare(`
      SELECT * FROM memories WHERE ${conditions.join(' OR ')}
      ORDER BY strength DESC, last_accessed DESC
      LIMIT 50
    `).all(...params) as Record<string, any>[];

    return rows.map(r => this.rowToEntry(r));
  }

  queryByState(state: number): PersistentMemoryEntry[] {
    const rows = this.db.prepare(`
      SELECT * FROM memories WHERE ternary_state = ?
      ORDER BY strength DESC
      LIMIT 50
    `).all(state) as Record<string, any>[];

    return rows.map(r => this.rowToEntry(r));
  }

  forget(id: string): boolean {
    const result = this.db.prepare('DELETE FROM memories WHERE id = ?').run(id);
    if (result.changes > 0) {
      this.db.prepare('DELETE FROM memories_fts WHERE id = ?').run(id);
    }
    return result.changes > 0;
  }

  associate(id1: string, id2: string): boolean {
    const e1 = this.get(id1);
    const e2 = this.get(id2);
    if (!e1 || !e2) return false;

    const assoc1 = JSON.parse(e1.associations);
    const assoc2 = JSON.parse(e2.associations);

    if (!assoc1.includes(id2)) {
      assoc1.push(id2);
      this.db.prepare('UPDATE memories SET associations = ? WHERE id = ?').run(JSON.stringify(assoc1), id1);
    }
    if (!assoc2.includes(id1)) {
      assoc2.push(id1);
      this.db.prepare('UPDATE memories SET associations = ? WHERE id = ?').run(JSON.stringify(assoc2), id2);
    }
    return true;
  }

  getAll(): PersistentMemoryEntry[] {
    const rows = this.db.prepare('SELECT * FROM memories ORDER BY strength DESC, created_at DESC').all() as Record<string, any>[];
    return rows.map(r => this.rowToEntry(r));
  }

  getStats(): MemoryStats {
    const row = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN ternary_state = 1 THEN 1 ELSE 0 END) as reinforced,
        SUM(CASE WHEN ternary_state = 0 THEN 1 ELSE 0 END) as fading,
        SUM(CASE WHEN ternary_state = -1 THEN 1 ELSE 0 END) as faded,
        AVG(strength) as avg_strength,
        SUM(reinforcement_count) as total_reinforcements,
        SUM(negation_count) as total_negations
      FROM memories
    `).get() as Record<string, number>;

    return {
      total: row.total ?? 0,
      reinforced: row.reinforced ?? 0,
      fading: row.fading ?? 0,
      faded: row.faded ?? 0,
      avgStrength: row.avg_strength ?? 0,
      totalReinforcements: row.total_reinforcements ?? 0,
      totalNegations: row.total_negations ?? 0,
    };
  }

  applyGlobalDecay(elapsedDays = 1): void {
    this.db.prepare(`
      UPDATE memories SET
        strength = MAX(0, strength - decay_rate * ?),
        ternary_state = CASE
          WHEN strength - decay_rate * ? < 0.1 THEN -1
          WHEN strength - decay_rate * ? < 0.5 THEN 0
          ELSE 1
        END
    `).run(elapsedDays, elapsedDays, elapsedDays);
  }

  /**
   * 重建 FTS5 索引（用于迁移已有数据）
   */
  rebuildFtsIndex(): number {
    // 清空旧索引
    this.db.prepare('DELETE FROM memories_fts').run();

    // 重新索引所有现有记忆
    const rows = this.db.prepare('SELECT id, content, source, tags FROM memories').all() as Record<string, any>[];
    const stmt = this.db.prepare('INSERT INTO memories_fts(content, id, source) VALUES(?, ?, ?)');
    for (const row of rows) {
      const ftsContent = PersistentMemoryStore.tokenizeForFts(row.content + ' ' + row.source + ' ' + (row.tags || ''));
      stmt.run(ftsContent, row.id, row.source);
    }
    return rows.length;
  }

  // ── 记忆清理策略 ──

  /**
   * 执行记忆清理：删除陈旧 + 合并重复 + 总量封顶
   * 建议在 session_start 和定期（如每 50 次 write）调用
   */
  cleanup(): CleanupResult {
    const result: CleanupResult = {
      fadedPurged: 0,
      duplicatesMerged: 0,
      kept: 0,
      reasons: {},
    };

    const cfg = this.cleanupConfig;

    this.db.exec('BEGIN');

    try {
      // ── Phase 1: 删除陈旧记忆 ──
      // 强度低 + 长时间未访问 = 自然遗忘
      const cutoffTime = Date.now() - cfg.maxUnusedDays * 24 * 60 * 60 * 1000;
      const fadedResult = this.db.prepare(`
        DELETE FROM memories
        WHERE ternary_state = -1
          AND strength < ?
          AND last_accessed < ?
          AND source != 'hermes-memory'  -- 保留种子知识
      `).run(cfg.fadedStrengthThreshold, cutoffTime);

      result.fadedPurged = fadedResult.changes;
      if (fadedResult.changes > 0) {
        result.reasons['faded_purged'] = fadedResult.changes;
      }

      // ── Phase 2: 合并重复内容 ──
      // 找出内容相似度高的条目，保留强度最高的，删除其余的
      const allEntries = this.db.prepare(
        'SELECT id, content, strength, created_at, source, tags FROM memories ORDER BY strength DESC',
      ).all() as Record<string, any>[];

      const groups: Array<{ keep: Record<string, any>; remove: string[] }> = [];
      const processed = new Set<string>();

      for (let i = 0; i < allEntries.length; i++) {
        if (processed.has(allEntries[i].id)) continue;

        const group: { keep: Record<string, any>; remove: string[] } = {
          keep: allEntries[i],
          remove: [],
        };
        processed.add(allEntries[i].id);

        for (let j = i + 1; j < allEntries.length; j++) {
          if (processed.has(allEntries[j].id)) continue;

          const sim = this.contentSimilarity(
            allEntries[i].content,
            allEntries[j].content,
          );

          if (sim >= cfg.duplicateSimilarityThreshold) {
            // 保留强度更高的
            if (allEntries[j].strength > group.keep.strength) {
              group.remove.push(group.keep.id);
              group.keep = allEntries[j];
            } else {
              group.remove.push(allEntries[j].id);
            }
            processed.add(allEntries[j].id);
          }
        }

        if (group.remove.length > 0) {
          groups.push(group);
        }
      }

      // 执行删除
      let mergeCount = 0;
      for (const group of groups) {
        for (const id of group.remove) {
          this.db.prepare('DELETE FROM memories WHERE id = ?').run(id);
          mergeCount++;
        }
      }
      result.duplicatesMerged = mergeCount;
      if (mergeCount > 0) {
        result.reasons['duplicates_merged'] = mergeCount;
      }

      // ── Phase 3: 总量封顶 ──
      const total = this.db.prepare('SELECT COUNT(*) as c FROM memories').get() as Record<string, number>;
      if (total.c > cfg.maxEntries) {
        const excess = total.c - cfg.maxEntries;
        // 删除最弱 + 最旧的记忆（排除种子）
        const overflowResult = this.db.prepare(`
          DELETE FROM memories WHERE id IN (
            SELECT id FROM memories
            WHERE source != 'hermes-memory'
            ORDER BY strength ASC, last_accessed ASC
            LIMIT ?
          )
        `).run(excess);
        result.reasons['max_entries_cap'] = overflowResult.changes;
      }

      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      console.warn('[PersistentMemoryStore] cleanup failed:', e);
      throw e;
    }

    result.kept = (this.db.prepare('SELECT COUNT(*) as c FROM memories').get() as Record<string, number>).c;
    return result;
  }

  /**
   * 简单的基于 Token 的内容相似度计算
   */
  private contentSimilarity(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;

    // 提取有意义的中文/英文 Token
    const tokenize = (s: string): Set<string> => {
      const tokens = new Set<string>();
      // 中文：按字符
      for (const ch of s) {
        if (/[\u4e00-\u9fff]/.test(ch)) tokens.add(ch);
      }
      // 英文：按单词
      for (const word of s.toLowerCase().split(/[^a-z0-9]+/)) {
        if (word.length > 1) tokens.add(word);
      }
      return tokens;
    };

    const ta = tokenize(a);
    const tb = tokenize(b);

    if (ta.size === 0 || tb.size === 0) return 0;

    // Jaccard 相似度
    let intersection = 0;
    for (const t of ta) {
      if (tb.has(t)) intersection++;
    }
    const union = ta.size + tb.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  /**
   * 获取当前清理配置
   */
  getCleanupConfig(): CleanupConfig {
    return { ...this.cleanupConfig };
  }

  /**
   * 更新清理配置
   */
  setCleanupConfig(config: Partial<CleanupConfig>): void {
    this.cleanupConfig = { ...this.cleanupConfig, ...config };
  }

  close(): void {
    this.db.close();
  }

  // ── 从 pi-hermes-memory MEMORY.md 导入种子知识 ──

  seedFromHermesMemory(): number {
    // 尝试从多个可能的位置读取 MEMORY.md
    const paths = [
      '/root/.pi/agent/pi-hermes-memory/MEMORY.md',
      '/root/.pi/agent/pi-hermes-memory/USER.md',
    ];

    let seeded = 0;
    for (const filePath of paths) {
      if (!existsSync(filePath)) continue;
      try {
        const content = readFileSync(filePath, 'utf-8');

        // 提取段落作为记忆条目
        const sections = content.split(/(?=^#{1,3}\s)/m);
        for (const section of sections) {
          const trimmed = section.trim();
          if (!trimmed || trimmed.length < 20) continue;

          // 提取标题作为标签
          const titleMatch = trimmed.match(/^#{1,3}\s+(.+)$/m);
          const tags: string[] = [];
          if (titleMatch) {
            tags.push(titleMatch[1].trim());
          }

          // 提取关键行
          const keyLines = trimmed
            .split('\n')
            .filter((l: string) => l.includes('|') || l.includes('**') || l.includes('•') || l.includes('-'))
            .slice(0, 10)
            .join('; ')
            .slice(0, 500);

          if (keyLines.length > 20) {
            this.store(
              keyLines,
              `hermes-memory:${filePath.split('/').pop()}`,
              [...tags, 'seed', 'hermes-memory'],
            );
            seeded++;
          }
        }
      } catch {
        // 静默忽略单个文件错误
      }
    }
    return seeded;
  }

  /**
   * 将查询拆分为搜索词
   * 中文：提取所有 2-4 字子串，去重后取最长 5 个
   * 英文：按空格分词
   *
   * 与 search() 配合：每个词用 LIKE，OR 组合，按匹配词数排序
   */
  private tokenizeQuery(query: string): string[] {
    if (!query || query.length < 2) return [];
    const tokens = new Set<string>();

    // 中文：提取 2-4 字子串（跳过人工组合）
    // 只取连续的、有意义的长度段
    const chineseRanges = [
      { len: 4, step: 2 }, // 四字词：步长2
      { len: 3, step: 2 }, // 三字词
      { len: 2, step: 1 }, // 双字词
    ];
    for (const { len, step } of chineseRanges) {
      for (let i = 0; i + len <= query.length; i += step) {
        const seg = query.slice(i, i + len);
        if (/^[\u4e00-\u9fff]+$/.test(seg)) tokens.add(seg);
      }
    }

    // 英文多字符词
    for (const word of query.toLowerCase().split(/[^a-z0-9]+/)) {
      if (word.length > 2) tokens.add(word);
    }

    // 如果拆出来太多词，只保留最长的前 10 个
    let result = [...tokens];
    if (result.length > 10) {
      result.sort((a, b) => b.length - a.length);
      result = result.slice(0, 10);
    }

    return result;
  }

  // ── 辅助 ──

  private rowToEntry(row: Record<string, any>): PersistentMemoryEntry {
    return {
      id: row.id,
      content: row.content,
      ternaryState: row.ternary_state,
      strength: row.strength,
      decayRate: row.decay_rate,
      associations: row.associations,
      lastAccessed: row.last_accessed,
      createdAt: row.created_at,
      reinforcementCount: row.reinforcement_count,
      negationCount: row.negation_count,
      source: row.source,
      tags: row.tags,
    };
  }
}
