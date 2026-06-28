/**
 * Standard runtime metrics structure for all platform operations.
 */
export interface RuntimeMetrics {
    /** Runtime name (e.g. 'asset', 'semantic', 'goal', 'capability') */
    name: string;
    /** Operation latency in milliseconds */
    latencyMs: number;
    /** Optional cost tracking (e.g. LLM token cost) */
    cost?: number;
    /** Whether the operation succeeded */
    success: boolean;
    /** How many retries were attempted */
    retryCount: number;
    /** Error message if failed */
    error?: string;
    /** Unix timestamp in milliseconds */
    timestamp: number;
}
/**
 * Telemetry collector interface.
 * Implementations can write to console, file, or Prometheus.
 */
export interface ITelemetryCollector {
    /** Record a single metric point */
    record(metrics: RuntimeMetrics): void;
    /** Record multiple metric points */
    recordBatch(metrics: RuntimeMetrics[]): void;
    /** Get recent metrics (for dashboard) */
    getRecent(limit?: number): RuntimeMetrics[];
}
/**
 * Default console-based telemetry collector.
 */
export declare class ConsoleTelemetryCollector implements ITelemetryCollector {
    private buffer;
    private maxBuffer;
    record(metrics: RuntimeMetrics): void;
    recordBatch(metrics: RuntimeMetrics[]): void;
    getRecent(limit?: number): RuntimeMetrics[];
}
export declare const telemetryCollector: ITelemetryCollector;
