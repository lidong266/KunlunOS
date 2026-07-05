/**
 * @kunlun/ocgs — L6 OCGS 自适应层统一入口
 *
 * 开放复杂巨系统论（钱学森）：
 *   生态感知 → 系统建模 → 涌现检测 → 自适应调节
 *
 * 九大生态源 + 四维复杂度 + 涌现三态
 *
 * @version 0.1.0-phase4
 */

// ─── 核心类型 ───
export type {
  // 生态源
  EcosystemSource,
  // 生态感知
  EcosystemSignal,
  EcosystemScanResult,
  SourceScanDetail,
  SourceStatus,
  EcosystemChange,
  EcosystemEventHandler,
  // 系统建模
  SubsystemDescriptor,
  Interaction,
  SystemBoundaries,
  SystemModelSnapshot,
  // 复杂度
  ComplexityAssessment,
  ComplexityClass,
  ManagementApproach,
  // 涌现检测
  EmergenceReport,
  EmergentBehavior,
  Nonlinearity,
  // 自适应调节
  AdaptiveMeasure,
  CognitiveMode,
  AdaptationDirective,
  AdaptationResult,
  // 全局状态
  OCGSState,
  // 编排器
  OCGSOrchestratorConfig,
  OrchestrationTrigger,
  // 内部
  SourceScanner,
} from './types.js';
export { DEFAULT_OCGS_ORCHESTRATOR_CONFIG } from './types.js';

// ─── EcosystemSensor ───
export type { IEcosystemSensor } from './ecosystem-sensor.js';
export { createEcosystemSensor } from './ecosystem-sensor.js';

// ─── SystemModel ───
export type { ISystemModel } from './system-model.js';
export { createSystemModel } from './system-model.js';

// ─── EmergenceDetector ───
export type { IEmergenceDetector } from './emergence-detector.js';
export { createEmergenceDetector } from './emergence-detector.js';

// ─── AdaptiveRegulator ───
export type { IAdaptiveRegulator } from './adaptive-regulator.js';
export { createAdaptiveRegulator } from './adaptive-regulator.js';

// ─── OCGSOrchestrator ───
export type { IOCGSOrchestrator, FullCycleResult } from './orchestrator.js';
export { createOCGSOrchestrator } from './orchestrator.js';
