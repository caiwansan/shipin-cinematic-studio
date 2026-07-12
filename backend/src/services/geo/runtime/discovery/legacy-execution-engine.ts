/**
 * Legacy Execution Engine — preserved singleton for discovery-runner
 * R-004: Moved out of provider/ directory to allow cleanup of geo/runtime/provider/
 *
 * This is the original ExecutionEngine from geo/runtime/provider/execution-engine.ts.
 * Kept as-is for backward compatibility of the discovery pipeline.
 */

import type { ProviderAdapter, ProviderContext, ExecuteOptions, StructuredResult, ExecutionTrace } from './discovery-types';

export interface EngineConfig {
  defaultTimeout?: number;
  defaultMaxRetries?: number;
  enableCache?: boolean;
  enableCircuitBreaker?: boolean;
  enableRateLimit?: boolean;
  traceStore?: Map<string, ExecutionTrace>;
}

export class ExecutionEngine {
  private providers: Map<string, ProviderAdapter> = new Map();
  private config: Required<EngineConfig>;
  public traces: Map<string, ExecutionTrace>;

  constructor(config?: EngineConfig) {
    this.config = {
      defaultTimeout: config?.defaultTimeout ?? 30000,
      defaultMaxRetries: config?.defaultMaxRetries ?? 2,
      enableCache: config?.enableCache ?? true,
      enableCircuitBreaker: config?.enableCircuitBreaker ?? true,
      enableRateLimit: config?.enableRateLimit ?? true,
      traceStore: config?.traceStore ?? new Map(),
    };
    this.traces = this.config.traceStore;
  }

  registerProvider(name: string, adapter: ProviderAdapter): void {
    this.providers.set(name, adapter);
  }

  getProvider(name: string): ProviderAdapter | undefined {
    return this.providers.get(name);
  }

  getProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  async execute(
    providerName: string,
    context: ProviderContext,
    prompt: string,
    options?: ExecuteOptions
  ): Promise<StructuredResult> {
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const startTime = Date.now();

    const adapter = this.providers.get(providerName);
    if (!adapter) {
      throw new Error(`Provider '${providerName}' not registered`);
    }

    const result = await adapter.execute(context, prompt, {
      ...options,
      timeout: options?.timeout ?? this.config.defaultTimeout,
      maxRetries: options?.maxRetries ?? this.config.defaultMaxRetries,
    });

    const duration = Date.now() - startTime;

    const trace: ExecutionTrace = {
      traceId,
      requestId: context.requestId,
      provider: providerName,
      model: adapter.model,
      prompt,
      promptVersion: '',
      snapshotVersion: context.snapshotVersion,
      snapshotHash: context.snapshotHash,
      status: 'success',
      duration,
      tokenCount: result.metrics.tokenCount,
      cost: result.metrics.cost,
      retryCount: 0,
      cached: result.metrics.cacheHit,
      timestamp: new Date().toISOString(),
      result,
    };
    this.traces.set(traceId, trace);

    return result;
  }

  getTrace(traceId: string): ExecutionTrace | undefined {
    return this.traces.get(traceId);
  }

  listTraces(): ExecutionTrace[] {
    return Array.from(this.traces.values());
  }
}

export const executionEngine = new ExecutionEngine();
