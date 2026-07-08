/**
 * KunlunAgent — 昆仑OS 统一 Agent 入口
 *
 * 昆仑OS 对外的唯一 Agent API 层。持有两样东西：
 *   1. KunlunOS  — 认知调度（矛盾分析、策略引擎、子系统编排）
 *   2. AgentHarness — Pi 微内核的执行框架（LLM 调用 + 工具执行 + 消息流）
 *
 * KunlunAgent 不封装 AgentHarness 的 API——直接通过 `agent.harness.prompt()` 调用，
 * 因为那些是 Pi 的标准接口，透传封装只会增加无意义的间接层。
 *
 * KunlunAgent 真正增值的部分：
 *   - OS 生命周期管理（start/stop，CogBoot 引导）
 *   - 认知引擎注册（将 KunlunOS.injectCognition/decideTool 注入 kunlun-bridge）
 *   - 多微内核实例支持（每个 Agent 实例独立注册自己的 KunlunEngine scope）
 *
 * 使用方式：
 * ```typescript
 * const agent = new KunlunAgent({ env, session, models, model });
 * await agent.start();  // 启动 OS + 注册认知引擎
 *
 * // 通过 harness 调用 Pi 标准 API
 * const reply = await agent.harness.prompt("你好");
 * await agent.harness.skill("pdf", "处理这个文件");
 *
 * // 查询 OS 状态
 * const analysis = agent.getLatestAnalysis();
 * agent.stop();
 * ```
 */

import type { Model, Models, ImageContent, AssistantMessage } from '@earendil-works/pi-ai';
import type {
  AgentTool,
  ThinkingLevel,
  QueueMode,
  AgentMessage,
  AgentEvent,
} from '@kunlun/pi-agent-core';
import { AgentHarness } from './harness/agent-harness.js';
import type {
  AgentHarnessOptions,
  AgentHarnessResources,
  AgentHarnessStreamOptions,
  ExecutionEnv,
  Session,
  Skill,
  PromptTemplate,
  AbortResult,
  NavigateTreeResult,
  AgentHarnessEvent,
  AgentHarnessEventResultMap,
  AgentHarnessOwnEvent,
} from './harness/types.js';
import { KunlunOS } from './kunlun-os.js';
import type { KunlunOSConfig } from './types.js';
import type { KunlunAnalysis } from './kunlun-os.js';
import { registerKunlunEngine } from '@kunlun/pi-agent-core';
import type { KunlunEngine } from '@kunlun/pi-agent-core';

// ═══════════════════════════════════════════════════════════════
// 对话模式路由 — 普通对话走职能 Pi，研讨开头走昆仑全链路
// ═══════════════════════════════════════════════════════════════

/**
 * 研讨模式触发词：以「研讨」二字开头即进入大成智慧学全链路
 * （十一桥 → 量智×性智双轴 → 加权共识 → 天工渲染 → 人以为主裁决）。
 *
 * 「研讨」是动词指令前缀，其后跟的是真正要研讨的内容，
 * 例：「研讨昨晚新闻联播」「研讨追求性能还是保证成本」。
 * 否则走职能 Pi 纯净对话（不触发昆仑认知开销）。
 */
export const YANTA_TRIGGER = '研讨';

/**
 * 判断一条用户文本是否带研讨意图（决定走全链路还是职能 Pi）。
 * 仅以「研讨」二字开头即触发，其后内容任意——避免把触发词写成
 * 固定搭配列表（如『研讨开头』『研讨：』）而漏掉真实用法。
 * 不要求精确前缀，正文中间出现「研讨」不会误触发。
 */
export function isYantaIntent(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return t.startsWith(YANTA_TRIGGER);
}

// ═══════════════════════════════════════════════════════════════
// KunlunAgent 配置
// ═══════════════════════════════════════════════════════════════

export interface KunlunAgentOptions<
  TSkill extends Skill = Skill,
  TPromptTemplate extends PromptTemplate = PromptTemplate,
  TTool extends AgentTool = AgentTool,
> extends AgentHarnessOptions<TSkill, TPromptTemplate, TTool> {
  /** 昆仑OS 配置（可选） */
  osConfig?: Partial<KunlunOSConfig>;
  /** 是否启用认知注入（默认 true） */
  cognitionEnabled?: boolean;
  /** 是否启用工具安全（默认 true） */
  toolSecurityEnabled?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// KunlunAgent 类
// ═══════════════════════════════════════════════════════════════

export class KunlunAgent<
  TSkill extends Skill = Skill,
  TPromptTemplate extends PromptTemplate = PromptTemplate,
  TTool extends AgentTool = AgentTool,
> {
  /** 昆仑OS 认知调度核心 */
  readonly os: KunlunOS;
  /** Pi 微内核执行框架 — 直接使用，不封装 */
  readonly harness: AgentHarness<TSkill, TPromptTemplate, TTool>;

  private cognitionEnabled: boolean;
  private toolSecurityEnabled: boolean;
  private latestAnalysis: KunlunAnalysis | null = null;
  private engineRegistered = false;

  constructor(options: KunlunAgentOptions<TSkill, TPromptTemplate, TTool>) {
    this.cognitionEnabled = options.cognitionEnabled ?? true;
    this.toolSecurityEnabled = options.toolSecurityEnabled ?? true;

    this.os = new KunlunOS(options.osConfig);
    this.harness = new AgentHarness<TSkill, TPromptTemplate, TTool>(options);
  }

  // ═══════════════════════════════════════════════════════════
  // 生命周期
  // ═══════════════════════════════════════════════════════════

  /**
   * 启动昆仑OS 引导流程，并注册认知引擎到 kunlun-bridge。
   * 必须在调用 harness.prompt() 之前执行。
   */
  async start(): Promise<void> {
    await this.os.start();

    // 注册认知引擎——必须在 OS 启动后，因为 injectCognition 依赖 contradiction 引擎
    if (!this.engineRegistered) {
      this.registerAsKunlunEngine();
      this.engineRegistered = true;
    }
  }

  /** 停止昆仑OS */
  stop(): void {
    this.os.stop();
  }

  // ═══════════════════════════════════════════════════════════
  // 认知分析查询
  // ═══════════════════════════════════════════════════════════

  /** 获取最近一次认知分析结果 */
  getLatestAnalysis(): KunlunAnalysis | null {
    return this.latestAnalysis;
  }

  /** 获取昆仑OS 状态 */
  getOSState() {
    return this.os.getState();
  }

  /**
   * 统一对话入口 — 普通对话默认走职能 Pi，研讨开头自动走昆仑全链路。
   *
   * 调用方无需关心模式切换：引擎在每次 LLM 调用前会读取最新一条用户消息，
   * 若以研讨触发词（见 YANTA_TRIGGERS）开头则注入大成智慧学认知，
   * 否则走纯净的职能 Pi 对话。
   *
   * @example
   * ```ts
   * await agent.start();
   * await agent.chat('你好，帮我写个函数');        // 职能 Pi
   * await agent.chat('研讨开头：追求性能还是保证成本'); // 昆仑全链路
   * ```
   */
  async chat(input: string, options?: { images?: import('@earendil-works/pi-ai').ImageContent[] }) {
    return this.harness.prompt(input, options);
  }

  /** 判断输入是否会走昆仑全链路（供上层 UI/日志使用） */
  willEnterYanta(input: string): boolean {
    return isYantaIntent(input);
  }

  // ═══════════════════════════════════════════════════════════
  // 内部：注册为 KunlunEngine
  // ═══════════════════════════════════════════════════════════

  private registerAsKunlunEngine(): void {
    const self = this;
    const engine: KunlunEngine = {
      async analyze(context) {
        if (!self.cognitionEnabled || !self.os.isRunning()) {
          return {
            summary: self.os.isRunning() ? '认知注入已禁用' : 'OS 未就绪',
            contradictions: [],
            promptInjection: '',
            unifiability: 0,
            dominantAspect: 0,
            qualitativeState: -1,
          };
        }

        // 对话模式路由：默认职能 Pi；仅当最新一条用户消息以研讨触发词开头时，
        // 才进入昆仑全链路（十一桥→双轴→共识→天工→人以为主）。
        const lastUser = [...context.messages].reverse().find(m => m.role === 'user');
        const lastUserText = lastUser
          ? (typeof lastUser.content === 'string'
            ? lastUser.content
            : Array.isArray(lastUser.content)
              ? lastUser.content.map((c: any) => typeof c === 'string' ? c : c.text || '').join(' ')
              : '')
          : '';
        if (!isYantaIntent(lastUserText)) {
          // 职能 Pi 模式：轻量空分析，不触发昆仑认知开销
          return {
            summary: '职能Pi模式（非研讨）',
            contradictions: [],
            promptInjection: '',
            unifiability: 0,
            dominantAspect: 0,
            qualitativeState: -1,
          };
        }

        const messages = context.messages.map(m => ({
          role: m.role,
          content: typeof (m as any).content === 'string' ? (m as any).content : JSON.stringify((m as any).content),
        }));

        const analysis = await self.os.injectCognition(messages, context.systemPrompt);
        self.latestAnalysis = analysis;
        return analysis;
      },

      async decideTool(context: any) {
        if (!self.toolSecurityEnabled) {
          return { allowed: true };
        }

        const decision = self.os.decideTool(
          context.toolName,
          (context as any).args ?? {},
          self.latestAnalysis,
        );

        return {
          allowed: decision.allowed,
          blockReason: decision.blockReason,
          suggestedAlternative: decision.suggestedAlternative,
          priority: decision.priority,
        } as any;
      },

      async decideToolBatch(context: any) {
        if (!self.toolSecurityEnabled) {
          return context.toolCalls.map(() => ({ allowed: true }));
        }

        const decisions = context.toolCalls.map((tc: any) => {
          const d = self.os.decideTool(
            tc.toolName,
            tc.args ?? {},
            self.latestAnalysis,
          );
          return {
            allowed: d.allowed,
            blockReason: d.blockReason,
            suggestedAlternative: d.suggestedAlternative,
            priority: d.priority,
          };
        });

        return { decisions };
      },
    };

    registerKunlunEngine(engine);
  }
}

// ═══════════════════════════════════════════════════════════════
// 便捷工厂
// ═══════════════════════════════════════════════════════════════

let globalAgent: KunlunAgent | null = null;

/** 获取全局 KunlunAgent 实例 */
export function getKunlunAgent(): KunlunAgent {
  if (!globalAgent) {
    throw new Error('KunlunAgent not initialized. Call createKunlunAgent() first.');
  }
  return globalAgent;
}

/** 创建并启动全局 KunlunAgent */
export async function createKunlunAgent(options: KunlunAgentOptions): Promise<KunlunAgent> {
  if (globalAgent) {
    globalAgent.stop();
  }
  const agent = new KunlunAgent(options);
  await agent.start();
  globalAgent = agent;
  return agent;
}
