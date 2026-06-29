/**
 * Capability Layer — Barrel Export
 *
 * This is the capability module's single entry point.
 * External code must import through this barrel, not from submodules directly.
 *
 * @package @studio/platform/capability
 */

// Core types
export type {
  CapabilityId,
  CapabilityDescriptor,
  CapabilityRequest,
  CapabilityContext,
  CapabilityResult,
  CapabilityError,
  CapabilityProvider,
  AssetRecord,
} from './types';

// Capability Runtime (legacy)
export { CapabilityRuntime } from './capability-runtime';

// Capability Definitions
export {
  CapabilityDefinitions,
  getCapabilityName,
  getCapabilityDescription,
  isKnownCapability,
} from './capability-definitions';

// Providers
export { OpenAIProvider } from './openai-provider';
export type {
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  OpenAIProviderConfig,
} from './openai-provider';

// ============ C2.1 Capability Orchestrator ============

// Registries
export { CapabilityRegistry } from './registries/capability-registry';
export { ProviderRegistry } from './registries/provider-registry';
export { ModelRegistry } from './registries/model-registry';
export type { ModelEntry, ModelStatus } from './registries/model-registry';

// Policy Engine
export { PolicyEngine } from './policy/policy-engine';
export type {
  Policy,
  PolicyRule,
  PolicyResolution,
  PolicyContext,
} from './policy/policy-engine';

// Router
export { CapabilityRouter } from './router/capability-router';
export type { RouteResult } from './router/capability-router';

// Health Manager
export { HealthManager } from './health-manager';
export type { HealthStatus, ProviderHealth } from './health-manager';

// Cost Manager
export { CostManager } from './cost-manager';
export type {
  UsageRecord,
  UsageFilter,
  CostFilter,
  CostAggregation,
} from './cost-manager';

// Fallback Manager
export { FallbackManager } from './fallback-manager';

// Orchestrator
export { CapabilityOrchestrator } from './capability-orchestrator';
