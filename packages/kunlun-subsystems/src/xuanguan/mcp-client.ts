/**
 * MCP 客户端 — 基于 JSON-RPC 2.0 的 Model Context Protocol 客户端
 *
 * 支持 stdio 传输层，用于连接 MCP server 并调用其工具。
 * MCP 协议（Model Context Protocol）：
 *   - JSON-RPC 2.0 over stdio
 *   - 每条消息一行 JSON，以 \n 分隔
 *   - 方法: initialize / ping / tools/list / tools/call
 */

import { spawn, execSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { ChildProcess } from 'node:child_process';

// ═══════════════════════════════════════════════════════════
// MCP JSON-RPC 协议类型
// ═══════════════════════════════════════════════════════════

/** JSON-RPC 请求 */
export interface JSONRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

/** JSON-RPC 成功响应 */
interface JSONRpcSuccess {
  jsonrpc: '2.0';
  id: number | string;
  result: unknown;
}

/** JSON-RPC 错误响应 */
interface JSONRpcError {
  jsonrpc: '2.0';
  id: number | string;
  error: { code: number; message: string; data?: unknown };
}

/** JSON-RPC 通知 */
interface JSONRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

/** MCP 工具定义 */
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

/** MCP Server 初始化结果 */
export interface MCPInitResult {
  protocolVersion: string;
  capabilities: Record<string, unknown>;
  serverInfo: { name: string; version: string };
}

/** MCP 服务器连接配置 */
export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  name?: string;
}

/** MCP 服务器状态 */
export type MCPServerStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// ═══════════════════════════════════════════════════════════
// 简易事件发射器（替代 EventEmitter 子类化以简化类型）
// ═══════════════════════════════════════════════════════════

type Listener = (...args: unknown[]) => void;

class SimpleEmitter {
  private listeners = new Map<string, Listener[]>();
  on(event: string, fn: Listener): void {
    const fns = this.listeners.get(event) ?? [];
    fns.push(fn);
    this.listeners.set(event, fns);
  }
  off(event: string, fn: Listener): void {
    const fns = this.listeners.get(event);
    if (!fns) return;
    const idx = fns.indexOf(fn);
    if (idx >= 0) fns.splice(idx, 1);
  }
  protected emit(event: string, ...args: unknown[]): void {
    const fns = this.listeners.get(event);
    if (!fns) return;
    for (const fn of fns) {
      try { fn(...args); } catch { /* ignore handler errors */ }
    }
  }
  removeAllListeners(): void {
    this.listeners.clear();
  }
}

// ═══════════════════════════════════════════════════════════
// MCPClient — 单个 MCP Server 连接
// ═══════════════════════════════════════════════════════════

export class MCPClient extends SimpleEmitter {
  private proc: ChildProcess | null = null;
  private rl: ReturnType<typeof createInterface> | null = null;
  private pending = new Map<number | string, {
    resolve: (v: unknown) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private nextId = 1;
  private _status: MCPServerStatus = 'disconnected';
  private _capabilities: Record<string, unknown> | null = null;
  private _serverInfo: { name: string; version: string } | null = null;
  /** 已发现的工具缓存 */
  tools: MCPTool[] = [];

  constructor(readonly config: MCPServerConfig) {
    super();
  }

  get status(): MCPServerStatus { return this._status; }
  get capabilities(): Record<string, unknown> | null { return this._capabilities; }
  get serverInfo(): { name: string; version: string } | null { return this._serverInfo; }
  get isConnected(): boolean { return this._status === 'connected'; }

  // ─── 生命周期 ──────────────────────────────────────

  async connect(timeoutMs = 10000): Promise<MCPInitResult> {
    if (this._status === 'connected' || this._status === 'connecting') {
      throw new Error(`MCP Client "${this.config.name}" is already ${this._status}`);
    }

    this._status = 'connecting';

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.cleanup();
        reject(new Error(`MCP Client "${this.config.name}" connect timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        this.proc = spawn(this.config.command, this.config.args ?? [], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, ...this.config.env },
          cwd: this.config.cwd,
        });

        const stderrChunks: Buffer[] = [];

        if (this.proc.stderr) {
          this.proc.stderr.on('data', (chunk: Buffer) => {
            stderrChunks.push(chunk);
          });
        }

        if (this.proc.stdout) {
          this.rl = createInterface({ input: this.proc.stdout, crlfDelay: Infinity });
          this.rl.on('line', (line: string) => {
            this.handleLine(line);
          });
        }

        this.proc.on('exit', (code: number | null) => {
          const wasConnecting = this._status === 'connecting';
          this._status = 'disconnected';
          this.emit('disconnected', code);

          for (const [id, p] of this.pending) {
            clearTimeout(p.timer);
            p.reject(new Error(`MCP server "${this.config.name}" disconnected (code: ${code})`));
          }
          this.pending.clear();

          if (wasConnecting) {
            clearTimeout(timer);
            const stderr = Buffer.concat(stderrChunks).toString('utf8').slice(0, 500);
            reject(new Error(
              `MCP server "${this.config.name}" exited during connect (code: ${code})${stderr ? '\nstderr: ' + stderr : ''}`,
            ));
          }
        });

        this.proc.on('error', (err: Error) => {
          const wasConnecting = this._status === 'connecting';
          this._status = 'error';
          this.emit('error', err);

          if (wasConnecting) {
            clearTimeout(timer);
            reject(err);
          }
        });

        // 发送 initialize 完成握手
        this.sendRequest('initialize', {
          protocolVersion: '0.1.0',
          capabilities: {},
          clientInfo: { name: 'pi-kunlun-xuanguan', version: '0.1.0' },
        }).then((result) => {
          clearTimeout(timer);
          const initResult = result as unknown as MCPInitResult;
          this._capabilities = initResult.capabilities;
          this._serverInfo = initResult.serverInfo;
          this._status = 'connected';
          this.emit('connected');
          resolve(initResult);
        }).catch((err: Error) => {
          clearTimeout(timer);
          reject(err);
        });
      } catch (err) {
        clearTimeout(timer);
        this._status = 'error';
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  async disconnect(): Promise<void> {
    this.cleanup();
    this._status = 'disconnected';
    this._capabilities = null;
    this._serverInfo = null;
    this.tools = [];
  }

  // ─── MCP 方法调用 ──────────────────────────────────

  async listTools(): Promise<MCPTool[]> {
    if (this._status !== 'connected') {
      throw new Error(`MCP Client "${this.config.name}" is not connected`);
    }
    const result = await this.sendRequest('tools/list', {});
    const r = result as { tools?: MCPTool[] };
    this.tools = r.tools ?? [];
    this.emit('tools_updated', this.tools);
    return this.tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (this._status !== 'connected') {
      throw new Error(`MCP Client "${this.config.name}" is not connected`);
    }
    return this.sendRequest('tools/call', { name, arguments: args });
  }

  async ping(): Promise<boolean> {
    try {
      await this.sendRequest('ping', {});
      return true;
    } catch { return false; }
  }

  // ─── 内部 JSON-RPC ────────────────────────────────

  private sendRequest(method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = this.nextId++;
    const req: JSONRpcRequest = { jsonrpc: '2.0', id, method, params };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request "${method}" timed out`));
      }, 30000);

      this.pending.set(id, { resolve, reject, timer });

      if (this.proc?.stdin?.writable) {
        this.proc.stdin.write(JSON.stringify(req) + '\n');
      } else {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(new Error('MCP stdin not available'));
      }
    });
  }

  private handleLine(line: string): void {
    line = line.trim();
    if (!line) return;

    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(line);
    } catch {
      return; // 非 JSON 行，忽略
    }

    // JSON-RPC 响应
    if ('id' in msg && (typeof msg.id === 'string' || typeof msg.id === 'number')) {
      const id = msg.id as string | number;
      const pending = this.pending.get(id);
      if (!pending) return;

      clearTimeout(pending.timer);
      this.pending.delete(id);

      if ('error' in msg && msg.error && typeof msg.error === 'object') {
        const err = msg.error as { code: number; message: string };
        pending.reject(new Error(`MCP error (code ${err.code}): ${err.message}`));
      } else {
        pending.resolve('result' in msg ? msg.result : undefined);
      }
    }
    // JSON-RPC 通知
    else if (typeof msg.method === 'string') {
      this.emit('notification', msg.method, msg.params);
    }
  }

  private cleanup(): void {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    if (this.proc) {
      try { this.proc.kill('SIGTERM'); } catch { /* ignore */ }
      setTimeout(() => {
        try { this.proc?.kill('SIGKILL'); } catch { /* ignore */ }
      }, 2000).unref();
      this.proc = null;
    }
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error('MCP client disconnected'));
    }
    this.pending.clear();
  }
}

// ═══════════════════════════════════════════════════════════
// MCPClientPool — MCP Server 连接池
// ═══════════════════════════════════════════════════════════

export class MCPClientPool extends SimpleEmitter {
  private clients = new Map<string, MCPClient>();

  async register(config: MCPServerConfig): Promise<MCPClient> {
    const name = config.name ?? config.command;
    if (this.clients.has(name)) {
      throw new Error(`MCP server "${name}" already registered`);
    }
    const client = new MCPClient(config);

    client.on('connected', () => this.emit('server_connected', name));
    client.on('disconnected', (code: unknown) => this.emit('server_disconnected', name, code));
    client.on('error', (err: unknown) => this.emit('server_error', name, err));

    this.clients.set(name, client);
    return client;
  }

  get(name: string): MCPClient | undefined {
    return this.clients.get(name);
  }

  /** 移除并断开一个客户端 */
  async remove(name: string): Promise<boolean> {
    const client = this.clients.get(name);
    if (!client) return false;
    await client.disconnect().catch(() => {});
    this.clients.delete(name);
    this.emit('server_removed', name);
    return true;
  }

  getAll(): MCPClient[] {
    return Array.from(this.clients.values());
  }

  getConnected(): MCPClient[] {
    return this.getAll().filter(c => c.isConnected);
  }

  getAllTools(): Map<string, MCPTool[]> {
    const result = new Map<string, MCPTool[]>();
    for (const [name, client] of this.clients) {
      if (client.isConnected && client.tools.length > 0) {
        result.set(name, client.tools);
      }
    }
    return result;
  }

  async callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const client = this.clients.get(serverName);
    if (!client) throw new Error(`MCP server "${serverName}" not found`);
    return client.callTool(toolName, args);
  }

  async disconnectAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const [, client] of this.clients) {
      promises.push(client.disconnect().catch(() => {}));
    }
    await Promise.all(promises);
    this.clients.clear();
  }

  async pingAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    await Promise.allSettled(
      Array.from(this.clients.entries()).map(async ([name, client]) => {
        if (client.isConnected) {
          results.set(name, await client.ping());
        }
      }),
    );
    return results;
  }
}

// ═══════════════════════════════════════════════════════════
// MCP Server 探测工具（供 OCGS 使用）
// ═══════════════════════════════════════════════════════════

export interface MCPDetectResult {
  servers: Array<{ name: string; command: string; pid?: number }>;
  totalCommands: number;
  connected: number;
  errors: string[];
}

export function detectMcpServers(): MCPDetectResult {
  const errors: string[] = [];
  const detected: Array<{ name: string; command: string; pid?: number }> = [];

  // 1. 环境变量 MCP_SERVERS
  const envServers = process.env.MCP_SERVERS;
  if (envServers) {
    try {
      const parsed = JSON.parse(envServers) as Array<{ command: string; name?: string }>;
      for (const s of parsed) {
        detected.push({ name: s.name ?? s.command, command: s.command });
      }
    } catch {
      errors.push('MCP_SERVERS env var is not valid JSON');
    }
  }

  // 2. 扫描 MCP 进程
  try {
    const output = execSync(
      'ps aux 2>/dev/null | grep -iE "mcp[-_]?server|modelcontextprotocol" | grep -v grep',
      { encoding: 'utf8', timeout: 3000 },
    ).trim();

    if (output) {
      for (const line of output.split('\n')) {
        const parts = line.trim().split(/\s+/);
        const pid = parseInt(parts[1] as string, 10);
        const cmd = parts.slice(10).join(' ') || 'unknown';
        const execName = cmd.split(' ')[0]?.split('/').pop() ?? 'unknown';
        if (!isNaN(pid)) {
          detected.push({ name: `mcp:${execName}`, command: cmd, pid });
        }
      }
    }
  } catch {
    // ps 不可用或无匹配
  }

  // 3. 检查 pi settings.json
  try {
    const { readFileSync, existsSync } = await_import_fs();
    const home = process.env.HOME;
    if (home) {
      const settingsPath = home + '/.pi/agent/settings.json';
      if (existsSync(settingsPath)) {
        const settings = JSON.parse(readFileSync(settingsPath));
        const packages: string[] | undefined = settings.packages;
        if (packages) {
          for (const pkg of packages) {
            if (pkg.toLowerCase().includes('mcp') || pkg.toLowerCase().includes('openclaw')) {
              detected.push({ name: `pkg:${pkg}`, command: pkg });
            }
          }
        }
      }
    }
  } catch {
    // 文件不存在或解析失败
  }

  const connected = detected.filter(d => d.pid !== undefined).length;

  return { servers: detected, totalCommands: detected.length, connected, errors };
}

// 惰性导入 fs
function await_import_fs(): { readFileSync: (p: string) => string; existsSync: (p: string) => boolean } {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('node:fs') as typeof import('node:fs');
  return {
    readFileSync: (p: string) => fs.readFileSync(p, 'utf8') as string,
    existsSync: fs.existsSync,
  };
}
