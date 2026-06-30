import { EventBus, DomainEvent, EventHandler, EventSubscription } from './types';

const subscriptions = new Map<string, EventSubscription[]>();

function uuid(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export const eventBus: EventBus = {
  async publish(event): Promise<void> {
    const domainEvent: DomainEvent = {
      id: uuid(),
      type: event.type,
      source: event.source,
      timestamp: new Date(),
      payload: { ...event.payload }, // Defensive copy — payload is immutable after publication
    };
    const handlers = subscriptions.get(event.type) || [];
    await Promise.allSettled(
      handlers.map(h => Promise.resolve(h.handler(domainEvent)))
    );
  },

  subscribe(eventType: string, handler: EventHandler): string {
    const sub: EventSubscription = {
      eventType,
      handler,
      id: `sub_${uuid()}`,
    };
    if (!subscriptions.has(eventType)) {
      subscriptions.set(eventType, []);
    }
    subscriptions.get(eventType)!.push(sub);
    return sub.id;
  },

  unsubscribe(subscriptionId: string): void {
    for (const [eventType, subs] of subscriptions.entries()) {
      const filtered = subs.filter(s => s.id !== subscriptionId);
      if (filtered.length !== subs.length) {
        subscriptions.set(eventType, filtered);
        return;
      }
    }
  },

  listSubscriptions(): EventSubscription[] {
    return Array.from(subscriptions.values()).flat();
  },
};

// ====== Stub Subscribers (to be implemented later) ======

export const growthMemorySubscriber: EventHandler = async (event) => {
  console.log(`[GrowthMemorySubscriber] Received: ${event.type} (to be implemented)`);
};

export const learningSubscriber: EventHandler = async (event) => {
  console.log(`[LearningSubscriber] Received: ${event.type} (to be implemented)`);
};

export const publishingSubscriber: EventHandler = async (event) => {
  console.log(`[PublishingSubscriber] Received: ${event.type} (to be implemented)`);
};
