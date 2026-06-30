import { validateTransition } from '../../../platform/state-machine';
import type { VerificationJobRunner } from './verification.types';

// In-memory job state (no external dependencies)
const jobState = new Map<string, {
  status: string;
  lockedBy?: string;
  lockedAt?: Date;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  startedAt?: Date;
  completedAt?: Date;
}>();

function uuid(): string { return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`; }

export class InMemoryJobRunner implements VerificationJobRunner {
  private executionCallback: ((executionId: string) => Promise<void>) | null = null;

  setExecutionCallback(cb: (executionId: string) => Promise<void>) {
    this.executionCallback = cb;
  }

  async enqueue(executionId: string): Promise<{ executionId: string; status: string }> {
    // Idempotency: check existing
    const existing = jobState.get(executionId);
    if (existing) {
      // Already enqueued — allow retry only if failed
      if (existing.status === 'failed' || existing.status === 'retrying') {
        return this.retry(executionId);
      }
      return { executionId, status: existing.status };
    }

    // Validate transition from null → pending
    const transition = validateTransition('verification', 'pending', 'pending');
    if (!transition.allowed) throw new Error(transition.reason || 'Invalid transition');

    jobState.set(executionId, { status: 'pending', retryCount: 0, maxRetries: 3 });
    return { executionId, status: 'pending' };
  }

  async cancel(executionId: string): Promise<void> {
    const state = jobState.get(executionId);
    if (!state) throw new Error(`Job ${executionId} not found`);

    const transition = validateTransition('verification', state.status, 'cancelled');
    if (!transition.allowed) throw new Error(`IllegalStateTransition: ${transition.reason}`);

    state.status = 'cancelled';
    state.completedAt = new Date();
  }

  async retry(executionId: string): Promise<{ executionId: string; status: string }> {
    const state = jobState.get(executionId);
    if (!state) throw new Error(`Job ${executionId} not found`);

    const transition = validateTransition('verification', state.status, 'retrying');
    if (!transition.allowed) throw new Error(`IllegalStateTransition: ${transition.reason}`);

    state.status = 'retrying';
    state.retryCount++;

    // Auto-advance to running
    const runTransition = validateTransition('verification', 'retrying', 'running');
    if (!runTransition.allowed) throw new Error(`IllegalStateTransition: ${runTransition.reason}`);
    state.status = 'running';
    state.startedAt = new Date();
    state.lockedAt = new Date();
    state.lockedBy = `runner_${uuid()}`;

    // Execute async
    if (this.executionCallback) {
      this.executionCallback(executionId).catch(err => {
        state.status = 'failed';
        state.lastError = err.message;
        state.completedAt = new Date();
        state.lockedBy = undefined;
      });
    }

    return { executionId, status: 'running' };
  }

  async resume(executionId: string): Promise<{ executionId: string; status: string }> {
    const state = jobState.get(executionId);
    if (!state) throw new Error(`Job ${executionId} not found`);

    const transition = validateTransition('verification', state.status, 'running');
    if (!transition.allowed) throw new Error(`IllegalStateTransition: ${transition.reason}`);

    state.status = 'running';
    state.startedAt = new Date();
    return { executionId, status: 'running' };
  }

  async getStatus(executionId: string): Promise<string> {
    const state = jobState.get(executionId);
    return state?.status || 'unknown';
  }

  // Helper for engine to update state during execution
  updateState(executionId: string, updates: Partial<{ status: string; lastError: string; completedAt: Date }>) {
    const state = jobState.get(executionId);
    if (!state) return;
    Object.assign(state, updates);
  }

  // Reset (for testing)
  reset() { jobState.clear(); }
}
