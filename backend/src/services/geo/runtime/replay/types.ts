import type { StructuredResult } from '../legacy-types';

export type ReplayStatus = 'success' | 'error' | 'timeout' | 'partial';

export interface ReplayRecord {
  replayId: string;
  traceId: string;
  snapshotVersion: string;
  snapshotHash: string;
  provider: string;
  model: string;
  promptVersion: string;
  status: ReplayStatus;
  duration: number;         // ms
  cost: number;
  tokenCount: number;
  timestamp: string;
  result: StructuredResult;
  error?: string;
}

export interface ReplaySummary {
  replayId: string;
  traceId: string;
  snapshotVersion: string;
  provider: string;
  model: string;
  status: ReplayStatus;
  duration: number;
  timestamp: string;
  findingCount: number;
  evidenceCount: number;
  topConfidence: number;
}

export interface ReplayDiff {
  left: ReplaySummary;
  right: ReplaySummary;
  changes: {
    field: string;
    leftValue: any;
    rightValue: any;
    delta: number;
  }[];
  same: boolean;
}
