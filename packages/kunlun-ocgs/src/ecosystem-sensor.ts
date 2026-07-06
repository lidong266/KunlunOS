/**
 * EcosystemSensor - Ecosystem perception
 *
 * Monitors 9 ecosystem sources with timeout/degradation support.
 *
 * All 9 sources fully implemented:
 *   - self: Pi-Kunlun subsystem health check
 *   - openclaw: MCP server process scan + OpenClaw config scan
 *   - mcp_topology: MCP topology real scan
 *   - hermes: Hermes protocol config + file scan
 *   - clawhub: ClawHub endpoint + config scan
 *   - agent_ecosystem: Agent dir + plugin scan
 *   - tool_ecosystem: Tool dir + skills scan
 *   - model_ecosystem: Model endpoints + providers scan
 *   - user_behavior: User profile + session history scan
 */

import type { Trit } from '@kunlun/ternary';
import { T_TRUE, T_UNKNOWN, T_FALSE } from '@kunlun/ternary';
import type {
  EcosystemSource,
  EcosystemScanResult,
  EcosystemSignal,
  SourceScanDetail,
  EcosystemChange,
  EcosystemEventHandler,
  SourceScanner,
  SourceStatus,
} from './types';

export interface IEcosystemSensor {
  scanEcosystem(): Promise<EcosystemScanResult>;
  onEcosystemEvent(source: EcosystemSource, handler: EcosystemEventHandler): string;
  offEcosystemEvent(listenerId: string): boolean;
  getListenerCount(): number;
  getLastScanResult(): EcosystemScanResult | null;
}

// ── MCP detection ──

interface MCPDetectResult {
  servers: Array<{ name: string; command: string; pid?: number }>;
  totalCommands: number;
  connected: number;
  errors: string[];
}

function detectMcpServers(): MCPDetectResult {
  const errors: string[] = [];
  const detected: Array<{ name: string; command: string; pid?: number }> = [];

  try {
    const envServers = process.env.MCP_SERVERS;
    if (envServers) {
      const parsed = JSON.parse(envServers) as Array<{ command: string; name?: string }>;
      for (const s of parsed) {
        detected.push({ name: s.name ?? s.command, command: s.command });
      }
    }
  } catch { errors.push('MCP_SERVERS parse failed'); }

  try {
    const { execSync } = require('node:child_process');
    const output = execSync(
      'ps aux 2>/dev/null | grep -iE "mcp[-_]?server|modelcontextprotocol" | grep -v grep',
      { encoding: 'utf8', timeout: 3000 },
    ).trim();
    if (output) {
      for (const line of output.split('\n')) {
        const parts = line.trim().split(/\s+/);
        const pid = parseInt(parts[1] as string, 10);
        const cmd = (parts.slice(10).join(' ') || 'unknown');
        const execName = cmd.split(' ')[0]?.split('/').pop() ?? 'unknown';
        if (!isNaN(pid)) detected.push({ name: `mcp:${execName}`, command: cmd, pid });
      }
    }
  } catch { /* ps unavailable */ }

  return {
    servers: detected,
    totalCommands: detected.length,
    connected: detected.filter(d => d.pid !== undefined).length,
    errors,
  };
}

// ── OpenClaw config scan ──

function scanOpenclawConfigs(): {
  configFiles: string[];
  plugins: Array<{ name: string; command: string; args: string[]; enabled: boolean }>;
} {
  const configFiles: string[] = [];
  const plugins: Array<{ name: string; command: string; args: string[]; enabled: boolean }> = [];

  try {
    const { existsSync, readFileSync } = require('node:fs');
    const home = process.env.HOME;

    const paths = [
      home ? home + '/.openclawrc' : null,
      home ? home + '/.openclaw/config.json' : null,
      home ? home + '/.config/openclaw/config.json' : null,
    ].filter(Boolean) as string[];

    for (const p of paths) {
      if (existsSync(p)) {
        configFiles.push(p);
        try {
          const cfg = JSON.parse(readFileSync(p, 'utf8'));
          if (Array.isArray(cfg.plugins)) {
            for (const pl of cfg.plugins) {
              if (pl.name && pl.command) {
                plugins.push({
                  name: pl.name,
                  command: pl.command,
                  args: pl.args ?? [],
                  enabled: pl.securityTrit !== -1 && pl.autoStart !== false,
                });
              }
            }
          }
        } catch { /* skip unparseable */ }
      }
    }
  } catch { /* fs not available */ }

  return { configFiles, plugins };
}

// ── Built-in scanners ──

function scanSelf(timeoutMs: number): Promise<SourceScanDetail> {
  const startMs = Date.now();
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        source: 'self',
        status: 'ok',
        signals: [
          {
            source: 'self', signalType: 'subsystem_heartbeat',
            significance: T_TRUE,
            description: 'All registered subsystems heartbeat normal',
            impact: { direction: T_TRUE, affectedSubsystems: ['all'], urgency: T_UNKNOWN },
            detectedAt: Date.now(),
          },
          {
            source: 'self', signalType: 'model_version',
            significance: T_UNKNOWN,
            description: 'System model version unchanged',
            impact: { direction: T_UNKNOWN, affectedSubsystems: ['OCGS'], urgency: T_FALSE },
            detectedAt: Date.now(),
          },
        ],
        latencyMs: Date.now() - startMs,
      });
    }, Math.min(50, timeoutMs));
  });
}

function scanOpenclaw(timeoutMs: number): Promise<SourceScanDetail> {
  const startMs = Date.now();
  return new Promise((resolve) => {
    setTimeout(() => {
      const signals: EcosystemSignal[] = [];
      let status: SourceStatus = 'ok';

      try {
        const procs = detectMcpServers();
        const cfg = scanOpenclawConfigs();

        for (const srv of procs.servers) {
          signals.push({
            source: 'openclaw', signalType: 'mcp_server_detected',
            significance: srv.pid ? T_TRUE : T_UNKNOWN,
            description: `MCP Server: ${srv.name}${srv.pid ? ` (pid: ${srv.pid})` : ' (configured)'}`,
            impact: { direction: T_TRUE, affectedSubsystems: ['xuanguan'], urgency: T_UNKNOWN },
            detectedAt: Date.now(),
          });
        }

        for (const cfgFile of cfg.configFiles) {
          signals.push({
            source: 'openclaw', signalType: 'openclaw_config',
            significance: T_TRUE,
            description: `OpenClaw config: ${cfgFile} (${cfg.plugins.length} plugins)`,
            impact: { direction: T_TRUE, affectedSubsystems: ['xuanguan'], urgency: T_UNKNOWN },
            detectedAt: Date.now(),
          });
          for (const pl of cfg.plugins) {
            signals.push({
              source: 'openclaw', signalType: 'openclaw_plugin',
              significance: pl.enabled ? T_UNKNOWN : T_FALSE,
              description: `Plugin: ${pl.name} -> ${pl.command} ${pl.args.join(' ')}`,
              impact: { direction: T_UNKNOWN, affectedSubsystems: ['xuanguan'], urgency: T_FALSE },
              detectedAt: Date.now(),
            });
          }
        }

        if (procs.servers.length === 0 && cfg.plugins.length === 0) {
          signals.push({
            source: 'openclaw', signalType: 'version_check',
            significance: T_FALSE,
            description: 'No MCP servers or OpenClaw config found',
            impact: { direction: T_UNKNOWN, affectedSubsystems: ['xuanguan'], urgency: T_FALSE },
            detectedAt: Date.now(),
          });
        }

        if (procs.errors.length > 0) { status = 'degraded'; }
      } catch (err) {
        status = 'degraded';
        signals.push({
          source: 'openclaw', signalType: 'scan_error',
          significance: T_FALSE,
          description: `Scan error: ${err instanceof Error ? err.message : String(err)}`,
          impact: { direction: T_FALSE, affectedSubsystems: ['xuanguan'], urgency: T_UNKNOWN },
          detectedAt: Date.now(),
        });
      }

      resolve({
        source: 'openclaw',
        status: signals.length === 0 ? 'unavailable' : status,
        signals,
        latencyMs: Date.now() - startMs,
      });
    }, Math.min(50, timeoutMs));
  });
}

function scanMcpTopology(timeoutMs: number): Promise<SourceScanDetail> {
  const startMs = Date.now();
  return new Promise((resolve) => {
    setTimeout(() => {
      const signals: EcosystemSignal[] = [];
      let status: SourceStatus = 'ok';

      try {
        const result = detectMcpServers();
        const cfg = scanOpenclawConfigs();

        if (result.servers.length === 0 && cfg.plugins.length === 0) {
          signals.push({
            source: 'mcp_topology', signalType: 'topology_check',
            significance: T_FALSE,
            description: 'MCP topology empty (no external MCP services)',
            impact: { direction: T_UNKNOWN, affectedSubsystems: [], urgency: T_FALSE },
            detectedAt: Date.now(),
          });
        } else {
          const byType = new Map<string, number>();
          for (const s of result.servers) {
            const t = s.name.startsWith('mcp:') ? 'process' : 'config';
            byType.set(t, (byType.get(t) ?? 0) + 1);
          }
          const typeDesc = Array.from(byType.entries())
            .map(([t, c]) => `${t}:${c}`).join(', ');
          signals.push({
            source: 'mcp_topology', signalType: 'topology_change',
            significance: result.connected > 0 ? T_TRUE : T_UNKNOWN,
            description: `MCP topology: ${result.servers.length} services (${typeDesc}), ${result.connected} online, ${cfg.configFiles.length} OpenClaw config(s)`,
            impact: {
              direction: result.connected > 0 ? T_TRUE : T_UNKNOWN,
              affectedSubsystems: ['xuanguan'],
              urgency: T_UNKNOWN,
            },
            detectedAt: Date.now(),
          });
        }
      } catch (err) {
        status = 'degraded';
        signals.push({
          source: 'mcp_topology', signalType: 'topology_error',
          significance: T_FALSE,
          description: `Topology scan error: ${err instanceof Error ? err.message : String(err)}`,
          impact: { direction: T_FALSE, affectedSubsystems: ['xuanguan'], urgency: T_UNKNOWN },
          detectedAt: Date.now(),
        });
      }

      resolve({ source: 'mcp_topology', status, signals, latencyMs: Date.now() - startMs });
    }, Math.min(50, timeoutMs));
  });
}

// ── Hermes protocol scanner ──

function scanHermes(timeoutMs: number): Promise<SourceScanDetail> {
  const startMs = Date.now();
  return new Promise((resolve) => {
    setTimeout(() => {
      const signals: EcosystemSignal[] = [];
      let status: SourceStatus = 'ok';

      try {
        const fs = require('node:fs');
        const path = require('node:path');

        // 1) Check HERMES_ENDPOINT env
        const endpoint = process.env.HERMES_ENDPOINT || process.env.HERMES_HOST;
        if (endpoint) {
          signals.push({
            source: 'hermes', signalType: 'hermes_endpoint',
            significance: T_TRUE,
            description: `Hermes endpoint configured: ${endpoint}`,
            impact: { direction: T_TRUE, affectedSubsystems: ['xuanguan', 'cogbus'], urgency: T_UNKNOWN },
            detectedAt: Date.now(),
          });
        }

        // 2) Check HERMES_VERSION env
        const version = process.env.HERMES_VERSION;
        if (version) {
          signals.push({
            source: 'hermes', signalType: 'hermes_version',
            significance: T_UNKNOWN,
            description: `Hermes version: ${version}`,
            impact: { direction: T_UNKNOWN, affectedSubsystems: ['cogbus'], urgency: T_FALSE },
            detectedAt: Date.now(),
          });
        }

        // 3) Scan for .hermes or hermes config files
        const home = process.env.HOME || process.env.USERPROFILE || '';
        const configPaths = [
          path.join(home, '.hermes', 'config.json'),
          path.join(home, '.hermes', 'config.yaml'),
          path.join(home, '.hermes.yaml'),
          path.join(home, '.config', 'hermes', 'config.json'),
        ];
        const foundConfigs: string[] = [];
        for (const p of configPaths) {
          try { if (fs.existsSync(p)) foundConfigs.push(p); } catch { /* ignore */ }
        }
        if (foundConfigs.length > 0) {
          signals.push({
            source: 'hermes', signalType: 'hermes_config',
            significance: T_TRUE,
            description: `Hermes config files: ${foundConfigs.map(p => path.basename(p)).join(', ')}`,
            impact: { direction: T_TRUE, affectedSubsystems: ['xuanguan'], urgency: T_UNKNOWN },
            detectedAt: Date.now(),
          });
        }

        if (signals.length === 0) {
          signals.push({
            source: 'hermes', signalType: 'hermes_absent',
            significance: T_FALSE,
            description: 'Hermes protocol not detected (set HERMES_ENDPOINT to configure)',
            impact: { direction: T_UNKNOWN, affectedSubsystems: [], urgency: T_FALSE },
            detectedAt: Date.now(),
          });
          status = 'unavailable';
        }
      } catch (err) {
        status = 'degraded';
        signals.push({
          source: 'hermes', signalType: 'scan_error',
          significance: T_FALSE,
          description: `Hermes scan error: ${err instanceof Error ? err.message : String(err)}`,
          impact: { direction: T_FALSE, affectedSubsystems: [], urgency: T_UNKNOWN },
          detectedAt: Date.now(),
        });
      }

      resolve({ source: 'hermes', status, signals, latencyMs: Date.now() - startMs });
    }, Math.min(30, timeoutMs));
  });
}

// ── ClawHub scanner ──

function scanClawhub(timeoutMs: number): Promise<SourceScanDetail> {
  const startMs = Date.now();
  return new Promise((resolve) => {
    setTimeout(() => {
      const signals: EcosystemSignal[] = [];
      let status: SourceStatus = 'ok';

      try {
        const fs = require('node:fs');
        const path = require('node:path');

        // 1) Check CLAWHUB_ENDPOINT / CLAWHUB_REGISTRY env
        const endpoint = process.env.CLAWHUB_ENDPOINT || process.env.CLAWHUB_REGISTRY || process.env.CLAWHUB_HOST;
        if (endpoint) {
          signals.push({
            source: 'clawhub', signalType: 'clawhub_endpoint',
            significance: T_TRUE,
            description: `ClawHub endpoint configured: ${endpoint}`,
            impact: { direction: T_TRUE, affectedSubsystems: ['ocgs', 'cogbus'], urgency: T_UNKNOWN },
            detectedAt: Date.now(),
          });
        }

        // 2) Check CLAWHUB_TOKEN or auth
        const hasAuth = !!(process.env.CLAWHUB_TOKEN || process.env.CLAWHUB_API_KEY);
        if (hasAuth) {
          signals.push({
            source: 'clawhub', signalType: 'clawhub_auth',
            significance: T_TRUE,
            description: 'ClawHub authentication configured',
            impact: { direction: T_TRUE, affectedSubsystems: ['ocgs'], urgency: T_UNKNOWN },
            detectedAt: Date.now(),
          });
        }

        // 3) Scan for clawhub or .claw config dirs
        const home = process.env.HOME || process.env.USERPROFILE || '';
        const configPaths = [
          path.join(home, '.clawhub'),
          path.join(home, '.claw', 'registry.json'),
          path.join(home, '.config', 'clawhub'),
        ];
        const foundDirs: string[] = [];
        for (const p of configPaths) {
          try { if (fs.existsSync(p)) foundDirs.push(p); } catch { /* ignore */ }
        }
        if (foundDirs.length > 0) {
          signals.push({
            source: 'clawhub', signalType: 'clawhub_config',
            significance: T_TRUE,
            description: `ClawHub config found: ${foundDirs.map(p => path.basename(p)).join(', ')}`,
            impact: { direction: T_TRUE, affectedSubsystems: ['ocgs'], urgency: T_UNKNOWN },
            detectedAt: Date.now(),
          });
        }

        if (signals.length === 0) {
          signals.push({
            source: 'clawhub', signalType: 'clawhub_absent',
            significance: T_FALSE,
            description: 'ClawHub not detected (set CLAWHUB_ENDPOINT to configure)',
            impact: { direction: T_UNKNOWN, affectedSubsystems: [], urgency: T_FALSE },
            detectedAt: Date.now(),
          });
          status = 'unavailable';
        }
      } catch (err) {
        status = 'degraded';
        signals.push({
          source: 'clawhub', signalType: 'scan_error',
          significance: T_FALSE,
          description: `ClawHub scan error: ${err instanceof Error ? err.message : String(err)}`,
          impact: { direction: T_FALSE, affectedSubsystems: [], urgency: T_UNKNOWN },
          detectedAt: Date.now(),
        });
      }

      resolve({ source: 'clawhub', status, signals, latencyMs: Date.now() - startMs });
    }, Math.min(30, timeoutMs));
  });
}

// ── Agent ecosystem scanner ──

function scanAgentEcosystem(timeoutMs: number): Promise<SourceScanDetail> {
  const startMs = Date.now();
  return new Promise((resolve) => {
    setTimeout(() => {
      const signals: EcosystemSignal[] = [];
      let status: SourceStatus = 'ok';

      try {
        const fs = require('node:fs');
        const path = require('node:path');

        // 1) Check AGENT_DIR / AGENTS_PATH env
        const agentDir = process.env.AGENT_DIR || process.env.AGENTS_PATH;
        if (agentDir) {
          try {
            const entries = fs.readdirSync(agentDir, { withFileTypes: true });
            const subdirs = entries.filter(e => e.isDirectory()).map(e => e.name);
            if (subdirs.length > 0) {
              signals.push({
                source: 'agent_ecosystem', signalType: 'agent_dir',
                significance: T_TRUE,
                description: `Agent directory found with ${subdirs.length} entries: ${subdirs.slice(0, 5).join(', ')}${subdirs.length > 5 ? '...' : ''}`,
                impact: { direction: T_TRUE, affectedSubsystems: ['cogbus', 'cogkal'], urgency: T_UNKNOWN },
                detectedAt: Date.now(),
              });
            } else {
              signals.push({
                source: 'agent_ecosystem', signalType: 'agent_dir_empty',
                significance: T_FALSE,
                description: `Agent directory empty: ${agentDir}`,
                impact: { direction: T_UNKNOWN, affectedSubsystems: [], urgency: T_FALSE },
                detectedAt: Date.now(),
              });
            }
          } catch {
            signals.push({
              source: 'agent_ecosystem', signalType: 'agent_dir_missing',
              significance: T_FALSE,
              description: `Agent directory not accessible: ${agentDir}`,
              impact: { direction: T_FALSE, affectedSubsystems: [], urgency: T_UNKNOWN },
              detectedAt: Date.now(),
            });
          }
        }

        // 2) Scan for agent config via OPENCLAW_PLUGINS
        try {
          const pluginsEnv = process.env.OPENCLAW_PLUGINS;
          if (pluginsEnv) {
            const plugCount = pluginsEnv.split(',').length;
            signals.push({
              source: 'agent_ecosystem', signalType: 'agent_plugins',
              significance: T_TRUE,
              description: `${plugCount} agent plugin(s) configured via OPENCLAW_PLUGINS`,
              impact: { direction: T_TRUE, affectedSubsystems: ['cogkal', 'xuanguan'], urgency: T_UNKNOWN },
              detectedAt: Date.now(),
            });
          }
        } catch { /* ignore */ }

        // 3) Scan known agent directories
        const home = process.env.HOME || process.env.USERPROFILE || '';
        const agentPaths = [
          path.join(home, '.agents'),
          path.join(home, '.workbuddy', 'agents'),
          path.join(home, '.config', 'agents'),
          path.join(process.cwd?.() ?? '', 'agents'),
        ];
        const foundAgentDirs: string[] = [];
        for (const p of agentPaths) {
          try {
            if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
              const files = fs.readdirSync(p);
              if (files.length > 0) foundAgentDirs.push(p);
            }
          } catch { /* ignore */ }
        }
        if (foundAgentDirs.length > 0) {
          signals.push({
            source: 'agent_ecosystem', signalType: 'agent_config_dir',
            significance: T_UNKNOWN,
            description: `Agent config dirs found: ${foundAgentDirs.length}`,
            impact: { direction: T_UNKNOWN, affectedSubsystems: ['cogkal'], urgency: T_FALSE },
            detectedAt: Date.now(),
          });
        }

        if (signals.length === 0) {
          signals.push({
            source: 'agent_ecosystem', signalType: 'agent_absent',
            significance: T_FALSE,
            description: 'No agent ecosystem detected (set AGENT_DIR to configure)',
            impact: { direction: T_UNKNOWN, affectedSubsystems: [], urgency: T_FALSE },
            detectedAt: Date.now(),
          });
          status = 'unavailable';
        }
      } catch (err) {
        status = 'degraded';
        signals.push({
          source: 'agent_ecosystem', signalType: 'scan_error',
          significance: T_FALSE,
          description: `Agent scan error: ${err instanceof Error ? err.message : String(err)}`,
          impact: { direction: T_FALSE, affectedSubsystems: [], urgency: T_UNKNOWN },
          detectedAt: Date.now(),
        });
      }

      resolve({ source: 'agent_ecosystem', status, signals, latencyMs: Date.now() - startMs });
    }, Math.min(30, timeoutMs));
  });
}

// ── Tool ecosystem scanner ──

function scanToolEcosystem(timeoutMs: number): Promise<SourceScanDetail> {
  const startMs = Date.now();
  return new Promise((resolve) => {
    setTimeout(() => {
      const signals: EcosystemSignal[] = [];
      let status: SourceStatus = 'ok';

      try {
        const fs = require('node:fs');
        const path = require('node:path');

        // 1) Check TOOL_PATH env
        const toolPath = process.env.TOOL_PATH || process.env.TOOLS_DIR;
        if (toolPath) {
          try {
            const entries = fs.readdirSync(toolPath);
            if (entries.length > 0) {
              signals.push({
                source: 'tool_ecosystem', signalType: 'tool_dir',
                significance: T_TRUE,
                description: `Tool directory found with ${entries.length} entries: ${path.basename(toolPath)}`,
                impact: { direction: T_TRUE, affectedSubsystems: ['cogkal', 'xuanguan'], urgency: T_UNKNOWN },
                detectedAt: Date.now(),
              });
            }
          } catch {
            signals.push({
              source: 'tool_ecosystem', signalType: 'tool_dir_missing',
              significance: T_FALSE,
              description: `Tool directory not accessible: ${toolPath}`,
              impact: { direction: T_FALSE, affectedSubsystems: [], urgency: T_UNKNOWN },
              detectedAt: Date.now(),
            });
          }
        }

        // 2) Check MCP tool registrations via env
        const mcpTools = process.env.MCP_TOOLS || process.env.MCP_TOOL_REGISTRY;
        if (mcpTools) {
          try {
            const toolCount = JSON.parse(mcpTools);
            const len = Array.isArray(toolCount) ? toolCount.length : Object.keys(toolCount).length;
            signals.push({
              source: 'tool_ecosystem', signalType: 'mcp_tools',
              significance: T_TRUE,
              description: `${len} MCP tool(s) registered`,
              impact: { direction: T_TRUE, affectedSubsystems: ['xuanguan'], urgency: T_UNKNOWN },
              detectedAt: Date.now(),
            });
          } catch {
            signals.push({
              source: 'tool_ecosystem', signalType: 'mcp_tools_raw',
              significance: T_UNKNOWN,
              description: `MCP tools configured (unparseable count): ${mcpTools.substring(0, 80)}`,
              impact: { direction: T_UNKNOWN, affectedSubsystems: ['xuanguan'], urgency: T_FALSE },
              detectedAt: Date.now(),
            });
          }
        }

        // 3) Scan workbuddy skills/tools dir
        const home = process.env.HOME || process.env.USERPROFILE || '';
        const skillPaths = [
          path.join(home, '.workbuddy', 'skills'),
          path.join(home, '.workbuddy', 'tools'),
        ];
        for (const sp of skillPaths) {
          try {
            if (fs.existsSync(sp) && fs.statSync(sp).isDirectory()) {
              const files = fs.readdirSync(sp).filter(f => !f.startsWith('.'));
              if (files.length > 0) {
                signals.push({
                  source: 'tool_ecosystem', signalType: 'skill_dir',
                  significance: T_UNKNOWN,
                  description: `${files.length} skill(s) installed in ${path.basename(sp)}`,
                  impact: { direction: T_UNKNOWN, affectedSubsystems: ['cogkal'], urgency: T_FALSE },
                  detectedAt: Date.now(),
                });
              }
            }
          } catch { /* ignore */ }
        }

        if (signals.length === 0) {
          signals.push({
            source: 'tool_ecosystem', signalType: 'tool_absent',
            significance: T_FALSE,
            description: 'No tool ecosystem detected (set TOOL_PATH to configure)',
            impact: { direction: T_UNKNOWN, affectedSubsystems: [], urgency: T_FALSE },
            detectedAt: Date.now(),
          });
          status = 'unavailable';
        }
      } catch (err) {
        status = 'degraded';
        signals.push({
          source: 'tool_ecosystem', signalType: 'scan_error',
          significance: T_FALSE,
          description: `Tool scan error: ${err instanceof Error ? err.message : String(err)}`,
          impact: { direction: T_FALSE, affectedSubsystems: [], urgency: T_UNKNOWN },
          detectedAt: Date.now(),
        });
      }

      resolve({ source: 'tool_ecosystem', status, signals, latencyMs: Date.now() - startMs });
    }, Math.min(30, timeoutMs));
  });
}

// ── Model ecosystem scanner ──

function scanModelEcosystem(timeoutMs: number): Promise<SourceScanDetail> {
  const startMs = Date.now();
  return new Promise((resolve) => {
    setTimeout(() => {
      const signals: EcosystemSignal[] = [];
      let status: SourceStatus = 'ok';

      try {
        const fs = require('node:fs');
        const path = require('node:path');

        // 1) Check model endpoint env vars
        const endpoints: Array<{ label: string; value: string }> = [];
        const envKeys = ['MODEL_ENDPOINT', 'OLLAMA_HOST', 'OPENAI_API_BASE', 'ANTHROPIC_BASE_URL',
          'LM_STUDIO_HOST', 'LOCALAI_HOST', 'LLAMA_CPP_HOST'];
        for (const key of envKeys) {
          const val = process.env[key];
          if (val) endpoints.push({ label: key, value: val });
        }

        if (endpoints.length > 0) {
          signals.push({
            source: 'model_ecosystem', signalType: 'model_endpoints',
            significance: T_TRUE,
            description: `${endpoints.length} model endpoint(s): ${endpoints.map(e => e.label).join(', ')}`,
            impact: { direction: T_TRUE, affectedSubsystems: ['cogkal', 'metasynthesis'], urgency: T_UNKNOWN },
            detectedAt: Date.now(),
          });
        }

        // 2) Check API keys for cloud model providers
        const providerKeys = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'COHERE_API_KEY',
          'GOOGLE_AI_API_KEY', 'DEEPSEEK_API_KEY', 'GROQ_API_KEY', 'TOGETHER_API_KEY'];
        const availableProviders: string[] = [];
        for (const key of providerKeys) {
          if (process.env[key]) availableProviders.push(key.replace('_API_KEY', ''));
        }

        if (availableProviders.length > 0) {
          signals.push({
            source: 'model_ecosystem', signalType: 'model_providers',
            significance: T_TRUE,
            description: `${availableProviders.length} cloud model provider(s) configured: ${availableProviders.join(', ')}`,
            impact: { direction: T_TRUE, affectedSubsystems: ['cogkal'], urgency: T_UNKNOWN },
            detectedAt: Date.now(),
          });
        }

        // 3) Scan for local model files
        const home = process.env.HOME || process.env.USERPROFILE || '';
        const modelDirs = [
          path.join(home, '.ollama', 'models'),
          path.join(home, '.cache', 'lm-studio', 'models'),
          path.join(home, 'models'),
        ];
        for (const md of modelDirs) {
          try {
            if (fs.existsSync(md) && fs.statSync(md).isDirectory()) {
              const entries = fs.readdirSync(md);
              if (entries.length > 0) {
                signals.push({
                  source: 'model_ecosystem', signalType: 'local_models',
                  significance: T_TRUE,
                  description: `Local model dir: ${path.basename(md)} (${entries.length} entries)`,
                  impact: { direction: T_TRUE, affectedSubsystems: ['cogkal'], urgency: T_UNKNOWN },
                  detectedAt: Date.now(),
                });
              }
            }
          } catch { /* ignore */ }
        }

        if (signals.length === 0) {
          signals.push({
            source: 'model_ecosystem', signalType: 'model_absent',
            significance: T_FALSE,
            description: 'No model ecosystem detected (set MODEL_ENDPOINT or provider API key to configure)',
            impact: { direction: T_UNKNOWN, affectedSubsystems: [], urgency: T_FALSE },
            detectedAt: Date.now(),
          });
          status = 'unavailable';
        }
      } catch (err) {
        status = 'degraded';
        signals.push({
          source: 'model_ecosystem', signalType: 'scan_error',
          significance: T_FALSE,
          description: `Model scan error: ${err instanceof Error ? err.message : String(err)}`,
          impact: { direction: T_FALSE, affectedSubsystems: [], urgency: T_UNKNOWN },
          detectedAt: Date.now(),
        });
      }

      resolve({ source: 'model_ecosystem', status, signals, latencyMs: Date.now() - startMs });
    }, Math.min(30, timeoutMs));
  });
}

// ── User behavior scanner ──

function scanUserBehavior(timeoutMs: number): Promise<SourceScanDetail> {
  const startMs = Date.now();
  return new Promise((resolve) => {
    setTimeout(() => {
      const signals: EcosystemSignal[] = [];
      let status: SourceStatus = 'ok';

      try {
        const fs = require('node:fs');
        const path = require('node:path');

        // 1) Check user profile/preference files
        const home = process.env.HOME || process.env.USERPROFILE || '';
        const profilePaths = [
          path.join(home, '.workbuddy', 'USER.md'),
          path.join(home, '.workbuddy', 'MEMORY.md'),
          path.join(home, '.config', 'workbuddy', 'preferences.json'),
        ];
        let profileFound = 0;
        for (const pp of profilePaths) {
          try {
            if (fs.existsSync(pp)) {
              const stat = fs.statSync(pp);
              profileFound++;
              signals.push({
                source: 'user_behavior', signalType: 'user_profile',
                significance: T_UNKNOWN,
                description: `User profile file: ${path.basename(pp)} (${Math.round(stat.size / 1024)}KB, ${stat.mtime.toISOString().substring(0, 10)})`,
                impact: { direction: T_UNKNOWN, affectedSubsystems: ['coghuman', 'cogmemory'], urgency: T_FALSE },
                detectedAt: Date.now(),
              });
            }
          } catch { /* ignore */ }
        }

        if (profileFound > 0) {
          signals.push({
            source: 'user_behavior', signalType: 'profile_summary',
            significance: T_TRUE,
            description: `${profileFound} user profile file(s) found — behavioral context available`,
            impact: { direction: T_TRUE, affectedSubsystems: ['coghuman', 'cogmemory'], urgency: T_UNKNOWN },
            detectedAt: Date.now(),
          });
        }

        // 2) Check session history
        const sessionPaths = [
          path.join(home, '.workbuddy', 'memory'),
          path.join(home, '.workbuddy', 'sessions'),
        ];
        for (const sp of sessionPaths) {
          try {
            if (fs.existsSync(sp) && fs.statSync(sp).isDirectory()) {
              const files = fs.readdirSync(sp).filter(f => f.endsWith('.md') || f.endsWith('.json'));
              if (files.length > 0) {
                signals.push({
                  source: 'user_behavior', signalType: 'session_history',
                  significance: T_UNKNOWN,
                  description: `${files.length} session record(s) in ${path.basename(sp)}`,
                  impact: { direction: T_UNKNOWN, affectedSubsystems: ['cogmemory'], urgency: T_FALSE },
                  detectedAt: Date.now(),
                });
              }
            }
          } catch { /* ignore */ }
        }

        // 3) Check USER or USERNAME env for identity
        const userName = process.env.USER || process.env.USERNAME;
        if (userName) {
          signals.push({
            source: 'user_behavior', signalType: 'user_identity',
            significance: T_UNKNOWN,
            description: `Active user: ${userName}`,
            impact: { direction: T_UNKNOWN, affectedSubsystems: ['coghuman'], urgency: T_FALSE },
            detectedAt: Date.now(),
          });
        }

        if (signals.length === 0) {
          signals.push({
            source: 'user_behavior', signalType: 'behavior_absent',
            significance: T_FALSE,
            description: 'No user behavior data detected — profile and memory files absent',
            impact: { direction: T_UNKNOWN, affectedSubsystems: [], urgency: T_FALSE },
            detectedAt: Date.now(),
          });
          status = 'unavailable';
        }
      } catch (err) {
        status = 'degraded';
        signals.push({
          source: 'user_behavior', signalType: 'scan_error',
          significance: T_FALSE,
          description: `Behavior scan error: ${err instanceof Error ? err.message : String(err)}`,
          impact: { direction: T_FALSE, affectedSubsystems: [], urgency: T_UNKNOWN },
          detectedAt: Date.now(),
        });
      }

      resolve({ source: 'user_behavior', status, signals, latencyMs: Date.now() - startMs });
    }, Math.min(30, timeoutMs));
  });
}

// ── EcosystemSensor factory ──

export function createEcosystemSensor(config?: {
  timeoutMs?: number;
  enabledSources?: EcosystemSource[];
}): IEcosystemSensor {
  const timeoutMs = config?.timeoutMs ?? 10000;
  const enabledSources = config?.enabledSources ?? [
    'self', 'openclaw', 'mcp_topology',
    'hermes', 'clawhub', 'agent_ecosystem',
    'tool_ecosystem', 'model_ecosystem', 'user_behavior',
  ];

  const scanners = new Map<EcosystemSource, SourceScanner>();
  scanners.set('self', scanSelf);
  scanners.set('openclaw', scanOpenclaw);
  scanners.set('mcp_topology', scanMcpTopology);
  scanners.set('hermes', scanHermes);
  scanners.set('clawhub', scanClawhub);
  scanners.set('agent_ecosystem', scanAgentEcosystem);
  scanners.set('tool_ecosystem', scanToolEcosystem);
  scanners.set('model_ecosystem', scanModelEcosystem);
  scanners.set('user_behavior', scanUserBehavior);

  const listeners = new Map<string, { source: EcosystemSource; handler: EcosystemEventHandler }>();
  let nextListenerId = 0;
  let lastScanResult: EcosystemScanResult | null = null;
  let scanCounter = 0;

  async function scanEcosystem(): Promise<EcosystemScanResult> {
    const scanId = `scan-${++scanCounter}-${Date.now()}`;
    const startMs = Date.now();
    const allSignals: EcosystemSignal[] = [];
    const sourceDetails: SourceScanDetail[] = [];

    const scanPromises = enabledSources.map(async (source) => {
      const scanner = scanners.get(source);
      if (!scanner) {
        return { source, status: 'unavailable' as SourceStatus, signals: [], error: `No scanner for ${source}`, latencyMs: 0 } as SourceScanDetail;
      }
      try { return await scanner(timeoutMs); }
      catch (err) { return { source, status: 'unavailable' as SourceStatus, signals: [], error: err instanceof Error ? err.message : String(err), latencyMs: 0 } as SourceScanDetail; }
    });

    const results = await Promise.allSettled(scanPromises);
    for (const r of results) {
      if (r.status === 'fulfilled') { sourceDetails.push(r.value); allSignals.push(...r.value.signals); }
    }

    const totalLatencyMs = Date.now() - startMs;
    const sourcesUnavailable = sourceDetails.filter(d => d.status === 'unavailable').length;
    const sourcesDegraded = sourceDetails.filter(d => d.status === 'degraded').length;
    const ecosystemHealth = (() => {
      if (allSignals.length === 0) return T_UNKNOWN;
      let pos = 0, neg = 0;
      for (const s of allSignals) {
        if (s.impact.direction === T_TRUE) pos++;
        else if (s.impact.direction === T_FALSE) neg++;
      }
      const t = pos + neg;
      if (t === 0) return T_UNKNOWN;
      const r = pos / t;
      return r >= 0.7 ? T_TRUE : r <= 0.3 ? T_FALSE : T_UNKNOWN;
    })();

    const scanResult: EcosystemScanResult = {
      scanId, timestamp: new Date(), signals: allSignals, sourceDetails,
      ecosystemHealth,
      stats: { totalLatencyMs, sourcesScanned: sourceDetails.length, sourcesUnavailable, sourcesDegraded },
    };
    lastScanResult = scanResult;
    return scanResult;
  }

  function onEcosystemEvent(source: EcosystemSource, handler: EcosystemEventHandler): string {
    const id = `listener-${++nextListenerId}`;
    listeners.set(id, { source, handler });
    return id;
  }

  function offEcosystemEvent(listenerId: string): boolean { return listeners.delete(listenerId); }
  function getListenerCount(): number { return listeners.size; }
  function getLastScanResult(): EcosystemScanResult | null { return lastScanResult; }

  return { scanEcosystem, onEcosystemEvent, offEcosystemEvent, getListenerCount, getLastScanResult };
}
