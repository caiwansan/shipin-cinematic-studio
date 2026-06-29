/**
 * ExecutionCapabilityHandler — Pipeline handler that bridges Execution → Capability.
 *
 * This is the ONLY place where Execution knows about Capability.
 * The handler:
 * 1. Reads a CapabilityRequest from the task payload
 * 2. Attaches the execution context
 * 3. Routes through CapabilityRuntime
 * 4. Stores the result back in the task
 *
 * Execution NEVER knows which provider handled the request.
 * CapabilityRuntime handles all routing internally.
 *
 * @package @studio/platform/execution
 */

import type { ExecutionContext } from './execution-context';
import type { ExecutionTask, ExecutionError } from './types';
import type { PipelineHandler, ExecutionPipelineStage } from './execution-pipeline';
import type { CapabilityRuntime } from '../capability/capability-runtime';
import type { CapabilityRequest } from '../capability/types';

// ============ Error Class ============

/**
 * Error thrown when a capability execution fails in the pipeline.
 * Includes the capability error details for retry/error handling.
 */
export class ExecutionCapabilityError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(capabilityError?: { code: string; message: string; retryable: boolean; details?: Record<string, unknown> }) {
    super(capabilityError?.message ?? 'Capability execution failed');
    this.name = 'ExecutionCapabilityError';

    if (capabilityError) {
      this.code = capabilityError.code;
      this.retryable = capabilityError.retryable;
      this.details = capabilityError.details;
    } else {
      this.code = 'CAPABILITY_ERROR';
      this.retryable = false;
    }
  }

  /**
   * Convert to standard ExecutionError format.
   */
  toExecutionError(stage: ExecutionPipelineStage): ExecutionError {
    return {
      code: this.code,
      message: this.message,
      stage,
      retryable: this.retryable,
      details: this.details,
    };
  }
}

// ============ Handler ============

/**
 * Pipeline handler that bridges Execution → Capability.
 *
 * This handler is responsible for:
 * 1. Extracting the CapabilityRequest from the task payload
 * 2. Attaching the ExecutionContext to the request
 * 3. Executing through CapabilityRuntime
 * 4. Storing the result back in the task
 *
 * The handler only knows CapabilityRequest/CapabilityResult.
 * It never knows which provider or model is used.
 */
export class ExecutionCapabilityHandler implements PipelineHandler {
  readonly stage: 'execute' = 'execute';

  constructor(private readonly capabilityRuntime: CapabilityRuntime) {}

  /**
   * Execute the capability through the pipeline.
   *
   * @param context - The execution context
   * @param task - The execution task (contains CapabilityRequest in payload)
   *
   * @throws ExecutionCapabilityError if capability execution fails
   */
  async execute(context: ExecutionContext, task: ExecutionTask): Promise<void> {
    // 1. Read capability request from task payload
    const capabilityRequest: CapabilityRequest = task.payload as CapabilityRequest;

    if (!capabilityRequest || !capabilityRequest.capabilityId) {
      throw new Error(
        `[ExecutionCapabilityHandler] Task ${task.id} missing capabilityId in payload. ` +
        'Payload must contain a valid CapabilityRequest with a capabilityId.'
      );
    }

    // 2. Attach execution context to the capability request
    capabilityRequest.context = context;

    // 3. Execute through CapabilityRuntime
    //    (CapabilityRuntime handles all provider routing internally)
    const result = await this.capabilityRuntime.execute(
      capabilityRequest.capabilityId,
      capabilityRequest
    );

    // 4. Store result in task
    task.result = {
      success: result.success,
      data: result.output,
      duration: result.usage?.durationMs ?? 0,
      traceId: context.traceId,
    };

    // 5. If execution failed, throw a capability error
    //    This triggers the Engine's retry logic if retryable
    if (!result.success) {
      const capabilityError = new ExecutionCapabilityError(result.error);
      // Attach standard execution error properties for Engine handling
      (capabilityError as unknown as Record<string, unknown>).stage = this.stage;
      throw capabilityError;
    }
  }
}
