/**
 * OpenClaw Plugin Discovery & Management Layer
 *
 * Responsibilities:
 *   1. Discover OpenClaw plugin configs from standard locations
 *   2. Parse openclaw.json / .openclawrc / plugin directories
 *   3. Integrate with MCPGateway for auto-starting configured plugins
 *
 * Scan locations:
 *   - ~/.openclawrc
 *   - ~/.openclaw/config.json
 *   - ~/.openclaw/plugins/<wildcard>/plugin.json
 *   - ~/.config/openclaw/config.json
 *   - OPENCLAW_CONFIG env var
 *   - project .openclaw.json
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { MCPClientPool, type MCPServerConfig } from './mcp-client.js';

// ═══════════════════════════════════════════════════════════
// OpenClaw 配置类型
// ═══════════════════════════════════════════════════════════

/** OpenClaw 插件配置 */
export interface OpenClawPluginDef {
  /** 插件名称 */
  name: string;
  /** 描述 */
  description?: string;
  /** 启动命令 */
  command: string;
  /** 命令参数 */
  args?: string[];
  /** 环境变量 */
  env?: Record<string, string>;
  /** 工作目录 */
  cwd?: string;
  /** 是否自动启动（默认 true） */
  autoStart?: boolean;
  /** 安全标记：+1=安全, 0=需审查, -1=禁止 */
  securityTrit?: number;
  /** 版本 */
  version?: string;
  /** 插件作者 */
  author?: string;
  /** 插件来源（local/npm/git） */
  source?: 'local' | 'npm' | 'git';
}

/** OpenClaw 生态系统配置 */
export interface OpenClawEcosystemConfig {
  /** 注册表地址 */
  registryUrl?: string;
  /** 是否自动更新 */
  autoUpdate?: boolean;
  /** 检查间隔（秒） */
  checkInterval?: number;
}

/** OpenClaw 完整配置 */
export interface OpenClawConfig {
  plugins?: OpenClawPluginDef[];
  ecosystem?: OpenClawEcosystemConfig;
}

/** 扫描结果中的插件条目 */
export interface OpenClawPluginEntry {
  def: OpenClawPluginDef;
  sourcePath: string;       // 来源配置文件路径
  configStatus: 'enabled' | 'disabled' | 'error';
  resolveStatus: 'resolved' | 'missing_command' | 'config_error';
}

/** OpenClaw 插件运行时状态 */
export interface OpenClawPluginRuntime {
  entry: OpenClawPluginEntry;
  serverName: string;
  connected: boolean;
  toolCount: number;
  startTime?: number;
  lastError?: string;
}

// ═══════════════════════════════════════════════════════════
// 标准扫描位置
// ═══════════════════════════════════════════════════════════

function getStandardPaths(): string[] {
  const home = homedir();
  const paths: string[] = [];

  // 环境变量 OPENCLAW_CONFIG
  const envConfig = process.env.OPENCLAW_CONFIG;
  if (envConfig) paths.push(envConfig);

  // 标准位置
  paths.push(join(home, '.openclawrc'));
  paths.push(join(home, '.openclaw', 'config.json'));
  paths.push(join(home, '.config', 'openclaw', 'config.json'));

  // 项目级配置（当前工作目录）
  try {
    const cwd = process.cwd();
    paths.push(join(cwd, '.openclaw.json'));
  } catch {
    // 无法获取 cwd
  }

  // 插件目录（每个子目录下的 plugin.json）
  const pluginDirs = [
    join(home, '.openclaw', 'plugins'),
    join(home, '.config', 'openclaw', 'plugins'),
  ];
  for (const dir of pluginDirs) {
    if (existsSync(dir)) {
      try {
        const entries = readFileSync('/dev/null', 'utf8'); // dummy, actual scan below
        const { readdirSync } = require('node:fs');
        const items = readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          if (item.isDirectory()) {
            paths.push(join(dir, item.name, 'plugin.json'));
            paths.push(join(dir, item.name, 'package.json'));
          }
        }
      } catch {
        // 目录不存在或不可读
      }
    }
  }

  return paths;
}

// ═══════════════════════════════════════════════════════════
// 配置解析
// ═══════════════════════════════════════════════════════════

function tryReadConfig(filePath: string): OpenClawConfig | null {
  try {
    if (!existsSync(filePath)) return null;

    // .openclawrc 是纯 JSON 文件
    const content = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content) as OpenClawConfig;

    // 验证基本结构
    if (!parsed.plugins && !parsed.ecosystem) return parsed;

    // 规范化插件定义
    if (parsed.plugins) {
      for (const p of parsed.plugins) {
        if (!p.name || !p.command) {
          console.warn(`[OpenClaw] 跳过无效插件定义: ${JSON.stringify(p)}`);
        }
      }
    }

    return parsed;
  } catch (err) {
    console.warn(`[OpenClaw] 读取配置失败 ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * 尝试从 package.json 中提取 OpenClaw 插件信息
 */
function tryReadPackageJsonAsPlugin(filePath: string): OpenClawPluginDef | null {
  try {
    if (!existsSync(filePath)) return null;
    const content = readFileSync(filePath, 'utf8');
    const pkg = JSON.parse(content);

    // 检查是否是 OpenClaw 插件（通过 keywords 或 pi 字段）
    const keywords: string[] = pkg.keywords ?? [];
    if (!keywords.includes('openclaw-plugin') && !keywords.includes('openclaw') && !pkg.openclaw) {
      return null;
    }

    const openclawMeta = pkg.openclaw ?? {};
    const bin = pkg.bin;
    const binCommand = typeof bin === 'string' ? bin :
                       bin && typeof bin === 'object' ? Object.values(bin)[0] as string : null;

    return {
      name: pkg.name ?? 'unknown',
      description: pkg.description,
      command: openclawMeta.command ?? 'npx',
      args: openclawMeta.args ?? (binCommand ? [pkg.name] : [pkg.name]),
      version: pkg.version,
      author: pkg.author,
      source: 'npm',
      autoStart: openclawMeta.autoStart ?? false,
      securityTrit: openclawMeta.securityTrit ?? 0,
    };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// OpenClawPluginScanner — 插件扫描器
// ═══════════════════════════════════════════════════════════

export interface ScanOptions {
  /** 额外的配置文件路径 */
  extraPaths?: string[];
  /** 是否包含项目级 .openclaw.json */
  includeProjectConfig?: boolean;
}

export interface ScanResult {
  plugins: OpenClawPluginEntry[];
  configFiles: string[];
  ecosystems: OpenClawEcosystemConfig[];
  errors: string[];
}

export class OpenClawPluginScanner {
  /**
   * 全面扫描 OpenClaw 插件
   */
  scan(options: ScanOptions = {}): ScanResult {
    const configFiles: string[] = [];
    const plugins: OpenClawPluginEntry[] = [];
    const ecosystems: OpenClawEcosystemConfig[] = [];
    const errors: string[] = [];

    // 收集所有候选路径
    const paths = [...getStandardPaths(), ...(options.extraPaths ?? [])];

    // 去重
    const uniquePaths = [...new Set(paths)];

    for (const filePath of uniquePaths) {
      try {
        // 尝试作为 OpenClaw 配置解析
        const config = tryReadConfig(filePath);
        if (config) {
          configFiles.push(filePath);

          if (config.ecosystem) {
            ecosystems.push(config.ecosystem);
          }

          if (config.plugins) {
            for (const def of config.plugins) {
              if (!def.name || !def.command) {
                errors.push(`配置 ${filePath} 中有无效插件定义（缺少 name 或 command）`);
                continue;
              }
              plugins.push({
                def,
                sourcePath: filePath,
                configStatus: def.securityTrit === -1 ? 'disabled' : 'enabled',
                resolveStatus: 'resolved',
              });
            }
          }
          continue;
        }

        // 尝试作为 package.json（单插件）解析
        if (filePath.endsWith('package.json')) {
          const pluginDef = tryReadPackageJsonAsPlugin(filePath);
          if (pluginDef) {
            configFiles.push(filePath);
            plugins.push({
              def: pluginDef,
              sourcePath: filePath,
              configStatus: pluginDef.securityTrit === -1 ? 'disabled' : 'enabled',
              resolveStatus: 'resolved',
            });
          }
        }
      } catch (err) {
        errors.push(`扫描 ${filePath} 出错: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 去重（按 name）
    const seen = new Set<string>();
    const uniquePlugins = plugins.filter(p => {
      if (seen.has(p.def.name)) return false;
      seen.add(p.def.name);
      return true;
    });

    return {
      plugins: uniquePlugins,
      configFiles,
      ecosystems,
      errors,
    };
  }
}

// ═══════════════════════════════════════════════════════════
// OpenClawPluginManager — 插件生命周期管理
// ═══════════════════════════════════════════════════════════

export class OpenClawPluginManager {
  private scanner: OpenClawPluginScanner;
  private pool: MCPClientPool;
  private runtimes = new Map<string, OpenClawPluginRuntime>();
  private autoStartTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(pool: MCPClientPool) {
    this.scanner = new OpenClawPluginScanner();
    this.pool = pool;

    // 监听连接事件更新运行时状态
    this.pool.on('server_connected', (serverName: unknown) => {
      this.syncRuntime(String(serverName));
    });
    this.pool.on('server_disconnected', (serverName: unknown) => {
      this.syncRuntime(String(serverName));
    });
    this.pool.on('server_error', (serverName: unknown) => {
      const rt = this.runtimes.get(String(serverName));
      if (rt) rt.lastError = `Server error at ${new Date().toISOString()}`;
    });
  }

  /**
   * 扫描并自动启动所有 autoStart 的插件
   */
  async autoStart(options?: ScanOptions): Promise<{
    started: number;
    skipped: number;
    errors: string[];
  }> {
    const scanResult = this.scanner.scan(options);
    let started = 0;
    let skipped = 0;

    for (const entry of scanResult.plugins) {
      if (entry.configStatus === 'disabled') { skipped++; continue; }
      if (!entry.def.autoStart && entry.def.autoStart !== undefined && !entry.def.autoStart) { skipped++; continue; }

      try {
        await this.startPlugin(entry);
        started++;
      } catch (err) {
        scanResult.errors.push(`启动 ${entry.def.name} 失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { started, skipped, errors: scanResult.errors };
  }

  /**
   * 启动一个插件
   */
  async startPlugin(entry: OpenClawPluginEntry): Promise<OpenClawPluginRuntime> {
    const serverName = `openclaw:${entry.def.name}`;

    // 如果已在运行，先断开
    if (this.pool.get(serverName)) {
      await this.pool.remove(serverName).catch(() => {});
    }

    const config: MCPServerConfig = {
      command: entry.def.command,
      args: entry.def.args ?? [],
      env: entry.def.env,
      cwd: entry.def.cwd,
      name: serverName,
    };

    const client = await this.pool.register(config);
    await client.connect(30000);

    // 发现工具
    const tools = await client.listTools();

    const runtime: OpenClawPluginRuntime = {
      entry,
      serverName,
      connected: client.isConnected,
      toolCount: tools.length,
      startTime: Date.now(),
    };

    this.runtimes.set(serverName, runtime);
    return runtime;
  }

  /**
   * 停止一个插件
   */
  async stopPlugin(name: string): Promise<boolean> {
    const serverName = `openclaw:${name}`;
    const removed = await this.pool.remove(serverName).catch(() => false);
    this.runtimes.delete(serverName);
    return removed as boolean;
  }

  /**
   * 停止所有插件
   */
  async stopAll(): Promise<void> {
    const promises: Promise<boolean>[] = [];
    for (const [serverName] of this.runtimes) {
      promises.push(this.stopPlugin(serverName.replace('openclaw:', '')));
    }
    await Promise.allSettled(promises);
    this.runtimes.clear();
  }

  /**
   * 重新扫描并同步状态
   */
  async rescanAndSync(options?: ScanOptions): Promise<ScanResult> {
    const scanResult = this.scanner.scan(options);

    // 移除已经不存在的插件运行时
    const configuredNames = new Set(scanResult.plugins.map(p => `openclaw:${p.def.name}`));
    for (const [serverName] of this.runtimes) {
      if (!configuredNames.has(serverName)) {
        await this.pool.remove(serverName).catch(() => {});
        this.runtimes.delete(serverName);
      }
    }

    // 同步运行时状态
    for (const entry of scanResult.plugins) {
      this.syncRuntime(`openclaw:${entry.def.name}`, entry);
    }

    return scanResult;
  }

  /**
   * 获取所有插件运行时状态
   */
  getRuntimes(): OpenClawPluginRuntime[] {
    return Array.from(this.runtimes.values());
  }

  /**
   * 获取健康概览
   */
  getHealthSummary(): { total: number; connected: number; tools: number; errors: string[] } {
    const runtimes = this.getRuntimes();
    return {
      total: runtimes.length,
      connected: runtimes.filter(r => r.connected).length,
      tools: runtimes.reduce((s, r) => s + r.toolCount, 0),
      errors: runtimes.filter(r => r.lastError).map(r => `${r.entry.def.name}: ${r.lastError!}`),
    };
  }

  // ─── 内部 ───

  private syncRuntime(serverName: string, entry?: OpenClawPluginEntry): void {
    const client = this.pool.get(serverName);
    if (!client) {
      this.runtimes.delete(serverName);
      return;
    }

    const existing = this.runtimes.get(serverName);
    this.runtimes.set(serverName, {
      entry: entry ?? existing?.entry ?? {
        def: { name: serverName.replace('openclaw:', ''), command: 'unknown' },
        sourcePath: 'runtime',
        configStatus: 'enabled',
        resolveStatus: 'resolved',
      },
      serverName,
      connected: client.isConnected,
      toolCount: client.tools.length,
      startTime: existing?.startTime,
      lastError: client.isConnected ? undefined : existing?.lastError,
    });
  }
}

// ═══════════════════════════════════════════════════════════
// 网关生命周期管理
// ═══════════════════════════════════════════════════════════

export interface GatewayStatus {
  running: boolean;
  url: string;
  pid?: number;
  plugins: number;
  channels: number;
  errors: string[];
}

/**
 * 检测 openclaw 网关是否运行
 */
export async function checkGateway(): Promise<GatewayStatus> {
  try {
    const { execSync } = await import('node:child_process');
    const out = execSync('openclaw status 2>&1', { encoding: 'utf8', timeout: 10000 });
    const running = out.includes('Gateway') && !out.includes('unreachable');
    const pluginCount = (out.match(/plugin/gi) || []).length;
    const channelCount = (out.match(/channel/gi) || []).length;
    return {
      running,
      url: 'ws://127.0.0.1:18789',
      plugins: pluginCount,
      channels: channelCount,
      errors: [],
    };
  } catch (e: any) {
    return { running: false, url: '', plugins: 0, channels: 0, errors: [e.message || String(e)] };
  }
}

/**
 * 初始化 OpenClaw 网关（首次配置）
 */
export async function setupGateway(mode: 'local' | 'cloud' = 'local'): Promise<boolean> {
  try {
    const { execSync } = await import('node:child_process');
    execSync(`openclaw onboard --mode ${mode} 2>&1`, { encoding: 'utf8', timeout: 30000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * 启动 OpenClaw 网关
 */
export async function startGateway(): Promise<boolean> {
  try {
    const { execSync, spawn } = await import('node:child_process');
    // 检查是否已配置
    const status = await checkGateway();
    if (status.running) return true;

    // 后台启动
    const proc = spawn('openclaw', ['gateway'], {
      detached: true,
      stdio: 'ignore',
    });
    proc.unref();

    // 等待启动
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const s = await checkGateway();
      if (s.running) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * 安装 OpenClaw 插件
 */
export async function installPlugin(name: string): Promise<boolean> {
  try {
    const { execSync } = await import('node:child_process');
    execSync(`openclaw plugins install ${name} 2>&1`, { encoding: 'utf8', timeout: 60000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * 添加微信通道并获取登录二维码
 * 返回二维码文本（可供终端显示）
 */
export async function addWeChatChannel(): Promise<{ success: boolean; qrcode?: string; url?: string }> {
  try {
    const { execSync } = await import('node:child_process');
    const out = execSync('openclaw channel add weixin 2>&1', { encoding: 'utf8', timeout: 30000 });

    // 提取二维码（ASCII art 区域）
    const qrMatch = out.match(/▄[\s\S]*?▄/);
    const urlMatch = out.match(/https?:\/\/[^\s]+/);

    return {
      success: true,
      qrcode: qrMatch ? qrMatch[0] : undefined,
      url: urlMatch ? urlMatch[0] : undefined,
    };
  } catch (e: any) {
    return { success: false };
  }
}

/**
 * 获取 OpenClaw 插件列表
 */
export async function listPlugins(): Promise<{ name: string; version: string; enabled: boolean }[]> {
  try {
    const { execSync } = await import('node:child_process');
    const out = execSync('openclaw plugins list 2>&1', { encoding: 'utf8', timeout: 10000 });
    const plugins: { name: string; version: string; enabled: boolean }[] = [];
    for (const line of out.split('\n')) {
      const m = line.match(/^[│ ]*([\w-@/]+)\s+([\d.]+)\s+(yes|no)/);
      if (m) {
        plugins.push({ name: m[1]!, version: m[2]!, enabled: m[3] === 'yes' });
      }
    }
    return plugins;
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════
// 工具函数：创建示例 openclaw.json 配置文件
// ═══════════════════════════════════════════════════════════

/**
 * 生成一个示例 OpenClaw 配置（供用户参考）
 */
export function generateSampleConfig(): string {
  const sample: OpenClawConfig = {
    plugins: [
      {
        name: 'wechat',
        description: '微信插件 — 消息收发与联系人管理',
        command: 'npx',
        args: ['@openclaw/plugin-wechat'],
        autoStart: true,
        securityTrit: 0,
        source: 'npm',
      },
      {
        name: 'xiaoyi',
        description: '小艺插件 — 语音助手与设备控制',
        command: 'npx',
        args: ['@openclaw/plugin-xiaoyi'],
        autoStart: false,
        securityTrit: 0,
        source: 'npm',
      },
      {
        name: 'filesystem',
        description: '文件系统 MCP Server',
        command: 'npx',
        args: ['@modelcontextprotocol/server-filesystem@0.6.2', '/tmp', '/root'],
        autoStart: true,
        securityTrit: 1,
        source: 'npm',
      },
    ],
    ecosystem: {
      registryUrl: 'https://clawhub.openclaw.dev',
      autoUpdate: false,
      checkInterval: 3600,
    },
  };

  return JSON.stringify(sample, null, 2);
}

// ═══════════════════════════════════════════════════════════
// 导出
// ═══════════════════════════════════════════════════════════

export { MCPClientPool } from './mcp-client.js';
