/**
 * Pi-昆仑 L3 认知子系统 — kunlun-subsystems
 *
 * 包含 8 个三元化改造子系统:
 *   S6  谛听 Diting   — 三元矛盾感知
 *   S7  太一 Taiyi    — 矛盾分析执行器
 *   S8  天工 Tiangong — 三元信度渲染
 *   S9  琅嬛 Langhuan — 三元知识索引
 *   S10 归藏 Guicang  — 三元记忆模型
 *   S11 镇岳 Zhenyue  — 三元安全判断
 *   S12 镇熵 Zhenshang — 三元决策治理
 *   S13 玄关 Xuanguan — MCP 协议网关
 */

// 共享类型
export type { ContradictionPair } from './types.js';
export { tryteFromTrits, tryteToTrits, tryteGetDimension } from './types.js';

// 谛听 — 三元矛盾感知
export {
  SignalSource,
  SIGNAL_RELIABILITY_INIT,
  ContradictionSignalDetector,
} from './diting/index.js';
export type {
  SignalTrit,
  ContradictionAwarePerception,
  DetectionConfig,
} from './diting/index.js';

// 太一 — 矛盾分析执行器
export {
  BridgeDomain,
  DomainRouter,
  DebateEngine,
  ContradictionExecutor,
} from './taiyi/index.js';
export type {
  DebateRound,
  DebateResult,
  DebateConfig,
  AnalysisTask,
  ExecutionConfig,
} from './taiyi/index.js';

// 天工 — 三元信度渲染
export {
  CONFIDENCE_TAGS,
  ConfidenceTagRenderer,
  ContradictionVisualizer,
} from './tiangong/index.js';
export type {
  ConfidenceTag,
  RenderFragment,
  RenderOutput,
  VisualizationNode,
  VisualizationEdge,
  ContradictionGraph,
} from './tiangong/index.js';

// 琅嬛 — 三元知识索引
export {
  RelationType,
  TernaryKnowledgeIndex,
  KnowledgeContradictionGraph,
} from './langhuan/index.js';
export type {
  KnowledgeEntry,
  KnowledgeRelation,
  IndexConfig,
  ContradictionEdge,
} from './langhuan/index.js';

// 归藏 — 三元记忆
export {
  DEFAULT_DECAY_PARAMS,
  TernaryMemoryModel,
  ResonantMemoryNetwork,
} from './guicang/index.js';
export type {
  MemoryEntry,
  DecayParams,
  MemoryConfig,
  ResonanceEvent,
} from './guicang/index.js';

// 镇岳 — 三元安全
export {
  PipelineLayer,
  TernarySecurityPipeline,
  TernaryRiskHeatmap,
} from './zhenyue/index.js';
export type {
  LayerResult,
  RiskEntry,
  PipelineConfig,
  HeatmapCell,
} from './zhenyue/index.js';

// 镇熵 — 三元治理
export {
  TernaryDecisionTree,
  SkillGovernance,
  TernaryAlertManager,
} from './zhenshang/index.js';
export type {
  DecisionNode,
  DecisionPath,
  SkillVersion,
  GovernedSkill,
  TernaryAlert,
} from './zhenshang/index.js';

// 玄关 — MCP 网关
export {
  MCPToolType,
  MCPGateway,
} from './xuanguan/index.js';
export type {
  MCPToolDef,
  MCPToolCall,
  MCPToolResult,
  GatewayConfig,
  RegisteredMCServer,
} from './xuanguan/index.js';

// MCP 客户端
export {
  MCPClientPool,
  MCPClient,
} from './xuanguan/mcp-client.js';
export type {
  MCPServerConfig,
  MCPTool as MCPExternalTool,
  MCPInitResult,
  MCPServerStatus,
} from './xuanguan/mcp-client.js';

// OpenClaw 插件管理
export {
  OpenClawPluginManager,
  OpenClawPluginScanner,
  checkGateway,
  setupGateway,
  startGateway,
  installPlugin,
  addWeChatChannel,
  listPlugins,
} from './xuanguan/openclaw.js';
export type {
  OpenClawPluginDef,
  OpenClawPluginEntry,
  OpenClawPluginRuntime,
  OpenClawConfig,
  OpenClawEcosystemConfig,
  ScanResult as OpenClawScanResult,
} from './xuanguan/openclaw.js';
