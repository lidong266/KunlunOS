// L2 三元事件总线 — 统一入口

export type {
  TernaryEventPayload,
  TernaryEventMap,
  TernaryEventHandler,
  ITernaryEventBus,
  EventBusStats,
  PresenceStateChangeEvent,
  PulseEvent,
  LifecycleEvent,
} from './types.js';

export { TernaryEventBus } from './event-bus.js';
export { StormProtector, LoopDetector, safeInvokeHandler } from './guard.js';
export type { HandlerResult } from './guard.js';
