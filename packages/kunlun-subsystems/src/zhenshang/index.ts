/**
 * 镇熵 Zhenshang (S12) — 三元决策治理
 * V2 职责: 三元决策树调度、技能治理、三元告警
 *
 * 关键变化:
 *  - 编排决策: 基于三元决策树
 *  - 技能治理: 基于实践螺旋验证
 *  - 监控告警: +1正常/0预警/-1告警
 */

import { Trit, T_TRUE, T_UNKNOWN, T_FALSE } from '@kunlun/ternary';

// ═══════════════════════════════════════════════════════════
// TernaryDecisionTree — 三元决策树
// ═══════════════════════════════════════════════════════════

export interface DecisionNode {
  id: string;
  label: string;
  condition: string;
  tritOutput: Trit;
  children: DecisionNode[];
  action?: string;
}

export interface DecisionPath {
  nodes: string[];
  finalDecision: Trit;
  action: string;
}

export class TernaryDecisionTree {
  private root: DecisionNode | null = null;

  setRoot(node: DecisionNode): void {
    this.root = node;
  }

  getRoot(): DecisionNode | null {
    return this.root;
  }

  /**
   * 遍历决策树并返回决策路径
   */
  traverse(context: Record<string, string>): DecisionPath {
    if (!this.root) {
      return { nodes: [], finalDecision: T_UNKNOWN, action: 'no_decision_tree' };
    }
    return this.traverseNode(this.root, context, []);
  }

  private traverseNode(
    node: DecisionNode,
    context: Record<string, string>,
    path: string[],
  ): DecisionPath {
    path.push(node.id);

    // 叶子节点
    if (node.children.length === 0) {
      return {
        nodes: path,
        finalDecision: node.tritOutput,
        action: node.action || 'no_action',
      };
    }

    // 按 Trit 值选择子节点
    const childByTrit = node.children.find(c => c.tritOutput === node.tritOutput);
    if (childByTrit) {
      return this.traverseNode(childByTrit, context, path);
    }

    // 默认取第一个子节点
    return this.traverseNode(node.children[0], context, path);
  }

  /**
   * 多数表决
   */
  majorityVote(decisions: Trit[]): Trit {
    if (decisions.length === 0) return T_UNKNOWN;
    const counts = { [T_TRUE]: 0, [T_UNKNOWN]: 0, [T_FALSE]: 0 };
    for (const d of decisions) counts[d]++;
    if (counts[T_TRUE] > counts[T_UNKNOWN] && counts[T_TRUE] > counts[T_FALSE]) return T_TRUE;
    if (counts[T_FALSE] > counts[T_UNKNOWN] && counts[T_FALSE] > counts[T_TRUE]) return T_FALSE;
    return T_UNKNOWN;
  }
}

// ═══════════════════════════════════════════════════════════
// SkillGovernance — 技能治理
// ═══════════════════════════════════════════════════════════

export interface SkillVersion {
  version: string;
  trit: Trit;
  validated: boolean;
  releasedAt: number;
  releaseNotes: string;
}

export interface GovernedSkill {
  name: string;
  currentVersion: string;
  versions: SkillVersion[];
  spiralCycleCount: number;
  lastValidated: number;
}

export class SkillGovernance {
  private skills: Map<string, GovernedSkill> = new Map();
  private tree: TernaryDecisionTree;

  constructor(tree: TernaryDecisionTree) {
    this.tree = tree;
  }

  registerSkill(name: string): GovernedSkill {
    const skill: GovernedSkill = {
      name,
      currentVersion: '0.1.0',
      versions: [{
        version: '0.1.0',
        trit: T_UNKNOWN,
        validated: false,
        releasedAt: Date.now(),
        releaseNotes: 'Initial version',
      }],
      spiralCycleCount: 0,
      lastValidated: Date.now(),
    };
    this.skills.set(name, skill);
    return skill;
  }

  /**
   * 基于实践螺旋验证升级/降级技能
   */
  validateSkill(name: string, spiralResult: Trit): SkillVersion | null {
    const skill = this.skills.get(name);
    if (!skill) return null;

    skill.spiralCycleCount++;
    skill.lastValidated = Date.now();

    const current = skill.versions[skill.versions.length - 1];

    if (spiralResult === T_TRUE) {
      // 验证通过 → 升级
      const [major, minor, patch] = current.version.split('.').map(Number);
      const newVersion: SkillVersion = {
        version: `${major}.${minor + 1}.${patch}`,
        trit: T_TRUE,
        validated: true,
        releasedAt: Date.now(),
        releaseNotes: `Upgraded after spiral cycle ${skill.spiralCycleCount}`,
      };
      skill.versions.push(newVersion);
      skill.currentVersion = newVersion.version;
      return newVersion;
    } else if (spiralResult === T_FALSE) {
      // 验证失败 → 降级
      const downgraded: SkillVersion = {
        version: current.version,
        trit: T_FALSE,
        validated: false,
        releasedAt: Date.now(),
        releaseNotes: `Downgraded: failed spiral cycle ${skill.spiralCycleCount}`,
      };
      skill.versions.push(downgraded);
      return downgraded;
    }

    // T_UNKNOWN → 保持不变
    return null;
  }

  getSkill(name: string): GovernedSkill | undefined {
    return this.skills.get(name);
  }

  getAllSkills(): GovernedSkill[] {
    return Array.from(this.skills.values());
  }

  getStats() {
    const all = Array.from(this.skills.values());
    return {
      total: all.length,
      validated: all.filter(s => {
        const latest = s.versions[s.versions.length - 1];
        return latest.trit === T_TRUE;
      }).length,
      pending: all.filter(s => {
        const latest = s.versions[s.versions.length - 1];
        return latest.trit === T_UNKNOWN;
      }).length,
      downgraded: all.filter(s => {
        const latest = s.versions[s.versions.length - 1];
        return latest.trit === T_FALSE;
      }).length,
    };
  }

  reset(): void {
    this.skills.clear();
  }
}

// ═══════════════════════════════════════════════════════════
// TernaryAlert — 三元告警
// ═══════════════════════════════════════════════════════════

export interface TernaryAlert {
  id: string;
  source: string;
  message: string;
  severity: Trit;
  level: 'normal' | 'warning' | 'critical';
  metadata?: Record<string, string>;
  timestamp: number;
  acknowledged: boolean;
}

export class TernaryAlertManager {
  private alerts: TernaryAlert[] = [];
  private counter = 0;

  /**
   * 发送告警
   */
  alert(source: string, message: string, severity: Trit, metadata?: Record<string, string>): TernaryAlert {
    const level = severity === T_FALSE ? 'critical'
      : severity === T_UNKNOWN ? 'warning'
      : 'normal';

    const a: TernaryAlert = {
      id: `alert-${++this.counter}`,
      source, message, severity, level, metadata,
      timestamp: Date.now(),
      acknowledged: false,
    };

    this.alerts.push(a);
    return a;
  }

  acknowledge(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return false;
    alert.acknowledged = true;
    return true;
  }

  getActiveAlerts(): TernaryAlert[] {
    return this.alerts.filter(a => !a.acknowledged);
  }

  getAlertsBySeverity(severity: Trit): TernaryAlert[] {
    return this.alerts.filter(a => a.severity === severity);
  }

  getCriticalAlerts(): TernaryAlert[] {
    return this.getAlertsBySeverity(T_FALSE);
  }

  getAllAlerts(): TernaryAlert[] {
    return [...this.alerts];
  }

  getStats() {
    const all = this.alerts;
    return {
      total: all.length,
      active: all.filter(a => !a.acknowledged).length,
      critical: all.filter(a => a.severity === T_FALSE).length,
      warning: all.filter(a => a.severity === T_UNKNOWN).length,
      normal: all.filter(a => a.severity === T_TRUE).length,
    };
  }

  reset(): void {
    this.alerts = [];
    this.counter = 0;
  }
}
