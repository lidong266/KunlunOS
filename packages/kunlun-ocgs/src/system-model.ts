/**
 * SystemModel — 内部系统模型
 *
 * 管理 Pi-昆仑自身的子系统拓扑：子系统注册、交互关系、边界定义。
 * 支持增量快照更新和版本追踪。
 */

import { T_TRUE, T_UNKNOWN, T_FALSE } from '@kunlun/ternary';
import type { Trit } from '@kunlun/ternary';
import type {
  EcosystemScanResult,
  SystemModelSnapshot,
  SubsystemDescriptor,
  Interaction,
  SystemBoundaries,
  ComplexityAssessment,
  ComplexityClass,
  ManagementApproach,
} from './types';

// ═══════════════════════════════════════════════════════════════
// 系统模型接口
// ═══════════════════════════════════════════════════════════════

export interface ISystemModel {
  /** 注册子系统 */
  registerSubsystem(descriptor: SubsystemDescriptor): void;

  /** 注销子系统 */
  unregisterSubsystem(name: string): boolean;

  /** 更新子系统状态 */
  updateSubsystemStatus(name: string, status: Trit): boolean;

  /** 添加交互关系 */
  addInteraction(interaction: Interaction): void;

  /** 设置边界 */
  setBoundaries(boundaries: SystemBoundaries): void;

  /** 从生态扫描结果更新系统模型 */
  updateSystemModel(scanResult: EcosystemScanResult): SystemModelSnapshot;

  /** 获取当前快照 */
  getSnapshot(): SystemModelSnapshot;

  /** 获取指定子系统 */
  getSubsystem(name: string): SubsystemDescriptor | undefined;

  /** 评估系统复杂性 */
  assessComplexity(): ComplexityAssessment;

  /** 添加涌现属性 */
  addEmergentProperty(property: string): void;
}

// ═══════════════════════════════════════════════════════════════
// 默认子系统注册
// ═══════════════════════════════════════════════════════════════

const DEFAULT_SUBSYSTEMS: SubsystemDescriptor[] = [
  {
    name: 'ternary',
    status: T_TRUE,
    dependencies: [],
    dependents: ['all'],
    load: 0.0,
    metadata: { layer: 'L0', description: '三进制逻辑层' },
  },
  {
    name: 'presence',
    status: T_TRUE,
    dependencies: ['ternary'],
    dependents: ['contradiction', 'eventbus'],
    load: 0.0,
    metadata: { layer: 'L4', description: '认知存在层' },
  },
  {
    name: 'eventbus',
    status: T_TRUE,
    dependencies: ['ternary'],
    dependents: ['contradiction', 'ocgs'],
    load: 0.0,
    metadata: { layer: 'L2', description: '三进制事件总线' },
  },
  {
    name: 'contradiction',
    status: T_TRUE,
    dependencies: ['ternary', 'presence'],
    dependents: ['spiral', 'pw', 'ocgs'],
    load: 0.0,
    metadata: { layer: 'L5', description: '矛盾分析引擎' },
  },
  {
    name: 'spiral',
    status: T_TRUE,
    dependencies: ['ternary', 'contradiction'],
    dependents: ['pw'],
    load: 0.0,
    metadata: { layer: 'L8', description: '实践螺旋引擎' },
  },
  {
    name: 'pw',
    status: T_TRUE,
    dependencies: ['ternary', 'contradiction', 'spiral'],
    dependents: [],
    load: 0.0,
    metadata: { layer: 'L7', description: '持久战策略引擎' },
  },
  {
    name: 'ocgs',
    status: T_TRUE,
    dependencies: ['ternary', 'contradiction', 'eventbus'],
    dependents: [],
    load: 0.0,
    metadata: { layer: 'L6', description: 'OCGS 自适应层' },
  },
];

const DEFAULT_INTERACTIONS: Interaction[] = [
  { from: 'presence', to: 'contradiction', type: 'trit_feed', frequency: 10, quality: T_TRUE },
  { from: 'contradiction', to: 'spiral', type: 'contradiction_pair', frequency: 5, quality: T_TRUE },
  { from: 'spiral', to: 'pw', type: 'spiral_metrics', frequency: 3, quality: T_TRUE },
  { from: 'ocgs', to: 'contradiction', type: 'adaptation_trigger', frequency: 1, quality: T_UNKNOWN },
  { from: 'eventbus', to: 'ocgs', type: 'ecosystem_event', frequency: 2, quality: T_UNKNOWN },
];

const DEFAULT_BOUNDARIES: SystemBoundaries = {
  hard: ['ternary_logic', 'safety_trit'],
  soft: ['knowledge_domain', 'memory_retention'],
  fuzzy: ['ecosystem_sensing', 'adaptation_scope'],
};

// ═══════════════════════════════════════════════════════════════
// SystemModel 实现
// ═══════════════════════════════════════════════════════════════

export function createSystemModel(config?: {
  subsystems?: SubsystemDescriptor[];
  interactions?: Interaction[];
  boundaries?: SystemBoundaries;
}): ISystemModel {
  // 子系统注册表
  const subsystems = new Map<string, SubsystemDescriptor>();
  const interactions: Interaction[] = [];
  let boundaries: SystemBoundaries = config?.boundaries ?? { ...DEFAULT_BOUNDARIES };
  let modelVersion = 0;
  const emergentProperties: string[] = [];

  // 初始化默认子系统
  const initialSubsystems = config?.subsystems ?? DEFAULT_SUBSYSTEMS;
  for (const sub of initialSubsystems) {
    subsystems.set(sub.name, { ...sub });
  }

  // 初始化默认交互
  const initialInteractions = config?.interactions ?? DEFAULT_INTERACTIONS;
  for (const int of initialInteractions) {
    interactions.push({ ...int });
  }

  function registerSubsystem(descriptor: SubsystemDescriptor): void {
    subsystems.set(descriptor.name, { ...descriptor });
    modelVersion++;
  }

  function unregisterSubsystem(name: string): boolean {
    const deleted = subsystems.delete(name);
    if (deleted) {
      // 清理相关交互
      for (let i = interactions.length - 1; i >= 0; i--) {
        if (interactions[i].from === name || interactions[i].to === name) {
          interactions.splice(i, 1);
        }
      }
      modelVersion++;
    }
    return deleted;
  }

  function updateSubsystemStatus(name: string, status: Trit): boolean {
    const sub = subsystems.get(name);
    if (!sub) return false;
    sub.status = status;
    modelVersion++;
    return true;
  }

  function addInteraction(interaction: Interaction): void {
    interactions.push({ ...interaction });
    modelVersion++;
  }

  function setBoundaries(newBoundaries: SystemBoundaries): void {
    boundaries = {
      hard: [...newBoundaries.hard],
      soft: [...newBoundaries.soft],
      fuzzy: [...newBoundaries.fuzzy],
    };
    modelVersion++;
  }

  function updateSystemModel(scanResult: EcosystemScanResult): SystemModelSnapshot {
    // 从生态扫描结果中提取对子系统的影响
    for (const signal of scanResult.signals) {
      if (signal.source === 'self' && signal.significance !== T_FALSE) {
        // 自感知信号影响子系统状态
        for (const affected of signal.impact.affectedSubsystems) {
          const sub = subsystems.get(affected);
          if (sub && signal.impact.direction === T_FALSE) {
            sub.status = T_UNKNOWN; // 降级
          }
        }
      }
    }

    // 更新生态健康度相关的涌现属性
    if (scanResult.ecosystemHealth === T_FALSE) {
      if (!emergentProperties.includes('ecosystem_decline_alert')) {
        emergentProperties.push('ecosystem_decline_alert');
      }
    }

    modelVersion++;
    return getSnapshot();
  }

  function getSnapshot(): SystemModelSnapshot {
    return {
      subsystems: Array.from(subsystems.values()).map((s) => ({ ...s })),
      interactions: interactions.map((i) => ({ ...i })),
      emergentProperties: [...emergentProperties],
      boundaries: {
        hard: [...boundaries.hard],
        soft: [...boundaries.soft],
        fuzzy: [...boundaries.fuzzy],
      },
      version: modelVersion,
      timestamp: Date.now(),
    };
  }

  function getSubsystem(name: string): SubsystemDescriptor | undefined {
    const sub = subsystems.get(name);
    return sub ? { ...sub } : undefined;
  }

  function assessComplexity(): ComplexityAssessment {
    const subList = Array.from(subsystems.values());
    const subsystemCount = subList.length;
    const interactionCount = interactions.length;
    const interactionDensity = subsystemCount > 0
      ? interactionCount / subsystemCount
      : 0;

    // 复杂度分类算法
    let complexityClass: ComplexityClass;
    let nonlinearityIndex: number;
    let predictability: Trit;
    let recommendedApproach: ManagementApproach;

    if (subsystemCount <= 5 && interactionDensity <= 1.0) {
      complexityClass = 'simple';
      nonlinearityIndex = 0.1;
      predictability = T_TRUE;
      recommendedApproach = 'sense_analyze_respond';
    } else if (subsystemCount <= 10 && interactionDensity <= 2.0) {
      complexityClass = 'complicated';
      nonlinearityIndex = 0.3;
      predictability = T_UNKNOWN;
      recommendedApproach = 'sense_analyze_respond';
    } else if (subsystemCount <= 20 && interactionDensity <= 5.0) {
      complexityClass = 'complex';
      nonlinearityIndex = 0.6;
      predictability = T_UNKNOWN;
      recommendedApproach = 'probe_sense_respond';
    } else {
      complexityClass = 'chaotic';
      nonlinearityIndex = 0.9;
      predictability = T_FALSE;
      recommendedApproach = 'act_sense_respond';
    }

    return {
      complexityClass,
      subsystemCount,
      interactionDensity,
      nonlinearityIndex,
      predictability,
      recommendedApproach,
      timestamp: Date.now(),
    };
  }

  function addEmergentProperty(property: string): void {
    if (!emergentProperties.includes(property)) {
      emergentProperties.push(property);
    }
    modelVersion++;
  }

  return {
    registerSubsystem,
    unregisterSubsystem,
    updateSubsystemStatus,
    addInteraction,
    setBoundaries,
    updateSystemModel,
    getSnapshot,
    getSubsystem,
    assessComplexity,
    addEmergentProperty,
  };
}
