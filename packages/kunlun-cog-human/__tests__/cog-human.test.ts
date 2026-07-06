import { describe, it, expect, beforeEach } from 'vitest';
import { HumanChannel } from '../src/index.js';
import type { HumanNode, HumanPreferences } from '../src/index.js';

function makeHumanNode(id: string, activeHours: [number, number] = [0, 24], budget: number = 10): HumanNode {
  return {
    id,
    name: `User-${id}`,
    type: 'human',
    presence: {
      timezone: 'UTC',
      activeHours,
      lastSeen: Date.now(),
      estimatedResponseTime: 5000,
      attentionBudget: budget,
    },
    preferences: {
      communicationStyle: 'direct',
      decisionSpeed: 'fast',
      riskTolerance: 0.5,
    },
    status: 'online',
    capabilities: ['review', 'approve'],
  };
}

describe('HumanChannel', () => {
  let channel: HumanChannel;

  beforeEach(() => {
    channel = new HumanChannel();
  });

  it('should register a human node', () => {
    const node = makeHumanNode('h1');
    channel.registerNode(node);
    const retrieved = channel.getNode('h1');
    expect(retrieved).toBeDefined();
    expect(retrieved!.name).toBe('User-h1');
  });

  it('should send async message to online node with budget', async () => {
    const node = makeHumanNode('h1', [0, 24], 10);
    channel.registerNode(node);
    await channel.sendAsync('h1', 'Hello');
    expect(channel.getPendingCount('h1')).toBe(1);
    expect(node.presence.attentionBudget).toBe(9);
  });

  it('should throw when sending to non-existent node', async () => {
    await expect(channel.sendAsync('unknown', 'msg')).rejects.toThrow('Human node not found');
  });

  it('should throw when sending to offline node', async () => {
    const node = makeHumanNode('h1');
    node.status = 'offline';
    channel.registerNode(node);
    await expect(channel.sendAsync('h1', 'msg')).rejects.toThrow('Cannot send');
  });

  it('should throw when attention budget is exhausted', async () => {
    const node = makeHumanNode('h1', [0, 24], 1);
    channel.registerNode(node);
    await channel.sendAsync('h1', 'first'); // budget becomes 0
    await expect(channel.sendAsync('h1', 'second')).rejects.toThrow('Cannot send');
  });

  it('should check canSend correctly', () => {
    const node = makeHumanNode('h1', [0, 24], 10);
    channel.registerNode(node);
    expect(channel.canSend('h1')).toBe(true);

    node.status = 'offline';
    expect(channel.canSend('h1')).toBe(false);

    node.status = 'online';
    node.presence.attentionBudget = 0;
    expect(channel.canSend('h1')).toBe(false);
  });

  it('should return false for canSend with unknown node', () => {
    expect(channel.canSend('unknown')).toBe(false);
  });

  it('should get pending count correctly', async () => {
    const node = makeHumanNode('h1', [0, 24], 10);
    channel.registerNode(node);
    expect(channel.getPendingCount('h1')).toBe(0);
    await channel.sendAsync('h1', 'msg1');
    await channel.sendAsync('h1', 'msg2');
    expect(channel.getPendingCount('h1')).toBe(2);
  });

  it('should clear pending messages', async () => {
    const node = makeHumanNode('h1', [0, 24], 10);
    channel.registerNode(node);
    await channel.sendAsync('h1', 'msg1');
    await channel.sendAsync('h1', 'msg2');
    channel.clearPending('h1');
    expect(channel.getPendingCount('h1')).toBe(0);
  });

  it('should poll response and return null when no response set', async () => {
    const node = makeHumanNode('h1', [0, 24], 10);
    channel.registerNode(node);
    await channel.sendAsync('h1', 'msg');
    const pending = channel.getPendingCount('h1');
    expect(pending).toBe(1);
    // No response set yet
    const response = await channel.pollResponse('h1', 'msg-h1-123', 1000);
    expect(response).toBeNull();
  });

  it('should update node status', () => {
    const node = makeHumanNode('h1');
    channel.registerNode(node);
    channel.updateStatus('h1', 'away');
    expect(node.status).toBe('away');
  });

  it('should list all registered nodes', () => {
    channel.registerNode(makeHumanNode('h1'));
    channel.registerNode(makeHumanNode('h2'));
    const nodes = channel.getAllNodes();
    expect(nodes).toHaveLength(2);
  });
});
