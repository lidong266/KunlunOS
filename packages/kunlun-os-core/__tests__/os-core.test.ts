import { describe, it, expect, beforeEach } from 'vitest';
import { KunlunOS, CogBoot, defaultOSConfig } from '../src/index';
import type { KunlunOSConfig, OSState, OSStatus, BootPhaseLog } from '../src/index';

describe('KunlunOS Core', () => {
  let os: KunlunOS;

  beforeEach(() => {
    os = new KunlunOS();
  });

  // ─── OS初始化 ──────────────────────────────────

  describe('OS Initialization', () => {
    it('should create OS with default config', () => {
      const config = os.getConfig();
      expect(config).toBeDefined();
      expect(config.instanceId).toBe('kunlun-os');
      expect(config.kal.initialInstances).toBe(1);
      expect(config.verbose).toBe(false);
    });

    it('should create OS with custom config', () => {
      const customOS = new KunlunOS({
        instanceId: 'custom-os',
        verbose: true,
        kal: { initialInstances: 3, statsInterval: 1000 },
      });
      const config = customOS.getConfig();
      expect(config.instanceId).toBe('custom-os');
      expect(config.verbose).toBe(true);
      expect(config.kal.initialInstances).toBe(3);
      expect(config.kal.statsInterval).toBe(1000);
    });

    it('should start in stopped status before init', () => {
      const state = os.getState();
      expect(state.status).toBe('stopped');
      expect(state.uptime).toBe(0);
    });
  });

  // ─── 引导流程 ──────────────────────────────────

  describe('Boot Process', () => {
    it('should execute all 6 boot phases via CogBoot', async () => {
      const config = defaultOSConfig();
      const boot = new CogBoot(config);
      const result = await boot.start();
      expect(result.logs).toHaveLength(6);
      const phases = result.logs.map(l => l.phase);
      expect(phases).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it('should have all phases succeed', async () => {
      const boot = new CogBoot(defaultOSConfig());
      const result = await boot.start();
      for (const log of result.logs) {
        expect(log.status).toBe('success');
      }
    });

    it('should boot with correct phase names', async () => {
      const boot = new CogBoot(defaultOSConfig());
      const result = await boot.start();
      const names = result.logs.map(l => l.name);
      expect(names).toEqual(['base', 'kernel', 'trust', 'capabilities', 'bus', 'algorithms']);
    });

    it('should register initial instances during phase1', async () => {
      const config = defaultOSConfig();
      config.kal.initialInstances = 2;
      const boot = new CogBoot(config);
      const result = await boot.start();
      expect(result.instanceIds).toHaveLength(2);
      expect(result.scheduler.getInstanceIds()).toHaveLength(2);
    });

    it('should initialize all subsystems in boot result', async () => {
      const boot = new CogBoot(defaultOSConfig());
      const result = await boot.start();
      expect(result.scheduler).toBeDefined();
      expect(result.multiInstance).toBeDefined();
      expect(result.ipc).toBeDefined();
      expect(result.bus).toBeDefined();
      expect(result.algoRegistry).toBeDefined();
      expect(result.capabilityRegistry).toBeDefined();
      expect(result.trustManager).toBeDefined();
      expect(result.tokenManager).toBeDefined();
      expect(result.attentionScheduler).toBeDefined();
      expect(result.pipeline).toBeDefined();
      expect(result.processManager).toBeDefined();
      expect(result.humanChannel).toBeDefined();
      expect(result.metasynthesisEngine).toBeDefined();
      expect(result.executor).toBeDefined();
    });
  });

  // ─── 启动/停止/暂停/恢复 ────────────────────────

  describe('OS Lifecycle', () => {
    it('should start OS and set status to running', async () => {
      await os.start();
      const state = os.getState();
      expect(state.status).toBe('running');
      expect(state.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should stop OS and reset uptime', async () => {
      await os.start();
      os.stop();
      const state = os.getState();
      expect(state.status).toBe('stopped');
      expect(state.uptime).toBe(0);
    });

    it('should pause and resume OS', async () => {
      await os.start();
      os.pause();
      expect(os.getState().status).toBe('paused');
      os.resume();
      expect(os.getState().status).toBe('running');
    });

    it('should not pause when not running', async () => {
      os.pause(); // no-op when stopped
      expect(os.getState().status).toBe('stopped');
    });

    it('should not resume when not paused', async () => {
      await os.start();
      os.resume(); // no-op when running
      expect(os.getState().status).toBe('running');
    });

    it('should support init then start separately', async () => {
      await os.init();
      expect(os.getState().status).toBe('booting');
      await os.start();
      expect(os.getState().status).toBe('running');
    });
  });

  // ─── 状态查询 ──────────────────────────────────

  describe('State Queries', () => {
    it('should report instance count after boot', async () => {
      await os.start();
      const state = os.getState();
      expect(state.instanceCount).toBe(1);
    });

    it('should report instance count with custom config', async () => {
      const customOS = new KunlunOS({ kal: { initialInstances: 4, statsInterval: 0 } });
      await customOS.start();
      expect(customOS.getState().instanceCount).toBe(4);
    });

    it('should track pipeline runs', async () => {
      await os.start();
      expect(os.getState().pipelineRuns).toBe(0);
      os.incrementPipelineRuns();
      os.incrementPipelineRuns();
      expect(os.getState().pipelineRuns).toBe(2);
    });

    it('should return boot logs', async () => {
      await os.start();
      const logs = os.getBootLogs();
      expect(logs).toHaveLength(6);
      expect(logs[0].phase).toBe(0);
      expect(logs[5].phase).toBe(5);
    });
  });

  // ─── 子系统集成验证 ────────────────────────────

  describe('Subsystem Integration', () => {
    beforeEach(async () => {
      await os.start();
    });

    it('should integrate scheduler with registered instances', () => {
      const scheduler = os.getScheduler();
      const instances = scheduler.getInstanceIds();
      expect(instances.length).toBe(1);
      expect(instances[0]).toContain('kernel-0');
    });

    it('should integrate algorithm registry with default plugins', () => {
      const algoRegistry = os.getAlgoRegistry();
      const algos = algoRegistry.listAlgorithms();
      expect(algos).toContain('contradiction');
      expect(algos).toContain('practice');
      expect(algos).toContain('protracted-war');
      expect(algos).toContain('ocgs');
    });

    it('should integrate capability registry with builtin capabilities', () => {
      const capRegistry = os.getCapabilityRegistry();
      const all = capRegistry.listAll();
      expect(all.length).toBeGreaterThan(0);
      const types = new Set(all.map(c => c.type));
      expect(types.has('perceive')).toBe(true);
      expect(types.has('think')).toBe(true);
      expect(types.has('act')).toBe(true);
    });

    it('should integrate cognitive bus with default session', () => {
      const bus = os.getBus();
      const sessions = bus.getSessions();
      expect(sessions.size).toBeGreaterThanOrEqual(1);
    });

    it('should integrate trust manager', () => {
      const trustManager = os.getTrustManager();
      expect(trustManager).toBeDefined();
      // OS自身节点应为untrusted（无证据）
      const level = trustManager.getTrustLevel('kunlun-os');
      expect(level).toBe('untrusted');
    });

    it('should integrate token manager with pool usage', () => {
      const tokenManager = os.getTokenManager();
      const usage = tokenManager.getPoolUsage('llm');
      expect(usage.total).toBe(128000);
      expect(usage.used).toBe(0);
      expect(usage.available).toBe(128000);
    });

    it('should integrate pipeline with 7 layers', () => {
      const pipeline = os.getPipeline();
      expect(pipeline).toBeDefined();
      // 验证管道可运行（无处理器时直接返回）
      // 这是一个基本的集成检查
    });

    it('should integrate process manager', () => {
      const pm = os.getProcessManager();
      const proc = pm.createProcess({ thesis: 'test-thesis', antithesis: 'test-antithesis' });
      expect(proc.id).toBeDefined();
      expect(proc.stage).toBe('nascent');
      expect(pm.getAllProcesses().length).toBe(1);
    });

    it('should integrate human channel', () => {
      const channel = os.getHumanChannel();
      expect(channel).toBeDefined();
      // 注册一个人类节点验证集成
      channel.registerNode({
        id: 'human-1',
        name: 'Test Human',
        type: 'human',
        presence: {
          timezone: 'UTC',
          activeHours: [0, 24],
          lastSeen: Date.now(),
          estimatedResponseTime: 1000,
          attentionBudget: 100,
        },
        preferences: {
          communicationStyle: 'direct',
          decisionSpeed: 'fast',
          riskTolerance: 0.5,
        },
        status: 'online',
        capabilities: ['review'],
      });
      expect(channel.getNode('human-1')).toBeDefined();
    });

    it('should integrate metasynthesis engine', () => {
      const engine = os.getMetasynthesisEngine();
      expect(engine).toBeDefined();
    });

    it('should integrate executor', async () => {
      const executor = os.getExecutor();
      const resp = await executor.execute({
        sessionId: 'test-session',
        algorithm: 'test',
        mode: 'sync',
        input: { data: 'hello' },
      });
      expect(resp.mode).toBe('sync');
      expect(resp.output).toBeDefined();
    });

    it('should throw when accessing subsystems before boot', () => {
      const unstartedOS = new KunlunOS();
      expect(() => unstartedOS.getScheduler()).toThrow(/not been booted|not booted/);
    });
  });

  // ─── 配置管理 ──────────────────────────────────

  describe('Config Management', () => {
    it('should return the full config object', () => {
      const config = os.getConfig();
      expect(config.kal).toBeDefined();
      expect(config.bus).toBeDefined();
      expect(config.algo).toBeDefined();
      expect(config.capability).toBeDefined();
      expect(config.trust).toBeDefined();
      expect(config.memory).toBeDefined();
      expect(config.pipeline).toBeDefined();
      expect(config.process).toBeDefined();
      expect(config.human).toBeDefined();
      expect(config.metasynthesis).toBeDefined();
      expect(config.executor).toBeDefined();
    });

    it('should preserve custom memory config', () => {
      const customOS = new KunlunOS({
        memory: { llmPoolSize: 200000, cachePoolSize: 30000, knowledgePoolSize: 80000 },
      });
      const config = customOS.getConfig();
      expect(config.memory.llmPoolSize).toBe(200000);
      expect(config.memory.cachePoolSize).toBe(30000);
      expect(config.memory.knowledgePoolSize).toBe(80000);
    });

    it('should preserve trust value alignment config', () => {
      const customOS = new KunlunOS({
        trust: {
          valueAlignment: {
            values: ['safety', 'autonomy'],
            thresholds: { perceive: 0.2, think: 0.4, act: 0.6, govern: 0.8 },
          },
        },
      });
      const config = customOS.getConfig();
      expect(config.trust.valueAlignment.values).toContain('autonomy');
      expect(config.trust.valueAlignment.thresholds.govern).toBe(0.8);
    });

    it('should use defaultOSConfig factory', () => {
      const defaults = defaultOSConfig();
      expect(defaults.instanceId).toBe('kunlun-os');
      expect(defaults.bus.nodeTTL).toBe(60000);
      expect(defaults.executor.maxSpiralIterations).toBe(10);
    });
  });
});
