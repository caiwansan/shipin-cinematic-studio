import type { PlatformEvent, PlatformEventType } from './event-types.js';
export type EventHandler = (event: PlatformEvent) => void;
/**
 * Platform Event Bus interface.
 * Implementation can be in-memory (default), Redis, or Kafka.
 */
export interface IEventBus {
    /** Subscribe to a specific event type */
    on(type: PlatformEventType, handler: EventHandler): () => void;
    /** Subscribe to all events */
    onAny(handler: EventHandler): () => void;
    /** Unsubscribe from a specific event type */
    off(type: PlatformEventType, handler: EventHandler): void;
    /** Emit an event to all subscribers */
    emit(event: PlatformEvent): void;
    /** Get recent event history for observability */
    getHistory(type?: PlatformEventType): PlatformEvent[];
    /** Clear all listeners and history */
    clear(): void;
}
export declare class InMemoryEventBus implements IEventBus {
    private listeners;
    private globalListeners;
    private history;
    private maxHistory;
    on(type: PlatformEventType, handler: EventHandler): () => void;
    onAny(handler: EventHandler): () => void;
    off(type: PlatformEventType, handler: EventHandler): void;
    emit(event: PlatformEvent): void;
    getHistory(type?: PlatformEventType): PlatformEvent[];
    clear(): void;
}
export declare const platformEventBus: IEventBus;
