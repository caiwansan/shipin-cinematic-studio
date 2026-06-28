// causal/event-linker.ts — Causal chain tracker

import { CausalLink } from './types'

export class EventLinker {
  private links = new Map<string, CausalLink>()

  link(eventId: string, link: CausalLink) {
    this.links.set(eventId, link)
  }

  get(eventId: string): CausalLink | undefined {
    return this.links.get(eventId)
  }

  /**
   * 从 eventId 向上回溯因果链
   */
  trace(eventId: string): CausalLink[] {
    const chain: CausalLink[] = []
    let current = this.links.get(eventId)
    const seen = new Set<string>()

    while (current && !seen.has(current.eventId)) {
      seen.add(current.eventId)
      chain.push(current)
      current = current.parentEventId
        ? this.links.get(current.parentEventId)
        : undefined
    }

    return chain
  }

  /**
   * 获取所有影响某实体的因果链
   */
  getEventsForEntity(entityId: string): CausalLink[] {
    const result: CausalLink[] = []
    for (const link of this.links.values()) {
      if (link.affects.entityIds.includes(entityId)) {
        result.push(link)
      }
    }
    return result
  }
}
