/**
 * CognitiveCLI 测试 — 离线认知分析命令行
 *
 * 验证无需 LLM API 即可运行的核心认知命令：
 *   analyze / contradiction / bridge / bridges / boot / status / help
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CognitiveCLI, runCognitiveCli } from '../src/cognitive-cli';

// ─── 输出捕获工具 ──────────────────────────────────────────

function captureConsole(): { logs: string[]; restore: () => void } {
  const logs: string[] = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...args: any[]) => { logs.push(args.map(String).join(' ')); };
  console.error = (...args: any[]) => { logs.push(args.map(String).join(' ')); };
  return {
    logs,
    restore: () => { console.log = origLog; console.error = origErr; },
  };
}

function joined(logs: string[]): string {
  return logs.join('\n');
}

// ═══════════════════════════════════════════════════════════════

describe('CognitiveCLI', () => {
  let cli: CognitiveCLI;
  let cap: { logs: string[]; restore: () => void };

  beforeEach(() => {
    cli = new CognitiveCLI();
    cap = captureConsole();
  });

  afterEach(() => {
    cap.restore();
  });

  // ─── help ──────────────────────────────────────────────

  describe('help command', () => {
    it('should print help and return 0', async () => {
      const code = await cli.runCommand('help', []);
      expect(code).toBe(0);
      const out = joined(cap.logs);
      expect(out).toContain('analyze');
      expect(out).toContain('contradiction');
      expect(out).toContain('bridge');
      expect(out).toContain('boot');
      expect(out).toContain('昆仑OS');
    });

    it('should accept --help and -h aliases', async () => {
      expect(await cli.runCommand('--help', [])).toBe(0);
      expect(await cli.runCommand('-h', [])).toBe(0);
    });
  });

  // ─── version ───────────────────────────────────────────

  describe('version command', () => {
    it('should print version info', async () => {
      const code = await cli.runCommand('version', []);
      expect(code).toBe(0);
      expect(joined(cap.logs)).toContain('Cognitive CLI');
    });
  });

  // ─── analyze ───────────────────────────────────────────

  describe('analyze command', () => {
    it('should run cognitive pipeline on contradiction query', async () => {
      const code = await cli.runCommand('analyze', ['性能和成本如何权衡']);
      expect(code).toBe(0);
      const out = joined(cap.logs);

      // 应包含认知分析标题
      expect(out).toContain('认知分析');
      // 应路由到某个桥
      expect(out).toContain('桥');
      // 应检测到矛盾
      expect(out).toContain('矛盾');
      // 应包含分析摘要
      expect(out).toContain('分析摘要');
      // 应生成 prompt 注入
      expect(out).toContain('Prompt 注入');
    });

    it('should produce promptInjection text', async () => {
      const code = await cli.runCommand('analyze', ['效率和质量的矛盾']);
      expect(code).toBe(0);
      const out = joined(cap.logs);
      expect(out).toContain('大成智慧学·认知分析');
    });

    it('should return 1 on empty input', async () => {
      const code = await cli.runCommand('analyze', []);
      expect(code).toBe(1);
      expect(joined(cap.logs)).toContain('用法');
    });
  });

  // ─── contradiction ─────────────────────────────────────

  describe('contradiction command', () => {
    it('should analyze a contradiction pair with vs separator', async () => {
      const code = await cli.runCommand('contradiction', ['追求极致性能', 'vs', '严格控制成本']);
      expect(code).toBe(0);
      const out = joined(cap.logs);

      expect(out).toContain('矛盾分析引擎');
      expect(out).toContain('正题: 追求极致性能');
      expect(out).toContain('反题: 严格控制成本');
      // 核心三元素
      expect(out).toContain('可统一性');
      expect(out).toContain('主导方面');
      // 质变临界点
      expect(out).toContain('质变临界点');
      // 否定之否定
      expect(out).toContain('否定之否定');
      // 转化预测
      expect(out).toContain('转化预测');
      // 三进制编码
      expect(out).toContain('三进制编码');
    });

    it('should support uppercase VS separator', async () => {
      const code = await cli.runCommand('contradiction', ['快速迭代', 'VS', '质量保障']);
      expect(code).toBe(0);
      const out = joined(cap.logs);
      expect(out).toContain('正题: 快速迭代');
      expect(out).toContain('反题: 质量保障');
    });

    it('should strip surrounding quotes', async () => {
      const code = await cli.runCommand('contradiction', ['"集中式架构"', 'vs', '"去中心化架构"']);
      expect(code).toBe(0);
      const out = joined(cap.logs);
      expect(out).toContain('正题: 集中式架构');
      expect(out).toContain('反题: 去中心化架构');
    });

    it('should return 1 when no vs separator', async () => {
      const code = await cli.runCommand('contradiction', ['只有正题没有反题']);
      expect(code).toBe(1);
      expect(joined(cap.logs)).toContain('用法');
    });
  });

  // ─── bridge ────────────────────────────────────────────

  describe('bridge command', () => {
    it('should route text to a bridge and show cards', async () => {
      const code = await cli.runCommand('bridge', ['如何优化系统性能']);
      expect(code).toBe(0);
      const out = joined(cap.logs);

      // 应显示桥信息
      expect(out).toContain('桥');
      expect(out).toContain('核心公理');
      // 应显示知识卡片
      expect(out).toContain('知识卡片');
      expect(out).toContain('AX');
      expect(out).toContain('SC');
      expect(out).toContain('TC');
      // 应显示三环节使用法
      expect(out).toContain('三环节使用法');
    });

    it('should return 1 on empty input', async () => {
      const code = await cli.runCommand('bridge', []);
      expect(code).toBe(1);
      expect(joined(cap.logs)).toContain('用法');
    });
  });

  // ─── bridges ───────────────────────────────────────────

  describe('bridges command', () => {
    it('should list all 11 bridges', async () => {
      const code = await cli.runCommand('bridges', []);
      expect(code).toBe(0);
      const out = joined(cap.logs);

      // 应列出 11 座桥
      expect(out).toContain('Q01');
      expect(out).toContain('Q11');
      expect(out).toContain('自然辩证法');
      expect(out).toContain('建筑科学');
      // 应显示卡片数量
      expect(out).toContain('知识卡片');
    });
  });

  // ─── boot ──────────────────────────────────────────────

  describe('boot command', () => {
    it('should execute CogBoot 6-phase sequence', async () => {
      const code = await cli.runCommand('boot', []);
      expect(code).toBe(0);
      const out = joined(cap.logs);

      expect(out).toContain('CogBoot');
      // 应显示引导日志（6 阶段）
      expect(out).toContain('base');
      expect(out).toContain('kernel');
      expect(out).toContain('trust');
      expect(out).toContain('capabilities');
      expect(out).toContain('bus');
      expect(out).toContain('algorithms');
      // 应显示算法插件
      expect(out).toContain('算法注册表');
    });
  });

  // ─── status ────────────────────────────────────────────

  describe('status command', () => {
    it('should show OS running state', async () => {
      const code = await cli.runCommand('status', []);
      expect(code).toBe(0);
      const out = joined(cap.logs);

      expect(out).toContain('运行状态');
      expect(out).toContain('running');
      expect(out).toContain('认知实例');
    });
  });

  // ─── unknown command ───────────────────────────────────

  describe('unknown command', () => {
    it('should return 1 and print help for unknown command', async () => {
      const code = await cli.runCommand('nonexistent', []);
      expect(code).toBe(1);
      expect(joined(cap.logs)).toContain('未知命令');
    });
  });

  // ─── error handling ────────────────────────────────────

  describe('error handling', () => {
    it('should not throw on any command (graceful degradation)', async () => {
      // 这些命令都不应抛出异常
      await expect(cli.runCommand('analyze', ['测试'])).resolves.toBeDefined();
      await expect(cli.runCommand('contradiction', ['A', 'vs', 'B'])).resolves.toBeDefined();
      await expect(cli.runCommand('bridge', ['测试'])).resolves.toBeDefined();
      await expect(cli.runCommand('boot', [])).resolves.toBeDefined();
      await expect(cli.runCommand('status', [])).resolves.toBeDefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════

describe('runCognitiveCli entry function', () => {
  let cap: { logs: string[]; restore: () => void };

  beforeEach(() => {
    cap = captureConsole();
  });

  afterEach(() => {
    cap.restore();
  });

  it('should run help via entry function', async () => {
    const code = await runCognitiveCli(['help']);
    expect(code).toBe(0);
    expect(joined(cap.logs)).toContain('analyze');
  });

  it('should run analyze via entry function', async () => {
    const code = await runCognitiveCli(['analyze', '性能和成本']);
    expect(code).toBe(0);
    expect(joined(cap.logs)).toContain('认知分析');
  });

  it('should run bridges via entry function', async () => {
    const code = await runCognitiveCli(['bridges']);
    expect(code).toBe(0);
    expect(joined(cap.logs)).toContain('Q01');
  });

  it('should return 1 for unknown command via entry function', async () => {
    const code = await runCognitiveCli(['bogus']);
    expect(code).toBe(1);
  });
});
