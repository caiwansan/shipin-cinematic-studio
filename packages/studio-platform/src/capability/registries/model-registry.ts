/**
 * ModelRegistry — Provider×Model mapping.
 *
 * Provider and Model are separate. Adding a model doesn't change provider code.
 * Models are registered with their capabilities, context windows, and cost.
 *
 * @package @studio/platform/capability
 */

import type { CapabilityId } from '../types';

/**
 * Model status lifecycle:
 * - active: ready for production use
 * - deprecated: still usable but will be sunset
 * - sunset: no longer available
 */
export type ModelStatus = 'active' | 'deprecated' | 'sunset';

/**
 * Model entry — describes a single model and its capabilities.
 */
export interface ModelEntry {
  /** Model identifier (e.g., 'gpt-5.5', 'deepseek-v4') */
  id: string;

  /** Provider identifier (e.g., 'openai', 'deepseek') */
  providerId: string;

  /** Human-readable model name */
  name: string;

  /** Model version string */
  version: string;

  /** Capabilities this model supports */
  capabilities: CapabilityId[];

  /** Context window limits */
  context: {
    /** Maximum total tokens */
    maxTokens: number;
    /** Maximum input tokens */
    maxInput: number;
    /** Maximum output tokens */
    maxOutput: number;
  };

  /** Pricing per 1K tokens */
  cost: {
    /** Cost per 1K input tokens (USD) */
    inputPer1k: number;
    /** Cost per 1K output tokens (USD) */
    outputPer1k: number;
  };

  /** Model lifecycle status */
  status: ModelStatus;
}

/**
 * ModelRegistry — model entry store.
 *
 * Provides:
 * - register: add a model entry
 * - unregister: remove by model ID
 * - get: lookup by model ID
 * - list: enumerate all models
 * - findByCapability: find all models supporting a capability
 * - findByProvider: find all models for a provider
 */
export class ModelRegistry {
  private models: Map<string, ModelEntry> = new Map();

  /**
   * Register a model entry.
   * Overwrites if already registered (with warning).
   */
  register(model: ModelEntry): void {
    if (this.models.has(model.id)) {
      console.warn(`[ModelRegistry] Model '${model.id}' already registered, overwriting`);
    }
    this.models.set(model.id, { ...model });
  }

  /**
   * Unregister a model by ID.
   */
  unregister(modelId: string): void {
    this.models.delete(modelId);
  }

  /**
   * Get a model entry by ID.
   * @returns The model entry, or undefined if not found
   */
  get(modelId: string): ModelEntry | undefined {
    return this.models.get(modelId);
  }

  /**
   * List all registered model entries.
   */
  list(): ModelEntry[] {
    return Array.from(this.models.values());
  }

  /**
   * Find all models that support a given capability.
   * @param capabilityId — The capability to search for
   */
  findByCapability(capabilityId: CapabilityId): ModelEntry[] {
    return Array.from(this.models.values())
      .filter(m => m.capabilities.includes(capabilityId) && m.status === 'active');
  }

  /**
   * Find all models belonging to a given provider.
   * @param providerId — The provider ID to search for
   */
  findByProvider(providerId: string): ModelEntry[] {
    return Array.from(this.models.values())
      .filter(m => m.providerId === providerId);
  }

  /**
   * Get the total number of registered models.
   */
  get count(): number {
    return this.models.size;
  }
}
