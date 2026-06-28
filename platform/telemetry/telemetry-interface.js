"use strict";
// ============================================================
// Telemetry Interface — observability metrics for all Runtimes
// ARCH-001-I: Define interface; Prometheus integration deferred to next phase
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.telemetryCollector = exports.ConsoleTelemetryCollector = void 0;
/**
 * Default console-based telemetry collector.
 */
class ConsoleTelemetryCollector {
    buffer = [];
    maxBuffer = 1000;
    record(metrics) {
        this.buffer.push(metrics);
        if (this.buffer.length > this.maxBuffer) {
            this.buffer.shift();
        }
        if (!metrics.success) {
            console.warn(`[Telemetry] ${metrics.name} failed after ${metrics.retryCount} retries (${metrics.latencyMs}ms): ${metrics.error}`);
        }
    }
    recordBatch(metrics) {
        for (const m of metrics)
            this.record(m);
    }
    getRecent(limit = 100) {
        return this.buffer.slice(-limit);
    }
}
exports.ConsoleTelemetryCollector = ConsoleTelemetryCollector;
exports.telemetryCollector = new ConsoleTelemetryCollector();
