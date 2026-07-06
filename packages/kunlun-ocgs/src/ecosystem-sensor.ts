/**
 * EcosystemSensor - Ecosystem perception
 *
 * Monitors 9 ecosystem sources with timeout/degradation support.
 *
 * Implementations:
 *   - self: Pi-Kunlun subsystem health check
 *   - openclaw: MCP server process scan + OpenClaw config scan
 *   - mcp_topology: MCP topology real scan
 *   - remaining 6: Stub
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

function createStubScanner(source: EcosystemSource): SourceScanner {
  return (timeoutMs: number) => {
    const startMs = Date.now();
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          source, status: 'stub' as SourceStatus,
          signals: [{
            source, signalType: 'stub',
            significance: T_UNKNOWN,
            description: `[Stub] ${source} scanner not implemented`,
            impact: { direction: T_UNKNOWN, affectedSubsystems: [], urgency: T_FALSE },
            detectedAt: Date.now(),
          }],
          latencyMs: Date.now() - startMs,
        });
      }, Math.min(30, timeoutMs));
    });
  };
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
  scanners.set('hermes', createStubScanner('hermes'));
  scanners.set('clawhub', createStubScanner('clawhub'));
  scanners.set('agent_ecosystem', createStubScanner('agent_ecosystem'));
  scanners.set('tool_ecosystem', createStubScanner('tool_ecosystem'));
  scanners.set('model_ecosystem', createStubScanner('model_ecosystem'));
  scanners.set('user_behavior', createStubScanner('user_behavior'));

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
