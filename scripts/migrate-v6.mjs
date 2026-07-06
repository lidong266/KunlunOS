#!/usr/bin/env node

import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const V6_DB = join(ROOT, '..', 'kunlun-v6', 'kunlun.db');
const V2_DB = join(ROOT, 'extension', 'kunlun-memory.db');
const REPORT = join(ROOT, 'deliverables', 'v6-migration-report.md');

const stats = {};
const errors = [];

function initV2() {
  const db = new DatabaseSync(V2_DB);
  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY, content TEXT NOT NULL, ternary_state INTEGER DEFAULT 0,
      strength REAL DEFAULT 0.5, decay_rate REAL DEFAULT 0.05,
      associations TEXT DEFAULT '[]', last_accessed INTEGER NOT NULL,
      created_at INTEGER NOT NULL, reinforcement_count INTEGER DEFAULT 0,
      negation_count INTEGER DEFAULT 0, source TEXT DEFAULT 'unknown',
      tags TEXT DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS knowledge (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL,
      category TEXT DEFAULT 'general', bridge_id TEXT, card_type TEXT,
      confidence REAL DEFAULT 0.5, source TEXT DEFAULT 'v6-migration',
      tags TEXT DEFAULT '[]', created_at INTEGER NOT NULL, call_count INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS bridge_profiles (
      bridge_id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
      resonance TEXT DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS domain_maps (
      domain TEXT NOT NULL, bridge_id TEXT NOT NULL,
      confidence REAL DEFAULT 1.0, PRIMARY KEY (domain, bridge_id)
    );
    CREATE TABLE IF NOT EXISTS migration_log (
      table_name TEXT, rows_migrated INTEGER, migrated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  return db;
}

function migrateTable(label, v6, v2, query, fn) {
  try {
    const rows = v6.prepare(query).all();
    if (rows.length === 0) { stats[label] = 0; console.log('  ⏭️', label, '(空)'); return; }

    v2.exec('BEGIN');
    for (const row of rows) {
      const r = fn(row);
      v2.prepare(r.sql).run(...r.params);
    }
    v2.exec('COMMIT');
    stats[label] = rows.length;
    v2.prepare('INSERT INTO migration_log (table_name, rows_migrated) VALUES (?, ?)').run(label, rows.length);
    console.log('  ✅', label + ':', rows.length, '条');
  } catch (e) {
    v2.exec('ROLLBACK');
    errors.push(label + ': ' + (e.message || e));
    console.log('  ❌', label + ':', e.message || e);
  }
}

function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║  v6 → V2 数据迁移                   ║');
  console.log('╚══════════════════════════════════════╝\n');

  if (!existsSync(V6_DB)) {
    console.log('⏭️  v6 数据库不存在:', V6_DB);
    return;
  }
  console.log('📂 v6:', V6_DB);
  console.log('📂 V2:', V2_DB, '\n');

  const v6 = new DatabaseSync(V6_DB);
  const v2 = initV2();

  // 1. knowledge_cards → knowledge 表
  migrateTable('knowledge_cards', v6, v2,
    'SELECT * FROM knowledge_cards',
    (row) => ({
      sql: `INSERT OR REPLACE INTO knowledge (id, title, content, category, bridge_id, card_type, confidence, source, tags, created_at, call_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        row.card_id, row.title || '', row.content || '', row.card_type || 'general',
        row.bridge_id || null, row.card_type || null, 0.7, 'v6-migration',
        JSON.stringify([row.card_type || 'general', 'v6-migration', row.bridge_id || ''].filter(Boolean)),
        row.created_at ? new Date(row.created_at).getTime() : Date.now(),
        row.call_count || 0,
      ],
    }),
  );

  // 2. bridge_profiles → bridge_profiles 表
  migrateTable('bridge_profiles', v6, v2,
    'SELECT * FROM bridge_profiles',
    (row) => ({
      sql: `INSERT OR REPLACE INTO bridge_profiles (bridge_id, name, description, resonance) VALUES (?, ?, ?, '[]')`,
      params: [row.bridge_id, row.name, row.description || ''],
    }),
  );

  // 3. bridge_resonance → 更新 resonance 字段
  migrateTable('bridge_resonance', v6, v2,
    'SELECT * FROM bridge_resonance',
    (row) => {
      const existing = v2.prepare('SELECT resonance FROM bridge_profiles WHERE bridge_id = ?').get(row.from_bridge);
      const res = existing ? JSON.parse(existing.resonance) : [];
      res.push({ to: row.to_bridge, direction: row.direction, strength: row.strength });
      return {
        sql: 'UPDATE bridge_profiles SET resonance = ? WHERE bridge_id = ?',
        params: [JSON.stringify(res), row.from_bridge],
      };
    },
  );

  // 4. domain_bridge_map → domain_maps 表
  migrateTable('domain_maps', v6, v2,
    'SELECT * FROM domain_bridge_map',
    (row) => ({
      sql: 'INSERT OR REPLACE INTO domain_maps (domain, bridge_id, confidence) VALUES (?, ?, ?)',
      params: [row.domain, row.bridge_id, row.confidence],
    }),
  );

  // 5. agent_rules → memories
  migrateTable('agent_rules', v6, v2,
    'SELECT * FROM agent_rules',
    (row) => ({
      sql: `INSERT OR REPLACE INTO memories (id, content, ternary_state, strength, source, tags, last_accessed, created_at)
            VALUES (?, ?, 0, ?, 'v6-migration', ?, ?, ?)`,
      params: [
        'rule-' + row.rule_id,
        '[规则/' + (row.category || 'general') + '] ' + (row.rule_text || ''),
        0.8,
        JSON.stringify(['rule', row.category || 'general', 'v6-migration']),
        Date.now(), Date.now(),
      ],
    }),
  );

  // 6. evolution_rules → memories
  migrateTable('evolution_rules', v6, v2,
    'SELECT * FROM tianyan_evolution_rules',
    (row) => ({
      sql: `INSERT OR REPLACE INTO memories (id, content, ternary_state, strength, source, tags, last_accessed, created_at)
            VALUES (?, ?, 0, ?, 'v6-migration', ?, ?, ?)`,
      params: [
        'evolve-' + row.rule_id,
        '[进化规则] ' + (row.name || '') + ': ' + (row.trigger || '') + ' → ' + (row.action || ''),
        0.7,
        JSON.stringify(['evolution', 'v6-migration']),
        Date.now(), Date.now(),
      ],
    }),
  );

  // 7. health_baselines → memories
  migrateTable('health_baselines', v6, v2,
    'SELECT * FROM zhenshang_health_baseline',
    (row) => ({
      sql: `INSERT OR REPLACE INTO memories (id, content, ternary_state, strength, source, tags, last_accessed, created_at)
            VALUES (?, ?, 0, ?, 'v6-migration', ?, ?, ?)`,
      params: [
        'health-' + row.subsystem + '-' + row.metric,
        '[健康基线] ' + row.subsystem + '/' + row.metric + ': baseline=' + row.baseline + ', threshold=' + row.threshold + (row.unit ? ' ' + row.unit : ''),
        0.6,
        JSON.stringify(['health', 'v6-migration']),
        Date.now(), Date.now(),
      ],
    }),
  );

  // 8. security_rules → memories
  migrateTable('security_rules', v6, v2,
    'SELECT * FROM zhenyue_rules',
    (row) => ({
      sql: `INSERT OR REPLACE INTO memories (id, content, ternary_state, strength, source, tags, last_accessed, created_at)
            VALUES (?, ?, 0, ?, 'v6-migration', ?, ?, ?)`,
      params: [
        'zhenyue-' + row.rule_id,
        '[镇岳规则] ' + (row.name || '') + ': ' + (row.description || '') + ' (条件: ' + (row.condition || '') + ')',
        0.75,
        JSON.stringify(['security', 'zhenyue', 'v6-migration']),
        Date.now(), Date.now(),
      ],
    }),
  );

  // 9. startup_sequence → memories
  migrateTable('startup_sequence', v6, v2,
    'SELECT * FROM startup_sequence ORDER BY phase',
    (row) => ({
      sql: `INSERT OR REPLACE INTO memories (id, content, ternary_state, strength, source, tags, last_accessed, created_at)
            VALUES (?, ?, 0, ?, 'v6-migration', ?, ?, ?)`,
      params: [
        'startup-' + row.phase,
        '[启动序列] Phase ' + row.phase + ': ' + (row.name || '') + ' (' + (row.subsystem || '') + ', ' + (row.last_status || '') + ', ' + (row.last_duration_ms || '?') + 'ms)',
        0.5,
        JSON.stringify(['startup', 'v6-migration']),
        Date.now(), Date.now(),
      ],
    }),
  );

  v6.close();
  v2.close();

  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  console.log('\n── 迁移完成: 共', total, '条记录 ──');
  if (errors.length > 0) {
    console.log('\n⚠️', errors.length, '个错误:');
    for (const e of errors) console.log('   -', e);
  }

  const reportDir = dirname(REPORT);
  if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });

  const headers = Object.keys(stats);
  const report = [
    '# v6 → V2 迁移报告',
    '',
    '> 生成时间: ' + new Date().toISOString(),
    '',
    '## 迁移概况',
    '',
    '| 数据类别 | 迁移数量 | 状态 |',
    '|---|---|---|',
    ...headers.map(k => '| ' + k + ' | ' + stats[k] + ' | ' + (stats[k] > 0 ? '✅' : '⏭️') + ' |'),
    '| **合计** | **' + total + '** | **' + (errors.length === 0 ? '✅ 全部成功' : '⚠️ ' + errors.length + ' 个错误') + '** |',
    '',
    '## 存储位置',
    '',
    '- V2 数据库: `extension/kunlun-memory.db`',
    '- 表: memories, knowledge, bridge_profiles, domain_maps, migration_log',
    '',
  ].join('\n');

  writeFileSync(REPORT, report);
  console.log('📄 报告:', REPORT);
}

main();
