/**
 * Legacy types preserved from geo/runtime/provider/types.ts
 * These are still referenced by replay/ and discovery/ modules.
 * R-004: Types only — no runtime implementation.
 */

export interface StructuredResult {
  summary: string;
  findings: any[];
  evidence: any[];
  citations: any[];
  confidence: number;
  metrics: ResultMetrics;
  providerMetadata: ProviderMetadata;
  rawResponse: string;
}

export interface ResultMetrics {
  duration: number;
  tokenCount?: number;
  cost?: number;
  cacheHit: boolean;
}

export interface ProviderMetadata {
  provider: string;
  model: string;
  promptVersion?: string;
  snapshotVersion: string;
  timestamp: string;
  traceId: string;
}

export interface ExecutionTrace {
  traceId: string;
  requestId: string;
  provider: string;
  model: string;
  prompt: string;
  promptVersion: string;
  snapshotVersion: string;
  snapshotHash: string;
  status: 'success' | 'error' | 'timeout' | 'cancelled';
  duration: number;
  tokenCount?: number;
  cost?: number;
  error?: string;
  retryCount: number;
  cached: boolean;
  timestamp: string;
  result?: StructuredResult;
}

export interface ProviderContext {
  snapshotVersion: string;
  snapshotHash: string;
  brandContext: any;
  requestId: string;
}
