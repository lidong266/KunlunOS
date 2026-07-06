/**
 * 端到端 Demo — 矛盾分析引擎（无需 LLM API）
 *
 * 演示：输入一个真实的矛盾场景 → 矛盾引擎完整分析 → 打印结构化结果
 *
 * 运行方式：
 *   npx tsx demo/contradiction-demo.ts
 */

import { createContradictionEngine } from '../packages/kunlun-contradiction/src/index.js';
import type { ContradictionPair, Proposition, Evidence } from '../packages/kunlun-contradiction/src/index.js';
import { T_TRUE, T_FALSE, T_UNKNOWN } from '../packages/kunlun-ternary/src/index.js';
import { K3 } from '../packages/kunlun-ternary/src/index.js';

// ─── 工具函数 ──────────────────────────────────────────────

function tritLabel(t: number): string {
  if (t === 1) return '✅ 正（+1）';
  if (t === -1) return '❌ 负（-1）';
  return '⭕ 中立/未知（0）';
}

function separator(title: string) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

function makeEvidence(id: string, content: string, strength: number): Evidence {
  return {
    type: 'empirical' as const,
    content,
    strength: strength as any,
    source: `demo-${id}`,
    timestamp: Date.now(),
  };
}

function makeProposition(
  id: string,
  statement: string,
  domain: string,
  evidenceList: Evidence[],
  counterEvidenceList: Evidence[] = [],
  confidenceTrit: number = 1,
): Proposition {
  return {
    id,
    statement,
    domain,
    evidence: evidenceList,
    counterEvidence: counterEvidenceList,
    confidenceTrit: confidenceTrit as any,
    confidenceVector: [1, 0, 0] as any, // Tryte = [Trit, Trit, Trit]
    source: 'user' as any,
    dependencies: [],
    createdAt: Date.now(),
  };
}

function makePair(
  id: string,
  thesis: Proposition,
  antithesis: Proposition,
  contradictionType: string,
): ContradictionPair {
  return {
    id,
    thesis,
    antithesis,
    contradictionType: contradictionType as any,
    discoveredBy: 'heuristic' as any,
    discoveredAt: Date.now(),
    relatedContradictions: [],
    priority: 0.5,
    presenceStateAtDiscovery: { phase: 'observation', actors: [], focus: id } as any,
    warPhaseAtDiscovery: 'strategic_defense',
  };
}

// ─── 场景数据 ──────────────────────────────────────────────

const scenarios: Array<{
  name: string;
  pair: ContradictionPair;
}> = [
  {
    name: '场景一：性能 vs 成本（系统架构经典权衡）',
    pair: makePair(
      'perf-cost-001',
      makeProposition(
        'thesis-perf',
        '追求极致性能，采用全内存缓存和冗余部署',
        'F03',
        [
          makeEvidence('e1', '用户期望 <50ms 响应', 1),
          makeEvidence('e2', '竞品已实现亚秒级响应', 1),
        ],
      ),
      makeProposition(
        'anti-cost',
        '严格控制成本，采用最低规格服务器和按需扩容',
        'F03',
        [
          makeEvidence('e3', '云服务月费已占运营成本 40%', 1),
          makeEvidence('e4', '投资人要求 6 个月内实现收支平衡', 1),
        ],
      ),
      'non_antagonistic',
    ),
  },
  {
    name: '场景二：快速迭代 vs 质量保障（研发管理矛盾）',
    pair: makePair(
      'speed-quality-002',
      makeProposition(
        'thesis-speed',
        '快速迭代，每周发布新版本抢占市场',
        'F05',
        [
          makeEvidence('e5', '市场窗口仅剩 3 个月', 1),
          makeEvidence('e6', '用户流失率每周递增 5%', 1),
        ],
      ),
      makeProposition(
        'anti-quality',
        '严格质量保障，每版本需完整回归测试',
        'F05',
        [
          makeEvidence('e7', '上次线上事故导致 10% 用户流失', 1),
          makeEvidence('e8', '技术债务已达临界值', 1),
        ],
      ),
      'non_antagonistic',
    ),
  },
  {
    name: '场景三：集中化 vs 去中心化（架构方向对抗）',
    pair: makePair(
      'central-decent-003',
      makeProposition(
        'thesis-central',
        '集中式架构，统一数据中心管理所有业务',
        'F03',
        [makeEvidence('e9', '便于统一管控和合规', 1)],
      ),
      makeProposition(
        'anti-decent',
        '去中心化架构，各业务线独立部署自治',
        'F03',
        [makeEvidence('e10', '业务线已扩展到 15 个，集中式瓶颈明显', 1)],
      ),
      'antagonistic',
    ),
  },
];

// ─── 运行分析 ──────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  昆仑OS — 矛盾分析引擎 Demo（无需 LLM API）              ║');
  console.log('║  基于 @kunlun/contradiction + @kunlun/ternary           ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const engine = createContradictionEngine();

  const allResults = [];

  for (const scenario of scenarios) {
    separator(scenario.name);

    console.log('\n📋 矛盾对输入:');
    console.log(`  正题: ${scenario.pair.thesis.statement}`);
    console.log(`  反题: ${scenario.pair.antithesis.statement}`);
    console.log(`  类型: ${scenario.pair.contradictionType}`);

    const result = engine.analyzeSingle(scenario.pair);
    allResults.push(result);

    // ── 核心三元素 ──
    console.log('\n📊 核心分析:');
    console.log(`  可统一性:   ${tritLabel(result.analysis.unifiability)}`);
    console.log(`  主导方面:   ${tritLabel(result.analysis.dominantAspect)}`);
    if (result.analysis.unificationPaths?.length > 0) {
      console.log(`  统一路径:`);
      for (const path of result.analysis.unificationPaths.slice(0, 3)) {
        const desc = typeof path === 'object' ? (path.description || path.path || JSON.stringify(path).slice(0, 80)) : String(path);
        console.log(`    → ${desc}`);
      }
    }

    // ── 质变临界点 ──
    console.log('\n📈 质变临界点:');
    console.log(`  临界状态:       ${tritLabel(result.qualitativeChange.approachingThreshold)}`);
    console.log(`  量变积累程度:   ${(result.qualitativeChange.quantitativeAccumulation * 100).toFixed(1)}%`);
    if (result.qualitativeChange.triggers?.length > 0) {
      console.log(`  可能触发因素:`);
      for (const t of result.qualitativeChange.triggers.slice(0, 3)) {
        const desc = typeof t === 'object' ? (t.description || t.factor || JSON.stringify(t).slice(0, 80)) : String(t);
        console.log(`    → ${desc}`);
      }
    }

    // ── 否定之否定 ──
    console.log('\n🔄 否定之否定:');
    console.log(`  当前阶段:   ${tritLabel(result.negationCycle.stage)}`);
    console.log(`  螺旋上升:   ${result.negationCycle.isGenuineAscension ? '是' : '否'}`);
    if (result.negationCycle.emergentProperties?.length > 0) {
      console.log(`  涌现新属性:`);
      for (const p of result.negationCycle.emergentProperties.slice(0, 3)) {
        console.log(`    → ${p}`);
      }
    }

    // ── 转化预测 ──
    console.log('\n🔮 矛盾转化预测:');
    const pred = result.transformationPrediction;
    if (pred.resultingContradiction) {
      console.log(`  转化后矛盾: ${pred.resultingContradiction.thesis?.statement || 'N/A'}`);
    }
    const prob = pred.probability;
    console.log(`  转化概率:   ${isNaN(prob) ? 'N/A' : (prob * 100).toFixed(1) + '%'}`);
    if (pred.conditions?.length > 0) {
      console.log(`  转化条件:`);
      for (const c of pred.conditions.slice(0, 3)) {
        console.log(`    → ${c}`);
      }
    }
  }

  // ── 批量分析 ──
  separator('批量分析：多矛盾场景 → 主矛盾定位');

  const allPairs = scenarios.map((s) => s.pair);
  const batchResults = engine.analyzeMultiple(allPairs);

  console.log(`\n共分析 ${batchResults.length} 组矛盾:\n`);
  for (const r of batchResults) {
    const unifiability =
      r.analysis.unifiability === 1 ? '可统一' : r.analysis.unifiability === -1 ? '不可调和' : '需更多信息';
    console.log(
      `  [${r.contradictionId}] 类型: ${r.analysis.contradictionType} | 可统一性: ${unifiability} | 主导: ${tritLabel(r.analysis.dominantAspect)}`,
    );
  }

  // ── 三进制演示 ──
  separator('三进制底座演示');

  console.log('\nTrit 值语义:');
  console.log(`  T_TRUE    = ${T_TRUE}  (真/确认/肯定)`);
  console.log(`  T_UNKNOWN = ${T_UNKNOWN}  (未知/待验证/中立)`);
  console.log(`  T_FALSE   = ${T_FALSE} (假/否定/反对)`);

  console.log('\n矛盾分析结果的三进制编码 (统一性/主导/临界):');
  for (const r of allResults) {
    const u = r.analysis.unifiability;
    const d = r.analysis.dominantAspect;
    const q = r.qualitativeChange.approachingThreshold;
    const code = `${u >= 0 ? '+' : ''}${u}/${d >= 0 ? '+' : ''}${d}/${q >= 0 ? '+' : ''}${q}`;
    console.log(`  [${r.contradictionId}] ${code}`);
  }

  console.log('\n✅ Demo 完成 — 以上所有分析无需 LLM API，纯本地三进制计算。\n');
}

main().catch((err) => {
  console.error('❌ Demo 运行失败:', err);
  process.exit(1);
});
