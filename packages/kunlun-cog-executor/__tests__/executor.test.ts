import { describe, it, expect, beforeEach } from 'vitest';
import { CogTaskExecutor } from '../src/index.js';
import type { ExecuteRequest, ExecuteResponse, SpiralState } from '../src/index.js';

describe('CogTaskExecutor', () => {
  let executor: CogTaskExecutor;

  beforeEach(() => {
    executor = new CogTaskExecutor();
  });

  function makeRequest(mode: 'sync' | 'async' | 'spiral', sessionId: string = 's1'): ExecuteRequest {
    return {
      sessionId,
      algorithm: 'test-algo',
      mode,
      input: { data: 'test-input' },
    };
  }

  it('should execute sync mode', async () => {
    const req = makeRequest('sync');
    const response = await executor.execute(req);
    expect(response.mode).toBe('sync');
    expect(response.output).toBeDefined();
    expect(response.cycles).toBeUndefined();
  });

  it('should execute async mode', async () => {
    const req = makeRequest('async');
    const response = await executor.execute(req);
    expect(response.mode).toBe('async');
    expect(response.output).toBeDefined();
  });

  it('should execute spiral mode and return cycles', async () => {
    const req = makeRequest('spiral', 'spiral-1');
    const response = await executor.execute(req);
    expect(response.mode).toBe('spiral');
    expect(response.cycles).toBeDefined();
    expect(response.cycles!).toBeGreaterThan(0);
    expect(response.cycles!).toBeLessThanOrEqual(10);
  });

  it('should converge in spiral mode before max iterations', async () => {
    const req = makeRequest('spiral', 'conv-1');
    const response = await executor.execute(req);
    // delta starts at 1.0, multiplied by 0.6 each iteration
    // 1.0, 0.6, 0.36, 0.216, 0.1296, 0.07776 → converged at iteration 5
    expect(response.cycles!).toBeLessThanOrEqual(5);
    const state = executor.getSessionState('conv-1');
    expect(state?.converged).toBe(true);
  });

  it('should determine convergence correctly', () => {
    const convergedState: SpiralState = {
      iteration: 5,
      maxIterations: 10,
      lastOutput: null,
      delta: 0.05,
      converged: true,
    };
    expect(executor.isConverged(convergedState)).toBe(true);

    const notConvergedState: SpiralState = {
      iteration: 2,
      maxIterations: 10,
      lastOutput: null,
      delta: 0.5,
      converged: false,
    };
    expect(executor.isConverged(notConvergedState)).toBe(false);
  });

  it('should sync method directly', async () => {
    const req = makeRequest('sync');
    const response = await executor.sync('algo', req);
    expect(response.mode).toBe('sync');
  });

  it('should async method directly', async () => {
    const req = makeRequest('async');
    const response = await executor.async('algo', req);
    expect(response.mode).toBe('async');
  });

  it('should spiral method directly', async () => {
    const req = makeRequest('spiral', 'direct-spiral');
    const response = await executor.spiral('algo', req);
    expect(response.mode).toBe('spiral');
    expect(response.cycles).toBeDefined();
  });

  it('should store and retrieve session state', async () => {
    const req = makeRequest('spiral', 'state-1');
    await executor.execute(req);
    const state = executor.getSessionState('state-1');
    expect(state).toBeDefined();
    expect(state!.iteration).toBeGreaterThan(0);
    expect(state!.converged).toBe(true);
  });

  it('should clear session', async () => {
    const req = makeRequest('spiral', 'clear-1');
    await executor.execute(req);
    executor.clearSession('clear-1');
    const state = executor.getSessionState('clear-1');
    expect(state).toBeUndefined();
  });
});
