/**
 * Capability Contract Types
 *
 * Defines the full Capability Contract that all Providers implement.
 * Execution Kernel only knows CapabilityRequest/Result, never the provider.
 *
 * Key principle: Provider-agnostic interface.
 * - Execution sends CapabilityRequest → doesn't know which provider
 * - CapabilityRuntime routes to provider → doesn't know Execution internals
 * - Provider implements CapabilityProvider → doesn't know CapabilityRuntime
 *
 * @package @studio/platform/capability
 * @see CAPABILITY-SPEC.md §2
 */

import type { ExecutionContext } from '../execution/execution-context';

// ============ Capability ID ============

/**
 * Capability identifier.
 * Naming convention: <domain>.<action>
 *
 * Examples:
 * - llm.reasoning  — General reasoning and analysis
 * - llm.extraction — Structured data extraction from text
 * - llm.translation — Text translation between languages
 * - llm.summary    — Text summarization
 * - video.generate — Video generation
 * - image.generate — Image generation
 * - tts            — Text-to-speech
 * - embedding      — Text embedding
 * - rerank         — Search result reranking
 * - search         — Knowledge search
 * - ocr            — Optical character recognition
 * - citation       — Citation generation
 * - geo.*          — GEO workspace capabilities
 * - novel.*        — Novel workspace capabilities
 * - ppt.*          — PPT workspace capabilities
 */
export type CapabilityId = string;

// ============ Capability Descriptor ============

/**
 * Full capability descriptor — registered at startup.
 * Describes what a capability does, which provider/model handles it,
 * and its input/output schema.
 */
export interface CapabilityDescriptor {
  /** Unique capability ID (e.g., 'llm.reasoning') */
  id: CapabilityId;

  /** Human-readable name */
  name: string;

  /** Description of what this capability does */
  description: string;

  /** Semantic version of this capability contract */
  version: string;

  /** Provider ID that handles this capability (e.g., 'openai') */
  provider: string;

  /** Model ID used by the provider (e.g., 'gpt-4o') */
  model: string;

  /** JSON Schema for input validation */
  inputSchema: Record<string, unknown>;

  /** JSON Schema for output validation */
  outputSchema: Record<string, unknown>;
}

// ============ Capability Request/Result ============

/**
 * Capability request — the contract between Execution and CapabilityRuntime.
 *
 * Execution creates a CapabilityRequest and submits it through the pipeline.
 * CapabilityRuntime routes it to the appropriate provider.
 *
 * Execution NEVER knows which provider handles this request.
 */
export interface CapabilityRequest {
  /** The capability to invoke */
  capabilityId: CapabilityId;

  /** Execution context (attached by ExecutionCapabilityHandler) */
  context: ExecutionContext;

  /** Input data for the capability */
  input: Record<string, unknown>;

  /** Optional execution parameters */
  options?: {
    /** Timeout in milliseconds */
    timeout?: number;
    /** Model temperature (0-2) */
    temperature?: number;
    /** Maximum output tokens */
    maxTokens?: number;
    /** Whether to stream the response */
    stream?: boolean;
    /** Custom tags for tracking */
    tags?: string[];
  };
}

/**
 * Capability execution context — tracking info for a single execution.
 */
export interface CapabilityContext {
  /** Distributed trace ID */
  traceId: string;
  /** Current attempt number (1-based) */
  attempt: number;
  /** Timestamp when execution started */
  startedAt: number;
}

/**
 * Asset record — reserved for C2.2 Asset Center integration.
 * Represents a media asset produced by a capability.
 */
export interface AssetRecord {
  type: 'image' | 'video' | 'audio' | 'document' | 'knowledge' | 'citation' | 'embedding';
  uri: string;
  mimeType?: string;
  size?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Capability result — returned to Execution after provider handles the request.
 */
export interface CapabilityResult {
  /** Whether the execution succeeded */
  success: boolean;

  /** Output data (present on success) */
  output?: unknown;

  /** Error information (present on failure) */
  error?: CapabilityError;

  /** Resource usage statistics */
  usage?: {
    /** Input tokens consumed */
    inputTokens?: number;
    /** Output tokens generated */
    outputTokens?: number;
    /** Total tokens consumed */
    totalTokens?: number;
    /** Estimated cost in USD */
    cost?: number;
    /** Execution duration in milliseconds */
    durationMs: number;
  };

  /** Assets produced by this execution (reserved for C2.2 Asset Center) */
  assets?: AssetRecord[];

  /** Additional metadata from the provider */
  metadata?: Record<string, unknown>;
}

// ============ Capability Error ============

/**
 * Standard capability error format.
 */
export interface CapabilityError {
  /** Machine-readable error code (e.g., 'RATE_LIMITED', 'TIMEOUT', 'INVALID_INPUT') */
  code: string;

  /** Human-readable error message */
  message: string;

  /** Whether this error is retryable */
  retryable: boolean;

  /** Additional error details */
  details?: Record<string, unknown>;
}

// ============ Capability Provider Interface ============

/**
 * CapabilityProvider — all providers implement this interface.
 *
 * This is the ONLY interface that CapabilityRuntime knows.
 * CapabilityRuntime does NOT import any provider-specific types.
 */
export interface CapabilityProvider {
  /** Unique provider identifier (e.g., 'openai', 'deepseek', 'qwen') */
  readonly id: string;

  /** Human-readable provider name */
  readonly name: string;

  /** Provider implementation version */
  readonly version: string;

  /**
   * Execute a capability request.
   * This is the single entry point for all capability execution.
   *
   * @param request - The capability request to execute
   * @returns Capability result
   */
  execute(request: CapabilityRequest): Promise<CapabilityResult>;

  /**
   * Check provider health.
   * @returns Health status and latency
   */
  health(): Promise<{ ok: boolean; latency: number }>;

  /**
   * Check if this provider supports a given capability.
   * @param capabilityId - The capability ID to check
   * @returns true if this provider can handle the capability
   */
  supports(capabilityId: CapabilityId): boolean;

  /**
   * Get cost estimates for a capability.
   * @param capabilityId - The capability ID
   * @returns Cost per 1K tokens for input and output
   */
  cost(capabilityId: CapabilityId): Promise<{ input: number; output: number }>;

  /**
   * Get usage limits for a capability.
   * @param capabilityId - The capability ID
   * @returns Max tokens and max concurrent requests
   */
  limits(capabilityId: CapabilityId): Promise<{ maxTokens: number; maxConcurrent: number }>;
}
