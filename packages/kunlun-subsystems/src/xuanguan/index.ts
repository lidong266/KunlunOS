/**
 * 玄关 Xuanguan (S13) — MCP 协议网关
 * V2 职责: 连接 OpenClaw MCP 生态
 * Phase 5: 三元增强接口 + 真实 MCP 客户端
 *
 * 架构：
 *   MCPGateway (门面)
 *     ├── registry (本地工具注册表)
 *     ├── MCPClientPool (外部 MCP Server 连接池)
 *     └── router (按 server+tool 分派)
 */

import { Trit, T_TRUE, T_UNKNOWN, T_FALSE, Tryte } from '@kunlun/ternary';
import { MCPClientPool, MCPClient, type MCPServerConfig } from './mcp-client.js';
import { OpenClawPluginManager, OpenClawPluginScanner, type OpenClawPluginEntry, type OpenClawPluginRuntime, type ScanResult, generateSampleConfig } from './openclaw.js';

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
  /** 插件来源（本地注册为 undefined，MCP server 来源为 server name） */
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
// 外部 MCP Server 信息
// ═══════════════════════════════════════════════════════════

export interface RegisteredMCServer {
  /** 服务器名称 */
  name: string;
  /** 命令 */
  command: string;
  /** 连接状态 */
  status: 'connected' | 'disconnected' | 'error';
  /** 可用工具数 */
  toolCount: number;
  /** 服务器信息（握手后获取） */
  serverInfo?: { name: string; version: string };
}

// ═══════════════════════════════════════════════════════════
// MCPGateway — MCP 协议网关
// ═══════════════════════════════════════════════════════════

export interface GatewayConfig {
  /** 最大并发工具调用 */
  maxConcurrentCalls: number;
  /** 工具调用超时(ms) */
  callTimeout: number;
  /** 是否自动发现 MCP 服务器 */
  autoDiscover: boolean;
}

const DEFAULT_GATEWAY_CONFIG: GatewayConfig = {
  maxConcurrentCalls: 10,
  callTimeout: 30000,
  autoDiscover: true,
};

export class MCPGateway {
  private config: GatewayConfig;
  private registeredTools: Map<string, MCPToolDef> = new Map();
  private callHistory: MCPToolResult[] = [];
  private callCounter = 0;
  private pool: MCPClientPool;
  private serverConfigs: MCPServerConfig[] = [];
  /** OpenClaw 插件管理器 */
  readonly openclaw: OpenClawPluginManager;
  /** OpenClaw 插件扫描器 */
  readonly openclawScanner: OpenClawPluginScanner;

  constructor(config: Partial<GatewayConfig> = {}) {
    this.config = { ...DEFAULT_GATEWAY_CONFIG, ...config };
    this.pool = new MCPClientPool();
    this.openclaw = new OpenClawPluginManager(this.pool);
    this.openclawScanner = new OpenClawPluginScanner();

    this.pool.on('server_connected', (name: unknown) => {
      if (typeof name === 'string') {
        const client = this.pool.get(name);
        if (client) {
          client.listTools().catch(() => {});
        }
      }
    });
  }

  // ─── MCP Server 管理（新增） ─────────────────────────

  /**
   * 注册并连接一个外部 MCP Server
   * @returns 注册完成后返回客户端引用
   */
  async addServer(config: MCPServerConfig): Promise<MCPClient> {
    // 先移除旧的同名 server
    if (this.pool.get(config.name ?? config.command)) {
      await this.removeServer(config.name ?? config.command);
    }

    const client = await this.pool.register(config);
    await client.connect(this.config.callTimeout);
    return client;
  }

  /**
   * 断开并移除一个 MCP Server
   */
  async removeServer(name: string): Promise<boolean> {
    // 从注册表中移除该 server 的工具
    for (const [toolName, def] of this.registeredTools) {
      if (def.pluginId === name) {
        this.registeredTools.delete(toolName);
      }
    }

    return this.pool.remove(name);
  }

  /**
   * 列出所有已注册的外部 MCP Server
   */
  listServers(): RegisteredMCServer[] {
    return this.pool.getAll().map(client => ({
      name: client.config.name ?? client.config.command,
      command: client.config.command,
      status: client.isConnected ? 'connected' :
              client.status === 'error' ? 'error' : 'disconnected',
      toolCount: client.tools.length,
      serverInfo: client.serverInfo ?? undefined,
    }));
  }

  /**
   * 自动发现并连接 MCP Server
   * 扫描常见 MCP 服务器配置：
   *   1. 环境变量 MCP_SERVERS
   *   2. 默认 MCP 服务器路径
   */
  async discoverServers(): Promise<number> {
    const servers: MCPServerConfig[] = [];

    // 从环境变量 MCP_SERVERS 解析（JSON 数组）
    const envServers = process.env.MCP_SERVERS;
    if (envServers) {
      try {
        const parsed = JSON.parse(envServers) as MCPServerConfig[];
        servers.push(...parsed);
      } catch {
        // 解析失败则忽略
      }
    }

    // 检查常见 MCP 服务器
    const commonCommands = [
      { command: 'npx', args: ['-y', '@anthropic/mcp-server'] },
      { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem'] },
      { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] },
    ];

    for (const cmd of commonCommands) {
      try {
        const { execSync } = await import('node:child_process');
        execSync(`which ${cmd.command}`, { stdio: 'ignore' });
        // 如果命令存在，但不自动启动（等待用户显式注册）
      } catch {
        // 命令不存在，跳过
      }
    }

    this.serverConfigs = servers;
    if (servers.length === 0) return 0;

    // 并行连接
    let connected = 0;
    await Promise.allSettled(
      servers.map(async (cfg) => {
        try {
          await this.addServer(cfg);
          connected++;
        } catch {
          // 连接失败不阻断
        }
      }),
    );

    return connected;
  }

  // ─── 本地工具注册（原功能） ─────────────────────────

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

  // ─── 工具调用 ──────────────────────────────────────

  /**
   * 调用工具（支持本地注册工具 + 外部 MCP Server 工具）
   *
   * 路由策略：
   *   1. 如果 pluginId 指定了 MCP Server → 路由到该 server
   *   2. 如果本地注册表中有 → 执行本地模拟/桥接
   *   3. 扫描所有 MCP Server 中匹配的工具名 → 路由到第一个匹配的 server
   */
  async callTool(call: MCPToolCall): Promise<MCPToolResult> {
    // 1) 检查本地注册表
    const localTool = this.registeredTools.get(call.toolName);
    if (localTool && !call.pluginId) {
      return this.executeLocalTool(localTool, call);
    }

    // 2) 如果指定了 pluginId，路由到对应 MCP Server
    if (call.pluginId) {
      return this.callMcpServerTool(call.pluginId, call);
    }

    // 3) 在所有已连接的 MCP Server 中查找该工具
    for (const client of this.pool.getConnected()) {
      const found = client.tools.find(t => t.name === call.toolName);
      if (found) {
        return this.callMcpServerTool(client.config.name ?? 'unknown', call);
      }
    }

    // 4) 若本地有 stub 工具定义（仅注册了类型但没有实际执行逻辑），也执行本地
    if (localTool) {
      return this.executeLocalTool(localTool, call);
    }

    // 5) 工具不存在
    return this.makeResult(call.callId, call.toolName, T_FALSE, undefined, `Tool not found: ${call.toolName}`);
  }

  /**
   * 执行本地注册的工具（原 simulateToolCall 升级版）
   */
  private async executeLocalTool(tool: MCPToolDef, call: MCPToolCall): Promise<MCPToolResult> {
    if (tool.securityTrit === T_FALSE) {
      return this.makeResult(call.callId, call.toolName, T_FALSE, undefined, `Tool blocked by security: ${call.toolName}`);
    }

    this.callCounter++;

    // 本地工具执行桥接：返回携带工具定义和参数的结果
    // 后续可扩展为注册本地 handler 回调
    const result: MCPToolResult = {
      callId: call.callId,
      toolName: tool.name,
      status: T_TRUE,
      data: {
        tool: tool.name,
        args: call.arguments,
        type: tool.type,
        timestamp: Date.now(),
        source: 'local',
      },
      confidence: [1, 0, 1, 0, 1, 0] as [Trit, Trit, Trit, Trit, Trit, Trit],
    };

    this.callHistory.push(result);
    return result;
  }

  /**
   * 路由到外部 MCP Server 执行工具调用
   */
  private async callMcpServerTool(serverName: string, call: MCPToolCall): Promise<MCPToolResult> {
    const client = this.pool.get(serverName);
    if (!client) {
      return this.makeResult(call.callId, call.toolName, T_FALSE, undefined, `MCP server not found: ${serverName}`);
    }

    if (!client.isConnected) {
      return this.makeResult(call.callId, call.toolName, T_FALSE, undefined, `MCP server disconnected: ${serverName}`);
    }

    // 如果是正在模拟工具调用的僵尸进程则补注册
    // 查找该 server 的工具列表
    const toolDef = client.tools.find(t => t.name === call.toolName);
    if (!toolDef && serverName !== 'unknown') {
      // 尝试刷新工具列表后再查一次
      try {
        await client.listTools();
      } catch {
        // 忽略刷新失败
      }
    }

    try {
      this.callCounter++;
      const result = await client.callTool(call.toolName, call.arguments);

      const mcpResult: MCPToolResult = {
        callId: call.callId,
        toolName: call.toolName,
        status: T_TRUE,
        data: result,
        confidence: [1, 0, 1, 0, 1, 0] as [Trit, Trit, Trit, Trit, Trit, Trit],
      };

      this.callHistory.push(mcpResult);
      return mcpResult;
    } catch (err) {
      const errorResult = this.makeResult(
        call.callId, call.toolName, T_FALSE, undefined,
        `MCP tool call failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
      this.callHistory.push(errorResult);
      return errorResult;
    }
  }

  /**
   * 同步外部 MCP Server 的工具到本地注册表
   * 方便通过 listTools 统一查看
   */
  syncExternalTools(): void {
    for (const client of this.pool.getConnected()) {
      for (const tool of client.tools) {
        const existingKey = `mcp:${client.config.name}:${tool.name}`;
        if (!this.registeredTools.has(existingKey) && !this.registeredTools.has(tool.name)) {
          this.registeredTools.set(existingKey, {
            name: tool.name,
            description: tool.description ?? `MCP tool from ${client.config.name}`,
            type: MCPToolType.RESOURCE,
            inputSchema: tool.inputSchema as Record<string, unknown> ?? {},
            securityTrit: T_UNKNOWN,
            pluginId: client.config.name,
          });
        }
      }
    }
  }

  // ─── 工具方法 ──────────────────────────────────────

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
    const servers = this.listServers();
    return {
      registeredTools: this.registeredTools.size,
      totalCalls: all.length,
      successCalls: all.filter(c => c.status === T_TRUE).length,
      unknownCalls: all.filter(c => c.status === T_UNKNOWN).length,
      failedCalls: all.filter(c => c.status === T_FALSE).length,
      connectedServers: servers.filter(s => s.status === 'connected').length,
      totalServers: servers.length,
    };
  }

  /**
   * 重置
   */
  reset(): void {
    this.registeredTools.clear();
    this.callHistory = [];
    this.callCounter = 0;
    // 不断开外部连接，只清网关状态
  }

  /**
   * 完全重置（包括断开所有外部连接）
   */
  async fullReset(): Promise<void> {
    this.registeredTools.clear();
    this.callHistory = [];
    this.callCounter = 0;
    await this.openclaw.stopAll();
    await this.pool.disconnectAll();
  }

  // ─── OpenClaw 插件管理 ─────────────────────────

  /**
   * 扫描 OpenClaw 配置并自动启动插件
   */
  async openclawAutoStart(): Promise<{ started: number; skipped: number; errors: string[] }> {
    return this.openclaw.autoStart();
  }

  /**
   * 获取所有 OpenClaw 插件运行时状态
   */
  getOpenclawRuntimes(): OpenClawPluginRuntime[] {
    return this.openclaw.getRuntimes();
  }

  /**
   * 启动指定 OpenClaw 插件
   */
  async startOpenclawPlugin(name: string): Promise<boolean> {
    const scanResult = this.openclawScanner.scan();
    const entry = scanResult.plugins.find(p => p.def.name === name);
    if (!entry) return false;
    await this.openclaw.startPlugin(entry);
    return true;
  }

  /**
   * 停止指定 OpenClaw 插件
   */
  async stopOpenclawPlugin(name: string): Promise<boolean> {
    return this.openclaw.stopPlugin(name);
  }

  /**
   * 生成示例 OpenClaw 配置文件内容
   */
  getSampleOpenclawConfig(): string {
    return generateSampleConfig();
  }

  /**
   * 扫描 OpenClaw 配置
   */
  scanOpenclawConfig(): ScanResult {
    return this.openclawScanner.scan();
  }
}
