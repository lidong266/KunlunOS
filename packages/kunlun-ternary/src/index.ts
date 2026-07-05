// L0 三进制逻辑层 — 统一入口

// ─── 基础类型 ───
export type { Trit } from './trit.js';
export {
  T_TRUE,
  T_UNKNOWN,
  T_FALSE,
  isTrue,
  isUnknown,
  isFalse,
  isCertain,
  tritFromBoolean,
  tritToBoolean,
  tritEq,
  isValidTrit,
  clampToTrit,
  TritMath,
} from './trit.js';

// ─── Tryte ───
export type { Tryte, TryteDimension } from './tryte.js';
export {
  TRYTE_MAX,
  TRYTE_ZERO,
  TRYTE_MIN,
  TRYTE_DIMENSIONS,
  tryteToValue,
  valueToTryte,
  isValidTryte,
  tryteAdd,
  tryteWeightedSum,
  tryteDotProduct,
  tryteCertainty,
  tryteDominantDirection,
  tryteMerge,
} from './tryte.js';

// ─── K3 三值逻辑 ───
export { K3 } from './k3.js';

// ─── TernaryLogic 复合工具类 ───
export { TernaryLogic } from './ternary-logic.js';

// ─── 三进制状态机 ───
export { TernaryStateMachine } from './ternary-state-machine.js';

// ─── 三进制比较器 ───
export { TernaryComparator } from './ternary-comparator.js';

// ─── 三进制决策树 ───
export type { TernaryDecisionNode } from './ternary-decision-tree.js';
export { TernaryDecisionTree } from './ternary-decision-tree.js';

// ─── 三元索引系统 ───
export type {
  TernaryIndexEntry,
  TernarySearchOptions,
  TernarySearchResult,
} from './ternary-index.js';
export { TernaryIndex } from './ternary-index.js';
