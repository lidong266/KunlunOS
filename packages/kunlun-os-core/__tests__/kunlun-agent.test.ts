import { describe, it, expect } from 'vitest';
import { isYantaIntent, YANTA_TRIGGER, KunlunAgent } from '../src/kunlun-agent.js';

describe('对话模式路由 — 研讨意图识别', () => {
  it('以「研讨」开头即触发全链路，其后内容任意（真实用法）', () => {
    // 用户举例：「研讨昨晚新闻联播」——研讨是动词指令，后面是真正议题
    expect(isYantaIntent('研讨昨晚新闻联播')).toBe(true);
    expect(isYantaIntent('研讨追求性能还是保证成本')).toBe(true);
    expect(isYantaIntent('研讨一下系统反馈回路')).toBe(true);
    expect(isYantaIntent('研讨会纪要整理')).toBe(true);
    expect(isYantaIntent('研讨')).toBe(true);
  });

  it('普通对话不应触发研讨', () => {
    expect(isYantaIntent('你好，帮我写个函数')).toBe(false);
    expect(isYantaIntent('今天天气怎么样')).toBe(false);
    // 「研讨」不在开头，不触发
    expect(isYantaIntent('我们研讨一下吧')).toBe(false);
    expect(isYantaIntent('我想研讨这个方案')).toBe(false);
  });

  it('空文本或纯空白不应触发', () => {
    expect(isYantaIntent('')).toBe(false);
    expect(isYantaIntent('   ')).toBe(false);
  });

  it('前后空白应被忽略（仍以研讨开头判定）', () => {
    expect(isYantaIntent('  研讨昨晚新闻联播')).toBe(true);
  });

  it('触发词为单一前缀「研讨」，非固定搭配列表', () => {
    expect(YANTA_TRIGGER).toBe('研讨');
    expect(isYantaIntent(YANTA_TRIGGER)).toBe(true);
  });

  it('willEnterYanta 与 isYantaIntent 对齐', () => {
    const agent = new KunlunAgent({ env: {}, session: {}, models: {}, model: 'mock' });
    expect(agent.willEnterYanta('研讨昨晚新闻联播')).toBe(true);
    expect(agent.willEnterYanta('普通聊天')).toBe(false);
  });
});
