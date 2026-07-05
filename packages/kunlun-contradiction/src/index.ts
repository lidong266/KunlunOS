/**
 * @kunlun/contradiction — L5 矛盾分析引擎
 *
 * 四论之矛盾论的核心落地，提供：
 *   1. 8 个分析器的完整矛盾分析管线
 *   2. 三元判定 Prompt 模板系统
 *   3. 矛盾链拓扑分析
 *
 * @version 2.0.0-phase1
 */

// ─── 类型导出 ───
export type {
  // 命题与证据
  PropositionSource,
  EvidenceType,
  Evidence,
  Proposition,

  // 矛盾对
  ContradictionDiscoverySource,
  ContradictionPair,
  ContradictionType,

  // 矛盾状态与历史
  ContradictionState,
  Intervention,
  ContradictionHistory,

  // 八分析器输出
  PrincipalContradictionResult,
  AspectAnalysis,
  UnityDerivation,
  UnificationPath,
  QualitativeChangeAssessment,
  QualitativeTrigger,
  NegationAssessment,
  TransformationPaths,
  TransformationPath,
  UnificationConditions,
  UnificationCondition,
  ContradictionChainGraph,
  ContradictionChainNode,
  ContradictionChainEdge,
  ContradictionChainRelation,

  // 引擎
  ContradictionAnalysisOutput,
  ContradictionEngineConfig,

  // Prompt 工程
  PromptTemplateVariables,
  TernaryJudgmentResult,
  TernaryPromptTemplate,
} from './types';

export { DEFAULT_CONTRADICTION_ENGINE_CONFIG } from './types';

// ─── 引擎 ───
export {
  createContradictionEngine,
  type ContradictionEngine,
} from './engine';

// ─── 分析器 ───
export {
  createPrincipalContradictionLocator,
  type PrincipalContradictionLocator,
} from './analyzers/principal-locator';

export {
  createAspectAnalyzer,
  type AspectAnalyzer,
} from './analyzers/aspect-analyzer';

export {
  createUnityDeriver,
  type UnityDeriver,
} from './analyzers/unity-deriver';

export {
  createQualitativeChangeDetector,
  type QualitativeChangeDetector,
} from './analyzers/qualitative-change-detector';

export {
  createNegationDetector,
  type NegationDetector,
} from './analyzers/negation-detector';

export {
  createTransformationPredictor,
  type TransformationPredictor,
} from './analyzers/transformation-predictor';

export {
  createUnificationConditionsDeriver,
  type UnificationConditionsDeriver,
} from './analyzers/unification-conditions';

export {
  createContradictionChainAnalyzer,
  type ContradictionChainAnalyzer,
} from './analyzers/contradiction-chain';

// ─── Prompt 模板系统 ───
export {
  createTernaryPromptManager,
  type TernaryPromptManager,
} from './ternary-prompt';
