/**
 * CogTrust 认知信任与价值对齐测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  TrustManager,
  createTrustManager,
  defaultValueAlignment,
} from '../src/index';
import type { TrustEvidence, ValueAlignment } from '../src/index';

// ═══════════════════════════════════════════════════════════════
// 测试辅助
// ═══════════════════════════════════════════════════════════════

function makeEvidence(
  type: TrustEvidence['type'],
  score: number,
  source = 'test-source',
): TrustEvidence {
  return { type, score, timestamp: Date.now(), source };
}

function strictAlignment(): ValueAlignment {
  return {
    values: ['safety'],
    thresholds: { perceive: 0.6, think: 0.75, act: 0.85, govern: 0.95 },
  };
}

function looseAlignment(): ValueAlignment {
  return {
    values: ['safety'],
    thresholds: { perceive: 0.2, think: 0.3, act: 0.4, govern: 0.5 },
  };
}

// ═══════════════════════════════════════════════════════════════
// TrustManager — evaluate 测试
// ═══════════════════════════════════════════════════════════════

describe('TrustManager.evaluate', () => {
  let tm: TrustManager;

  beforeEach(() => {
    tm = new TrustManager();
  });

  it('高评分证据应得到high信任级别', () => {
    const level = tm.evaluate('node-1', [
      makeEvidence('value-alignment-test', 0.95),
      makeEvidence('reputation-history', 0.9),
    ]);
    expect(['system', 'high']).toContain(level);
  });

  it('低评分证据应得到untrusted级别', () => {
    const level = tm.evaluate('node-1', [
      makeEvidence('value-alignment-test', 0.1),
      makeEvidence('reputation-history', 0.2),
    ]);
    expect(level).toBe('untrusted');
  });

  it('中等评分应得到medium级别', () => {
    const level = tm.evaluate('node-1', [
      makeEvidence('direct-observation', 0.65),
      makeEvidence('reputation-history', 0.6),
    ]);
    expect(level).toBe('medium');
  });

  it('多次评估应累积证据', () => {
    tm.evaluate('node-1', [makeEvidence('direct-observation', 0.9)]);
    tm.evaluate('node-1', [makeEvidence('reputation-history', 0.9)]);
    expect(tm.getEvidence('node-1')).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// TrustManager — authorize 测试
// ═══════════════════════════════════════════════════════════════

describe('TrustManager.authorize', () => {
  let tm: TrustManager;

  beforeEach(() => {
    tm = new TrustManager();
  });

  it('高信任节点应通过宽松阈值授权', () => {
    tm.evaluate('node-1', [makeEvidence('value-alignment-test', 0.9)]);
    expect(tm.authorize('act', 'node-1', looseAlignment())).toBe(true);
  });

  it('低信任节点不应通过严格阈值授权', () => {
    tm.evaluate('node-1', [makeEvidence('value-alignment-test', 0.5)]);
    expect(tm.authorize('act', 'node-1', strictAlignment())).toBe(false);
  });

  it('govern任务需要最高信任度', () => {
    tm.evaluate('node-1', [makeEvidence('value-alignment-test', 0.92)]);
    const align = strictAlignment();
    expect(tm.authorize('govern', 'node-1', align)).toBe(false);
  });

  it('perceive任务阈值最低，容易授权', () => {
    tm.evaluate('node-1', [makeEvidence('direct-observation', 0.4)]);
    expect(tm.authorize('perceive', 'node-1', looseAlignment())).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// TrustManager — transitiveTrust 测试
// ═══════════════════════════════════════════════════════════════

describe('TrustManager.transitiveTrust', () => {
  let tm: TrustManager;

  beforeEach(() => {
    tm = new TrustManager();
  });

  it('传递信任应低于直接信任', () => {
    tm.evaluate('nodeA', [makeEvidence('value-alignment-test', 0.9)]);
    tm.evaluate('nodeB', [makeEvidence('value-alignment-test', 0.9)]);
    const direct = tm.getTrustLevel('nodeA');
    const transitive = tm.transitiveTrust('nodeA', 'nodeB');
    expect(tm.getScore('nodeA') >= 0.9 * 0.9).toBe(true);
    // 传递级别应不高于直接级别
    const order = ['untrusted', 'low', 'medium', 'high', 'system'];
    expect(order.indexOf(transitive)).toBeLessThanOrEqual(order.indexOf(direct));
  });

  it('一方低信任应拉低传递信任', () => {
    tm.evaluate('nodeA', [makeEvidence('value-alignment-test', 0.9)]);
    tm.evaluate('nodeB', [makeEvidence('value-alignment-test', 0.3)]);
    const transitive = tm.transitiveTrust('nodeA', 'nodeB');
    expect(['untrusted', 'low', 'medium']).toContain(transitive);
  });
});

// ═══════════════════════════════════════════════════════════════
// TrustManager — getScore / getTrustLevel / getEvidence / reset 测试
// ═══════════════════════════════════════════════════════════════

describe('TrustManager 查询与重置', () => {
  let tm: TrustManager;

  beforeEach(() => {
    tm = new TrustManager();
  });

  it('getScore未评估节点应返回0', () => {
    expect(tm.getScore('unknown')).toBe(0);
  });

  it('getTrustLevel未评估节点应返回untrusted', () => {
    expect(tm.getTrustLevel('unknown')).toBe('untrusted');
  });

  it('getEvidence未评估节点应返回空数组', () => {
    expect(tm.getEvidence('unknown')).toEqual([]);
  });

  it('reset应清除节点记录', () => {
    tm.evaluate('node-1', [makeEvidence('value-alignment-test', 0.9)]);
    tm.reset('node-1');
    expect(tm.getScore('node-1')).toBe(0);
    expect(tm.getEvidence('node-1')).toEqual([]);
  });

  it('reset不存在的节点应不抛出错误', () => {
    expect(() => tm.reset('nonexistent')).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════
// 辅助函数测试
// ═══════════════════════════════════════════════════════════════

describe('辅助函数', () => {
  it('createTrustManager应返回TrustManager实例', () => {
    const tm = createTrustManager();
    expect(tm).toBeInstanceOf(TrustManager);
  });

  it('defaultValueAlignment应返回合理阈值', () => {
    const align = defaultValueAlignment();
    expect(align.values.length).toBeGreaterThan(0);
    expect(align.thresholds.perceive).toBeLessThan(align.thresholds.govern);
  });
});
