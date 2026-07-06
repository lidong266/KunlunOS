/**
 * 昆仑冲突自动检测模块
 *
 * 检测场景：
 *   1. 记忆与公理冲突 — 新分析结论否定公理卡(AX)的核心断言
 *   2. 卡间矛盾 — 同一桥下不同类型知识卡立场矛盾
 *
 * 方法：对比新文本与 AX 卡标题中的核心断言，检测同一主题的立场反转。
 */

import { DatabaseSync } from 'node:sqlite';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOG_DIR = join(dirname(fileURLToPath(import.meta.url)), 'logs');
const CONFLICT_LOG = join(LOG_DIR, 'conflicts.log');

if (!existsSync(LOG_DIR)) {
  try { mkdirSync(LOG_DIR, { recursive: true }); } catch { /* ok */ }
}

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

export interface ConflictEntry {
  id: string;
  ts: string;
  type: 'memory-vs-axiom' | 'card-vs-card';
  severity: 1 | 2 | 3;
  sourceA: string;
  sourceB: string;
  propositionA: string;
  propositionB: string;
  bridgeId?: string;
  description: string;
  resolved: boolean;
}

// ═══════════════════════════════════════════════════════════════
// 否定词表
// ═══════════════════════════════════════════════════════════════

const NEGATORS = [
  '不', '没', '无', '非', '勿', '别', '莫', '未', '否',
  '不是', '没有', '不能', '不会', '不可', '不必', '不应', '不许', '禁止',
  '不需要', '没必要', '毫无意义', '已经过时', '是错误的', '是错的',
  '反对', '否定', '错误', '无效', '失败',
  'not', 'no', 'never', 'cannot', 'wrong', 'false',
];

// ═══════════════════════════════════════════════════════════════
// 告警存储
// ═══════════════════════════════════════════════════════════════

let conflictCounter = 0;

export function logConflict(entry: Omit<ConflictEntry, 'id' | 'ts'>): ConflictEntry {
  const full: ConflictEntry = {
    id: `conflict-${++conflictCounter}-${Date.now()}`,
    ts: new Date().toISOString(),
    ...entry,
  };
  try {
    appendFileSync(CONFLICT_LOG, JSON.stringify(full) + '\n');
  } catch { /* ok */ }
  return full;
}

export function getConflicts(limit = 50, unresolvedOnly = false): ConflictEntry[] {
  try {
    if (!existsSync(CONFLICT_LOG)) return [];
    const content = readFileSync(CONFLICT_LOG, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean).slice(-limit);
    const entries = lines.map(l => JSON.parse(l) as ConflictEntry);
    return unresolvedOnly ? entries.filter(e => !e.resolved).reverse() : entries.reverse();
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// 冲突检测：新记忆 vs 公理卡
// ═══════════════════════════════════════════════════════════════

export function detectMemoryKnowledgeConflict(
  db: DatabaseSync,
  memoryContent: string,
  memoryTags: string[],
): ConflictEntry[] {
  const results: ConflictEntry[] = [];
  const mem = memoryContent.toLowerCase();

  // 获取所有 AX 卡（公理卡）
  const axCards = db.prepare(
    "SELECT card_id, title, content, bridge_id FROM knowledge_cards_v2 WHERE card_type='AX'",
  ).all() as Record<string, any>[];

  for (const card of axCards) {
    const title = card.title;
    // 从标题中提取断言片段（按分隔符拆分）
    const assertions = title.split(/[·。，,、．.！!？?]/).filter((s: string) => s.trim().length > 0);

    for (const assertion of assertions) {
      const trimmed = assertion.trim();
      if (trimmed.length < 2) continue;

      // 从断言中提取核心名词（2-4字中文词）
      const nouns: string[] = [];
      for (let len = 2; len <= 4; len++) {
        for (let i = 0; i <= trimmed.length - len; i++) {
          const sub = trimmed.slice(i, i + len);
          if (/^[\u4e00-\u9fff]+$/.test(sub)) nouns.push(sub);
        }
      }
      // 去重保留最长的
      nouns.sort((a, b) => b.length - a.length);
      const uniqueNouns = nouns.filter((n, i) => !nouns.some((m, j) => j < i && m.includes(n)));

      for (const noun of uniqueNouns.slice(0, 3)) {
        const idx = mem.indexOf(noun);
        if (idx === -1) continue;

        // 检查名词附近是否有否定词
        const start = Math.max(0, idx - 10);
        const end = Math.min(mem.length, idx + noun.length + 30);
        const context = mem.slice(start, end);

        const negated = NEGATORS.some(n => context.includes(n));
        if (!negated) continue;

        // 计算严重度：否定越长/越核心的名词越严重
        const severity: 1 | 2 | 3 = noun.length >= 3 ? 3 : noun.length >= 2 ? 2 : 1;

        results.push({
          id: `conflict-${++conflictCounter}-${Date.now()}`,
          ts: new Date().toISOString(),
          type: 'memory-vs-axiom',
          severity,
          sourceA: `memory: ${memoryContent.slice(0, 40)}`,
          sourceB: `${card.card_id}: ${card.title}`,
          propositionA: context,
          propositionB: trimmed,
          bridgeId: card.bridge_id,
          description: `新分析否定了公理 [${card.card_id}] "${card.title}" 的核心断言 "${trimmed}"（在"${noun}"附近检测到否定词）`,
          resolved: false,
        });
        break; // 一张卡只报告一次
      }
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════
// 冲突检测：跨卡矛盾
// ═══════════════════════════════════════════════════════════════

export function detectCrossCardConflict(db: DatabaseSync): ConflictEntry[] {
  const results: ConflictEntry[] = [];

  const bridges = db.prepare('SELECT DISTINCT bridge_id FROM knowledge_cards_v2').all() as Record<string, any>[];

  for (const { bridge_id } of bridges) {
    const cards = db.prepare(
      'SELECT card_id, title, content, card_type, bridge_id FROM knowledge_cards_v2 WHERE bridge_id = ?',
    ).all(bridge_id) as Record<string, any>[];

    // 仅比较 AX vs SC/TC（公理 vs 学科/工具）
    const axCards = cards.filter(c => c.card_type === 'AX');
    const otherCards = cards.filter(c => c.card_type !== 'AX');

    for (const ax of axCards) {
      for (const other of otherCards) {
        // 检查 other 卡的内容是否否定了 ax 卡的标题断言
        const otherContent = (other.content + ' ' + other.title).toLowerCase();
        const axAssertions = ax.title.split(/[·。，,、．.！!？?]/).filter((s: string) => s.trim().length > 0);

        for (const assertion of axAssertions) {
          const trimmed = assertion.trim();
          if (trimmed.length < 2) continue;

          const nouns: string[] = [];
          for (let len = 2; len <= 4; len++) {
            for (let i = 0; i <= trimmed.length - len; i++) {
              const sub = trimmed.slice(i, i + len);
              if (/^[\u4e00-\u9fff]+$/.test(sub)) nouns.push(sub);
            }
          }
          nouns.sort((a, b) => b.length - a.length);
          const uniqueNouns = nouns.filter((n, i) => !nouns.some((m, j) => j < i && m.includes(n)));

          for (const noun of uniqueNouns.slice(0, 2)) {
            if (!otherContent.includes(noun)) continue;
            const negated = NEGATORS.some(n => otherContent.includes(n));
            if (negated) {
              results.push({
                id: `conflict-${++conflictCounter}-${Date.now()}`,
                ts: new Date().toISOString(),
                type: 'card-vs-card',
                severity: 3,
                sourceA: `${ax.card_id}: ${ax.title}`,
                sourceB: `${other.card_id}: ${other.title}`,
                propositionA: trimmed,
                propositionB: other.content.slice(0, 80),
                bridgeId: bridge_id,
                description: `公理卡 [${ax.card_id}] "${ax.title}" 被同桥 [${other.card_type}]${other.title} 否定`,
                resolved: false,
              });
              break;
            }
          }
        }
      }
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════
// 报告格式化
// ═══════════════════════════════════════════════════════════════

export function formatConflictReport(conflicts: ConflictEntry[]): string {
  if (conflicts.length === 0) return '✅ 无未解决的冲突\n';

  const lines: string[] = [];
  lines.push(`⚠️  检测到 ${conflicts.length} 个冲突\n`);

  for (const c of conflicts) {
    const sevIcon = c.severity === 3 ? '🔴' : c.severity === 2 ? '🟡' : '🟢';
    const typeLabels: Record<string, string> = {
      'memory-vs-axiom': '记忆↔公理',
      'card-vs-card': '卡↔卡',
    };
    lines.push(`${sevIcon} [${typeLabels[c.type] || c.type}] 严重度${c.severity}`);
    lines.push(`   ${c.description}`);
    lines.push(`   来源: ${c.sourceA} ↔ ${c.sourceB}`);
    if (c.bridgeId) lines.push(`   桥: ${c.bridgeId}`);
    lines.push('');
  }

  return lines.join('\n');
}
