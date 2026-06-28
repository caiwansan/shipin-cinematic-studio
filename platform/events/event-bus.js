"use strict";
// ============================================================
// Platform Event Bus — unified event bus interface
// ARCH-001-D: All Runtimes must use this interface instead of own EventEmitter
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.platformEventBus = exports.InMemoryEventBus = void 0;
// ============================================================
// Default In-Memory Implementation
// ============================================================
class InMemoryEventBus {
    listeners = new Map();
    globalListeners = new Set();
    history = [];
    maxHistory = 200;
    on(type, handler) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set());
        }
        this.listeners.get(type).add(handler);
        return () => this.off(type, handler);
    }
    onAny(handler) {
        this.globalListeners.add(handler);
        return () => { this.globalListeners.delete(handler); };
    }
    off(type, handler) {
        this.listeners.get(type)?.delete(handler);
    }
    emit(event) {
        // Store in history
        this.history.push(event);
        if (this.history.length > this.maxHistory) {
            this.history.splice(0, Math.floor(this.maxHistory * 0.25));
        }
        // Notify type-specific listeners
        const typeListeners = this.listeners.get(event.type);
        if (typeListeners) {
            for (const handler of typeListeners) {
                try {
                    handler(event);
                }
                catch (err) {
                    console.error(`[EventBus] Error in ${event.type} handler:`, err);
                }
            }
        }
        // Notify global listeners
        for (const handler of this.globalListeners) {
            try {
                handler(event);
            }
            catch (err) {
                console.error(`[EventBus] Error in global handler:`, err);
            }
        }
    }
    getHistory(type) {
        if (type)
            return this.history.filter(e => e.type === type);
        return [...this.history];
    }
    clear() {
        this.listeners.clear();
        this.globalListeners.clear();
        this.history = [];
    }
}
exports.InMemoryEventBus = InMemoryEventBus;
// Singleton instance
exports.platformEventBus = new InMemoryEventBus();
