/**
 * L2 三元事件总线 — 类型定义
 *
 * 核心设计：每个事件都带有 Trit 标记，表示事件的三元属性。
 * 事件总线提供 Trit 过滤订阅（onTrit），实现三元分流。
 */

import type { Trit } from '@kunlun/ternary';

/** 事件 payload 基类：所有事件必须带 trit 字段 */
export interface TernaryEventPayload {
  trit: Trit;
}

/**
 * Presence 事件
 */
export interface PresenceStateChangeEvent extends TernaryEventPayload {
  previous: string;   // AWAKE | WATCHING | RESTING
  current: string;
}

export interface PulseEvent extends TernaryEventPayload {
  pulseType: string;  // scheduled | event_driven | contradiction | practice | user_initiated
  pulseId: string;
}

/**
 * Lifecycle 事件
 */
export interface LifecycleEvent extends TernaryEventPayload {
  phase: 'init' | 'running' | 'shutdown' | 'error';
  detail?: string;
}

/**
 * 通用事件 map（可被上游扩展）
 */
export interface TernaryEventMap {
  'presence:state_change': PresenceStateChangeEvent;
  'presence:pulse': PulseEvent;
  'lifecycle': LifecycleEvent;
  [key: string]: TernaryEventPayload;
}

/**
 * 事件处理器类型
 */
export type TernaryEventHandler<T extends TernaryEventPayload = TernaryEventPayload> =
  (payload: T) => void | Promise<void>;

/**
 * 三进制事件总线接口
 */
export interface ITernaryEventBus {
  /** 发射三元事件 */
  emit<K extends keyof TernaryEventMap = string>(
    event: K,
    payload: TernaryEventMap[K]
  ): void;

  /** 订阅三元事件 */
  on<K extends keyof TernaryEventMap = string>(
    event: K,
    handler: TernaryEventHandler<TernaryEventMap[K]>
  ): void;

  /** 取消订阅 */
  off<K extends keyof TernaryEventMap = string>(
    event: K,
    handler: TernaryEventHandler<TernaryEventMap[K]>
  ): void;

  /** 按 Trit 值过滤订阅 — 只接收匹配此 Trit 的事件 */
  onTrit<K extends keyof TernaryEventMap = string>(
    event: K,
    tritFilter: Trit,
    handler: TernaryEventHandler<TernaryEventMap[K]>
  ): void;

  /** 获取当前 emit 嵌套深度（用于诊断） */
  readonly currentDepth: number;

  /** 获取事件计数统计 */
  getStats(): EventBusStats;
}

export interface EventBusStats {
  totalEmitted: number;
  totalDropped: number;
  totalLoopsDetected: number;
  totalStormsTriggered: number;
  totalHandlerErrors: number;
  totalHandlerTimeouts: number;
  currentDepth: number;
  subscriberCount: number;
}
