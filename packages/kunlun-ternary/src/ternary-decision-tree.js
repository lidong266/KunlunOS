/**
 * TernaryDecisionTree — 三进制决策树
 *
 * 非递归遍历，有最大深度限制防止无限循环。
 */
export class TernaryDecisionTree {
    root;
    maxDepth;
    constructor(root, maxDepth = 100) {
        this.root = root;
        this.maxDepth = maxDepth;
    }
    /**
     * 遍历决策树（非递归）
     * @param input 输入数据
     * @returns 叶子节点的值，或 undefined（到达未知叶子/超深）
     */
    traverse(input) {
        let node = this.root;
        let depth = 0;
        while (node && depth < this.maxDepth) {
            // 叶子节点：直接返回值
            if (node.leafValue !== undefined) {
                return node.leafValue;
            }
            // 评估当前输入
            const result = node.evaluate(input);
            // 三分支导航
            node = result === 1 ? node.onTrue
                : result === -1 ? node.onFalse
                    : node.onUnknown;
            depth++;
        }
        // 到达未知叶子或超深
        return undefined;
    }
    /**
     * 带路径追踪的遍历
     * @returns 遍历路径和最终结果
     */
    traverseWithPath(input) {
        let node = this.root;
        const path = [];
        let depth = 0;
        while (node && depth < this.maxDepth) {
            if (node.leafValue !== undefined) {
                return { value: node.leafValue, path, depth, terminated: 'leaf' };
            }
            const result = node.evaluate(input);
            path.push(result);
            node = result === 1 ? node.onTrue
                : result === -1 ? node.onFalse
                    : node.onUnknown;
            depth++;
        }
        return { value: undefined, path, depth, terminated: depth >= this.maxDepth ? 'max-depth' : 'unknown' };
    }
}
//# sourceMappingURL=ternary-decision-tree.js.map