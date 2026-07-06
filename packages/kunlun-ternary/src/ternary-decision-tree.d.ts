import type { Trit } from './trit.js';
/**
 * 三进制决策树节点
 *
 * 每个节点有三个子节点，对应 +1/0/-1 三个分支。
 * 替代传统的 if-else 二叉树。
 */
export interface TernaryDecisionNode<T> {
    /** 评估函数：输入 → Trit */
    evaluate(input: T): Trit;
    /** 三个子节点 */
    onTrue?: TernaryDecisionNode<T>;
    onUnknown?: TernaryDecisionNode<T>;
    onFalse?: TernaryDecisionNode<T>;
    /** 叶子节点的值 */
    leafValue?: unknown;
}
/**
 * TernaryDecisionTree — 三进制决策树
 *
 * 非递归遍历，有最大深度限制防止无限循环。
 */
export declare class TernaryDecisionTree<T> {
    private root;
    private maxDepth;
    constructor(root: TernaryDecisionNode<T>, maxDepth?: number);
    /**
     * 遍历决策树（非递归）
     * @param input 输入数据
     * @returns 叶子节点的值，或 undefined（到达未知叶子/超深）
     */
    traverse(input: T): unknown;
    /**
     * 带路径追踪的遍历
     * @returns 遍历路径和最终结果
     */
    traverseWithPath(input: T): {
        value: unknown;
        path: Trit[];
        depth: number;
        terminated: 'leaf' | 'unknown' | 'max-depth';
    };
}
//# sourceMappingURL=ternary-decision-tree.d.ts.map