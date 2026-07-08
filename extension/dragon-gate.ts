/**
 * ⚠️ DEPRECATED — 死代码，请勿在新链路中使用
 *
 * 本文件是"龙门自动补录"的初版实现，依赖 `node:sqlite`（运行时需 SQLite 支持），
 * 且依赖已不存在的 `knowledge_cards_v2` 表，无法在现代环境直接运行。
 *
 * 该能力已于大成智慧学落地阶段（2026-07）重写为：
 *   👉 packages/kunlun-os-core/src/longmen.ts
 *      —— 纯内存 + JSONL，三元坐标/溯源/不覆盖 防注水，已接入 kunlun-os 全链路。
 *
 * 现状（2026-07-08 审计确认）：本文件全仓零引用，仅作历史参考保留。
 * 如有清理意愿，可直接删除或移入 docs/legacy/。
 *
 * ──────────────────────────────────────────────────────────────
 * 以下为原始文档（仅供参考）：
 *
 * 龙门自动补录 — 推理中识别缺失知识卡，自动生成草稿待审核
 *
 * 灵感来源：鲤鱼跃龙门 — 推理到达一定深度后，自动"化龙"生成新卡。
 *
 * 触发条件：
 *   1. 某桥被高频激活（≥3 次分析）但该桥某层缺某类卡 → 建议补录
 *   2. 分析中检测到新模式，可提炼为学科卡(SC)或工具卡(TC)
 *   3. 多轮分析后涌现的通用原则 → 公理卡(AX)
 */

import { DatabaseSync } from 'node:sqlite';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'kunlun-memory.db');
const LOG_DIR = join(__dirname, 'logs');
const DRAFT_LOG = join(LOG_DIR, 'dragon-gate-drafts.log');

if (!existsSync(LOG_DIR)) {
  try { mkdirSync(LOG_DIR, { recursive: true }); } catch { /* ok */ }
}

// ═══════════════════════════════════════════════════════════════
// 龙门补录草案
// ═══════════════════════════════════════════════════════════════

export interface DragonGateDraft {
  /** 草稿 ID */
  id: string;
  /** 生成时间 */
  ts: string;
  /** 推荐桥 */
  bridgeId: string;
  /** 推荐层 */
  layer: '基础学科' | '科学技术' | '工程技术';
  /** 推荐卡类型 */
  cardType: 'AX' | 'SC' | 'TC';
  /** 推荐标题 */
  title: string;
  /** 推荐内容 */
  content: string;
  /** 推荐标签 */
  tags: string[];
  /** 触发来源（分析摘要） */
  source: string;
  /** 置信度 (0-1) */
  confidence: number;
  /** 状态: draft/promoted/rejected */
  status: 'draft' | 'promoted' | 'rejected';
}

// ═══════════════════════════════════════════════════════════════
// 草稿存储
// ═══════════════════════════════════════════════════════════════

let draftCounter = 0;

export function logDraft(draft: Omit<DragonGateDraft, 'id' | 'ts'>): DragonGateDraft {
  const full: DragonGateDraft = {
    id: `dragon-${++draftCounter}-${Date.now()}`,
    ts: new Date().toISOString(),
    ...draft,
  };
  try {
    appendFileSync(DRAFT_LOG, JSON.stringify(full) + '\n');
  } catch { /* ok */ }
  return full;
}

export function getDrafts(status?: 'draft' | 'promoted' | 'rejected'): DragonGateDraft[] {
  try {
    if (!existsSync(DRAFT_LOG)) return [];
    const content = readFileSync(DRAFT_LOG, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    let entries = lines.map(l => JSON.parse(l) as DragonGateDraft);
    if (status) entries = entries.filter(e => e.status === status);
    return entries.reverse();
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// 龙门推理引擎
// ═══════════════════════════════════════════════════════════════

/**
 * 分析当前的缺口并生成补录建议
 */
export function suggestDrafts(
  db: DatabaseSync,
  bridgeId: string,
  analysisQuery: string,
  contradictions: number,
  hasStrategy: boolean,
  hasEcosystem: boolean,
): DragonGateDraft[] {
  const drafts: DragonGateDraft[] = [];

  // 获取该桥当前已有卡片
  const existingCards = db.prepare(
    'SELECT card_id, layer, card_type FROM knowledge_cards_v2 WHERE bridge_id = ?',
  ).all(bridgeId) as Record<string, any>[];

  const layers = ['基础学科', '科学技术', '工程技术'];
  const allTypes = ['AX', 'SC', 'TC'];

  for (const layer of layers) {
    const existingTypes = existingCards
      .filter(c => c.layer === layer)
      .map(c => c.card_type);

    for (const cardType of allTypes) {
      if (existingTypes.includes(cardType)) continue;

      // 找到缺口，根据上下文生成建议
      const draft = generateDraft(
        db, bridgeId, layer as any, cardType as any,
        analysisQuery, contradictions, hasStrategy, hasEcosystem,
      );
      if (draft && draft.confidence >= 0.4) {
        drafts.push(draft);
      }
    }
  }

  return drafts;
}

/**
 * 为特定缺口生成补录建议
 */
function generateDraft(
  db: DatabaseSync,
  bridgeId: string,
  layer: '基础学科' | '科学技术' | '工程技术',
  cardType: 'AX' | 'SC' | 'TC',
  query: string,
  contradictions: number,
  hasStrategy: boolean,
  hasEcosystem: boolean,
): DragonGateDraft | null {
  // 获取桥名称
  const bridge = db.prepare('SELECT name, description FROM bridge_profiles WHERE bridge_id = ?').get(bridgeId) as Record<string, any> | undefined;
  if (!bridge) return null;

  const bridgeName = bridge.name;

  // 根据层+类型组合生成建议
  const pair = `${layer}|${cardType}`;
  let confidence = 0;
  let title = '';
  let content = '';
  let tags: string[] = [bridgeId, cardType, layer];

  switch (pair) {
    // ═══════════════════════════════════════
    // 基础学科 - 公理卡 (已存在)
    // ═══════════════════════════════════════
    // 基础学科 - 学科卡 (SC)
    case '基础学科|SC':
      confidence = 0.5 + (contradictions > 0 ? 0.2 : 0);
      title = `${bridgeName}基础理论`;
      content = generateSCTitle(bridgeName, layer, query);
      tags.push('foundation', 'discipline');
      break;

    // 基础学科 - 工具卡 (TC)
    case '基础学科|TC':
      confidence = 0.4 + (contradictions > 0 ? 0.2 : 0);
      title = `${bridgeName}基础概念辨析工具`;
      content = generateTCTitle(bridgeName, layer, query);
      tags.push('foundation', 'tool');
      break;

    // 科学技术 - 公理卡 (AX)
    case '科学技术|AX':
      confidence = 0.5 + (hasStrategy ? 0.2 : 0);
      title = `方法论的统一性原理`;
      content = generateAXTitle(bridgeName, layer, query);
      tags.push('methodology', 'axiom');
      break;

    // 科学技术 - 学科卡 (已存在)
    // 科学技术 - 工具卡 (TC)
    case '科学技术|TC':
      confidence = 0.5 + (contradictions > 1 ? 0.2 : 0);
      title = `${bridgeName}分析方法论`;
      content = generateTCTitle(bridgeName, layer, query);
      tags.push('methodology', 'tool');
      break;

    // 工程技术 - 公理卡 (AX)
    case '工程技术|AX':
      confidence = 0.4 + (hasEcosystem ? 0.2 : 0);
      title = `实践检验的辩证原则`;
      content = generateAXTitle(bridgeName, layer, query);
      tags.push('practice', 'axiom');
      break;

    // 工程技术 - 学科卡 (SC)
    case '工程技术|SC':
      confidence = 0.5 + (contradictions > 0 ? 0.2 : 0);
      title = `${bridgeName}工程实践`;
      content = generateSCTitle(bridgeName, layer, query);
      tags.push('practice', 'discipline');
      break;

    // 工程技术 - 工具卡 (已存在)
    default:
      return null;
  }

  if (confidence < 0.4) return null;

  return {
    id: '',
    ts: '',
    bridgeId,
    layer,
    cardType,
    title,
    content,
    tags,
    source: query.slice(0, 100),
    confidence: Math.round(confidence * 10) / 10,
    status: 'draft',
  };
}

// ═══════════════════════════════════════════════════════════════
// 内容生成器（模板 + 分析上下文填充）
// ═══════════════════════════════════════════════════════════════

function generateAXTitle(bridge: string, layer: string, query: string): string {
  const templates = [
    `${bridge}领域的认识论基础：从实践到认识的辩证过程`,
    `系统思维的核心法则：${bridge}的整体性与层次性`,
    `${bridge}分析的第一性原则：实事求是、尊重客观规律`,
    `矛盾的普遍性与特殊性 — ${bridge}的辩证分析`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

function generateSCTitle(bridge: string, layer: string, query: string): string {
  const templates = [
    `${bridge}的核心概念体系：定义、分类与关系`,
    `${bridge}的主要研究范式与发展脉络`,
    `${bridge}与相关学科的交叉分析框架`,
    `${bridge}的基本规律与核心机制`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

function generateTCTitle(bridge: string, layer: string, query: string): string {
  const templates = [
    `${bridge}分析工具箱：从问题到诊断的完整流程`,
    `${bridge}的指标体系和评估方法`,
    `${bridge}的结构化分析方法：层次分析法`,
    `${bridge}的问题诊断框架：现象-原因-对策`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

// ═══════════════════════════════════════════════════════════════
// 草稿升级（龙门跃迁）
// ═══════════════════════════════════════════════════════════════

/**
 * 将草稿升级为正式知识卡（龙门跃迁）
 */
export function promoteDraft(db: DatabaseSync, draft: DragonGateDraft, customContent?: string): boolean {
  try {
    const now = Date.now();
    db.prepare(`
      INSERT OR REPLACE INTO knowledge_cards_v2
        (card_id, bridge_id, layer, card_type, title, content, tags, call_count, confidence, created_at, updated_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'active')
    `).run(
      draft.id.replace('dragon-', 'DG-'),
      draft.bridgeId,
      draft.layer,
      draft.cardType,
      draft.title,
      customContent || draft.content,
      JSON.stringify(draft.tags),
      draft.confidence,
      now,
      now,
    );

    // 同时写入 memories 表（作为系统记忆）
    db.prepare(`
      INSERT INTO memories (id, content, ternary_state, strength, source, tags, last_accessed, created_at)
      VALUES (?, ?, 0, 0.6, 'dragon-gate', ?, ?, ?)
    `).run(
      'dragon-' + draft.id,
      `[龙门补录] 桥${draft.bridgeId} ${draft.layer}/${draft.cardType}: ${draft.title}`,
      JSON.stringify(['dragon-gate', draft.bridgeId, draft.cardType]),
      now, now,
    );

    draft.status = 'promoted';
    return true;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// 报告格式化
// ═══════════════════════════════════════════════════════════════

export function formatDraftReport(drafts: DragonGateDraft[]): string {
  if (drafts.length === 0) return '⏭️ 当前无龙门补录建议\n';

  const lines: string[] = [];
  lines.push(`🐉 龙门补录建议 (${drafts.length} 条草稿)\n`);

  for (const d of drafts) {
    const confBar = '█'.repeat(Math.round(d.confidence * 10));
    const typeLabels: Record<string, string> = { AX: '公理卡', SC: '学科卡', TC: '工具卡' };
    lines.push(`  ${d.bridgeId} ${d.layer} → ${typeLabels[d.cardType] || d.cardType}`);
    lines.push(`    📋 ${d.title}`);
    lines.push(`    💬 ${d.content.slice(0, 60)}...`);
    lines.push(`    🎯 置信度: ${Math.round(d.confidence * 100)}% ${confBar}`);
    lines.push(`    🏷 ${d.tags.join(', ')}`);
    lines.push('');
  }

  return lines.join('\n');
}
