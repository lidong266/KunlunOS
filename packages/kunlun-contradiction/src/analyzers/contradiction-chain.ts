/**
 * 8. 矛盾链分析器 (Contradiction Chain Analyzer)
 *
 * 分析多个矛盾之间的因果、强化、抑制等关系网络。
 * 核心算法：
 *   - 拓扑排序确定矛盾层级和依赖关系
 *   - 基于矛盾对的 relatedContradictions 字段推断边类型
 *   - 检测循环依赖（矛盾链中的死锁）
 *   - 计算整体可解性
 *   - 识别根矛盾（入度为 0 的矛盾）
 */

import type { Trit } from '@kunlun/ternary';
import type {
  ContradictionPair,
  ContradictionChainGraph,
  ContradictionChainNode,
  ContradictionChainEdge,
  ContradictionChainRelation,
} from '../types';

export interface ContradictionChainAnalyzer {
  analyze(
    contradictions: ContradictionPair[],
    maxDepth?: number,
    detectCycles?: boolean
  ): ContradictionChainGraph;
}

export function createContradictionChainAnalyzer(): ContradictionChainAnalyzer {
  return new ContradictionChainAnalyzerImpl();
}

class ContradictionChainAnalyzerImpl implements ContradictionChainAnalyzer {
  analyze(
    contradictions: ContradictionPair[],
    maxDepth: number = 10,
    detectCycles: boolean = true
  ): ContradictionChainGraph {
    if (contradictions.length === 0) {
      return {
        nodes: [],
        edges: [],
        rootContradictionId: null,
        hasCycles: false,
        chainLength: 0,
        solvability: 0,
      };
    }

    // 1. 构建节点
    const nodes = this.buildNodes(contradictions);

    // 2. 从 relatedContradictions 推断边
    const edges = this.inferEdges(contradictions, nodes);

    // 3. 计算深度（BFS 拓扑遍历）
    const depthMap = this.computeDepths(nodes, edges, maxDepth);

    // 4. 检测循环
    const hasCycles = detectCycles ? this.detectCycles(nodes, edges) : false;

    // 5. 识别根矛盾
    const roots = nodes.filter(n => n.inDegree === 0);
    const rootId = roots.length === 1
      ? roots[0].contradictionId
      : roots.length > 1
        ? this.pickMostInfluentialRoot(roots, contradictions)
        : null;

    // 6. 计算链长度
    const chainLength = Math.max(0, ...nodes.map(n => n.depth)) + (nodes.length > 0 ? 1 : 0);

    // 7. 判定整体可解性
    const solvability = this.judgeSolvability(nodes, edges, hasCycles, contradictions);

    return {
      nodes: nodes.map(n => ({
        ...n,
        depth: depthMap.get(n.contradictionId) ?? n.depth,
      })),
      edges,
      rootContradictionId: rootId,
      hasCycles,
      chainLength,
      solvability,
    };
  }

  // ─── 节点构建 ───

  private buildNodes(contradictions: ContradictionPair[]): ContradictionChainNode[] {
    return contradictions.map(c => ({
      contradictionId: c.id,
      depth: 0, // 待拓扑排序计算
      isPrincipal: c.contradictionType === 'principal',
      inDegree: 0, // 待计算
      outDegree: 0, // 待计算
    }));
  }

  // ─── 边推断 ───

  private inferEdges(
    contradictions: ContradictionPair[],
    nodes: ContradictionChainNode[]
  ): ContradictionChainEdge[] {
    const edges: ContradictionChainEdge[] = [];
    const nodeMap = new Map(nodes.map(n => [n.contradictionId, n]));

    for (const c of contradictions) {
      for (const relatedId of c.relatedContradictions) {
        const target = contradictions.find(x => x.id === relatedId);
        if (!target) continue;

        const relation = this.inferRelation(c, target);
        const edge: ContradictionChainEdge = {
          from: c.id,
          to: relatedId,
          relation,
          strength: this.calculateEdgeStrength(c, target, relation),
          direction: this.inferDirection(relation),
        };

        edges.push(edge);

        // 更新入度/出度
        const fromNode = nodeMap.get(c.id);
        const toNode = nodeMap.get(relatedId);
        if (fromNode) fromNode.outDegree++;
        if (toNode) toNode.inDegree++;
      }
    }

    return edges;
  }

  /**
   * 推断矛盾之间的关系类型
   *
   * 推断策略：
   *   - 优先级高的矛盾 → causes 优先级低的
   *   - 主要矛盾 → contains 次要矛盾
   *   - 同类型矛盾 → intensifies/suppresses（根据矛盾类型决定）
   *   - 不同领域的矛盾 → transforms_into（如果存在领域迁移可能）
   */
  private inferRelation(
    source: ContradictionPair,
    target: ContradictionPair
  ): ContradictionChainRelation {
    // 主要矛盾包含次要/非对抗矛盾
    if (
      source.contradictionType === 'principal' &&
      ['secondary', 'non_antagonistic'].includes(target.contradictionType)
    ) {
      return 'contains';
    }

    // 高优先级矛盾导致低优先级矛盾
    if (source.priority > target.priority + 0.2) {
      return source.contradictionType === 'antagonistic' ? 'intensifies' : 'causes';
    }

    // 同类型矛盾相互加强
    if (source.contradictionType === target.contradictionType) {
      return source.contradictionType === 'antagonistic' ? 'intensifies' : 'suppresses';
    }

    // 如果目标已经解决了（低优先级），源可能消解
    if (target.priority < 0.2) {
      return 'resolves';
    }

    // 不同领域 → 转化关系
    if (source.thesis.domain !== target.thesis.domain) {
      return 'transforms_into';
    }

    // 默认：引发关系
    return 'causes';
  }

  private calculateEdgeStrength(
    source: ContradictionPair,
    target: ContradictionPair,
    relation: ContradictionChainRelation
  ): number {
    let strength = 0.5;

    // 优先级差越大，影响越强
    const priorityDiff = Math.abs(source.priority - target.priority);
    strength += priorityDiff * 0.2;

    // 关系类型影响
    switch (relation) {
      case 'causes': strength += 0.15; break;
      case 'intensifies': strength += 0.2; break;
      case 'contains': strength += 0.25; break;
      case 'suppresses': strength -= 0.1; break;
      case 'transforms_into': strength += 0.1; break;
      case 'resolves': strength += 0.3; break;
    }

    // 关联矛盾数量加权重
    const relatedCount = source.relatedContradictions.length;
    strength += Math.min(0.15, relatedCount * 0.03);

    return Math.round(Math.min(1, Math.max(0.1, strength)) * 100) / 100;
  }

  private inferDirection(relation: ContradictionChainRelation): Trit {
    switch (relation) {
      case 'causes': return 1;       // 正向因果
      case 'intensifies': return 1;  // 正向加强
      case 'contains': return 1;     // 正向包含
      case 'suppresses': return -1;  // 负向抑制
      case 'transforms_into': return 0; // 中性转化
      case 'resolves': return 1;     // 正向消解
      default: return 0;
    }
  }

  // ─── 深度计算（BFS 拓扑排序） ───

  private computeDepths(
    nodes: ContradictionChainNode[],
    edges: ContradictionChainEdge[],
    maxDepth: number
  ): Map<string, number> {
    const depthMap = new Map<string, number>();
    const visited = new Set<string>();

    // 构建邻接表
    const adjacency = new Map<string, string[]>();
    for (const edge of edges) {
      const targets = adjacency.get(edge.from) || [];
      targets.push(edge.to);
      adjacency.set(edge.from, targets);
    }

    // 从入度为 0 的节点开始 BFS
    const roots = nodes.filter(n => n.inDegree === 0);
    const queue: Array<{ id: string; depth: number }> = roots.map(r => ({
      id: r.contradictionId,
      depth: 0,
    }));

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.id)) continue;
      if (current.depth > maxDepth) continue;

      visited.add(current.id);
      depthMap.set(current.id, current.depth);

      const neighbors = adjacency.get(current.id) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push({ id: neighbor, depth: current.depth + 1 });
        }
      }
    }

    // 处理未被访问的节点（循环依赖中的节点）
    for (const node of nodes) {
      if (!depthMap.has(node.contradictionId)) {
        depthMap.set(node.contradictionId, maxDepth);
      }
    }

    return depthMap;
  }

  // ─── 循环检测（DFS 三色标记） ───

  private detectCycles(
    nodes: ContradictionChainNode[],
    edges: ContradictionChainEdge[]
  ): boolean {
    const WHITE = 0; // 未访问
    const GRAY = 1;  // 访问中
    const BLACK = 2; // 已完成

    const color = new Map<string, number>();
    for (const node of nodes) {
      color.set(node.contradictionId, WHITE);
    }

    const adjacency = new Map<string, string[]>();
    for (const edge of edges) {
      const targets = adjacency.get(edge.from) || [];
      targets.push(edge.to);
      adjacency.set(edge.from, targets);
    }

    const dfs = (nodeId: string): boolean => {
      color.set(nodeId, GRAY);
      const neighbors = adjacency.get(nodeId) || [];
      for (const neighbor of neighbors) {
        const c = color.get(neighbor);
        if (c === GRAY) return true; // 发现回边 → 有环
        if (c === WHITE && dfs(neighbor)) return true;
      }
      color.set(nodeId, BLACK);
      return false;
    };

    for (const node of nodes) {
      if (color.get(node.contradictionId) === WHITE) {
        if (dfs(node.contradictionId)) return true;
      }
    }

    return false;
  }

  // ─── 根矛盾选择 ───

  private pickMostInfluentialRoot(
    roots: ContradictionChainNode[],
    contradictions: ContradictionPair[]
  ): string | null {
    if (roots.length === 0) return null;

    // 按出度 + 主要矛盾标记选择最有影响力的根
    const scored = roots.map(r => {
      const c = contradictions.find(x => x.id === r.contradictionId);
      return {
        id: r.contradictionId,
        score: r.outDegree * 0.6 + (r.isPrincipal ? 0.4 : 0) + (c?.priority ?? 0) * 0.2,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].id;
  }

  // ─── 整体可解性判定 ───

  private judgeSolvability(
    nodes: ContradictionChainNode[],
    edges: ContradictionChainEdge[],
    hasCycles: boolean,
    contradictions: ContradictionPair[]
  ): Trit {
    if (nodes.length === 0) return 1; // 空链视为可解

    // 循环依赖 → 不可解（至少是缠结）
    if (hasCycles) return -1;

    // 存在对抗性矛盾 → 部分可解
    const hasAntagonistic = contradictions.some(
      c => c.contradictionType === 'antagonistic'
    );

    // 链过长 → 部分可解
    const maxDepth = Math.max(...nodes.map(n => n.depth));
    if (maxDepth > 8) return 0;

    // 所有边都是正向 → 可线性解决
    const allPositive = edges.every(e => e.direction === 1);
    if (allPositive && !hasAntagonistic) return 1;

    // 存在抑制边 → 部分可解
    const hasSuppression = edges.some(e => e.relation === 'suppresses');
    if (hasSuppression) return 0;

    // 对抗性矛盾在不同层级 → 有时可分层解决
    if (hasAntagonistic) {
      const antagonisticDepths = contradictions
        .filter(c => c.contradictionType === 'antagonistic')
        .map(c => nodes.find(n => n.contradictionId === c.id)?.depth ?? 0);

      const uniqueDepths = new Set(antagonisticDepths);
      if (uniqueDepths.size <= 1) return 0; // 同层对抗性矛盾集中
      return 0; // 默认对抗性存在就部分可解
    }

    return 1;
  }
}
