"use strict";
// ============================================================
// Platform Context — unified context for all Runtime operations
// ARCH-001-E: All Runtime method signatures must use this interface
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContext = createContext;
exports.mergeContext = mergeContext;
/**
 * Create a context with defaults.
 */
function createContext(overrides = {}) {
    return {
        traceId: overrides.traceId || `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        requestId: overrides.requestId || `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ...overrides,
    };
}
/**
 * Merge child context into parent, child fields take precedence.
 */
function mergeContext(parent, child) {
    return { ...parent, ...child };
}
