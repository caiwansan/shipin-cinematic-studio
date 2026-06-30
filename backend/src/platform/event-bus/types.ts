export type EventHandler = (event: DomainEvent) => void | Promise<void>;

export interface DomainEvent {
  id: string;
  type: string;
  source: string;
  timestamp: Date;
  payload: Record<string, any>;
  // Events are immutable — no updater methods allowed
}

export interface EventSubscription {
  eventType: string;
  handler: EventHandler;
  id: string;
}

export interface EventBus {
  publish(event: Omit<DomainEvent, 'id' | 'timestamp'>): Promise<void>;
  subscribe(eventType: string, handler: EventHandler): string;
  unsubscribe(subscriptionId: string): void;
  listSubscriptions(): EventSubscription[];
}
