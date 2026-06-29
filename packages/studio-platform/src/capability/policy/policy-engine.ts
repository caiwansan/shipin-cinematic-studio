/**
 * PolicyEngine — Config-driven routing decision maker.
 *
 * The Policy Engine resolves which provider+model should handle a capability request.
 * It does NOT execute any capabilities — it only makes routing decisions.
 *
 * Policies are configuration-driven (YAML/JSON). No if/else logic.
 * Changing routing just means changing the policy config, not code.
 *
 * @package @studio/platform/capability
 */

import type { CapabilityId } from '../types';
import type { ProviderHealth } from '../health-manager';

// ============ Policy Types ============

/**
 * A single routing rule within a policy.
 * Maps a capability to a specific provider (and optionally model).
 */
export interface PolicyRule {
  /** Capability ID this rule applies to */
  capability: CapabilityId;

  /** Provider ID to route to */
  provider: string;

  /** Optional model ID (uses provider default if omitted) */
  model?: string;

  /** Priority within the rule set (lower = higher priority, default: 100) */
  priority?: number;
}

/**
 * A complete policy configuration.
 * Workspaces have their own policies that determine routing.
 */
export interface Policy {
  /** Unique policy identifier */
  id: string;

  /** Human-readable policy name */
  name: string;

  /** Workspace this policy applies to */
  workspace: string;

  /** Optional: specific workflow this policy applies to */
  workflow?: string;

  /** Primary routing rules (evaluated in priority order) */
  rules: PolicyRule[];

  /** Multi-level fallback chains.
   *  Each entry is a set of alternative rules tried in order.
   *  Level 0 = first fallback level, Level 1 = second, etc.
   */
  fallbacks: PolicyRule[][];
}

/**
 * Result of policy resolution — tells the Router which provider+model to use.
 */
export interface PolicyResolution {
  /** Provider ID to route to */
  providerId: string;

  /** Model ID to use */
  modelId: string;

  /** Policy ID that produced this resolution */
  policyId: string;

  /** Index of the matching rule within the policy */
  ruleIndex: number;
}

/**
 * Context passed to policy resolution.
 * Includes workspace info, current health, and cost data.
 */
export interface PolicyContext {
  /** Workspace type (e.g., 'geo', 'novel') */
  workspace: string;

  /** Optional workflow ID */
  workflow?: string;

  /** Current provider health status (providerId → health) */
  health?: Record<string, ProviderHealth>;

  /** Current cost records (providerId → cost data) — reserved for cost-aware routing */
  cost?: Record<string, unknown>;
}

// ============ PolicyEngine ============

/**
 * PolicyEngine — makes all routing decisions.
 *
 * Responsibilities:
 * 1. Load/unload policies from config
 * 2. Resolve capabilityId → best provider+model based on policy + health
 * 3. Provide fallback chains for the FallbackManager
 *
 * The Policy Engine does NOT know providers directly.
 * It resolves to providerId + modelId strings only.
 * The Router handles provider lookup and execution.
 */
export class PolicyEngine {
  /** Loaded policies by ID */
  private policies: Map<string, Policy> = new Map();

  /** Policies indexed by workspace */
  private workspacePolicies: Map<string, string[]> = new Map();

  /**
   * Load a policy into the engine.
   * Replaces any existing policy with the same ID.
   */
  loadPolicy(policy: Policy): void {
    this.policies.set(policy.id, { ...policy });

    // Index by workspace
    const existing = this.workspacePolicies.get(policy.workspace) || [];
    if (!existing.includes(policy.id)) {
      existing.push(policy.id);
      this.workspacePolicies.set(policy.workspace, existing);
    }

    console.log(`[PolicyEngine] Loaded policy '${policy.id}' for workspace '${policy.workspace}'`);
  }

  /**
   * Unload a policy by ID.
   */
  unloadPolicy(policyId: string): void {
    const policy = this.policies.get(policyId);
    if (policy) {
      this.policies.delete(policyId);

      // Clean workspace index
      const existing = this.workspacePolicies.get(policy.workspace) || [];
      const filtered = existing.filter(id => id !== policyId);
      if (filtered.length > 0) {
        this.workspacePolicies.set(policy.workspace, filtered);
      } else {
        this.workspacePolicies.delete(policy.workspace);
      }
    }
  }

  /**
   * Resolve the best provider+model for a capability request.
   *
   * Resolution strategy:
   * 1. Find policies matching workspace (and optionally workflow)
   * 2. Within each policy, find rules matching the capabilityId
   * 3. Sort rules by priority (lower = higher)
   * 4. Check health: skip unhealthy providers
   * 5. Return the first healthy match
   *
   * @param capabilityId — The capability to route
   * @param context — Execution context (workspace, workflow, health)
   * @returns PolicyResolution with providerId + modelId
   * @throws Error if no matching rule found or all providers unhealthy
   */
  async resolve(
    capabilityId: CapabilityId,
    context: PolicyContext
  ): Promise<PolicyResolution> {
    // 1. Find matching policies
    const matchingPolicies = this.findMatchingPolicies(context);

    if (matchingPolicies.length === 0) {
      throw new Error(
        `[PolicyEngine] No policy found for capability '${capabilityId}' in workspace '${context.workspace}'`
      );
    }

    // 2. For each policy, find matching rules
    for (const policy of matchingPolicies) {
      const matchingRules = policy.rules
        .filter(r => r.capability === capabilityId)
        .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

      for (const [index, rule] of matchingRules.entries()) {
        // 3. Check health: skip unhealthy providers
        if (context.health && rule.provider in context.health) {
          const health = context.health[rule.provider];
          if (!this.isProviderHealthy(health)) {
            continue; // Skip unhealthy provider, try next rule
          }
        }

        // 4. Found a healthy match
        return {
          providerId: rule.provider,
          modelId: rule.model || '',
          policyId: policy.id,
          ruleIndex: index,
        };
      }
    }

    // 5. No healthy match found
    throw new Error(
      `[PolicyEngine] No healthy provider found for capability '${capabilityId}' in workspace '${context.workspace}'`
    );
  }

  /**
   * Get fallback chains for a capability.
   * Returns the multi-level fallback rules from the matching policy.
   *
   * @param capabilityId — The capability to get fallbacks for
   * @returns Array of fallback rule sets (each set = one fallback level)
   *          or empty array if no fallbacks configured
   */
  getFallbacks(capabilityId: CapabilityId): PolicyRule[][] {
    // Search all policies for fallbacks matching this capability
    for (const policy of this.policies.values()) {
      const matchingFallbackLevels: PolicyRule[][] = [];

      for (const fallbackLevel of policy.fallbacks) {
        const matchingRules = fallbackLevel.filter(r => r.capability === capabilityId);
        if (matchingRules.length > 0) {
          matchingFallbackLevels.push(matchingRules);
        }
      }

      if (matchingFallbackLevels.length > 0) {
        return matchingFallbackLevels;
      }
    }

    return [];
  }

  /**
   * List all loaded policies.
   */
  listPolicies(): Policy[] {
    return Array.from(this.policies.values());
  }

  /**
   * List policies for a specific workspace.
   */
  listPoliciesByWorkspace(workspace: string): Policy[] {
    const policyIds = this.workspacePolicies.get(workspace) || [];
    return policyIds
      .map(id => this.policies.get(id))
      .filter((p): p is Policy => p !== undefined);
  }

  // ============ Private ============

  /**
   * Find policies matching the given context.
   * Prefers workflow-specific policies over workspace-wide policies.
   */
  private findMatchingPolicies(context: PolicyContext): Policy[] {
    const candidates: Policy[] = [];

    // Try workflow-specific first
    if (context.workflow) {
      for (const policy of this.policies.values()) {
        if (
          policy.workspace === context.workspace &&
          policy.workflow === context.workflow
        ) {
          candidates.push(policy);
        }
      }
    }

    // Fall back to workspace-wide policies
    if (candidates.length === 0) {
      for (const policy of this.policies.values()) {
        if (
          policy.workspace === context.workspace &&
          !policy.workflow
        ) {
          candidates.push(policy);
        }
      }
    }

    return candidates;
  }

  /**
   * Check if a provider is healthy enough for routing.
   * Healthy = status is 'healthy' or 'degraded' (not 'unavailable').
   */
  private isProviderHealthy(health: ProviderHealth): boolean {
    if (health.status === 'unavailable') {
      return false;
    }
    // Also consider providers with very high consecutive failures as unhealthy
    if (health.consecutiveFailures >= 5) {
      return false;
    }
    return true;
  }
}
