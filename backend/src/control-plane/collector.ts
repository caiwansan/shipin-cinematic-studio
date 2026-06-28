/**
 * Control Plane — Ring Buffer Collector
 *
 * Lock-free ring buffer for zero-interference trace collection.
 * Fire-and-forget: no await, no retry, no backpressure.
 * Bounded memory: oldest entries silently evicted when full.
 */

import type {
  RingBuffer,
  RingBufferEntry,
  PolicyTrace,
  ExecutionTrace,
  FieldSnapshot,
  FullTrace,
} from './types.js'

// ── Buffer Implementation ──

export function createRingBuffer<T>(capacity: number): RingBuffer<T> {
  return {
    capacity,
    size: 0,
    entries: new Array(capacity),
    cursor: 0,
    seq: 0,
  }
}

export function ringBufferPush<T>(buffer: RingBuffer<T>, data: T): void {
  const seq = ++buffer.seq
  const entry: RingBufferEntry<T> = { seq, timestamp: Date.now(), data }
  buffer.entries[buffer.cursor] = entry
  buffer.cursor = (buffer.cursor + 1) % buffer.capacity
  if (buffer.size < buffer.capacity) buffer.size++
}

export function ringBufferGetAll<T>(buffer: RingBuffer<T>): RingBufferEntry<T>[] {
  if (buffer.size < buffer.capacity) {
    // Not wrapped yet — return in order [0..size]
    return buffer.entries.slice(0, buffer.size) as RingBufferEntry<T>[]
  }
  // Wrapped — return oldest-first
  const tail = buffer.entries.slice(buffer.cursor) as RingBufferEntry<T>[]
  const head = buffer.entries.slice(0, buffer.cursor) as RingBufferEntry<T>[]
  return [...tail, ...head]
}

export function ringBufferGetBySeq<T>(
  buffer: RingBuffer<T>,
  fromSeq: number,
  limit = 50,
): RingBufferEntry<T>[] {
  const all = ringBufferGetAll(buffer)
  const start = all.findIndex(e => e.seq >= fromSeq)
  if (start < 0) return []
  return all.slice(start, start + limit)
}

// ── Singleton Collectors ──

const DEFAULT_CAPACITY = 1000

export const policyTraceBuffer = createRingBuffer<PolicyTrace>(DEFAULT_CAPACITY)
export const execTraceBuffer = createRingBuffer<ExecutionTrace>(DEFAULT_CAPACITY)
export const fieldSnapshotBuffer = createRingBuffer<FieldSnapshot>(DEFAULT_CAPACITY)

// Trace ID → FullTrace lookup (limited, for recent requests)
const traceIndex = new Map<string, FullTrace>()
const MAX_TRACE_INDEX = 100

export function collectPolicyTrace(trace: PolicyTrace): void {
  ringBufferPush(policyTraceBuffer, trace)
  const existing = traceIndex.get(trace.traceId) || {
    traceId: trace.traceId,
    policy: null,
    execution: null,
    field: null,
    createdAt: Date.now(),
  }
  existing.policy = trace
  traceIndex.set(trace.traceId, existing)
  // Evict oldest if full
  if (traceIndex.size > MAX_TRACE_INDEX) {
    const oldest = [...traceIndex.entries()].sort(
      (a, b) => a[1].createdAt - b[1].createdAt,
    )[0]
    if (oldest) traceIndex.delete(oldest[0])
  }
}

export function collectExecutionTrace(trace: ExecutionTrace): void {
  ringBufferPush(execTraceBuffer, trace)
  const existing = traceIndex.get(trace.traceId) || {
    traceId: trace.traceId,
    policy: null,
    execution: null,
    field: null,
    createdAt: Date.now(),
  }
  existing.execution = trace
  traceIndex.set(trace.traceId, existing)
}

export function collectFieldSnapshot(trace: FieldSnapshot): void {
  ringBufferPush(fieldSnapshotBuffer, trace)
  const existing = traceIndex.get(trace.traceId) || {
    traceId: trace.traceId,
    policy: null,
    execution: null,
    field: null,
    createdAt: Date.now(),
  }
  existing.field = trace
  traceIndex.set(trace.traceId, existing)
  if (traceIndex.size > MAX_TRACE_INDEX) {
    const oldest = [...traceIndex.entries()].sort(
      (a, b) => a[1].createdAt - b[1].createdAt,
    )[0]
    if (oldest) traceIndex.delete(oldest[0])
  }
}

export function getFullTrace(traceId: string): FullTrace | undefined {
  return traceIndex.get(traceId)
}

export function getAllTraceIds(): string[] {
  return [...traceIndex.keys()]
}
