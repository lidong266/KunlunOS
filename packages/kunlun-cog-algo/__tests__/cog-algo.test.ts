/**
 * CogAlgo 算法Plugin注册测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  CogAlgorithmRegistry,
  createAlgorithmRegistry,
  registerAlgorithm,
  ContradictionPlugin,
  PracticePlugin,
  ProtractedWarPlugin,
  OCGSPlugin,
} from '../src/index';
import type { ICogAlgorithm, AlgorithmFactory } from '../src/index';

// ═══════════════════════════════════════════════════════════════
// CogAlgorithmRegistry 测试
// ═══════════════════════════════════════════════════════════════

describe('CogAlgorithmRegistry', () => {
  let registry: CogAlgorithmRegistry;

  beforeEach(() => {
    registry = new CogAlgorithmRegistry();
  });

  describe('算法注册', () => {
    it('应注册算法工厂', () => {
      const factory: AlgorithmFactory = () => new ContradictionPlugin();
      registry.register('test-algo', factory);
      expect(registry.listAlgorithms()).toContain('test-algo');
    });

    it('注册多个算法应列出所有', () => {
      registry.register('algo-a', () => new ContradictionPlugin());
      registry.register('algo-b', () => new PracticePlugin());
      expect(registry.listAlgorithms()).toHaveLength(2);
    });

    it('重复注册应覆盖', () => {
      registry.register('algo', () => new ContradictionPlugin());
      registry.register('algo', () => new PracticePlugin());
      expect(registry.listAlgorithms()).toHaveLength(1);
    });
  });

  describe('获取算法', () => {
    it('应获取算法实例', async () => {
      registry.register('test', () => new ContradictionPlugin());
      const algo = await registry.getAlgorithm('session-1', 'test');
      expect(algo).toBeDefined();
      expect(algo.name).toBe('contradiction');
    });

    it('未注册算法应抛出错误', async () => {
      await expect(
        registry.getAlgorithm('session-1', 'nonexistent'),
      ).rejects.toThrow('not registered');
    });
  });

  describe('会话隔离', () => {
    it('同一会话应返回同一实例', async () => {
      registry.register('test', () => new ContradictionPlugin());
      const algo1 = await registry.getAlgorithm('session-1', 'test');
      const algo2 = await registry.getAlgorithm('session-1', 'test');
      expect(algo1).toBe(algo2);
    });

    it('不同会话应返回不同实例', async () => {
      registry.register('test', () => new ContradictionPlugin());
      const algo1 = await registry.getAlgorithm('session-1', 'test');
      const algo2 = await registry.getAlgorithm('session-2', 'test');
      expect(algo1).not.toBe(algo2);
    });

    it('释放会话后重新获取应创建新实例', async () => {
      registry.register('test', () => new ContradictionPlugin());
      const algo1 = await registry.getAlgorithm('session-1', 'test');
      await registry.releaseSession('session-1');
      const algo2 = await registry.getAlgorithm('session-1', 'test');
      expect(algo1).not.toBe(algo2);
    });
  });

  describe('释放会话', () => {
    it('应成功释放会话', async () => {
      registry.register('test', () => new ContradictionPlugin());
      await registry.getAlgorithm('session-1', 'test');
      await registry.releaseSession('session-1');
      // 不应抛出错误
    });

    it('释放不存在的会话应不抛出错误', async () => {
      await expect(
        registry.releaseSession('nonexistent'),
      ).resolves.toBeUndefined();
    });
  });

  describe('默认初始化', () => {
    it('initDefault应注册四个默认Plugin', () => {
      registry.initDefault();
      const algorithms = registry.listAlgorithms();
      expect(algorithms).toContain('contradiction');
      expect(algorithms).toContain('practice');
      expect(algorithms).toContain('protracted-war');
      expect(algorithms).toContain('ocgs');
      expect(algorithms).toHaveLength(4);
    });

    it('createAlgorithmRegistry应返回已初始化的注册中心', () => {
      const reg = createAlgorithmRegistry();
      expect(reg.listAlgorithms()).toHaveLength(4);
    });
  });

  describe('listAlgorithms', () => {
    it('空注册中心应返回空数组', () => {
      expect(registry.listAlgorithms()).toEqual([]);
    });

    it('注册后应返回算法名列表', () => {
      registry.initDefault();
      const list = registry.listAlgorithms();
      expect(list).toContain('contradiction');
      expect(list).toContain('ocgs');
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 辅助函数测试
// ═══════════════════════════════════════════════════════════════

describe('辅助函数', () => {
  it('registerAlgorithm应注册算法', () => {
    const registry = new CogAlgorithmRegistry();
    registerAlgorithm(registry, 'custom', () => new ContradictionPlugin());
    expect(registry.listAlgorithms()).toContain('custom');
  });

  it('createAlgorithmRegistry应包含四个默认算法', () => {
    const registry = createAlgorithmRegistry();
    expect(registry.listAlgorithms()).toHaveLength(4);
  });
});

// ═══════════════════════════════════════════════════════════════
// 四个Plugin基本功能测试
// ═══════════════════════════════════════════════════════════════

describe('四个Plugin基本功能', () => {
  describe('ContradictionPlugin', () => {
    let plugin: ContradictionPlugin;

    beforeEach(() => {
      plugin = new ContradictionPlugin();
    });

    it('应有正确的名称和版本', () => {
      expect(plugin.name).toBe('contradiction');
      expect(plugin.version).toBe('0.1.0');
      expect(plugin.inferMode).toBe('async');
    });

    it('应支持prepare和release生命周期', async () => {
      await plugin.prepare('session-1', {
        createdAt: Date.now(),
        metadata: {},
      });
      await plugin.release('session-1');
    });

    it('应支持setOption和getOption', () => {
      plugin.setOption('key', 'value');
      expect(plugin.getOption('key')).toBe('value');
    });
  });

  describe('PracticePlugin', () => {
    let plugin: PracticePlugin;

    beforeEach(() => {
      plugin = new PracticePlugin();
    });

    it('应有正确的名称和推理模式', () => {
      expect(plugin.name).toBe('practice');
      expect(plugin.inferMode).toBe('spiral');
    });

    it('应支持生命周期', async () => {
      await plugin.prepare('session-1', {
        createdAt: Date.now(),
        metadata: {},
      });
      await plugin.release('session-1');
    });
  });

  describe('ProtractedWarPlugin', () => {
    let plugin: ProtractedWarPlugin;

    beforeEach(() => {
      plugin = new ProtractedWarPlugin();
    });

    it('应有正确的名称', () => {
      expect(plugin.name).toBe('protracted-war');
    });

    it('应支持生命周期', async () => {
      await plugin.prepare('session-1', {
        createdAt: Date.now(),
        metadata: {},
      });
      await plugin.release('session-1');
    });
  });

  describe('OCGSPlugin', () => {
    let plugin: OCGSPlugin;

    beforeEach(() => {
      plugin = new OCGSPlugin();
    });

    it('应有正确的名称', () => {
      expect(plugin.name).toBe('ocgs');
    });

    it('应支持生命周期', async () => {
      await plugin.prepare('session-1', {
        createdAt: Date.now(),
        metadata: {},
      });
      await plugin.release('session-1');
    });

    it('应支持选项操作', () => {
      plugin.setOption('timeout', 5000);
      expect(plugin.getOption('timeout')).toBe(5000);
    });
  });
});
