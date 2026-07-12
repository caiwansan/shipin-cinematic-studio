import type { ExecutionTrace, StructuredResult } from '../legacy-types';
import type { ReplayRecord, ReplayStatus, ReplaySummary } from './types';
import { replayStore } from './store';

function generateReplayId(): string {
  return `replay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createReplayRecord(
  trace: ExecutionTrace,
  result?: StructuredResult
): ReplayRecord {
  return {
    replayId: generateReplayId(),
    traceId: trace.traceId,
    snapshotVersion: trace.snapshotVersion,
    snapshotHash: trace.snapshotHash,
    provider: trace.provider,
    model: trace.model,
    promptVersion: trace.promptVersion,
    status: trace.status as ReplayStatus,
    duration: trace.duration,
    cost: trace.cost ?? 0,
    tokenCount: trace.tokenCount ?? 0,
    timestamp: trace.timestamp,
    result: result ?? {
      summary: '',
      findings: [],
      evidence: [],
      citations: [],
      confidence: 0,
      metrics: { duration: trace.duration, cacheHit: false },
      providerMetadata: {
        provider: trace.provider,
        model: trace.model,
        snapshotVersion: trace.snapshotVersion,
        timestamp: trace.timestamp,
        traceId: trace.traceId,
      },
      rawResponse: '',
    },
    error: trace.status === 'error' || trace.status === 'timeout' ? trace.error : undefined,
  };
}

export function replayToSummary(replay: ReplayRecord): ReplaySummary {
  return {
    replayId: replay.replayId,
    traceId: replay.traceId,
    snapshotVersion: replay.snapshotVersion,
    provider: replay.provider,
    model: replay.model,
    status: replay.status,
    duration: replay.duration,
    timestamp: replay.timestamp,
    findingCount: replay.result.findings.length,
    evidenceCount: replay.result.evidence.length,
    topConfidence: Math.max(...replay.result.findings.map(f => f.confidence), 0),
  };
}
