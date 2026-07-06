/**
 * 昆仑云同步模块
 *
 * 将知识卡体系 (knowledge_cards_v2) 同步到远端知识库。
 * 支持 JSON 导出/导入，以及 HTTP API 推送。
 *
 * 同步模式：
 *   export   — 导出为 JSON 文件（可用于备份/迁移）
 *   import   — 从 JSON 文件导入知识卡
 *   push     — 推送到远端 API
 *   pull     — 从远端 API 拉取
 */

import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'kunlun-memory.db');
const EXPORT_DIR = join(__dirname, 'exports');
const EXPORT_PATH = join(EXPORT_DIR, 'knowledge-cards-export.json');

if (!existsSync(EXPORT_DIR)) {
  try { mkdirSync(EXPORT_DIR, { recursive: true }); } catch { /* ok */ }
}

// ═══════════════════════════════════════════════════════════════
// 导出格式
// ═══════════════════════════════════════════════════════════════

export interface CardExport {
  version: string;
  exportedAt: string;
  cards: CardRecord[];
  bridges: BridgeRecord[];
  domainMaps: DomainMapRecord[];
  stats: ExportStats;
}

export interface CardRecord {
  cardId: string;
  bridgeId: string;
  layer: string;
  cardType: string;
  title: string;
  content: string;
  tags: string[];
}

interface BridgeRecord {
  bridgeId: string;
  name: string;
  description: string;
  resonance: string;
}

interface DomainMapRecord {
  domain: string;
  bridgeId: string;
  confidence: number;
}

interface ExportStats {
  totalCards: number;
  totalBridges: number;
  totalDomains: number;
  byBridge: Record<string, number>;
  byType: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════
// 导出
// ═══════════════════════════════════════════════════════════════

export function exportKnowledgeCards(db?: DatabaseSync): CardExport {
  const shouldClose = !db;
  const localDb = db || new DatabaseSync(DB_PATH);

  try {
    const cards = localDb.prepare(
      'SELECT card_id, bridge_id, layer, card_type, title, content, tags FROM knowledge_cards_v2 ORDER BY card_id',
    ).all() as Record<string, any>[];

    const bridges = localDb.prepare(
      'SELECT bridge_id, name, description, resonance FROM bridge_profiles ORDER BY bridge_id',
    ).all() as Record<string, any>[];

    const domainMaps = localDb.prepare(
      'SELECT domain, bridge_id, confidence FROM domain_maps ORDER BY domain',
    ).all() as Record<string, any>[];

    // 统计
    const byBridge: Record<string, number> = {};
    const byType: Record<string, number> = {};
    for (const c of cards) {
      byBridge[c.bridge_id] = (byBridge[c.bridge_id] || 0) + 1;
      byType[c.card_type] = (byType[c.card_type] || 0) + 1;
    }

    return {
      version: '0.2.0',
      exportedAt: new Date().toISOString(),
      cards: cards.map(c => ({
        cardId: c.card_id,
        bridgeId: c.bridge_id,
        layer: c.layer,
        cardType: c.card_type,
        title: c.title,
        content: c.content,
        tags: JSON.parse(c.tags || '[]'),
      })),
      bridges: bridges.map(b => ({
        bridgeId: b.bridge_id,
        name: b.name,
        description: b.description,
        resonance: b.resonance,
      })),
      domainMaps: domainMaps.map(d => ({
        domain: d.domain,
        bridgeId: d.bridge_id,
        confidence: d.confidence,
      })),
      stats: {
        totalCards: cards.length,
        totalBridges: bridges.length,
        totalDomains: domainMaps.length,
        byBridge,
        byType,
      },
    };
  } finally {
    if (shouldClose) localDb.close();
  }
}

export function exportToFile(): string {
  const data = exportKnowledgeCards();
  writeFileSync(EXPORT_PATH, JSON.stringify(data, null, 2));
  return EXPORT_PATH;
}

// ═══════════════════════════════════════════════════════════════
// 导入
// ═══════════════════════════════════════════════════════════════

export interface ImportResult {
  cardsImported: number;
  cardsSkipped: number;
  bridgesImported: number;
  domainsImported: number;
  errors: string[];
}

export function importFromFile(filePath?: string): ImportResult {
  const path = filePath || EXPORT_PATH;
  if (!existsSync(path)) {
    return { cardsImported: 0, cardsSkipped: 0, bridgesImported: 0, domainsImported: 0, errors: [`文件不存在: ${path}`] };
  }

  const data = JSON.parse(readFileSync(path, 'utf8')) as CardExport;
  return importKnowledgeCards(data);
}

export function importKnowledgeCards(data: CardExport, db?: DatabaseSync): ImportResult {
  const shouldClose = !db;
  const localDb = db || new DatabaseSync(DB_PATH);
  const result: ImportResult = { cardsImported: 0, cardsSkipped: 0, bridgesImported: 0, domainsImported: 0, errors: [] };

  try {
    localDb.exec('BEGIN');

    try {
      // 导入知识卡
      for (const card of data.cards) {
        const existing = localDb.prepare('SELECT card_id FROM knowledge_cards_v2 WHERE card_id = ?').get(card.cardId);
        if (existing) {
          result.cardsSkipped++;
          continue;
        }
        localDb.prepare(`
          INSERT INTO knowledge_cards_v2 (card_id, bridge_id, layer, card_type, title, content, tags, call_count, confidence, created_at, updated_at, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0.7, ?, ?, 'active')
        `).run(
          card.cardId, card.bridgeId, card.layer, card.cardType,
          card.title, card.content, JSON.stringify(card.tags),
          Date.now(), Date.now(),
        );
        result.cardsImported++;
      }

      // 导入桥配置
      if (data.bridges) {
        for (const bridge of data.bridges) {
          localDb.prepare(`
            INSERT OR REPLACE INTO bridge_profiles (bridge_id, name, description, resonance)
            VALUES (?, ?, ?, ?)
          `).run(bridge.bridgeId, bridge.name, bridge.description, bridge.resonance || '[]');
          result.bridgesImported++;
        }
      }

      // 导入领域映射
      if (data.domainMaps) {
        for (const dm of data.domainMaps) {
          localDb.prepare(`
            INSERT OR REPLACE INTO domain_maps (domain, bridge_id, confidence)
            VALUES (?, ?, ?)
          `).run(dm.domain, dm.bridgeId, dm.confidence);
          result.domainsImported++;
        }
      }

      localDb.exec('COMMIT');
    } catch (e: any) {
      localDb.exec('ROLLBACK');
      result.errors.push(`导入失败: ${e.message || e}`);
    }

  } finally {
    if (shouldClose) localDb.close();
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// HTTP 推送/拉取
// ═══════════════════════════════════════════════════════════════

export interface SyncConfig {
  /** 远端知识库 API 地址 */
  endpoint: string;
  /** API 密钥 */
  apiKey?: string;
  /** 超时 (ms) */
  timeout: number;
}

const DEFAULT_SYNC_CONFIG: SyncConfig = {
  endpoint: '',
  timeout: 10000,
};

let syncConfig: SyncConfig = { ...DEFAULT_SYNC_CONFIG };

export function setSyncConfig(config: Partial<SyncConfig>): void {
  syncConfig = { ...syncConfig, ...config };
}

export function getSyncConfig(): SyncConfig {
  return { ...syncConfig };
}

export interface SyncResult {
  success: boolean;
  pushed: number;
  pulled: number;
  errors: string[];
  endpoint: string;
}

export async function pushToRemote(): Promise<SyncResult> {
  const result: SyncResult = { success: false, pushed: 0, pulled: 0, errors: [], endpoint: syncConfig.endpoint };

  if (!syncConfig.endpoint) {
    result.errors.push('未配置远端 endpoint，使用 export 代替');
    const path = exportToFile();
    result.errors.push(`已导出到: ${path}`);
    return result;
  }

  try {
    const data = exportKnowledgeCards();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (syncConfig.apiKey) headers['Authorization'] = `Bearer ${syncConfig.apiKey}`;

    const response = await fetch(syncConfig.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(syncConfig.timeout),
    });

    if (!response.ok) {
      result.errors.push(`HTTP ${response.status}: ${response.statusText}`);
      return result;
    }

    result.pushed = data.cards.length;
    result.success = true;
  } catch (e: any) {
    result.errors.push(`推送失败: ${e.message || e}`);
  }

  return result;
}

export async function pullFromRemote(): Promise<SyncResult> {
  const result: SyncResult = { success: false, pushed: 0, pulled: 0, errors: [], endpoint: syncConfig.endpoint };

  if (!syncConfig.endpoint) {
    result.errors.push('未配置远端 endpoint');
    return result;
  }

  try {
    const headers: Record<string, string> = {};
    if (syncConfig.apiKey) headers['Authorization'] = `Bearer ${syncConfig.apiKey}`;

    const response = await fetch(syncConfig.endpoint, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(syncConfig.timeout),
    });

    if (!response.ok) {
      result.errors.push(`HTTP ${response.status}: ${response.statusText}`);
      return result;
    }

    const data = await response.json() as CardExport;
    const importResult = importKnowledgeCards(data);
    result.pulled = importResult.cardsImported;
    result.success = true;

    if (importResult.errors.length > 0) {
      result.errors.push(...importResult.errors);
    }
  } catch (e: any) {
    result.errors.push(`拉取失败: ${e.message || e}`);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// 报告格式化
// ═══════════════════════════════════════════════════════════════

export function formatExportReport(data: CardExport): string {
  const lines: string[] = [];
  lines.push('╔════════════════════════════════════╗');
  lines.push('║  知识卡同步报告                     ║');
  lines.push('╚════════════════════════════════════╝');
  lines.push('');
  lines.push(`版本:       ${data.version}`);
  lines.push(`导出时间:   ${data.exportedAt}`);
  lines.push(`知识卡总数: ${data.stats.totalCards}`);
  lines.push(`桥配置数:   ${data.stats.totalBridges}`);
  lines.push(`领域映射数: ${data.stats.totalDomains}`);
  lines.push('');
  lines.push('按桥统计:');
  for (const [bridge, count] of Object.entries(data.stats.byBridge).sort()) {
    const name = data.bridges.find(b => b.bridgeId === bridge)?.name || bridge;
    lines.push(`  ${bridge} ${name}: ${count} 张`);
  }
  lines.push('');
  lines.push('按类型统计:');
  const typeLabels: Record<string, string> = { AX: '公理卡', SC: '学科卡', TC: '工具卡' };
  for (const [type, count] of Object.entries(data.stats.byType)) {
    lines.push(`  ${type} (${typeLabels[type] || type}): ${count} 张`);
  }
  return lines.join('\n');
}

export function formatSyncResult(result: SyncResult): string {
  if (!result.endpoint) {
    return result.errors.join('\n');
  }
  const lines: string[] = [];
  lines.push(result.success ? '✅ 同步成功' : '❌ 同步失败');
  lines.push(`  端点: ${result.endpoint}`);
  if (result.pushed > 0) lines.push(`  推送: ${result.pushed} 条`);
  if (result.pulled > 0) lines.push(`  拉取: ${result.pulled} 条`);
  if (result.errors.length > 0) {
    for (const e of result.errors) lines.push(`  ⚠️ ${e}`);
  }
  return lines.join('\n');
}
