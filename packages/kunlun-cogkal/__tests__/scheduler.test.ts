/**
 * CogKAL 调度器测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  CogScheduler,
  CogPriority,
  CogTaskStatus,
  CogSignal,
  CogIPIType,
  priorityFromLevel,
} from '../src/index';
import type { CogTaskCB, CogSchedPolicy } from '../src/index';

describe('CogScheduler', () => {
  let scheduler: CogScheduler;

  beforeEach(() => {
    scheduler = new CogScheduler();
  });

  afterEach(() => {
    scheduler.stopGC();
    scheduler.reset();
  });

  // ─── 实例管理 ───

  describe('实例管理', () => {
    it('应注册新实例', () => {
      const rq = scheduler.registerInstance('pi-1');
      expect(rq).toBeDefined();
      expect(rq.instanceId).toBe('pi-1');
      expect(scheduler.getInstanceIds()).toContain('pi-1');
    });

    it('重复注册同一实例应返回已有实例', () => {
      const rq1 = scheduler.registerInstance('pi-1');
      const rq2 = scheduler.registerInstance('pi-1');
      expect(rq1).toBe(rq2);
    });

    it('应注销实例', () => {
      scheduler.registerInstance('pi-1');
      scheduler.unregisterInstance('pi-1');
      expect(scheduler.getInstanceIds()).not.toContain('pi-1');
    });
  });

  // ─── 任务创建 ───

  describe('任务创建', () => {
    it('应创建认知任务', () => {
      const task = scheduler.createTask({
        name: 'test-task',
        type: 'think',
        context: {
          input: { data: 'test' },
          executor: async () => 'result',
          args: [],
        },
      });

      expect(task.id).toMatch(/^cog-task-/);
      expect(task.type).toBe('think');
      expect(task.status).toBe(CogTaskStatus.INIT);
      expect(task.priority).toBe(CogPriority.NORMAL);
    });

    it('应支持自定义优先级', () => {
      const task = scheduler.createTask({
        name: 'urgent-task',
        type: 'think',
        priority: CogPriority.CRITICAL,
        context: {
          input: {},
          executor: async () => null,
          args: [],
        },
      });

      expect(task.priority).toBe(CogPriority.CRITICAL);
    });

    it('应支持自定义调度策略', () => {
      const policy: CogSchedPolicy = {
        type: 'consensus-deadline',
        deadline: Date.now() + 60000,
        finishTime: 0,
        period: 0,
      };

      const task = scheduler.createTask({
        name: 'deadline-task',
        type: 'think',
        policy,
        context: {
          input: {},
          executor: async () => null,
          args: [],
        },
      });

      expect(task.policy.type).toBe('consensus-deadline');
    });
  });

  // ─── 任务入队 ───

  describe('任务入队', () => {
    it('共识策略任务应加入共识队列', () => {
      scheduler.registerInstance('pi-1');
      const task = scheduler.createTask({
        name: 'consensus-task',
        type: 'think',
        policy: {
          type: 'consensus-deadline',
          deadline: Date.now() + 10000,
          finishTime: 0,
          period: 0,
        },
        context: { input: {}, executor: async () => null, args: [] },
      });

      scheduler.enqueueTask(task, 'pi-1');
      expect(task.status).toBe(CogTaskStatus.READY);
    });

    it('矛盾优先级策略任务应加入矛盾队列', () => {
      scheduler.registerInstance('pi-1');
      const task = scheduler.createTask({
        name: 'contradiction-task',
        type: 'think',
        priority: CogPriority.HIGH,
        policy: {
          type: 'contradiction-priority',
          priority: CogPriority.HIGH,
          basePrio: CogPriority.NORMAL,
          timeSlice: 1000,
        },
        context: { input: {}, executor: async () => null, args: [] },
      });

      scheduler.enqueueTask(task, 'pi-1');
      expect(task.status).toBe(CogTaskStatus.READY);
    });

    it('螺旋迭代策略任务应加入螺旋队列', () => {
      scheduler.registerInstance('pi-1');
      const task = scheduler.createTask({
        name: 'spiral-task',
        type: 'think',
        policy: {
          type: 'spiral-iteration',
          cycleCount: 3,
          convergenceScore: 0.2,
          deltaConvergence: 0.1,
        },
        context: { input: {}, executor: async () => null, args: [] },
      });

      scheduler.enqueueTask(task, 'pi-1');
      expect(task.status).toBe(CogTaskStatus.READY);
    });

    it('未注册实例应抛出错误', () => {
      const task = scheduler.createTask({
        name: 'bad-task',
        type: 'think',
        context: { input: {}, executor: async () => null, args: [] },
      });

      expect(() => scheduler.enqueueTask(task, 'nonexistent')).toThrow();
    });
  });

  // ─── 调度决策 ───

  describe('调度决策 (topCogTaskGet)', () => {
    it('空闲队列应返回 idleTask', () => {
      const rq = scheduler.registerInstance('pi-1');
      const result = scheduler.topCogTaskGet(rq);
      expect(result).toBeNull();
    });

    it('应优先选择共识截止时间任务', () => {
      const rq = scheduler.registerInstance('pi-1');

      // 添加矛盾优先级任务
      const contradictionTask = scheduler.createTask({
        name: 'ct-task',
        type: 'think',
        priority: CogPriority.CRITICAL,
        policy: {
          type: 'contradiction-priority',
          priority: CogPriority.CRITICAL,
          basePrio: CogPriority.NORMAL,
          timeSlice: 100,
        },
        context: { input: {}, executor: async () => null, args: [] },
      });
      scheduler.enqueueTask(contradictionTask, 'pi-1');

      // 添加共识任务
      const consensusTask = scheduler.createTask({
        name: 'cs-task',
        type: 'think',
        policy: {
          type: 'consensus-deadline',
          deadline: Date.now() + 5000,
          finishTime: 0,
          period: 0,
        },
        context: { input: {}, executor: async () => null, args: [] },
      });
      scheduler.enqueueTask(consensusTask, 'pi-1');

      // 共识任务应优先（一级优先）
      const result = scheduler.topCogTaskGet(rq);
      expect(result?.name).toBe('cs-task');
    });

    it('应跳过已过期deadline的共识任务', () => {
      const rq = scheduler.registerInstance('pi-1');

      // 添加过期的共识任务
      const expiredTask = scheduler.createTask({
        name: 'expired-task',
        type: 'think',
        policy: {
          type: 'consensus-deadline',
          deadline: Date.now() - 1000, // 已过期
          finishTime: 0,
          period: 0,
        },
        context: { input: {}, executor: async () => null, args: [] },
      });
      scheduler.enqueueTask(expiredTask, 'pi-1');

      // 添加矛盾优先级任务
      const ctTask = scheduler.createTask({
        name: 'ct-task',
        type: 'think',
        priority: CogPriority.HIGH,
        policy: {
          type: 'contradiction-priority',
          priority: CogPriority.HIGH,
          basePrio: CogPriority.NORMAL,
          timeSlice: 100,
        },
        context: { input: {}, executor: async () => null, args: [] },
      });
      scheduler.enqueueTask(ctTask, 'pi-1');

      const result = scheduler.topCogTaskGet(rq);
      // 过期任务被跳过，应返回矛盾优先级任务
      expect(result?.name).toBe('ct-task');
    });

    it('螺旋迭代任务收敛度差的优先', () => {
      const rq = scheduler.registerInstance('pi-1');

      const spiralLow = scheduler.createTask({
        name: 'spiral-low',
        type: 'think',
        policy: {
          type: 'spiral-iteration',
          cycleCount: 1,
          convergenceScore: 0.1,
          deltaConvergence: 0.05,
        },
        context: { input: {}, executor: async () => null, args: [] },
      });
      scheduler.enqueueTask(spiralLow, 'pi-1');

      const spiralHigh = scheduler.createTask({
        name: 'spiral-high',
        type: 'think',
        policy: {
          type: 'spiral-iteration',
          cycleCount: 5,
          convergenceScore: 0.9,
          deltaConvergence: 0.01,
        },
        context: { input: {}, executor: async () => null, args: [] },
      });
      scheduler.enqueueTask(spiralHigh, 'pi-1');

      const result = scheduler.topCogTaskGet(rq);
      // 收敛度低的优先（0.1 < 0.9）
      expect(result?.name).toBe('spiral-low');
    });
  });

  // ─── 任务执行 ───

  describe('任务执行', () => {
    it('应成功执行任务', async () => {
      scheduler.registerInstance('pi-1');
      const task = scheduler.createTask({
        name: 'exec-task',
        type: 'think',
        policy: {
          type: 'contradiction-priority',
          priority: CogPriority.NORMAL,
          basePrio: CogPriority.NORMAL,
          timeSlice: 100,
        },
        context: {
          input: { data: 'hello' },
          executor: async (ctx) => `processed: ${JSON.stringify(ctx.input)}`,
          args: [],
        },
      });

      scheduler.enqueueTask(task, 'pi-1');
      await scheduler.reschedule('pi-1');

      expect(task.context.output).toBe('processed: {"data":"hello"}');
      expect(task.status).toBe(CogTaskStatus.EXIT);
    });

    it('任务执行错误应标记ERROR状态', async () => {
      scheduler.registerInstance('pi-1');
      const task = scheduler.createTask({
        name: 'error-task',
        type: 'think',
        policy: {
          type: 'contradiction-priority',
          priority: CogPriority.NORMAL,
          basePrio: CogPriority.NORMAL,
          timeSlice: 100,
        },
        context: {
          input: {},
          executor: async () => { throw new Error('test error'); },
          args: [],
        },
      });

      scheduler.enqueueTask(task, 'pi-1');
      await scheduler.reschedule('pi-1');

      expect(task.status).toBe(CogTaskStatus.ERROR);
      expect(task.context.error).toBeDefined();
      expect(task.context.error?.message).toBe('test error');
    });
  });

  // ─── 亲和性 ───

  describe('亲和性检查', () => {
    it('无限制时应允许任意实例', () => {
      const task = scheduler.createTask({
        name: 'free-task',
        type: 'think',
        context: { input: {}, executor: async () => null, args: [] },
      });

      expect(scheduler.checkKernelAffinity(task, 'pi-1')).toBe(true);
      expect(scheduler.checkKernelAffinity(task, 'pi-2')).toBe(true);
    });

    it('限制实例时应只允许指定实例', () => {
      const task = scheduler.createTask({
        name: 'bound-task',
        type: 'think',
        kernelAffinity: {
          allowedInstances: ['pi-1', 'pi-3'],
        },
        context: { input: {}, executor: async () => null, args: [] },
      });

      expect(scheduler.checkKernelAffinity(task, 'pi-1')).toBe(true);
      expect(scheduler.checkKernelAffinity(task, 'pi-3')).toBe(true);
      expect(scheduler.checkKernelAffinity(task, 'pi-2')).toBe(false);
    });
  });

  // ─── GC ───

  describe('垃圾回收', () => {
    it('应回收已完成的任务', async () => {
      scheduler.registerInstance('pi-1');
      const task = scheduler.createTask({
        name: 'gc-task',
        type: 'think',
        policy: {
          type: 'contradiction-priority',
          priority: CogPriority.NORMAL,
          basePrio: CogPriority.NORMAL,
          timeSlice: 100,
        },
        context: { input: {}, executor: async () => 'done', args: [] },
      });

      scheduler.enqueueTask(task, 'pi-1');
      await scheduler.reschedule('pi-1');

      const collected = scheduler.collectGarbage();
      expect(collected).toBe(1);
      expect(scheduler.getTasks()).toHaveLength(0);
    });

    it('应回收KILL信号标记的任务', () => {
      const task = scheduler.createTask({
        name: 'kill-task',
        type: 'think',
        context: { input: {}, executor: async () => null, args: [] },
      });
      task.signal = CogSignal.KILL;

      const collected = scheduler.collectGarbage();
      expect(collected).toBe(1);
    });
  });

  // ─── 统计 ───

  describe('统计信息', () => {
    it('应返回正确的统计', async () => {
      scheduler.registerInstance('pi-1');

      for (let i = 0; i < 3; i++) {
        const task = scheduler.createTask({
          name: `stat-task-${i}`,
          type: 'think',
          policy: {
            type: 'contradiction-priority',
            priority: CogPriority.NORMAL,
            basePrio: CogPriority.NORMAL,
            timeSlice: 100,
          },
          context: { input: { i }, executor: async (ctx) => ctx.input, args: [] },
        });
        scheduler.enqueueTask(task, 'pi-1');
        await scheduler.reschedule('pi-1');
      }

      const stats = scheduler.getStats();
      expect(stats.completedTasks).toBe(3);
      expect(stats.errorTasks).toBe(0);
    });
  });

  // ─── IPI ───

  describe('跨实例IPI', () => {
    it('应能发送SCHEDULE IPI', () => {
      scheduler.registerInstance('pi-1');
      scheduler.registerInstance('pi-2');

      // SCHEDULE 应不抛出异常
      expect(() => {
        scheduler.sendIPI(['pi-2'], CogIPIType.SCHEDULE, 'pi-1');
      }).not.toThrow();
    });

    it('应忽略来自自身的IPI', () => {
      scheduler.registerInstance('pi-1');

      expect(() => {
        scheduler.sendIPI(['pi-1'], CogIPIType.HALT, 'pi-1');
      }).not.toThrow();
    });
  });

  // ─── 优先级辅助函数 ───

  describe('priorityFromLevel', () => {
    it('高矛盾+高紧急 = CRITICAL', () => {
      expect(priorityFromLevel(0.9, 0.9)).toBe(CogPriority.CRITICAL);
    });

    it('中等 = HIGH 或 NORMAL', () => {
      expect(priorityFromLevel(0.6, 0.4)).toBe(CogPriority.HIGH);
      expect(priorityFromLevel(0.3, 0.4)).toBe(CogPriority.NORMAL);
    });

    it('低值 = LOW 或 IDLE', () => {
      expect(priorityFromLevel(0.1, 0.2)).toBe(CogPriority.LOW);
      expect(priorityFromLevel(0.0, 0.0)).toBe(CogPriority.IDLE);
    });
  });
});
