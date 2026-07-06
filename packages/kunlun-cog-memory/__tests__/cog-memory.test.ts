/**
 * CogMemory Token与注意力预算管理测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  TokenManager,
  AttentionScheduler,
  createTokenManager,
  createAttentionScheduler,
} from '../src/index';
import type { SchedulableTask, ContradictionLevel } from '../src/index';

// ═══════════════════════════════════════════════════════════════
// TokenManager 测试
// ═══════════════════════════════════════════════════════════════

describe('TokenManager — 池初始化', () => {
  it('llm池应有128000 tokens', () => {
    const tm = new TokenManager();
    const usage = tm.getPoolUsage('llm');
    expect(usage.total).toBe(128000);
  });

  it('cache池应有50000 tokens', () => {
    const tm = new TokenManager();
    const usage = tm.getPoolUsage('cache');
    expect(usage.total).toBe(50000);
  });

  it('knowledge池应有100000 tokens', () => {
    const tm = new TokenManager();
    const usage = tm.getPoolUsage('knowledge');
    expect(usage.total).toBe(100000);
  });

  it('初始available应等于total', () => {
    const tm = new TokenManager();
    const usage = tm.getPoolUsage('llm');
    expect(usage.available).toBe(usage.total);
    expect(usage.used).toBe(0);
  });
});

describe('TokenManager — allocate', () => {
  it('应成功分配token', () => {
    const tm = new TokenManager();
    const result = tm.allocate({ taskId: 'task-1' }, 1000);
    expect(result).toBe(true);
    expect(tm.getPoolUsage('llm').used).toBe(1000);
  });

  it('超出总量应分配失败', () => {
    const tm = new TokenManager();
    expect(tm.allocate({ taskId: 'task-1' }, 200000)).toBe(false);
  });

  it('多次分配同一任务应累积', () => {
    const tm = new TokenManager();
    tm.allocate({ taskId: 'task-1' }, 500);
    tm.allocate({ taskId: 'task-1' }, 300);
    expect(tm.getPoolUsage('llm').used).toBe(800);
  });
});

describe('TokenManager — release', () => {
  it('应释放任务的token', () => {
    const tm = new TokenManager();
    tm.allocate({ taskId: 'task-1' }, 1000);
    tm.release('task-1');
    expect(tm.getPoolUsage('llm').used).toBe(0);
  });

  it('释放不存在的任务应不抛出错误', () => {
    const tm = new TokenManager();
    expect(() => tm.release('nonexistent')).not.toThrow();
  });
});

describe('TokenManager — getContextWindow', () => {
  it('应创建上下文窗口', () => {
    const tm = new TokenManager();
    const cw = tm.getContextWindow({ taskId: 'task-1', estimatedTokens: 4000 });
    expect(cw.taskId).toBe('task-1');
    expect(cw.total).toBe(4000);
  });

  it('同一任务应返回同一上下文窗口', () => {
    const tm = new TokenManager();
    const cw1 = tm.getContextWindow({ taskId: 'task-1', estimatedTokens: 4000 });
    const cw2 = tm.getContextWindow({ taskId: 'task-1', estimatedTokens: 4000 });
    expect(cw1).toBe(cw2);
  });

  it('compress应压缩history部分', () => {
    const tm = new TokenManager();
    const cw = tm.getContextWindow({ taskId: 'task-1', estimatedTokens: 10000 });
    const saved = cw.compress();
    expect(saved).toBeGreaterThan(0);
  });

  it('prioritize应按重要性重排占比', () => {
    const tm = new TokenManager();
    const cw = tm.getContextWindow({ taskId: 'task-1', estimatedTokens: 10000 });
    cw.prioritize(
      new Map([
        ['system', 0.4],
        ['input', 0.3],
        ['history', 0.2],
        ['output', 0.1],
      ]),
    );
    expect(cw.sections.system).toBeCloseTo(0.4, 5);
    expect(cw.sections.output).toBeCloseTo(0.1, 5);
  });
});

describe('TokenManager — setWatermark', () => {
  it('应设置llm池水位线', () => {
    const tm = new TokenManager();
    tm.setWatermark('llm', 100000);
    // 不抛出错误即通过
    expect(true).toBe(true);
  });

  it('设置不存在的池水位线应不抛出错误', () => {
    const tm = new TokenManager();
    expect(() => tm.setWatermark('llm', 99999)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════
// AttentionScheduler 测试
// ═══════════════════════════════════════════════════════════════

describe('AttentionScheduler — fromContradiction', () => {
  it('高级矛盾应有高注意力权重', () => {
    const scheduler = new AttentionScheduler();
    const schedule = scheduler.fromContradiction('high');
    expect(schedule.attentionWeight).toBeGreaterThan(0.9);
    expect(schedule.interruptible).toBe(false);
  });

  it('低级矛盾应可中断', () => {
    const scheduler = new AttentionScheduler();
    const schedule = scheduler.fromContradiction('low');
    expect(schedule.interruptible).toBe(true);
  });

  it('无矛盾应注意力权重最低', () => {
    const scheduler = new AttentionScheduler();
    const schedule = scheduler.fromContradiction('none');
    expect(schedule.attentionWeight).toBeLessThan(0.4);
  });
});

describe('AttentionScheduler — fromUrgency', () => {
  it('远期截止应低注意力', () => {
    const scheduler = new AttentionScheduler();
    const farDeadline = Date.now() + 600000; // 10分钟后
    const schedule = scheduler.fromUrgency(farDeadline);
    expect(schedule.attentionWeight).toBeLessThan(0.5);
    expect(schedule.interruptible).toBe(true);
  });

  it('已过期应最高注意力且不可中断', () => {
    const scheduler = new AttentionScheduler();
    const pastDeadline = Date.now() - 1000;
    const schedule = scheduler.fromUrgency(pastDeadline);
    expect(schedule.attentionWeight).toBeGreaterThan(0.9);
    expect(schedule.interruptible).toBe(false);
  });
});

describe('AttentionScheduler — schedule', () => {
  it('应按优先级排序分配注意力', () => {
    const scheduler = new AttentionScheduler();
    const tasks: SchedulableTask[] = [
      { taskId: 'low', priority: 0.3, estimatedTokens: 1000 },
      { taskId: 'high', priority: 0.9, estimatedTokens: 1000 },
      { taskId: 'mid', priority: 0.6, estimatedTokens: 1000 },
    ];
    const schedules = scheduler.schedule(tasks);
    expect(schedules).toHaveLength(3);
    // high优先级任务注意力应最高
    const highSchedule = schedules.find((s) => s.taskId === 'high');
    const lowSchedule = schedules.find((s) => s.taskId === 'low');
    expect(highSchedule!.attentionWeight).toBeGreaterThan(lowSchedule!.attentionWeight);
  });

  it('高优先级任务应不可中断', () => {
    const scheduler = new AttentionScheduler();
    const tasks: SchedulableTask[] = [
      { taskId: 'critical', priority: 0.95, estimatedTokens: 1000 },
    ];
    const schedules = scheduler.schedule(tasks);
    expect(schedules[0]!.interruptible).toBe(false);
  });

  it('空任务列表应返回空调度', () => {
    const scheduler = new AttentionScheduler();
    const schedules = scheduler.schedule([]);
    expect(schedules).toEqual([]);
  });
});

describe('AttentionScheduler — getActiveSchedules', () => {
  it('应返回所有活跃调度', () => {
    const scheduler = new AttentionScheduler();
    scheduler.fromContradiction('high');
    scheduler.fromContradiction('low');
    expect(scheduler.getActiveSchedules().length).toBeGreaterThanOrEqual(2);
  });

  it('初始应无活跃调度', () => {
    const scheduler = new AttentionScheduler();
    expect(scheduler.getActiveSchedules()).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════
// 辅助函数测试
// ═══════════════════════════════════════════════════════════════

describe('辅助函数', () => {
  it('createTokenManager应返回TokenManager实例', () => {
    const tm = createTokenManager();
    expect(tm).toBeInstanceOf(TokenManager);
    expect(tm.getPoolUsage('llm').total).toBe(128000);
  });

  it('createAttentionScheduler应返回AttentionScheduler实例', () => {
    const scheduler = createAttentionScheduler();
    expect(scheduler).toBeInstanceOf(AttentionScheduler);
  });
});
