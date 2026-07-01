// ════════════════════════════════════════════════════════════
// KH2-T002 — PublisherRegistry
// ════════════════════════════════════════════════════════════
// All publishers must register here.
// No switch, no if-else publisher selection — only registry lookup.
// ════════════════════════════════════════════════════════════

import { Publisher } from './types'

export class PublisherRegistry {
  private publishers: Map<string, Publisher> = new Map()

  register(publisher: Publisher): void {
    if (this.publishers.has(publisher.name)) {
      console.warn(`[PublisherRegistry] Overwriting publisher: ${publisher.name}`)
    }
    this.publishers.set(publisher.name, publisher)
  }

  get(name: string): Publisher | undefined {
    return this.publishers.get(name)
  }

  getAll(): Publisher[] {
    return Array.from(this.publishers.values())
  }

  filterByCapability(capability: string): Publisher[] {
    return this.getAll().filter(p => p.capabilities?.includes(capability))
  }

  unregister(name: string): void {
    this.publishers.delete(name)
  }
}
