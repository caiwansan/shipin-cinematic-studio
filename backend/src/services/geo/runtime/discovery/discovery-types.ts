/**
 * Discovery types — moved from geo/runtime/provider/types.ts
 * R-004: Types only, no runtime implementation.
 */

import type { StructuredResult, ExecutionTrace, ProviderContext } from '../legacy-types';

export interface ProviderAdapter {
  readonly name: string;
  readonly model: string;
  execute(context: ProviderContext, prompt: string, options?: ExecuteOptions): Promise<StructuredResult>;
}

export interface ExecuteOptions {
  timeout?: number;
  maxRetries?: number;
  useCache?: boolean;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  baseURL?: string;
}

export type { StructuredResult, ExecutionTrace, ProviderContext };
