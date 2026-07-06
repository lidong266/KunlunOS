/**
 * CogBus 认知事件总线测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  CognEventBus,
  CogLedger,
  CogDiscoveryManager,
} from '../src/index';
import type {
  CogNodeInfo,
  CogPublishInfo,
  CogSubscribeInfo,
  CogNodeCapabilities,
} from '../src/index';
import { CogIPIType } from '@kunlun/cogkal';
import type { CogIPIMessage } from '@kunlun/cogkal';

// 辅助函数：创建测试节点信息
function makeNodeInfo(overrides: Partial<CogNodeInfo> = {}): CogNodeInfo {
  return {
    id: 'node-1',
    type: 'pi-agent',
    name: 'Test Node',
    capabilities: { perceive: true, think: true, express: true, act: true, memory: true },
    status: 'online',
    lastHeartbeat: Date.now(),
    ttl: 60000,
    reputation: 0.8,
    avgResponseTime: 100,
    metadata: {},
    ...overrides,
  };
}

function makePublishInfo(overrides: Partial<CogPublishInfo> = {}): CogPublishInfo {
  return {
    nodeId: 'node-1',
    capabilities: { perceive: true, think: true, express: true, act: true, memory: true },
    medium: 'event-bus',
    mode: 'active',
    ttl: 60000,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// CogLedger 测试
// ═══════════════════════════════════════════════════════════════

describe('CogLedger', () => {
  let ledger: CogLedger;

  beforeEach(() => {
    ledger = new CogLedger();
  });

  it('应注册节点', () => {
    const node = makeNodeInfo();
    ledger.register(node);
    expect(ledger.getAll()).toHaveLength(1);
    expect(ledger.getAll()[0]!.id).toBe('node-1');
  });

  it('应注销节点', () => {
    const node = makeNodeInfo();
    ledger.register(node);
    ledger.unregister('node-1');
    expect(ledger.getAll()).toHaveLength(0);
  });

  it('应根据过滤器查找节点', () => {
    const node1 = makeNodeInfo({ id: 'node-1', capabilities: { perceive: true, think: true, express: false, act: false, memory: false } });
    const node2 = makeNodeInfo({ id: 'node-2', capabilities: { perceive: true, think: false, express: true, act: false, memory: false } });
    ledger.register(node1);
    ledger.register(node2);

    const filter: CogSubscribeInfo = {
      requiredCapabilities: { think: true },
      minReputation: 0,
    };
    const found = ledger.find(filter);
    expect(found).toHaveLength(1);
    expect(found[0]!.id).toBe('node-1');
  });

  it('应过滤信誉不足的节点', () => {
    const node1 = makeNodeInfo({ id: 'low-rep', reputation: 0.3 });
    const node2 = makeNodeInfo({ id: 'high-rep', reputation: 0.9 });
    ledger.register(node1);
    ledger.register(node2);

    const filter: CogSubscribeInfo = {
      requiredCapabilities: {},
      minReputation: 0.5,
    };
    const found = ledger.find(filter);
    expect(found).toHaveLength(1);
    expect(found[0]!.id).toBe('high-rep');
  });

  it('应获取节点信誉', () => {
    const node = makeNodeInfo({ reputation: 0.75 });
    ledger.register(node);
    expect(ledger.getReputation('node-1')).toBe(0.75);
  });

  it('不存在的节点信誉应为0', () => {
    expect(ledger.getReputation('nonexistent')).toBe(0);
  });

  it('应返回所有节点', () => {
    ledger.register(makeNodeInfo({ id: 'a' }));
    ledger.register(makeNodeInfo({ id: 'b' }));
    ledger.register(makeNodeInfo({ id: 'c' }));
    expect(ledger.getAll()).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════════════════════════
// CogDiscoveryManager 测试
// ═══════════════════════════════════════════════════════════════

describe('CogDiscoveryManager', () => {
  let ledger: CogLedger;
  let discovery: CogDiscoveryManager;

  beforeEach(() => {
    ledger = new CogLedger();
    discovery = new CogDiscoveryManager(ledger);
  });

  it('应发布节点信息并注册到账本', () => {
    const info = makePublishInfo();
    discovery.publish(info);
    expect(ledger.getAll()).toHaveLength(1);
    expect(ledger.getAll()[0]!.id).toBe('node-1');
  });

  it('应发现已发布的节点', () => {
    const info = makePublishInfo();
    discovery.publish(info);

    const filter: CogSubscribeInfo = {
      requiredCapabilities: { think: true },
      minReputation: 0,
    };
    const nodes = discovery.getOnlineNodes();
    const matched = nodes.filter((n) => discovery.matches(n, filter));
    expect(matched.length).toBeGreaterThanOrEqual(1);
  });

  it('startDiscovery应通知现有匹配节点', (ctx) => {
    return new Promise<void>((resolve) => {
      const info = makePublishInfo();
      discovery.publish(info);

      const filter: CogSubscribeInfo = {
        requiredCapabilities: { think: true },
        minReputation: 0,
      };

      discovery.startDiscovery(filter, (node) => {
        expect(node.id).toBe('node-1');
        resolve();
      });
    });
  });

  it('startDiscovery应通知后续发布的匹配节点', (ctx) => {
    return new Promise<void>((resolve) => {
      const filter: CogSubscribeInfo = {
        requiredCapabilities: { perceive: true },
        minReputation: 0,
      };

      discovery.startDiscovery(filter, (node) => {
        expect(node.id).toBe('node-new');
        resolve();
      });

      // 稍后发布
      setTimeout(() => {
        discovery.publish(makePublishInfo({ nodeId: 'node-new' }));
      }, 10);
    });
  });

  it('getOnlineNodes应只返回在线节点', () => {
    const online = makeNodeInfo({ id: 'online', status: 'online' });
    const offline = makeNodeInfo({ id: 'offline', status: 'offline' });
    const busy = makeNodeInfo({ id: 'busy', status: 'busy' });
    ledger.register(online);
    ledger.register(offline);
    ledger.register(busy);

    const nodes = discovery.getOnlineNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.id).toBe('online');
  });
});

// ═══════════════════════════════════════════════════════════════
// CognEventBus 测试
// ═══════════════════════════════════════════════════════════════

describe('CognEventBus', () => {
  let bus: CognEventBus;

  beforeEach(() => {
    bus = new CognEventBus();
  });

  // ─── 会话管理 ───

  describe('会话管理', () => {
    it('应创建会话并返回ID', () => {
      const id = bus.createSession('test-session', 'unicast');
      expect(id).toMatch(/^cog-session-/);
      expect(bus.getSessions().has(id)).toBe(true);
    });

    it('应关闭会话', () => {
      const id = bus.createSession('test', 'multicast');
      bus.closeSession(id);
      expect(bus.getSessions().has(id)).toBe(false);
    });

    it('创建多个会话应有不同ID', () => {
      const id1 = bus.createSession('s1', 'unicast');
      const id2 = bus.createSession('s2', 'multicast');
      expect(id1).not.toBe(id2);
    });
  });

  // ─── 节点注册与发现 ───

  describe('节点注册与发现', () => {
    it('joinCogNetwork应注册节点', () => {
      const info = makePublishInfo();
      const nodeId = bus.joinCogNetwork(info);
      expect(nodeId).toBe('node-1');
      expect(bus.getLedger().getAll()).toHaveLength(1);
    });

    it('leaveCogNetwork应注销节点', () => {
      bus.joinCogNetwork(makePublishInfo());
      bus.leaveCogNetwork('node-1');
      expect(bus.getLedger().getAll()).toHaveLength(0);
    });

    it('discoverCogNodes应根据过滤器查找', () => {
      bus.joinCogNetwork(makePublishInfo({
        nodeId: 'thinker',
        capabilities: { perceive: false, think: true, express: false, act: false, memory: false },
      }));
      bus.joinCogNetwork(makePublishInfo({
        nodeId: 'perceiver',
        capabilities: { perceive: true, think: false, express: false, act: false, memory: false },
      }));

      const filter: CogSubscribeInfo = {
        requiredCapabilities: { think: true },
        minReputation: 0,
      };
      const found = bus.discoverCogNodes(filter);
      expect(found).toHaveLength(1);
      expect(found[0]!.id).toBe('thinker');
    });
  });

  // ─── 数据通道 ───

  describe('数据通道', () => {
    it('sendCognition应存入payload', () => {
      const payload = {
        sessionId: 's1',
        type: 'thought' as const,
        data: { content: 'hello' },
        source: 'node-1',
        timestamp: Date.now(),
        ttl: 5000,
      };
      bus.sendCognition('ch-1', payload);

      const received = bus.receiveCognition('ch-1');
      expect(received).not.toBeNull();
      expect(received!.data).toEqual({ content: 'hello' });
    });

    it('空通道receiveCognition应返回null', () => {
      const result = bus.receiveCognition('nonexistent');
      expect(result).toBeNull();
    });

    it('应支持多条消息的FIFO顺序', () => {
      const p1 = {
        sessionId: 's1',
        type: 'perception' as const,
        data: 'first',
        source: 'n1',
        timestamp: Date.now(),
        ttl: 5000,
      };
      const p2 = {
        sessionId: 's1',
        type: 'perception' as const,
        data: 'second',
        source: 'n1',
        timestamp: Date.now(),
        ttl: 5000,
      };

      bus.sendCognition('ch-1', p1);
      bus.sendCognition('ch-1', p2);

      expect(bus.receiveCognition('ch-1')!.data).toBe('first');
      expect(bus.receiveCognition('ch-1')!.data).toBe('second');
      expect(bus.receiveCognition('ch-1')).toBeNull();
    });
  });

  // ─── 控制通道 ───

  describe('控制通道IPI', () => {
    it('sendCogIPI应不抛出错误', () => {
      const ipi: CogIPIMessage = {
        type: 'ipi',
        ipiType: CogIPIType.WAKEUP,
        from: 'node-1',
      };
      expect(() => bus.sendCogIPI('pi-1', ipi)).not.toThrow();
    });

    it('应能发送SCHEDULE IPI', () => {
      const ipi: CogIPIMessage = {
        type: 'ipi',
        ipiType: CogIPIType.SCHEDULE,
        from: 'scheduler',
      };
      expect(() => bus.sendCogIPI('pi-1', ipi)).not.toThrow();
    });

    it('应能发送HALT IPI', () => {
      const ipi: CogIPIMessage = {
        type: 'ipi',
        ipiType: CogIPIType.HALT,
        from: 'controller',
      };
      expect(() => bus.sendCogIPI('pi-1', ipi)).not.toThrow();
    });
  });

  // ─── 事件系统 ───

  describe('事件系统', () => {
    it('应注册事件处理器', (ctx) => {
      return new Promise<void>((resolve) => {
        bus.on('test:event', (payload: unknown) => {
          expect(payload).toBeDefined();
          resolve();
        });
        bus.emit('test:event', { data: 'hello' });
      });
    });

    it('应支持多个事件处理器', () => {
      let count = 0;
      bus.on('multi:event', () => { count++; });
      bus.on('multi:event', () => { count++; });
      bus.emit('multi:event', {});
      expect(count).toBe(2);
    });
  });

  // ─── 信誉查询 ───

  describe('信誉查询', () => {
    it('应通过账本查询信誉', () => {
      bus.joinCogNetwork(makePublishInfo({ nodeId: 'reputable' }));
      // 注册的节点默认信誉为 0.5
      expect(bus.getLedger().getReputation('reputable')).toBe(0.5);
    });
  });

  // ─── 离线节点过滤 ───

  describe('离线节点过滤', () => {
    it('discoverCogNodes应排除离线节点', () => {
      bus.joinCogNetwork(makePublishInfo({ nodeId: 'online-node' }));
      bus.joinCogNetwork(makePublishInfo({ nodeId: 'busy-node' }));

      // 手动设置 busy-node 为 busy 状态
      const busyNode = bus.getLedger().getAll().find((n) => n.id === 'busy-node');
      if (busyNode) {
        busyNode.status = 'busy';
      }

      const filter: CogSubscribeInfo = {
        requiredCapabilities: {},
        minReputation: 0,
      };
      const nodes = bus.discoverCogNodes(filter);
      expect(nodes).toHaveLength(1);
      expect(nodes[0]!.id).toBe('online-node');
    });
  });
});
