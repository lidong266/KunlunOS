import { describe, it, expect } from 'vitest';
import { isYantaIntent, YANTA_TRIGGERS, KunlunAgent } from '../src/kunlun-agent.js';

describe('对话模式路由 — 研讨意图识别', () => {
  it('研讨触发词开头应识别为全链路意图', () => {
    expect(isYantaIntent('研讨开头：追求性能还是保证成本')).toBe(true);
    expect(isYantaIntent('研讨：区域发展需要协调与平衡')).toBe(true);
    expect(isYantaIntent('研讨一下系统反馈回路')).toBe(true);
    expect(isYantaIntent('研讨')).toBe(true);
  });

  it('普通对话不应触发研讨', () => {
    expect(isYantaIntent('你好，帮我写个函数')).toBe(false);
    expect(isYantaIntent('今天天气怎么样')).toBe(false);
    expect(isYantaIntent('我们研讨一下吧')).toBe(false); // 研讨不在开头
    expect(isYantaIntent('我想研讨这个方案')).toBe(false);
  });

  it('空文本或纯空白不应触发', () => {
    expect(isYantaIntent('')).toBe(false);
    expect(isYantaIntent('   ')).toBe(false);
  });

  it('前后空白应被忽略', () => {
    expect(isYantaIntent('  研讨开头：xxx')).toBe(true);
  });

  it('触发词列表非空且均为有效前缀', () => {
    expect(YANTA_TRIGGERS.length).toBeGreaterThan(0);
    for (const kw of YANTA_TRIGGERS) {
      expect(isYantaIntent(kw)).toBe(true);
    }
  });

  it('willEnterYanta 与 isYantaIntent 对齐', () => {
    // 用最小 mock 构造 KunlunAgent（不触发真实 LLM），验证路由判断方法可用
    const agent = new KunlunAgent({ env: {}, session: {}, models: {}, model: 'mock' });
    expect(agent.willEnterYanta('研讨开头：xxx')).toBe(true);
    expect(agent.willEnterYanta('普通聊天')).toBe(false);
  });
});
