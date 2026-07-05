import { describe, it, expect } from 'vitest';
import { TernaryDecisionTree } from '../src/ternary-decision-tree.js';
import type { TernaryDecisionNode } from '../src/ternary-decision-tree.js';

describe('TernaryDecisionTree', () => {
  it('简单三分支：叶子节点直接返回值', () => {
    const leaf: TernaryDecisionNode<number> = {
      evaluate: () => 1,
      leafValue: 'leaf-result',
    };
    const tree = new TernaryDecisionTree(leaf);
    expect(tree.traverse(42)).toBe('leaf-result');
  });

  it('两层级三分支', () => {
    // root: n > 0 → +1, n = 0 → 0, n < 0 → -1
    const root: TernaryDecisionNode<number> = {
      evaluate: (n: number) => n > 0 ? 1 : n < 0 ? -1 : 0,
      onTrue: {
        evaluate: () => 1,
        leafValue: 'positive',
      },
      onUnknown: {
        evaluate: () => 0,
        leafValue: 'zero',
      },
      onFalse: {
        evaluate: () => 1,
        leafValue: 'negative',
      },
    };

    const tree = new TernaryDecisionTree(root);
    expect(tree.traverse(5)).toBe('positive');
    expect(tree.traverse(0)).toBe('zero');
    expect(tree.traverse(-5)).toBe('negative');
  });

  it('到达未知叶子 → undefined', () => {
    const root: TernaryDecisionNode<number> = {
      evaluate: () => 0,
      // onUnknown undefined
    };
    const tree = new TernaryDecisionTree(root);
    expect(tree.traverse(0)).toBeUndefined();
  });

  it('超深保护 → maxDepth 后返回 undefined', () => {
    const infinite: TernaryDecisionNode<number> = {
      evaluate: () => 1,
      onTrue: undefined as unknown as TernaryDecisionNode<number>, // 循环引用
    };
    // 自引用
    infinite.onTrue = infinite;

    const tree = new TernaryDecisionTree(infinite, 5);
    const result = tree.traverse(0);
    expect(result).toBeUndefined();
  });

  it('traverseWithPath 返回路径和终止原因', () => {
    const root: TernaryDecisionNode<string> = {
      evaluate: (s: string) => s === 'yes' ? 1 : s === 'no' ? -1 : 0,
      onTrue: {
        evaluate: () => 1,
        leafValue: 'confirmed',
      },
    };
    const tree = new TernaryDecisionTree(root);
    const result = tree.traverseWithPath('yes');
    expect(result.value).toBe('confirmed');
    expect(result.path).toEqual([1]);
    expect(result.terminated).toBe('leaf');
  });
});
