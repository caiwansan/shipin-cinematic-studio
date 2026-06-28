/**
 * drift/types.ts
 *
 * Phase 3B — Drift Detection System
 * 时间维投影一致性监控
 *
 * 铁律：
 * - 纯记录 + 纯比较，不做任何解释
 * - 不输出"异常"标签，只输出 delta/hash diff
 */

export interface DriftRecord {
  timestamp: number;
  domain: string;
  runId: string;
  projectionHash: string;
  replayHash: string;
  fidelityScore: number;
  adapterVersion: string;
}

export interface DriftDelta {
  projectionDrift: boolean;
  replayDrift: boolean;
  fidelityDelta: number;
  regression: boolean;
}

export interface DriftReport {
  totalRecords: number;
  domains: string[];
  latestRecord: DriftRecord | null;
  deltas: Array<{
    fromIdx: number;
    toIdx: number;
    delta: DriftDelta;
  }>;
  regressions: DriftDelta[];
}
