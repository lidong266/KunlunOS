/**
 * 玄关 Xuanguan (S13) — MCP 协议网关
 * V2 职责: 连接 OpenClaw MCP 生态（保留不变）
 * Phase 5: 增加三元增强接口
 */

import { Trit, T_TRUE, T_UNKNOWN, T_FALSE, Tryte } from '@kunlun/ternary';

// ═══════════════════════════════════════════════════════════
// MCP 协议基础类型
// ═══════════════════════════════════════════════════════════

export enum MCPToolType {
  /** 返回结构化数据 */
  RESOURCE = 'resource',
  /** 读写操作 */
  ACTION = 'action',
  /** 数据转换 */
  TRANSFORM = 'transform',
  /** 外部服务调用 */
  SERVICE = 'service',
}

export interface MCPToolDef {
  name: string;
  description: string;
  type: MCPToolType;
  /** 输入 schema */
  inputSchema: Record<string, unknown>;
  /** 三元安全标记 */
  securityTrit: Trit;
  /** 插件来源 */
  pluginId?: string;
}

export interface MCPToolCall {
  toolName: string;
  arguments: Record<string, unknown>;
  callId: string;
  pluginId?: string;
}

export interface MCPToolResult {
  callId: string;
  toolName: string;
  /** 三元成功/失败/未知状态 */
  status: Trit;
  /** 结果数据 */
  data?: unknown;
  /** 错误信息 */
  error?: string;
  /** 结果信度 */
  confidence: Tryte;
}

// ═══════════════════════════════════════════════════════════
// MCPGateway — MCP 协议网关
// ═══════════════════════════════════════════════════════════

export interface GatewayConfig {
  /** 最大并发工具调用 */
  maxConcurrentCalls: number;
  /** 工具调用超时(ms) */
  callTimeout: number;
}

const DEFAULT_GATEWAY_CONFIG: GatewayConfig = {
  maxConcurrentCalls: 10,
  callTimeout: 30000,
};

export class MCPGateway {
  private config: GatewayConfig;
  private registeredTools: Map<string, MCPToolDef> = new Map();
  private callHistory: MCPToolResult[] = [];
  private pendingCalls: Map<string, Promise<MCPToolResult>> = new Map();
  private callCounter = 0;

  constructor(config: Partial<GatewayConfig> = {}) {
    this.config = { ...DEFAULT_GATEWAY_CONFIG, ...config };
  }

  /**
   * 注册 MCP 工具
   */
  registerTool(
    name: string,
    description: string,
    type: MCPToolType,
    inputSchema: Record<string, unknown>,
    securityTrit: Trit = T_UNKNOWN,
    pluginId?: string,
  ): MCPToolDef {
    const toolDef: MCPToolDef = {
      name, description, type, inputSchema, securityTrit, pluginId,
    };
    this.registeredTools.set(name, toolDef);
    return toolDef;
  }

  /**
   * 注销工具
   */
  unregisterTool(name: string): boolean {
    return this.registeredTools.delete(name);
  }

  /**
   * 获取已注册工具
   */
  getTool(name: string): MCPToolDef | undefined {
    return this.registeredTools.get(name);
  }

  /**
   * 列出所有已注册工具
   */
  listTools(): MCPToolDef[] {
    return Array.from(this.registeredTools.values());
  }

  /**
   * 按安全标记过滤工具
   */
  listToolsBySecurity(trit: Trit): MCPToolDef[] {
    return Array.from(this.registeredTools.values()).filter(
      t => t.securityTrit === trit,
    );
  }

  /**
   * 调用 MCP 工具（异步）
   */
  async callTool(call: MCPToolCall): Promise<MCPToolResult> {
    const tool = this.registeredTools.get(call.toolName);
    if (!tool) {
      return this.makeResult(call.callId, call.toolName, T_FALSE, undefined, `Tool not found: ${call.toolName}`);
    }

    if (tool.securityTrit === T_FALSE) {
      return this.makeResult(call.callId, call.toolName, T_FALSE, undefined, `Tool blocked by security: ${call.toolName}`);
    }

    if (this.pendingCalls.size >= this.config.maxConcurrentCalls) {
      return this.makeResult(call.callId, call.toolName, T_UNKNOWN, undefined, 'Max concurrent calls reached');
    }

    try {
      // 模拟工具调用
      const result = await this.simulateToolCall(tool, call.arguments);
      this.callHistory.push(result);
      return result;
    } catch (e) {
      const errorResult = this.makeResult(
        call.callId, call.toolName, T_FALSE, undefined,
        `Tool call failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
      );
      this.callHistory.push(errorResult);
      return errorResult;
    }
  }

  private async simulateToolCall(tool: MCPToolDef, args: Record<string, unknown>): Promise<MCPToolResult> {
    const callId = `call-${++this.callCounter}`;

    // 模拟延迟（使用微任务而非 setTimeout）
    await Promise.resolve();

    const result: MCPToolResult = {
      callId,
      toolName: tool.name,
      status: T_TRUE,
      data: { tool: tool.name, args, timestamp: Date.now() },
      confidence: [1, 0, 1, -1, 1, 0] as [Trit, Trit, Trit, Trit, Trit, Trit],
    };
    return result;
  }

  private makeResult(
    callId: string,
    toolName: string,
    status: Trit,
    data?: unknown,
    error?: string,
  ): MCPToolResult {
    return {
      callId,
      toolName,
      status,
      data,
      error,
      confidence: [0, 0, 0, 0, 1, 0] as [Trit, Trit, Trit, Trit, Trit, Trit],
    };
  }

  /**
   * 获取调用历史
   */
  getCallHistory(): MCPToolResult[] {
    return [...this.callHistory];
  }

  /**
   * 获取网关统计
   */
  getStats() {
    const all = this.callHistory;
    return {
      registeredTools: this.registeredTools.size,
      totalCalls: all.length,
      successCalls: all.filter(c => c.status === T_TRUE).length,
      unknownCalls: all.filter(c => c.status === T_UNKNOWN).length,
      failedCalls: all.filter(c => c.status === T_FALSE).length,
      pendingCalls: this.pendingCalls.size,
    };
  }

  /**
   * 重置
   */
  reset(): void {
    this.registeredTools.clear();
    this.callHistory = [];
    this.pendingCalls.clear();
    this.callCounter = 0;
  }
}
