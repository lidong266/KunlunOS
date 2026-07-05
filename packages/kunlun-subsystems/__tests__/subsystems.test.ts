/**
 * kunlun-subsystems 综合测试
 * 覆盖全部 8 个子系统：谛听、太一、天工、琅嬛、归藏、镇岳、镇熵、玄关
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { T_TRUE, T_UNKNOWN, T_FALSE } from '@kunlun/ternary';

import {
  SignalSource, SIGNAL_RELIABILITY_INIT, ContradictionSignalDetector,
} from '@kunlun/subsystems';

import {
  BridgeDomain, DomainRouter, DebateEngine, ContradictionExecutor,
} from '@kunlun/subsystems';

import {
  CONFIDENCE_TAGS, ConfidenceTagRenderer, ContradictionVisualizer,
} from '@kunlun/subsystems';

import {
  RelationType, TernaryKnowledgeIndex, KnowledgeContradictionGraph,
} from '@kunlun/subsystems';

import {
  DEFAULT_DECAY_PARAMS, TernaryMemoryModel, ResonantMemoryNetwork,
} from '@kunlun/subsystems';

import {
  PipelineLayer, TernarySecurityPipeline, TernaryRiskHeatmap,
} from '@kunlun/subsystems';

import {
  TernaryDecisionTree, SkillGovernance, TernaryAlertManager,
} from '@kunlun/subsystems';

import {
  MCPToolType, MCPGateway,
} from '@kunlun/subsystems';

// ══════════════════════════════════
// S6: 谛听 Diting
// ══════════════════════════════════
describe('谛听 Diting (S6)', () => {
  describe('SignalSource', () => {
    it('应有6种来源', () => {
      expect(Object.values(SignalSource)).toHaveLength(6);
    });
  });

  describe('SIGNAL_RELIABILITY_INIT', () => {
    it('system_internal 应最高', () => {
      const t = SIGNAL_RELIABILITY_INIT[SignalSource.SYSTEM_INTERNAL];
      expect(t[0]).toBe(1);
      expect(t[1]).toBe(1);
    });
    it('human_input 应较低', () => {
      const t = SIGNAL_RELIABILITY_INIT[SignalSource.HUMAN_INPUT];
      expect(t[0]).toBe(0);
      expect(t[1]).toBe(-1);
    });
  });

  describe('ContradictionSignalDetector', () => {
    let d: ContradictionSignalDetector;
    beforeEach(() => { d = new ContradictionSignalDetector(); });

    it('vs 信号应提取矛盾对', () => {
      const r = d.perceiveSignal('A vs B', SignalSource.HUMAN_INPUT);
      expect(r.contradictions.length).toBeGreaterThan(0);
    });

    it('但是 应提取矛盾', () => {
      const r = d.perceiveSignal('A好但是B便宜', SignalSource.HUMAN_INPUT);
      expect(r.contradictions.length).toBeGreaterThan(0);
    });

    it('空信号无矛盾对', () => {
      const r = d.perceiveSignal('', SignalSource.HUMAN_INPUT);
      expect(r.contradictions).toHaveLength(0);
    });

    it('system_internal 应标注 T_TRUE', () => {
      const r = d.perceiveSignal('pulse', SignalSource.SYSTEM_INTERNAL);
      expect(r.signalTrits[0].judgment).toBe(T_TRUE);
    });

    it('getStats 统计正确', () => {
      d.perceiveSignal('a vs b', SignalSource.HUMAN_INPUT);
      d.perceiveSignal('c', SignalSource.WEB_SEARCH);
      expect(d.getStats().total).toBe(2);
      expect(d.getStats().contradictionsFound).toBeGreaterThanOrEqual(1);
    });

    it('reset 清空状态', () => {
      d.perceiveSignal('test', SignalSource.HUMAN_INPUT);
      d.reset();
      expect(d.getPerceivedSignals()).toHaveLength(0);
    });
  });
});

// ══════════════════════════════════
// S7: 太一 Taiyi
// ══════════════════════════════════
describe('太一 Taiyi (S7)', () => {
  describe('DomainRouter', () => {
    let r: DomainRouter;
    beforeEach(() => { r = new DomainRouter(); });

    it('量子→PHYSICS', () => expect(r.route('量子力学')).toBe(BridgeDomain.PHYSICS));
    it('算法→CS', () => expect(r.route('算法复杂度')).toBe(BridgeDomain.COMPUTER_SCIENCE));
    it('无匹配→GENERAL', () => expect(r.route('天气')).toBe(BridgeDomain.GENERAL));
    it('getKeywords 返回关键词', () => {
      expect(r.getKeywords(BridgeDomain.PHILOSOPHY).length).toBeGreaterThan(0);
    });
  });

  describe('DebateEngine', () => {
    let e: DebateEngine;
    beforeEach(() => { e = new DebateEngine(); });

    it('执行辩论', () => {
      const r = e.debate({ thesis: '量子完备', antithesis: '量子不完备' });
      expect(r.rounds.length).toBe(3);
      expect([T_TRUE, T_UNKNOWN, T_FALSE]).toContain(r.verdict);
    });

    it('自动路由', () => {
      const r = e.debate({ thesis: '市场自由', antithesis: '市场监管' });
      expect(r.domain).toBe(BridgeDomain.ECONOMICS);
    });

    it('指定领域', () => {
      const r = e.debate({ thesis: 'A', antithesis: 'B' }, BridgeDomain.GENERAL);
      expect(r.domain).toBe(BridgeDomain.GENERAL);
    });

    it('记录历史', () => {
      e.debate({ thesis: 'T1', antithesis: 'A1' });
      e.debate({ thesis: 'T2', antithesis: 'A2' });
      expect(e.getDebateHistory()).toHaveLength(2);
    });

    it('getStats', () => {
      e.debate({ thesis: 'T', antithesis: 'A' });
      expect(e.getStats().total).toBe(1);
    });

    it('reset 清空', () => {
      e.debate({ thesis: 'T', antithesis: 'A' });
      e.reset();
      expect(e.getDebateHistory()).toHaveLength(0);
    });
  });

  describe('ContradictionExecutor', () => {
    let ex: ContradictionExecutor;
    beforeEach(() => { ex = new ContradictionExecutor(); });

    it('提交并执行任务', () => {
      const t = ex.submitTask({ thesis: 'AI应监管', antithesis: 'AI应自由' });
      expect(t.status).toBe('pending');
      const r = ex.executeTask(t.id);
      expect(r).not.toBeNull();
      expect(ex.getTask(t.id)?.status).toBe('completed');
    });

    it('不存在的任务返回 null', () => {
      expect(ex.executeTask('nonexistent')).toBeNull();
    });

    it('getPendingTasks', () => {
      ex.submitTask({ thesis: 'T1', antithesis: 'A1' });
      ex.submitTask({ thesis: 'T2', antithesis: 'A2' });
      expect(ex.getPendingTasks()).toHaveLength(2);
    });

    it('getStats', () => {
      const t = ex.submitTask({ thesis: 'T', antithesis: 'A' });
      ex.executeTask(t.id);
      const s = ex.getStats();
      expect(s.total).toBe(1);
      expect(s.completed).toBe(1);
    });
  });
});

// ══════════════════════════════════
// S8: 天工 Tiangong
// ══════════════════════════════════
describe('天工 Tiangong (S8)', () => {
  describe('CONFIDENCE_TAGS', () => {
    it('应有三种标签', () => {
      expect(CONFIDENCE_TAGS['+1']).toBeDefined();
      expect(CONFIDENCE_TAGS['0']).toBeDefined();
      expect(CONFIDENCE_TAGS['-1']).toBeDefined();
    });
    it('+1=green/已验证', () => {
      expect(CONFIDENCE_TAGS['+1'].color).toBe('green');
      expect(CONFIDENCE_TAGS['+1'].trit).toBe(T_TRUE);
    });
    it('-1=red/已否定', () => {
      expect(CONFIDENCE_TAGS['-1'].color).toBe('red');
      expect(CONFIDENCE_TAGS['-1'].trit).toBe(T_FALSE);
    });
  });

  describe('ConfidenceTagRenderer', () => {
    let r: ConfidenceTagRenderer;
    beforeEach(() => { r = new ConfidenceTagRenderer(); });

    it('渲染片段', () => {
      const o = r.render('A。B。', [T_TRUE, T_UNKNOWN]);
      expect(o.fragments.length).toBeGreaterThanOrEqual(2);
    });

    it('缺标注默认 T_UNKNOWN', () => {
      expect(r.render('单句', []).overallConfidence).toBe(T_UNKNOWN);
    });

    it('多数表决 T_TRUE', () => {
      expect(r.render('a。b。c。', [T_TRUE, T_TRUE, T_UNKNOWN]).overallConfidence).toBe(T_TRUE);
    });

    it('多数表决 T_FALSE', () => {
      expect(r.render('a。b。c。', [T_FALSE, T_FALSE, T_TRUE]).overallConfidence).toBe(T_FALSE);
    });

    it('getTag', () => {
      expect(r.getTag(T_TRUE).color).toBe('green');
      expect(r.getTag(T_UNKNOWN).color).toBe('yellow');
      expect(r.getTag(T_FALSE).color).toBe('red');
    });

    it('getAvailableTags 返回3个', () => {
      expect(r.getAvailableTags()).toHaveLength(3);
    });
  });

  describe('ContradictionVisualizer', () => {
    let v: ContradictionVisualizer;
    beforeEach(() => { v = new ContradictionVisualizer(); });

    it('buildGraph 无合题', () => {
      const g = v.buildGraph('T', 'A');
      expect(g.nodes).toHaveLength(2);
      expect(g.edges).toHaveLength(1);
    });

    it('buildGraph 有合题', () => {
      const g = v.buildGraph('T', 'A', 'S');
      expect(g.nodes).toHaveLength(3);
      expect(g.edges.length).toBe(3);
    });

    it('toAscii', () => {
      const g = v.buildGraph('T', 'A');
      expect(v.toAscii(g)).toContain('T');
    });

    it('toMarkdown', () => {
      const g = v.buildGraph('T', 'A', 'S');
      const md = v.toMarkdown(g);
      expect(md).toContain('```mermaid');
      expect(md).toContain('graph LR');
    });
  });
});

// ══════════════════════════════════
// S9: 琅嬛 Langhuan
// ══════════════════════════════════
describe('琅嬛 Langhuan (S9)', () => {
  describe('TernaryKnowledgeIndex', () => {
    let idx: TernaryKnowledgeIndex;
    beforeEach(() => { idx = new TernaryKnowledgeIndex(); });

    it('添加条目', () => {
      const e = idx.addEntry('太阳东升', T_TRUE, 'obs', ['天文']);
      expect(e.id).toMatch(/^k-/);
      expect(e.classification).toBe(T_TRUE);
    });

    it('按分类查询', () => {
      idx.addEntry('v', T_TRUE, 's');
      idx.addEntry('p', T_UNKNOWN, 's');
      idx.addEntry('f', T_FALSE, 's');
      expect(idx.queryByClassification(T_TRUE)).toHaveLength(1);
    });

    it('按标签查询', () => {
      idx.addEntry('k1', T_TRUE, 's', ['AI']);
      idx.addEntry('k2', T_UNKNOWN, 's', ['DB']);
      expect(idx.queryByTags(['AI'])).toHaveLength(1);
    });

    it('全文搜索', () => {
      idx.addEntry('量子力学是基础', T_TRUE, 's');
      expect(idx.search('量子')).toHaveLength(1);
    });

    it('按信度向量查询', () => {
      idx.addEntry('test', T_TRUE, 's');
      expect(Array.isArray(idx.queryByCredibilityVector([0, 0, 0, 0, 1, 0]))).toBe(true);
    });

    it('添加关系', () => {
      const a = idx.addEntry('A', T_TRUE);
      const b = idx.addEntry('B', T_FALSE);
      expect(idx.addRelation(a.id, b.id, RelationType.CONTRADICTS)).toBe(true);
    });

    it('更新分类', () => {
      const e = idx.addEntry('t', T_UNKNOWN);
      idx.updateClassification(e.id, T_TRUE);
      expect(idx.getEntry(e.id)?.classification).toBe(T_TRUE);
    });

    it('getStats', () => {
      idx.addEntry('c', T_TRUE, 's');
      idx.addEntry('p', T_UNKNOWN, 's');
      idx.addEntry('f', T_FALSE, 's');
      const s = idx.getStats();
      expect(s.confirmed).toBe(1);
      expect(s.pending).toBe(1);
      expect(s.falsified).toBe(1);
    });

    it('访问计数', () => {
      const e = idx.addEntry('t', T_UNKNOWN);
      idx.getEntry(e.id);
      idx.getEntry(e.id);
      expect(idx.getEntry(e.id)?.accessCount).toBe(3);
    });

    it('reset 清空', () => {
      idx.addEntry('t', T_UNKNOWN);
      idx.reset();
      expect(idx.getAllEntries()).toHaveLength(0);
    });
  });

  describe('KnowledgeContradictionGraph', () => {
    it('检测分类冲突', () => {
      const idx = new TernaryKnowledgeIndex();
      idx.addEntry('c', T_TRUE);
      idx.addEntry('f', T_FALSE);
      const g = new KnowledgeContradictionGraph(idx);
      expect(g.detectContradictions().length).toBeGreaterThan(0);
    });

    it('无冲突时为空', () => {
      const idx = new TernaryKnowledgeIndex();
      idx.addEntry('a', T_TRUE);
      idx.addEntry('b', T_TRUE);
      const g = new KnowledgeContradictionGraph(idx);
      expect(g.detectContradictions()).toHaveLength(0);
    });
  });
});

// ══════════════════════════════════
// S10: 归藏 Guicang
// ══════════════════════════════════
describe('归藏 Guicang (S10)', () => {
  describe('TernaryMemoryModel', () => {
    let m: TernaryMemoryModel;
    beforeEach(() => { m = new TernaryMemoryModel(); });

    it('存储记忆', () => {
      const e = m.store('测试记忆', 'src', ['tag']);
      expect(e.id).toMatch(/^mem-/);
      expect(e.ternaryState).toBe(T_UNKNOWN);
    });

    it('强化', () => {
      const e = m.store('重要');
      const s0 = e.strength;
      m.reinforce(e.id);
      expect(m.recall(e.id)?.strength).toBeGreaterThan(s0);
    });

    it('强化到 T_TRUE', () => {
      const e = m.store('强化');
      m.reinforce(e.id);
      m.reinforce(e.id);
      m.reinforce(e.id);
      expect(m.recall(e.id)?.ternaryState).toBe(T_TRUE);
    });

    it('否定', () => {
      const e = m.store('错误');
      m.negate(e.id);
      expect(m.recall(e.id)?.negationCount).toBe(1);
    });

    it('衰减', () => {
      const e = m.store('衰减');
      const s0 = e.strength;
      m.applyDecay(e.id, 365);
      expect(m.recall(e.id)?.strength).toBeLessThan(s0);
    });

    it('全局衰减', () => {
      m.store('a');
      m.store('b');
      const results = m.applyGlobalDecay(30);
      expect(results.size).toBe(2);
    });

    it('search', () => {
      m.store('量子计算未来');
      expect(m.search('量子')).toHaveLength(1);
    });

    it('associate', () => {
      const a = m.store('A');
      const b = m.store('B');
      m.associate(a.id, b.id);
      expect(m.recall(a.id)?.associations).toContain(b.id);
    });

    it('getStats', () => {
      m.store('a');
      m.store('b');
      expect(m.getStats().total).toBe(2);
    });

    it('reset', () => {
      m.store('a');
      m.reset();
      expect(m.getAllMemories()).toHaveLength(0);
    });
  });

  describe('ResonantMemoryNetwork', () => {
    it('共鸣激活关联', () => {
      const m = new TernaryMemoryModel();
      const n = new ResonantMemoryNetwork(m);
      const a = m.store('source');
      const b = m.store('associated');
      m.associate(a.id, b.id);
      expect(n.resonate(a.id)).not.toBeNull();
    });

    it('无关联为 T_FALSE', () => {
      const m = new TernaryMemoryModel();
      const n = new ResonantMemoryNetwork(m);
      const a = m.store('lonely');
      expect(n.resonate(a.id)?.resonanceType).toBe(T_FALSE);
    });
  });
});

// ══════════════════════════════════
// S11: 镇岳 Zhenyue
// ══════════════════════════════════
describe('镇岳 Zhenyue (S11)', () => {
  describe('TernarySecurityPipeline', () => {
    let p: TernarySecurityPipeline;
    beforeEach(() => { p = new TernarySecurityPipeline(); });

    it('正常操作', () => {
      const r = p.evaluate('read', 'user');
      expect(r.layerResults).toHaveLength(4);
      expect(r.finalDecision).toBeDefined();
    });

    it('unknown actor 阻断', () => {
      const r = p.evaluate('read', 'unknown');
      expect(r.layerResults.some(l => l.decision === T_FALSE)).toBe(true);
    });

    it('危险操作高风险', () => {
      const r = p.evaluate('delete database', 'user');
      const audit = r.layerResults.find(l => l.layer === PipelineLayer.AUDIT);
      expect(audit?.riskScore).toBeGreaterThan(0.5);
    });

    it('禁止模式过滤', () => {
      const r = p.evaluate('DROP TABLE users', 'user');
      const filter = r.layerResults.find(l => l.layer === PipelineLayer.FILTER);
      expect(filter?.decision).toBe(T_FALSE);
    });

    it('system 信任', () => {
      const r = p.evaluate('any', 'system');
      const auth = r.layerResults.find(l => l.layer === PipelineLayer.AUTH);
      expect(auth?.decision).toBe(T_TRUE);
    });

    it('getHistory', () => {
      p.evaluate('a', 'user');
      p.evaluate('b', 'system');
      expect(p.getHistory()).toHaveLength(2);
    });

    it('getStats', () => {
      p.evaluate('safe', 'system');
      p.evaluate('DROP TABLE', 'unknown');
      const s = p.getStats();
      expect(s.blocked).toBeGreaterThan(0);
    });
  });

  describe('TernaryRiskHeatmap', () => {
    it('生成热力图', () => {
      const p = new TernarySecurityPipeline();
      p.evaluate('safe', 'system');
      p.evaluate('DROP TABLE', 'unknown');
      const h = new TernaryRiskHeatmap(p);
      const cells = h.generate();
      expect(cells).toHaveLength(2);
      expect(cells[0].color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it('getSummary', () => {
      const p = new TernarySecurityPipeline();
      p.evaluate('safe', 'system');
      p.evaluate('danger', 'unknown');
      const h = new TernaryRiskHeatmap(p);
      const s = h.getSummary();
      expect(s.green + s.yellow + s.red).toBe(2);
    });
  });
});

// ══════════════════════════════════
// S12: 镇熵 Zhenshang
// ══════════════════════════════════
describe('镇熵 Zhenshang (S12)', () => {
  describe('TernaryDecisionTree', () => {
    let t: TernaryDecisionTree;
    beforeEach(() => { t = new TernaryDecisionTree(); });

    it('遍历', () => {
      t.setRoot({ id: 'root', label: '安全?', condition: 's>0.8', tritOutput: T_TRUE, children: [{ id: 'allow', label: '允许', condition: '', tritOutput: T_TRUE, children: [], action: 'allow' }] });
      const p = t.traverse({});
      expect(p.finalDecision).toBe(T_TRUE);
      expect(p.nodes).toContain('root');
    });

    it('无根=T_UNKNOWN', () => {
      expect(new TernaryDecisionTree().traverse({}).finalDecision).toBe(T_UNKNOWN);
    });

    it('majorityVote', () => {
      expect(t.majorityVote([T_TRUE, T_TRUE, T_FALSE])).toBe(T_TRUE);
      expect(t.majorityVote([T_FALSE, T_FALSE, T_UNKNOWN])).toBe(T_FALSE);
      expect(t.majorityVote([T_TRUE, T_FALSE])).toBe(T_UNKNOWN);
      expect(t.majorityVote([])).toBe(T_UNKNOWN);
    });
  });

  describe('SkillGovernance', () => {
    it('注册', () => {
      const t = new TernaryDecisionTree();
      const g = new SkillGovernance(t);
      expect(g.registerSkill('s').currentVersion).toBe('0.1.0');
    });

    it('验证通过升级', () => {
      const t = new TernaryDecisionTree();
      const g = new SkillGovernance(t);
      g.registerSkill('s');
      g.validateSkill('s', T_TRUE);
      expect(g.getSkill('s')?.currentVersion).toBe('0.2.0');
    });

    it('验证失败降级', () => {
      const t = new TernaryDecisionTree();
      const g = new SkillGovernance(t);
      g.registerSkill('s');
      const r = g.validateSkill('s', T_FALSE);
      expect(r?.trit).toBe(T_FALSE);
    });

    it('T_UNKNOWN 不变', () => {
      const t = new TernaryDecisionTree();
      const g = new SkillGovernance(t);
      g.registerSkill('s');
      expect(g.validateSkill('s', T_UNKNOWN)).toBeNull();
    });
  });

  describe('TernaryAlertManager', () => {
    let a: TernaryAlertManager;
    beforeEach(() => { a = new TernaryAlertManager(); });

    it('发送告警', () => {
      const al = a.alert('sys', '内存低', T_FALSE);
      expect(al.level).toBe('critical');
      expect(al.acknowledged).toBe(false);
    });

    it('区分级别', () => {
      expect(a.alert('s', 'ok', T_TRUE).level).toBe('normal');
      expect(a.alert('s', 'warn', T_UNKNOWN).level).toBe('warning');
      expect(a.alert('s', 'crit', T_FALSE).level).toBe('critical');
    });

    it('确认', () => {
      const al = a.alert('s', 'issue', T_FALSE);
      expect(a.acknowledge(al.id)).toBe(true);
      expect(a.getAllAlerts()[0].acknowledged).toBe(true);
    });

    it('getActiveAlerts', () => {
      const al = a.alert('s', 'active', T_FALSE);
      expect(a.getActiveAlerts()).toHaveLength(1);
      a.acknowledge(al.id);
      expect(a.getActiveAlerts()).toHaveLength(0);
    });

    it('getCriticalAlerts', () => {
      a.alert('s', 'crit', T_FALSE);
      a.alert('s', 'warn', T_UNKNOWN);
      expect(a.getCriticalAlerts()).toHaveLength(1);
    });

    it('getStats', () => {
      a.alert('s', 'a', T_TRUE);
      a.alert('s', 'b', T_UNKNOWN);
      a.alert('s', 'c', T_FALSE);
      const s = a.getStats();
      expect(s.total).toBe(3);
      expect(s.critical).toBe(1);
      expect(s.warning).toBe(1);
      expect(s.normal).toBe(1);
    });
  });
});

// ══════════════════════════════════
// S13: 玄关 Xuanguan
// ══════════════════════════════════
describe('玄关 Xuanguan (S13)', () => {
  let gw: MCPGateway;
  beforeEach(() => { gw = new MCPGateway(); });

  it('注册工具', () => {
    const t = gw.registerTool('search', '搜索', MCPToolType.RESOURCE, {});
    expect(t.name).toBe('search');
    expect(t.type).toBe(MCPToolType.RESOURCE);
  });

  it('列出工具', () => {
    gw.registerTool('t1', 'd1', MCPToolType.RESOURCE, {});
    gw.registerTool('t2', 'd2', MCPToolType.ACTION, {});
    expect(gw.listTools()).toHaveLength(2);
  });

  it('按安全标记过滤', () => {
    gw.registerTool('safe', 'd', MCPToolType.RESOURCE, {}, T_TRUE);
    gw.registerTool('blocked', 'd', MCPToolType.ACTION, {}, T_FALSE);
    expect(gw.listToolsBySecurity(T_TRUE)).toHaveLength(1);
    expect(gw.listToolsBySecurity(T_FALSE)).toHaveLength(1);
  });

  it('注销工具', () => {
    gw.registerTool('t', 'd', MCPToolType.RESOURCE, {});
    expect(gw.unregisterTool('t')).toBe(true);
    expect(gw.getTool('t')).toBeUndefined();
  });

  it('调用工具', async () => {
    gw.registerTool('echo', 'echo', MCPToolType.RESOURCE, {});
    const result = await gw.callTool({
      toolName: 'echo', callId: '1', arguments: { text: 'hello' },
    });
    expect(result.status).toBe(T_TRUE);
    expect(result.data).toBeDefined();
  });

  it('调用不存在的工具', async () => {
    const result = await gw.callTool({
      toolName: 'nonexistent', callId: '1', arguments: {},
    });
    expect(result.status).toBe(T_FALSE);
    expect(result.error).toContain('not found');
  });

  it('调用被安全阻断的工具', async () => {
    gw.registerTool('blocked', 'd', MCPToolType.ACTION, {}, T_FALSE);
    const result = await gw.callTool({
      toolName: 'blocked', callId: '1', arguments: {},
    });
    expect(result.status).toBe(T_FALSE);
    expect(result.error).toContain('blocked');
  });

  it('getCallHistory', async () => {
    gw.registerTool('echo', 'echo', MCPToolType.RESOURCE, {});
    await gw.callTool({ toolName: 'echo', callId: '1', arguments: {} });
    expect(gw.getCallHistory()).toHaveLength(1);
  });

  it('getStats', async () => {
    gw.registerTool('echo', 'echo', MCPToolType.RESOURCE, {});
    await gw.callTool({ toolName: 'echo', callId: '1', arguments: {} });
    const s = gw.getStats();
    expect(s.registeredTools).toBe(1);
    expect(s.totalCalls).toBe(1);
  });

  it('reset', () => {
    gw.registerTool('t', 'd', MCPToolType.RESOURCE, {});
    gw.reset();
    expect(gw.listTools()).toHaveLength(0);
    expect(gw.getCallHistory()).toHaveLength(0);
  });
});
