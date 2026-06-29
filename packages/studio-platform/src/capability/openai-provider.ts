/**
 * OpenAI Provider — Real LLM capability provider (OpenAI-compatible API).
 *
 * Implements the CapabilityProvider interface from capability/types.ts.
 * Makes real HTTP calls to any OpenAI-compatible API endpoint.
 *
 * Capability routing:
 * - llm.reasoning  → GPT-4 (max intelligence)
 * - llm.extraction → GPT-4o-mini (fast, cheap for structured extraction)
 * - llm.translation → GPT-4o (balanced)
 * - llm.summary    → GPT-4o-mini (fast, cheap for summarization)
 *
 * @package @studio/platform/capability
 * @see CAPABILITY-SPEC.md §2
 */

import type {
  CapabilityProvider,
  CapabilityId,
  CapabilityRequest,
  CapabilityResult,
} from './types';

// ============ Types ============

/**
 * Completion request for the OpenAI API.
 */
export interface CompletionRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
  stream?: boolean;
}

/**
 * Completion response from the OpenAI API.
 */
export interface CompletionResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Streaming chunk from SSE response.
 */
export interface StreamChunk {
  content: string;
  done: boolean;
}

/**
 * OpenAI-compatible Provider Configuration.
 */
export interface OpenAIProviderConfig {
  /** API base URL (e.g., https://api.openai.com/v1) */
  baseUrl: string;

  /** API key */
  apiKey: string;

  /** Default model (e.g., gpt-4o) */
  defaultModel: string;

  /** Request timeout in ms */
  timeout?: number;

  /** Maximum retries on failure */
  maxRetries?: number;
}

// ============ Capability → Model Mapping ============

/**
 * Default mapping from capability ID to model name.
 * Can be overridden via constructor options.
 */
const DEFAULT_CAPABILITY_MODELS: Record<string, string> = {
  'llm.reasoning': 'gpt-4',         // Max intelligence for reasoning
  'llm.extraction': 'gpt-4o-mini',  // Fast, cheap for structured extraction
  'llm.translation': 'gpt-4o',      // Balanced for translation
  'llm.summary': 'gpt-4o-mini',     // Fast, cheap for summarization
};

/**
 * Default supported capabilities for OpenAI provider.
 */
const DEFAULT_SUPPORTED_CAPABILITIES = new Set<string>([
  'llm.reasoning',
  'llm.extraction',
  'llm.translation',
  'llm.summary',
]);

// ============ Provider Implementation ============

/**
 * OpenAI-compatible Provider.
 *
 * Implements CapabilityProvider interface.
 * Connects to any OpenAI-compatible API endpoint.
 * Uses environment variables for configuration by default.
 *
 * Environment variables:
 * - OPENAI_API_KEY: API key
 * - OPENAI_BASE_URL: API base URL (default: https://api.openai.com/v1)
 * - LLM_MODEL: Default model name (default: gpt-4o)
 */
export class OpenAIProvider implements CapabilityProvider {
  readonly id: string = 'openai';
  readonly name: string = 'OpenAI';
  readonly version: string = '1.0.0';

  private config: OpenAIProviderConfig;
  private capabilityModels: Record<string, string>;
  private supportedCapabilities: Set<string>;

  constructor(config?: Partial<OpenAIProviderConfig>) {
    this.config = {
      baseUrl: config?.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      apiKey: config?.apiKey || process.env.OPENAI_API_KEY || '',
      defaultModel: config?.defaultModel || process.env.LLM_MODEL || 'gpt-4o',
      timeout: config?.timeout || 30000,
      maxRetries: config?.maxRetries || 3,
    };

    // Initialize capability → model mapping
    this.capabilityModels = { ...DEFAULT_CAPABILITY_MODELS };
    this.supportedCapabilities = new Set(DEFAULT_SUPPORTED_CAPABILITIES);
  }

  // ============ CapabilityProvider Interface ============

  /**
   * Execute a capability request.
   * Routes to the appropriate model based on capabilityId.
   */
  async execute(request: CapabilityRequest): Promise<CapabilityResult> {
    const startTime = Date.now();
    const { capabilityId, input, options } = request;

    // Build messages from input
    const messages = this.buildMessages(input);
    const model = this.getModel(capabilityId);

    try {
      const response = await this.complete({
        model,
        messages,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        stream: options?.stream,
      });

      return {
        success: true,
        output: response.content,
        usage: {
          inputTokens: response.usage?.promptTokens,
          outputTokens: response.usage?.completionTokens,
          totalTokens: response.usage?.totalTokens,
          durationMs: Date.now() - startTime,
        },
        metadata: {
          model: response.model,
          provider: this.id,
          capabilityId,
        },
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const error = err as Error;

      return {
        success: false,
        error: {
          code: this.mapErrorCode(error),
          message: error.message,
          retryable: this.isRetryable(error),
          details: { model, capabilityId, durationMs },
        },
        usage: { durationMs },
      };
    }
  }

  /**
   * Check provider health by making a lightweight API call.
   */
  async health(): Promise<{ ok: boolean; latency: number }> {
    const start = Date.now();
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });

      const latency = Date.now() - start;
      return {
        ok: response.ok,
        latency,
      };
    } catch {
      return {
        ok: false,
        latency: Date.now() - start,
      };
    }
  }

  /**
   * Check if this provider supports a given capability.
   */
  supports(capabilityId: CapabilityId): boolean {
    return this.supportedCapabilities.has(capabilityId);
  }

  /**
   * Get cost estimates for a capability.
   * Based on OpenAI's current pricing tiers.
   */
  async cost(capabilityId: CapabilityId): Promise<{ input: number; output: number }> {
    const model = this.getModel(capabilityId);

    // OpenAI pricing per 1K tokens (approximate)
    switch (model) {
      case 'gpt-4':
        return { input: 0.03, output: 0.06 };
      case 'gpt-4o':
        return { input: 0.01, output: 0.03 };
      case 'gpt-4o-mini':
        return { input: 0.0015, output: 0.002 };
      default:
        return { input: 0.01, output: 0.03 };
    }
  }

  /**
   * Get usage limits for a capability.
   */
  async limits(capabilityId: CapabilityId): Promise<{ maxTokens: number; maxConcurrent: number }> {
    const model = this.getModel(capabilityId);

    switch (model) {
      case 'gpt-4':
        return { maxTokens: 8192, maxConcurrent: 10 };
      case 'gpt-4o':
        return { maxTokens: 16384, maxConcurrent: 30 };
      case 'gpt-4o-mini':
        return { maxTokens: 16384, maxConcurrent: 50 };
      default:
        return { maxTokens: 8192, maxConcurrent: 20 };
    }
  }

  // ============ Additional Public Methods (backward compat) ============

  /**
   * Execute a non-streaming chat completion request.
   * Legacy support — used by CapabilityRuntime's old interface.
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const model = request.model || this.config.defaultModel;
    const lastError: Error[] = [];

    for (let attempt = 0; attempt <= (this.config.maxRetries ?? 3); attempt++) {
      try {
        const response = await this.executeRequest(model, request, lastError);
        return response;
      } catch (err) {
        lastError.push(err as Error);
        if (attempt < (this.config.maxRetries ?? 3)) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw new Error(
      `[OpenAIProvider] All ${(this.config.maxRetries ?? 3) + 1} retries failed: ${lastError.map(e => e.message).join('; ')}`
    );
  }

  /**
   * Execute a streaming chat completion request.
   */
  async *completeStream(request: CompletionRequest): AsyncIterable<StreamChunk> {
    const model = request.model || this.config.defaultModel;

    const url = `${this.config.baseUrl}/chat/completions`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout ?? 30000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens,
          stop: request.stop,
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${errorBody || response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body stream available');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            yield { content: '', done: true };
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            if (delta) {
              yield { content: delta, done: false };
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }

      yield { content: '', done: true };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ============ Private Methods ============

  /**
   * Get the model name for a given capability.
   */
  private getModel(capabilityId: CapabilityId): string {
    return this.capabilityModels[capabilityId] || this.config.defaultModel;
  }

  /**
   * Build messages array from capability input.
   */
  private buildMessages(input: Record<string, unknown>): Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    // System prompt
    if (input.systemPrompt && typeof input.systemPrompt === 'string') {
      messages.push({ role: 'system', content: input.systemPrompt });
    }

    // User message
    if (input.prompt && typeof input.prompt === 'string') {
      messages.push({ role: 'user', content: input.prompt });
    } else if (input.text && typeof input.text === 'string') {
      messages.push({ role: 'user', content: input.text });
    } else {
      messages.push({ role: 'user', content: JSON.stringify(input) });
    }

    return messages;
  }

  /**
   * Map an error to a machine-readable code.
   */
  private mapErrorCode(error: Error): string {
    const msg = error.message.toLowerCase();
    if (msg.includes('rate') || msg.includes('429')) return 'RATE_LIMITED';
    if (msg.includes('timeout') || msg.includes('timed out')) return 'TIMEOUT';
    if (msg.includes('auth') || msg.includes('401') || msg.includes('403')) return 'AUTH_ERROR';
    if (msg.includes('token') || msg.includes('context')) return 'CONTEXT_LENGTH';
    if (msg.includes('model') || msg.includes('not found') || msg.includes('404')) return 'MODEL_NOT_FOUND';
    return 'PROVIDER_ERROR';
  }

  /**
   * Determine if an error is retryable.
   */
  private isRetryable(error: Error): boolean {
    const msg = error.message.toLowerCase();
    if (msg.includes('rate') || msg.includes('429')) return true;
    if (msg.includes('timeout')) return true;
    if (msg.includes('503') || msg.includes('502') || msg.includes('500')) return true;
    return false;
  }

  /**
   * Execute a single API request (non-streaming).
   */
  private async executeRequest(
    model: string,
    request: CompletionRequest,
    _errors: Error[]
  ): Promise<CompletionResponse> {
    const url = `${this.config.baseUrl}/chat/completions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        stop: request.stop,
        stream: false,
      }),
      signal: AbortSignal.timeout(this.config.timeout ?? 30000),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`[OpenAIProvider] HTTP ${response.status}: ${errorBody || response.statusText}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
      model: string;
    };

    return {
      content: data.choices?.[0]?.message?.content || '',
      model: data.model || model,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    };
  }
}
