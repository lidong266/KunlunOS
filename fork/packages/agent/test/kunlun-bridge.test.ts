/**
 * 三元认知桥接器测试 — kunlun-bridge.ts
 *
 * 覆盖:
 *   1. 引擎注册/加载状态
 *   2. 认知分析注入
 *   3. 单个工具决策
 *   4. 批量工具决策 + 优先级排序
 *   5. 注入格式化
 *   6. 边界场景（空引擎、异常降级）
 */

import { describe, expect, it } from "vitest";
import {
	registerKunlunEngine,
	isKunlunEngineLoaded,
	runKunlunAnalysis,
	getLatestAnalysis,
	decideToolCall,
	decideToolCallBatch,
	sortToolCallsByPriority,
	formatAnalysisForPrompt,
} from "../src/kunlun-bridge.js";
import type {
	KunlunEngine,
	AnalysisContext,
	AnalysisResult,
	ToolDecisionContext,
	BatchToolDecisionContext,
	ToolDecision,
} from "../src/kunlun-bridge.js";

// ═══════════════════════════════════════════════════════════════
// Helper
// ═══════════════════════════════════════════════════════════════

function createTestEngine(overrides: Partial<KunlunEngine> = {}): KunlunEngine {
	return {
		async analyze(ctx: AnalysisContext): Promise<AnalysisResult> {
			return {
				contradictions: [{ thesis: "效率", antithesis: "质量" }],
				unifiability: 1,
				dominantAspect: 1,
				qualitativeState: -1,
				strategy: "相持阶段 → 以质量换效率",
				memoryContext: "历史模式：之前 3 次选择了效率优先",
				ecosystemHealth: 1,
				summary: "效率与质量的矛盾可统一",
			};
		},
		async decideTool(ctx: ToolDecisionContext): Promise<ToolDecision> {
			if (["write", "edit", "delete", "rm"].includes(ctx.toolName)) {
				return {
					allowed: false,
					blockReason: `工具 ${ctx.toolName} 被三元引擎阻止（矛盾未解决）`,
					suggestedAlternative: ctx.availableTools.find(t => t.includes("read")) || "read",
				};
			}
			return { allowed: true, priority: 5 };
		},
		...overrides,
	};
}

function createEmptyEngine(): KunlunEngine {
	return {
		async analyze() {
			return { contradictions: [], unifiability: 0, dominantAspect: 0, qualitativeState: -1, summary: "" };
		},
	};
}

// ═══════════════════════════════════════════════════════════════
// 1. 引擎注册/加载状态
// ═══════════════════════════════════════════════════════════════

describe("引擎注册 & 状态", () => {

	it("注册真实引擎后状态变为已加载", () => {
		registerKunlunEngine(createTestEngine());
		expect(isKunlunEngineLoaded()).toBe(true);
	});

	it("注册新引擎后清空 latestAnalysis", async () => {
		registerKunlunEngine(createTestEngine());
		await runKunlunAnalysis({ messages: [], systemPrompt: "", tools: [] });
		expect(getLatestAnalysis()).not.toBeNull();

		registerKunlunEngine(createTestEngine());
		expect(getLatestAnalysis()).toBeNull();
	});
});

// ═══════════════════════════════════════════════════════════════
// 2. 认知分析
// ═══════════════════════════════════════════════════════════════

describe("认知分析 (runKunlunAnalysis)", () => {
	it("返回分析结果", async () => {
		registerKunlunEngine(createTestEngine());
		const result = await runKunlunAnalysis({
			messages: [{ role: "user", content: [{ type: "text", text: "效率 vs 质量" }], timestamp: Date.now() }],
			systemPrompt: "test",
			tools: ["read", "write"],
		});

		expect(result.contradictions).toHaveLength(1);
		expect(result.contradictions[0]?.thesis).toBe("效率");
		expect(result.unifiability).toBe(1);
		expect(result.strategy).toBeDefined();
	});

	it("更新 latestAnalysis", async () => {
		registerKunlunEngine(createTestEngine());
		expect(getLatestAnalysis()).toBeNull();
		await runKunlunAnalysis({ messages: [], systemPrompt: "", tools: [] });
		expect(getLatestAnalysis()).not.toBeNull();
		expect(getLatestAnalysis()?.summary).toBe("效率与质量的矛盾可统一");
	});

	it("引擎异常时返回降级结果", async () => {
		registerKunlunEngine({
			async analyze() { throw new Error("引擎崩溃"); },
		});

		const result = await runKunlunAnalysis({ messages: [], systemPrompt: "", tools: [] });
		expect(result.summary).toBe("三元分析失败");
		expect(result.contradictions).toHaveLength(0);
	});

	it("空引擎分析返回默认结果", async () => {
		registerKunlunEngine(createEmptyEngine());
		const result = await runKunlunAnalysis({ messages: [], systemPrompt: "", tools: [] });
		expect(result.summary).toBe("");
	});
});

// ═══════════════════════════════════════════════════════════════
// 3. 工具决策
// ═══════════════════════════════════════════════════════════════

describe("工具决策 (decideToolCall)", () => {
	it("读类工具默认允许", async () => {
		registerKunlunEngine(createTestEngine());
		const decision = await decideToolCall({
			toolName: "read",
			toolArgs: { path: "/test" },
			availableTools: ["read", "write", "bash"],
			latestAnalysis: null,
		});
		expect(decision.allowed).toBe(true);
	});

	it("写类工具在引擎有实现时被阻止", async () => {
		registerKunlunEngine(createTestEngine());
		const decision = await decideToolCall({
			toolName: "write",
			toolArgs: { path: "/test" },
			availableTools: ["read", "write"],
			latestAnalysis: { contradictions: [], unifiability: 0, dominantAspect: 0, qualitativeState: -1, summary: "" },
		});
		expect(decision.allowed).toBe(false);
		expect(decision.blockReason).toContain("三元引擎阻止");
		expect(decision.suggestedAlternative).toBe("read");
	});

	it("引擎未实现 decideTool 时默认允许", async () => {
		registerKunlunEngine({
			async analyze() {
				return { contradictions: [], unifiability: 0, dominantAspect: 0, qualitativeState: -1, summary: "" };
			},
		});
		const decision = await decideToolCall({
			toolName: "write", toolArgs: {}, availableTools: ["read"], latestAnalysis: null,
		});
		expect(decision.allowed).toBe(true);
	});

	it("引擎 decideTool 异常时降级为允许", async () => {
		registerKunlunEngine({
			async analyze() {
				return { contradictions: [], unifiability: 0, dominantAspect: 0, qualitativeState: -1, summary: "" };
			},
			async decideTool() { throw new Error("决策崩溃"); },
		});
		const decision = await decideToolCall({
			toolName: "bash", toolArgs: {}, availableTools: [], latestAnalysis: null,
		});
		expect(decision.allowed).toBe(true);
	});
});

// ═══════════════════════════════════════════════════════════════
// 4. 批量工具决策
// ═══════════════════════════════════════════════════════════════

describe("批量工具决策 (decideToolCallBatch)", () => {
	it("批量评估多个工具，写类工具被阻止", async () => {
		registerKunlunEngine(createTestEngine());
		const decisions = await decideToolCallBatch({
			toolCalls: [
				{ toolName: "read", toolArgs: {}, toolCallId: "1" },
				{ toolName: "write", toolArgs: {}, toolCallId: "2" },
				{ toolName: "bash", toolArgs: {}, toolCallId: "3" },
			],
			availableTools: ["read", "write", "bash"],
			latestAnalysis: null,
		});

		expect(decisions).toHaveLength(3);
		expect(decisions[0]?.allowed).toBe(true);
		expect(decisions[1]?.allowed).toBe(false);
		expect(decisions[2]?.allowed).toBe(true);
	});

	it("支持引擎的 decideToolBatch 实现", async () => {
		registerKunlunEngine({
			async analyze() {
				return { contradictions: [], unifiability: 0, dominantAspect: 0, qualitativeState: -1, summary: "" };
			},
			async decideToolBatch(ctx: BatchToolDecisionContext): Promise<ToolDecision[]> {
				return ctx.toolCalls.map(tc => ({
					allowed: tc.toolName !== "delete",
					priority: tc.toolName === "read" ? 10 : 1,
					suggestedAlternative: tc.toolName === "delete" ? "read" : undefined,
				}));
			},
		});

		const decisions = await decideToolCallBatch({
			toolCalls: [
				{ toolName: "read", toolArgs: {}, toolCallId: "1" },
				{ toolName: "delete", toolArgs: {}, toolCallId: "2" },
			],
			availableTools: ["read", "delete"],
			latestAnalysis: null,
		});

		expect(decisions[0]?.allowed).toBe(true);
		expect(decisions[0]?.priority).toBe(10);
		expect(decisions[1]?.allowed).toBe(false);
		expect(decisions[1]?.suggestedAlternative).toBe("read");
	});

	it("引擎 decideToolBatch 异常时降级为逐个决策", async () => {
		registerKunlunEngine({
			async analyze() {
				return { contradictions: [], unifiability: 0, dominantAspect: 0, qualitativeState: -1, summary: "" };
			},
			async decideTool(ctx: ToolDecisionContext): Promise<ToolDecision> {
				return {
					allowed: ctx.toolName !== "edit",
					priority: ctx.toolName === "search" ? 8 : 3,
				};
			},
			async decideToolBatch() { throw new Error("批量决策崩溃"); },
		});

		const decisions = await decideToolCallBatch({
			toolCalls: [
				{ toolName: "search", toolArgs: {}, toolCallId: "1" },
				{ toolName: "edit", toolArgs: {}, toolCallId: "2" },
			],
			availableTools: ["search", "edit"],
			latestAnalysis: null,
		});

		expect(decisions[0]?.allowed).toBe(true);
		expect(decisions[0]?.priority).toBe(8);
		expect(decisions[1]?.allowed).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════════
// 5. 优先级排序
// ═══════════════════════════════════════════════════════════════

describe("优先级排序 (sortToolCallsByPriority)", () => {
	it("按优先级降序排列", () => {
		const items = [
			{ toolCall: { id: "1", name: "write" }, decision: { allowed: true, priority: 1 } },
			{ toolCall: { id: "2", name: "read" }, decision: { allowed: true, priority: 10 } },
			{ toolCall: { id: "3", name: "bash" }, decision: { allowed: true, priority: 5 } },
		] as any;

		const sorted = sortToolCallsByPriority(items);
		expect(sorted[0]?.toolCall.name).toBe("read");
		expect(sorted[1]?.toolCall.name).toBe("bash");
		expect(sorted[2]?.toolCall.name).toBe("write");
	});

	it("无优先级时默认 0", () => {
		const items = [
			{ toolCall: { id: "1", name: "a" }, decision: { allowed: true } },
			{ toolCall: { id: "2", name: "b" }, decision: { allowed: true, priority: 5 } },
		] as any;

		const sorted = sortToolCallsByPriority(items);
		expect(sorted[0]?.toolCall.name).toBe("b");
		expect(sorted[1]?.toolCall.name).toBe("a");
	});

	it("不修改原数组", () => {
		const items = [
			{ toolCall: { id: "1", name: "a" }, decision: { allowed: true, priority: 1 } },
			{ toolCall: { id: "2", name: "b" }, decision: { allowed: true, priority: 10 } },
		] as any;
		const original = [...items];
		sortToolCallsByPriority(items);
		expect(items[0]?.toolCall.name).toBe(original[0]?.toolCall.name);
	});
});

// ═══════════════════════════════════════════════════════════════
// 6. 注入格式化
// ═══════════════════════════════════════════════════════════════

describe("注入格式化 (formatAnalysisForPrompt)", () => {
	it("格式化含矛盾的分析结果", () => {
		const result: AnalysisResult = {
			contradictions: [{ thesis: "开放", antithesis: "管控" }],
			unifiability: 0,
			dominantAspect: 1,
			qualitativeState: -1,
			strategy: "先开放试点，再逐步规范",
			memoryContext: "类似模式在教育行业试验过",
			ecosystemHealth: 0,
			summary: "开放与管控可阶段性统一",
		};

		const text = formatAnalysisForPrompt(result);
		expect(text).toContain("三元认知分析");
		expect(text).toContain("开放 ↔ 管控");
		expect(text).toContain("先开放试点");
		expect(text).toContain("类似模式在教育行业试验过");
		expect(text).toContain("稳定"); // ecosystemHealth=0 → "稳定"
		expect(text).toContain("开放与管控可阶段性统一");
	});

	it("格式化无矛盾的兜底结果", () => {
		const result: AnalysisResult = {
			contradictions: [],
			unifiability: 0,
			dominantAspect: 0,
			qualitativeState: -1,
			summary: "无矛盾",
		};

		const text = formatAnalysisForPrompt(result);
		expect(text).toContain("三元认知分析");
		expect(text).not.toContain("【矛盾感知】");
		expect(text).toContain("【分析摘要】无矛盾");
	});

	it("格式化空引擎分析结果", () => {
		const result: AnalysisResult = {
			contradictions: [],
			unifiability: 0,
			dominantAspect: 0,
			qualitativeState: -1,
			summary: "三元引擎未加载",
		};

		const text = formatAnalysisForPrompt(result);
		expect(text).toContain("三元引擎未加载");
	});
});
