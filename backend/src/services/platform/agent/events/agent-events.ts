// ============================================================
// Agent Events — KMKI-PLAT-010
// 统一 Agent 事件定义
// ============================================================

import type { PlatformEvent, PlatformEventType } from '@platform/events/event-types'

// ─── Agent Event Types ───

export const AgentEventTypes = {
  Registered: 'agent:Registered' as PlatformEventType,
  Unregistered: 'agent:Unregistered' as PlatformEventType,
  SessionCreated: 'agent:SessionCreated' as PlatformEventType,
  Planning: 'agent:Planning' as PlatformEventType,
  Executing: 'agent:Executing' as PlatformEventType,
  Streaming: 'agent:Streaming' as PlatformEventType,
  Completed: 'agent:Completed' as PlatformEventType,
  Failed: 'agent:Failed' as PlatformEventType,
  Paused: 'agent:Paused' as PlatformEventType,
  Resumed: 'agent:Resumed' as PlatformEventType,
  Cancelled: 'agent:Cancelled' as PlatformEventType,
  ToolCalled: 'agent:ToolCalled' as PlatformEventType,
} as const

// ─── Event Bus Proxy ───

import { InMemoryEventBus } from '@platform/events/event-bus'

let eventBus: InMemoryEventBus | null = null

export function getAgentEventBus(): InMemoryEventBus {
  if (!eventBus) {
    eventBus = new InMemoryEventBus()
  }
  return eventBus
}

export function resetAgentEventBus(): void {
  eventBus = null
}
