/**
 * CogCapability 认知能力注册表测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CogCapabilityRegistry,
  createCapabilityRegistry,
  registerProvider,
} from '../src/index';
import type { CogCapabilityProvider, CogCapability } from '../src/index';

// ═══════════════════════════════════════════════════════════════
// 测试辅助
// ═══════════════════════════════════════════════════════════════

function makeProvider(
  id: string,
  capabilities: CogCapability[],
): CogCapabilityProvider {
  return {
    id,
    capabilities,
    register: vi.fn(),
    heartbeat: vi.fn(),
    unregister: vi.fn(),
  };
}

function makeCapability(
  type: CogCapability['type'],
  provider: string,
  name: string,
  version: string,
  tokensPerCall: number,
  avgLatencyMs: number,
  status: CogCapability['status'] = 'available',
): CogCapability {
  return { type, provider, name, version, cost: { tokensPerCall, avgLatencyMs }, status };
}

// ═══════════════════════════════════════════════════════════════
// CogCapabilityRegistry 测试
// ═══════════════════════════════════════════════════════════════

describe('CogCapabilityRegistry', () => {
  let registry: CogCapabilityRegistry;

  beforeEach(() => {
    registry = new CogCapabilityRegistry();
  });

  describe('register', () => {
    it('应注册提供者并调用register回调', () => {
      const provider = makeProvider('p1', [
        makeCapability('perceive', 'p1', 'vision', '1.0.0', 100, 50),
      ]);
      registry.register(provider);
      expect(registry.getProviderCount()).toBe(1);
      expect(provider.register).toHaveBeenCalledTimes(1);
    });

    it('应注册多个提供者', () => {
      registry.register(
        makeProvider('p1', [makeCapability('perceive', 'p1', 'vision', '1.0.0', 100, 50)]),
      );
      registry.register(
        makeProvider('p2', [makeCapability('think', 'p2', 'reasoning', '1.0.0', 200, 100)]),
      );
      expect(registry.getProviderCount()).toBe(2);
    });

    it('重复注册同一id应覆盖', () => {
      const p1 = makeProvider('p1', [
        makeCapability('perceive', 'p1', 'vision', '1.0.0', 100, 50),
      ]);
      const p1New = makeProvider('p1', [
        makeCapability('act', 'p1', 'motor', '2.0.0', 300, 80),
      ]);
      registry.register(p1);
      registry.register(p1New);
      expect(registry.getProviderCount()).toBe(1);
      expect(registry.getByProvider('p1')).toHaveLength(1);
      expect(registry.getByProvider('p1')[0]!.type).toBe('act');
    });
  });

  describe('find', () => {
    beforeEach(() => {
      registry.register(
        makeProvider('p1', [
          makeCapability('perceive', 'p1', 'vision', '1.0.0', 100, 50),
          makeCapability('perceive', 'p1', 'audio', '2.0.0', 80, 30),
        ]),
      );
      registry.register(
        makeProvider('p2', [
          makeCapability('perceive', 'p2', 'lidar', '1.5.0', 500, 200),
          makeCapability('think', 'p2', 'reasoning', '1.0.0', 200, 100),
        ]),
      );
    });

    it('应按类型查找所有匹配能力', () => {
      const results = registry.find('perceive');
      expect(results).toHaveLength(3);
    });

    it('应支持minVersion过滤', () => {
      const results = registry.find('perceive', { minVersion: '1.2.0' });
      expect(results).toHaveLength(2);
      expect(results.every((c) => c.name !== 'vision')).toBe(true);
    });

    it('应支持maxCost过滤', () => {
      const results = registry.find('perceive', { maxCost: 100 });
      expect(results).toHaveLength(2);
      expect(results.every((c) => c.cost.tokensPerCall <= 100)).toBe(true);
    });

    it('应同时应用minVersion和maxCost过滤', () => {
      const results = registry.find('perceive', { minVersion: '1.0.0', maxCost: 90 });
      expect(results).toHaveLength(1);
      expect(results[0]!.name).toBe('audio');
    });

    it('无匹配类型应返回空数组', () => {
      const results = registry.find('memorize');
      expect(results).toEqual([]);
    });
  });

  describe('getByProvider', () => {
    it('应返回指定提供者的所有能力', () => {
      registry.register(
        makeProvider('p1', [
          makeCapability('perceive', 'p1', 'vision', '1.0.0', 100, 50),
          makeCapability('think', 'p1', 'reasoning', '1.0.0', 200, 100),
        ]),
      );
      expect(registry.getByProvider('p1')).toHaveLength(2);
    });

    it('不存在的提供者应返回空数组', () => {
      expect(registry.getByProvider('nonexistent')).toEqual([]);
    });
  });

  describe('unregister', () => {
    it('应注销提供者并调用unregister回调', () => {
      const provider = makeProvider('p1', [
        makeCapability('perceive', 'p1', 'vision', '1.0.0', 100, 50),
      ]);
      registry.register(provider);
      registry.unregister('p1');
      expect(registry.getProviderCount()).toBe(0);
      expect(provider.unregister).toHaveBeenCalledTimes(1);
    });

    it('注销不存在的提供者应不抛出错误', () => {
      expect(() => registry.unregister('nonexistent')).not.toThrow();
    });
  });

  describe('listAll', () => {
    it('空注册中心应返回空数组', () => {
      expect(registry.listAll()).toEqual([]);
    });

    it('应返回所有提供者的所有能力', () => {
      registry.register(
        makeProvider('p1', [makeCapability('perceive', 'p1', 'vision', '1.0.0', 100, 50)]),
      );
      registry.register(
        makeProvider('p2', [makeCapability('think', 'p2', 'reasoning', '1.0.0', 200, 100)]),
      );
      expect(registry.listAll()).toHaveLength(2);
    });
  });

  describe('getProviderCount', () => {
    it('初始应为0', () => {
      expect(registry.getProviderCount()).toBe(0);
    });

    it('注册后应正确计数', () => {
      registry.register(
        makeProvider('p1', [makeCapability('perceive', 'p1', 'vision', '1.0.0', 100, 50)]),
      );
      expect(registry.getProviderCount()).toBe(1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 辅助函数测试
// ═══════════════════════════════════════════════════════════════

describe('辅助函数', () => {
  it('createCapabilityRegistry应返回注册中心实例', () => {
    const reg = createCapabilityRegistry();
    expect(reg).toBeInstanceOf(CogCapabilityRegistry);
    expect(reg.getProviderCount()).toBe(0);
  });

  it('registerProvider应注册提供者', () => {
    const reg = createCapabilityRegistry();
    const provider = makeProvider('p1', [
      makeCapability('perceive', 'p1', 'vision', '1.0.0', 100, 50),
    ]);
    registerProvider(reg, provider);
    expect(reg.getProviderCount()).toBe(1);
  });
});
