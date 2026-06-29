/**
 * CostManager — Usage tracking and cost recording.
 *
 * Records EVERY capability call. No opt-out.
 * Provides cost aggregation by workspace, project, provider, and time period.
 *
 * @package @studio/platform/capability
 */

import type { CapabilityId } from './types';

/**
 * A single usage record — created for every capability execution.
 */
export interface UsageRecord {
  /** Unique record ID */
  id: string;

  /** Timestamp of the execution (ms since epoch) */
  timestamp: number;

  /** Workspace type */
  workspace: string;

  /** Project ID */
  projectId: string;

  /** User ID */
  userId: string;

  /** Capability executed */
  capabilityId: CapabilityId;

  /** Provider used */
  providerId: string;

  /** Model used */
  modelId: string;

  /** Input tokens consumed */
  inputTokens: number;

  /** Output tokens generated */
  outputTokens: number;

  /** Total tokens consumed */
  totalTokens: number;

  /** Estimated cost in USD */
  cost: number;

  /** Execution latency in milliseconds */
  latencyMs: number;

  /** Whether the execution succeeded */
  success: boolean;

  /** Distributed trace ID */
  traceId: string;
}

/**
 * Filter for querying usage records.
 */
export interface UsageFilter {
  /** Filter by workspace */
  workspace?: string;

  /** Filter by project */
  projectId?: string;

  /** Filter by provider */
  providerId?: string;

  /** Start time (ms since epoch) */
  startTime?: number;

  /** End time (ms since epoch) */
  endTime?: number;
}

/**
 * Aggregate cost query filter.
 */
export interface CostFilter {
  /** Filter by workspace */
  workspace?: string;

  /** Filter by project */
  projectId?: string;

  /** Filter by provider */
  providerId?: string;

  /** Aggregation period */
  period?: 'day' | 'week' | 'month';
}

/**
 * Cost aggregation result.
 */
export interface CostAggregation {
  /** Total cost in USD */
  total: number;

  /** Number of records in the aggregation */
  records: number;
}

// ============ CostManager ============

/**
 * CostManager — records and queries usage/cost data.
 *
 * Features:
 * - recordUsage: persist a usage record for every capability execution
 * - getUsage: query usage records with filters
 * - getTotalCost: aggregate cost by period
 *
 * All records are stored in-memory (for now).
 * Future: persist to database for long-term billing.
 */
export class CostManager {
  /** In-memory usage record store */
  private records: UsageRecord[] = [];

  /** Maximum records to keep in memory (prevents unbounded growth) */
  private readonly maxRecords: number = 100000;

  /**
   * Record a usage entry for a capability execution.
   * Called on EVERY execution — no opt-out.
   */
  recordUsage(record: UsageRecord): void {
    this.records.push({ ...record });

    // Prune oldest records if exceeded max
    if (this.records.length > this.maxRecords) {
      this.records.splice(0, this.records.length - this.maxRecords);
    }
  }

  /**
   * Query usage records with optional filters.
   *
   * @param filter — Optional filters for workspace, project, provider, time range
   * @returns Array of matching usage records
   */
  getUsage(filter: UsageFilter = {}): UsageRecord[] {
    return this.records.filter(r => {
      if (filter.workspace && r.workspace !== filter.workspace) return false;
      if (filter.projectId && r.projectId !== filter.projectId) return false;
      if (filter.providerId && r.providerId !== filter.providerId) return false;
      if (filter.startTime && r.timestamp < filter.startTime) return false;
      if (filter.endTime && r.timestamp > filter.endTime) return false;
      return true;
    });
  }

  /**
   * Get aggregated total cost for a given filter and period.
   *
   * @param filter — Filters and period for aggregation
   * @returns Total cost and record count
   */
  async getTotalCost(filter: CostFilter = {}): Promise<CostAggregation> {
    const matching = this.getUsage(filter);

    let total = 0;
    for (const record of matching) {
      total += record.cost;
    }

    return {
      total: Math.round(total * 1000000) / 1000000, // Round to 6 decimal places
      records: matching.length,
    };
  }

  /**
   * Get total usage statistics across all records.
   */
  getStats(): {
    totalRecords: number;
    totalCost: number;
    totalTokens: number;
    successRate: number;
  } {
    const totalRecords = this.records.length;
    if (totalRecords === 0) {
      return { totalRecords: 0, totalCost: 0, totalTokens: 0, successRate: 100 };
    }

    const totalCost = this.records.reduce((sum, r) => sum + r.cost, 0);
    const totalTokens = this.records.reduce((sum, r) => sum + r.totalTokens, 0);
    const successCount = this.records.filter(r => r.success).length;

    return {
      totalRecords,
      totalCost: Math.round(totalCost * 1000000) / 1000000,
      totalTokens,
      successRate: Math.round((successCount / totalRecords) * 10000) / 100,
    };
  }

  /**
   * Clear all records (for testing).
   */
  clear(): void {
    this.records = [];
  }

  /**
   * Get the total number of records.
   */
  get count(): number {
    return this.records.length;
  }
}
