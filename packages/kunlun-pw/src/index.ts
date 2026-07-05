/**
 * @kunlun/pw — L7 持久战策略引擎
 *
 * 论持久战：防御→相持→反攻三阶段内建时间维度
 */

// Types
export type {
  ProtractedWarPhase,
  PWContext,
  PhaseHistoryEntry,
  PowerSnapshot,
  SpiralMetrics,
  PWCriticalEvent,
  PhaseAssessment,
  PowerBalance,
  ContradictionStatus,
  PracticeSpiralStatus,
  EcosystemFactors,
  ReadinessToShift,
  PhaseShiftDecision,
  PhaseShiftRisk,
  PhaseShiftResult,
  DefenseTactics,
  StalemateTactics,
  CounteroffensiveTactics,
  PWTempoMetrics,
  TempoDecision,
  TempoAction,
  ResourceAllocation,
  PWGlobalState,
  PhaseRecord,
} from './types.js';

export { PW_TRIT } from './types.js';

// Engine
export { ProtractedWarEngine } from './engine.js';
export type { IProtractedWarEngine } from './engine.js';
