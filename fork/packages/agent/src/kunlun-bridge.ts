/**
 * KunlunBridge — 三元认知引擎适配器（v2）
 *
 * 三层能力：
 *   1. 认知注入 — 在 LLM 调用前注入三元分析（已有）
 *   2. 工具决策 — 控制 LLM 的工具调用选择（新增）
 *   3. 记忆系统 — 归藏三元记忆模型集成（新增）
 *
 * Fork 核心改动点。
 */

import type { AgentMessage, AgentToolCall, AgentTool } from "./types.js";

// ═══════════════════════════════════════════════════════════════
// 三元引擎接口
// ═══════════════════════════════════════════════════════════════

export interface KunlunEngine {
  /** 分析上下文，返回三元分析结论（注入 LLM 调用前） */
  analyze(context: AnalysisContext): Promise<AnalysisResult>;

  /** 工具决策：给定单个工具调用，决定是否执行、顺序、或替代方案 */
  decideTool?(context: ToolDecisionContext): Promise<ToolDecision>;

  /**
   * 批量工具决策：一次性评估所有 tool call，支持全局优先级排序和互斥检测
   * 如果未实现，fallback 到逐个调用 decideTool
   */
  decideToolBatch?(context: BatchToolDecisionContext): Promise<ToolDecision[]>;
}

export interface AnalysisContext {
  messages: AgentMessage[];
  systemPrompt: string;
  tools: string[];
}

export interface AnalysisResult {
  contradictions: Array<{ thesis: string; antithesis: string }>;
  unifiability: number;
  dominantAspect: number;
  qualitativeState: number;
  strategy?: string;
  ecosystemHealth?: number;
  /** 记忆注入：相关历史分析摘要 */
  memoryContext?: string;
  summary: string;
}

export interface ToolDecisionContext {
  /** 要调用的工具名 */
  toolName: string;
  /** 工具参数 */
  toolArgs: Record<string, unknown>;
  /** 当前可用工具列表 */
  availableTools: string[];
  /** 最近分析结果 */
  latestAnalysis: AnalysisResult | null;
  /** 工具描述 */
  tool?: AgentTool<any>;
}

/**
 * 批量工具决策上下文：引擎可一次性评估所有待调度工具
 */
export interface BatchToolDecisionContext {
  /** 所有待执行的 tool call */
  toolCalls: Array<{
    toolName: string;
    toolArgs: Record<string, unknown>;
    toolCallId: string;
    tool?: AgentTool<any>;
  }>;
  /** 可用工具列表 */
  availableTools: string[];
  /** 最近分析结果 */
  latestAnalysis: AnalysisResult | null;
}

export interface ToolDecision {
  /** true=允许执行, false=阻止 */
  allowed: boolean;
  /** 阻止原因（仅 allowed=false 时） */
  blockReason?: string;
  /** 建议替代工具 */
  suggestedAlternative?: string;
  /** 执行优先级（数字越大越优先，仅 parallel 模式有效） */
  priority?: number;
}

// ═══════════════════════════════════════════════════════════════
// 空引擎（fallback）
// ═══════════════════════════════════════════════════════════════

const NULL_ENGINE: KunlunEngine = {
  async analyze(_ctx: AnalysisContext): Promise<AnalysisResult> {
    return {
      contradictions: [],
      unifiability: 0,
      dominantAspect: 0,
      qualitativeState: -1,
      summary: "三元引擎未加载",
    };
  },
};

// ═══════════════════════════════════════════════════════════════
// 引擎实例与状态
// ═══════════════════════════════════════════════════════════════

let engine: KunlunEngine = NULL_ENGINE;
let latestAnalysis: AnalysisResult | null = null;

export function registerKunlunEngine(e: KunlunEngine): void {
  engine = e;
  latestAnalysis = null;
}

export function isKunlunEngineLoaded(): boolean {
  return engine !== NULL_ENGINE;
}

export function getLatestAnalysis(): AnalysisResult | null {
  return latestAnalysis;
}

// ═══════════════════════════════════════════════════════════════
// 认知分析（LLM 调用前注入）
// ═══════════════════════════════════════════════════════════════

export async function runKunlunAnalysis(ctx: AnalysisContext): Promise<AnalysisResult> {
  try {
    const result = await engine.analyze(ctx);
    latestAnalysis = result;
    return result;
  } catch {
    const fallback: AnalysisResult = {
      contradictions: [],
      unifiability: 0,
      dominantAspect: 0,
      qualitativeState: -1,
      summary: "三元分析失败",
    };
    latestAnalysis = fallback;
    return fallback;
  }
}

// ═══════════════════════════════════════════════════════════════
// 工具决策（LLM 返回 tool call 后执行前）
// ═══════════════════════════════════════════════════════════════

export async function decideToolCall(ctx: ToolDecisionContext): Promise<ToolDecision> {
  if (!engine.decideTool) {
    return { allowed: true };
  }
  try {
    return await engine.decideTool(ctx);
  } catch {
    return { allowed: true };
  }
}

/**
 * 批量工具决策
 * - 如果引擎实现了 decideToolBatch，使用批量决策（支持全局优先级）
 * - 否则逐个调用 decideTool
 */
export async function decideToolCallBatch(
  ctx: BatchToolDecisionContext,
): Promise<ToolDecision[]> {
  if (engine.decideToolBatch) {
    try {
      return await engine.decideToolBatch(ctx);
    } catch {
      // 降级到逐个决策
    }
  }
  // 逐个决策
  const decisions: ToolDecision[] = [];
  for (const tc of ctx.toolCalls) {
    const d = await decideToolCall({
      toolName: tc.toolName,
      toolArgs: tc.toolArgs,
      availableTools: ctx.availableTools,
      latestAnalysis: ctx.latestAnalysis,
      tool: tc.tool,
    });
    decisions.push(d);
  }
  return decisions;
}

/**
 * 按优先级排序工具调用，最高优先级在先
 * 用于 parallel 模式下的执行顺序优化
 */
export function sortToolCallsByPriority(
  toolCalls: Array<{ toolCall: any; decision: ToolDecision }>,
): Array<{ toolCall: any; decision: ToolDecision }> {
  return [...toolCalls].sort((a, b) => {
    const pa = a.decision.priority ?? 0;
    const pb = b.decision.priority ?? 0;
    return pb - pa; // 降序：高优先级先执行
  });
}

// ═══════════════════════════════════════════════════════════════
// 注入格式化
// ═══════════════════════════════════════════════════════════════

export function formatAnalysisForPrompt(analysis: AnalysisResult): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("─── 三元认知分析（Pi-昆仑 V2） ───");
  lines.push("");

  if (analysis.contradictions.length > 0) {
    lines.push("【矛盾感知】");
    for (const c of analysis.contradictions) {
      lines.push(`  · ${c.thesis} ↔ ${c.antithesis}`);
    }
    const unifiabilityLabels: Record<number, string> = { 1: "可统一", 0: "待分析", [-1]: "不可调和" };
    lines.push(`  整体矛盾状态：${unifiabilityLabels[analysis.unifiability] ?? "未知"}`);
    const aspectLabels: Record<number, string> = { 1: "正题主导", 0: "均势", [-1]: "反题主导" };
    lines.push(`  主导方面：${aspectLabels[analysis.dominantAspect] ?? "未知"}`);
    lines.push("");
  }

  if (analysis.strategy) {
    lines.push("【策略建议】");
    lines.push(`  ${analysis.strategy}`);
    lines.push("");
  }

  if (analysis.memoryContext) {
    lines.push("【相关记忆】");
    lines.push(`  ${analysis.memoryContext}`);
    lines.push("");
  }

  if (analysis.ecosystemHealth !== undefined) {
    const healthLabels: Record<number, string> = { 1: "繁荣", 0: "稳定", [-1]: "衰退" };
    lines.push(`【生态健康】${healthLabels[analysis.ecosystemHealth] ?? "未知"}`);
    lines.push("");
  }

  lines.push(`【分析摘要】${analysis.summary}`);
  lines.push("────────────────────────────");
  lines.push("");

  return lines.join("\n");
}
