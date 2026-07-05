import { describe, it, expect } from 'vitest';
import { TernaryStateMachine } from '../src/ternary-state-machine.js';

type Mood = 'happy' | 'neutral' | 'sad';

describe('TernaryStateMachine', () => {
  it('初始化时返回初始状态', () => {
    const sm = new TernaryStateMachine<Mood>('neutral');
    expect(sm.getState()).toBe('neutral');
  });

  it('三分支转移: +1 → onTrue', () => {
    const sm = new TernaryStateMachine<Mood>('neutral');
    sm.registerTransition('neutral', 'happy', 'neutral', 'sad');
    const result = sm.transition(1);
    expect(result).toBe('happy');
    expect(sm.getState()).toBe('happy');
  });

  it('三分支转移: 0 → onUnknown', () => {
    const sm = new TernaryStateMachine<Mood>('neutral');
    sm.registerTransition('neutral', 'happy', 'neutral', 'sad');
    const result = sm.transition(0);
    expect(result).toBe('neutral');
  });

  it('三分支转移: -1 → onFalse', () => {
    const sm = new TernaryStateMachine<Mood>('neutral');
    sm.registerTransition('neutral', 'happy', 'neutral', 'sad');
    const result = sm.transition(-1);
    expect(result).toBe('sad');
  });

  it('未注册转移 → 抛错', () => {
    const sm = new TernaryStateMachine<Mood>('neutral');
    expect(() => sm.transition(1)).toThrow('No transition registered');
  });

  it('记录转移历史', () => {
    const sm = new TernaryStateMachine<Mood>('neutral');
    sm.registerTransition('neutral', 'happy', 'neutral', 'sad');
    sm.registerTransition('happy', 'happy', 'happy', 'neutral'); // from happy: +1→happy, 0→happy, -1→neutral
    sm.transition(1);  // neutral+1 → happy
    sm.transition(-1); // happy-1 → neutral

    const history = sm.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ from: 'neutral', to: 'happy', signal: 1 });
    expect(history[1]).toMatchObject({ from: 'happy', to: 'neutral', signal: -1 });
  });

  it('重置状态并清空历史', () => {
    const sm = new TernaryStateMachine<Mood>('neutral');
    sm.registerTransition('neutral', 'happy', 'neutral', 'sad');
    sm.transition(1);
    sm.reset('neutral');
    expect(sm.getState()).toBe('neutral');
    expect(sm.getHistory()).toHaveLength(0);
  });

  it('批量注册转移', () => {
    const sm = new TernaryStateMachine<Mood>('happy');
    sm.registerTransitions([
      { from: 'happy', onTrue: 'happy', onUnknown: 'neutral', onFalse: 'sad' },
    ]);
    const result = sm.transition(0);
    expect(result).toBe('neutral');
  });

  it('hasTransition 检查', () => {
    const sm = new TernaryStateMachine<Mood>('neutral');
    expect(sm.hasTransition('neutral')).toBe(false);
    sm.registerTransition('neutral', 'happy', 'neutral', 'sad');
    expect(sm.hasTransition('neutral')).toBe(true);
  });
});
