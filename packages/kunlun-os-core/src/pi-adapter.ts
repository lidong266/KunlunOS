/**
 * KunlunOS Pi 集成适配器
 *
 * 复用 Pi Agent 的：
 *   1. LLM 调用链路（streamSimple）
 *   2. 工具执行引擎
 *   3. 消息流管理
 *   4. session 管理
 *
 * 昆仑OS 注入：
 *   1. 三元认知分析（每次 LLM 调用前）
 *   2. 工具安全决策（每次工具执行前）
 *   3. 持久化记忆
 *   4. 知识图谱
 */

import { KunlunOS, getKunlunOS, bootKunlunOS } from './kunlun-os';
import type { KunlunAnalysis, KunlunToolDecision } from './kunlun-os';
import type { KunlunOSConfig } from './types';

// ═══════════════════════════════════════════════════════════════
// Pi Agent 集成配置
// ═══════════════════════════════════════════════════════════════

export interface PiIntegrationConfig {
  /** 是否启用认知注入 */
  cognitionEnabled: boolean;
  /** 是否启用工具安全管线 */
  toolSecurityEnabled: boolean;
  /** 昆仑OS 注入到 system prompt 的标记 */
  injectionMarker: string;
  /** 是否在 session_start 时自动重载引擎 */
  autoReload: boolean;
}

export const DEFAULT_PI_CONFIG: PiIntegrationConfig = {
  cognitionEnabled: true,
  toolSecurityEnabled: true,
  injectionMarker: '─── 三元认知分析（昆仑OS） ───',
  autoReload: true,
};

// ═══════════════════════════════════════════════════════════════
// Pi AgentLoopConfig 适配器
// ═══════════════════════════════════════════════════════════════

/**
 * 创建适用于 Pi AgentLoopConfig 的昆仑OS 回调函数集
 *
 * 在 Pi 初始化时调用：
 * ```typescript
 * const kunlun = createPiIntegration();
 * const agent = new Agent({
 *   systemPrompt: "你的系统提示词",
 *   transformContext: kunlun.transformContext,  // LLM调用前注入
 *   beforeToolCall: kunlun.beforeToolCall,      // 工具执行前安全检查
 *   // ... 其他配置
 * });
 * await kunlun.start(); // 启动昆仑OS
 * ```
 */
export function createPiIntegration(config: Partial<PiIntegrationConfig> = {}, osConfig?: Partial<KunlunOSConfig>) {
  const cfg = { ...DEFAULT_PI_CONFIG, ...config };
  const os = getKunlunOS(osConfig);
  let latestAnalysis: KunlunAnalysis | null = null;

  return {
    /** 昆仑OS 实例 */
    os,

    /** 启动 */
    start: () => os.start(),

    /** 获取最新分析 */
    getLatestAnalysis: () => latestAnalysis,

    /**
     * Pi AgentLoopConfig.transformContext
     *
     * 在 LLM 调用前，昆仑OS 分析上下文并注入认知分析结果。
     * 此函数不修改 messages，而是返回增强后的 system prompt。
     * 需要在外部将注入文本追加到 system prompt。
     */
    transformContext: async (messages: any[], signal?: AbortSignal) => {
      return messages; // 不修改消息，通过其他方式传递分析
    },

    /**
     * 生成增强的 system prompt（包含昆仑OS 认知分析）
     *
     * 在 Pi 的 streamAssistantResponse 或 createLoopConfig 之前调用：
     * ```typescript
     * const enhancedPrompt = kunlun.enhanceSystemPrompt(originalPrompt, messages);
     * ```
     */
    enhanceSystemPrompt: async (originalPrompt: string, messages: any[]): Promise<string> => {
      if (!cfg.cognitionEnabled) return originalPrompt;

      // 如果已经包含昆仑OS 标记，不再重复注入
      if (originalPrompt.includes(cfg.injectionMarker)) return originalPrompt;

      const analysis = await os.injectCognition(messages, originalPrompt);
      latestAnalysis = analysis;

      if (!analysis.promptInjection) return originalPrompt;
      return originalPrompt + '\n' + analysis.promptInjection;
    },

    /**
     * Pi AgentLoopConfig.beforeToolCall
     *
     * 在工具执行前进行安全检查
     */
    beforeToolCall: async (context: any, signal?: AbortSignal) => {
      if (!cfg.toolSecurityEnabled) return undefined;

      const decision = os.decideTool(
        context.toolCall?.toolName || context.toolName || '',
        context.args || {},
        latestAnalysis,
      );

      if (!decision.allowed) {
        return {
          block: true,
          reason: decision.blockReason || '昆仑OS 安全策略阻止',
        };
      }

      return undefined; // 放行
    },

    /**
     * 重置（每次新 session 时调用）
     */
    reset: () => {
      latestAnalysis = null;
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// 便捷函数：一行启动昆仑OS
// ═══════════════════════════════════════════════════════════════

/**
 * 一行启动昆仑OS 并返回 Pi 集成
 *
 * ```typescript
 * import { startKunlun } from '@kunlun/os-core';
 *
 * const kunlun = await startKunlun();
 *
 * // 在 Pi Agent 中使用
 * const agent = new Agent({
 *   systemPrompt: "你的系统提示词",
 *   beforeToolCall: kunlun.beforeToolCall,
 *   // 在每次 LLM 调用前增强 system prompt
 *   transformContext: async (messages) => {
 *     // 通过全局变量或其他方式传递增强后的 prompt
 *     return messages;
 *   },
 * });
 * ```
 */
export async function startKunlun(config?: Partial<PiIntegrationConfig>, osConfig?: Partial<KunlunOSConfig>) {
  const integration = createPiIntegration(config, osConfig);
  await integration.start();
  return integration;
}
