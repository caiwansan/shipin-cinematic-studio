/**
 * Capability × Execution Integration Test
 *
 * Tests the full chain: Execution → CapabilityRequest → CapabilityRuntime → Provider → Result → Execution.
 *
 * Test scenarios:
 * 1. Full chain: Submit ExecutionRequest → Pipeline runs "execute" stage → CapabilityRuntime dispatches
 *    to provider → returns result → Execution task completes.
 * 2. Events: Verify SUBMITTED → STAGE_STARTED (execute) → STAGE_COMPLETED (execute) → COMPLETED
 * 3. Failure path: Provider throws → FAILED event → retry
 * 4. Provider discovery via supports()
 * 5. CapabilityRuntime routing via descriptors
 *
 * @package @studio/platform/capability
 */

import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert';

import { EventBus } from '../../event/event-bus';
import { CapabilityRuntime } from '../capability-runtime';
import type { CapabilityProvider, CapabilityId, CapabilityRequest, CapabilityResult } from '../types';
import {
  ExecutionEngine,
  ExecutionPipeline,
  DefaultExecutionPipeline,
  InMemoryScheduler,
  InMemoryLockManager,
  ExecutionEventTypes,
  ExecutionCapabilityHandler,
  ExecutionCapabilityError,
} from '../../execution/index';
import type {
  ExecutionContext,
  ExecutionTask,
  ExecutionRequest,
  PipelineHandler,
  ExecutionPipelineStage,
} from '../../execution/index';

// ============ Mock Provider ============

/**
 * Mock provider that returns known data.
 * Used to test the full chain without hitting real APIs.
 */
class MockCapabilityProvider implements CapabilityProvider {
  readonly id = 'mock-provider';
  readonly name = 'Mock Provider';
  readonly version = '1.0.0';

  private supported: Set<string>;
  private shouldFail = false;
  private failCount = 0;
  private callCount = 0;

  constructor(supportedCapabilities: string[] = ['llm.reasoning', 'llm.extraction']) {
    this.supported = new Set(supportedCapabilities);
  }

  /**
   * Configure the provider to fail on the next N calls.
   */
  setFail(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  /**
   * Get the number of times execute() was called.
   */
  getCallCount(): number {
    return this.callCount;
  }

  /**
   * Reset call count and failure state.
   */
  reset(): void {
    this.callCount = 0;
    this.failCount = 0;
    this.shouldFail = false;
  }

  async execute(request: CapabilityRequest): Promise<CapabilityResult> {
    this.callCount++;

    if (this.shouldFail && this.failCount < 3) {
      this.failCount++;
      return {
        success: false,
        error: {
          code: 'MOCK_ERROR',
          message: `Mock provider failure (attempt ${this.callCount})`,
          retryable: true,
          details: { callCount: this.callCount },
        },
        usage: { durationMs: 10 },
      };
    }

    return {
      success: true,
      output: `Mock result for ${request.capabilityId}: processed at ${Date.now()}`,
      usage: {
        inputTokens: 50,
        outputTokens: 10,
        totalTokens: 60,
        durationMs: 15,
      },
      metadata: {
        provider: this.id,
        capabilityId: request.capabilityId,
      },
    };
  }

  async health(): Promise<{ ok: boolean; latency: number }> {
    return { ok: true, latency: 5 };
  }

  supports(capabilityId: CapabilityId): boolean {
    return this.supported.has(capabilityId);
  }

  async cost(capabilityId: CapabilityId): Promise<{ input: number; output: number }> {
    return { input: 0.001, output: 0.002 };
  }

  async limits(capabilityId: CapabilityId): Promise<{ maxTokens: number; maxConcurrent: number }> {
    return { maxTokens: 4096, maxConcurrent: 10 };
  }
}

/**
 * Mock provider that only supports 'llm.translation'.
 */
class MockTranslationProvider implements CapabilityProvider {
  readonly id = 'translation-provider';
  readonly name = 'Translation Provider';
  readonly version = '1.0.0';

  async execute(request: CapabilityRequest): Promise<CapabilityResult> {
    return {
      success: true,
      output: `Translated: ${JSON.stringify(request.input)}`,
      usage: { durationMs: 10 },
      metadata: { provider: this.id },
    };
  }

  async health(): Promise<{ ok: boolean; latency: number }> {
    return { ok: true, latency: 3 };
  }

  supports(capabilityId: CapabilityId): boolean {
    return capabilityId === 'llm.translation';
  }

  async cost(_capabilityId: CapabilityId): Promise<{ input: number; output: number }> {
    return { input: 0.001, output: 0.002 };
  }

  async limits(_capabilityId: CapabilityId): Promise<{ maxTokens: number; maxConcurrent: number }> {
    return { maxTokens: 4096, maxConcurrent: 10 };
  }
}

// ============ Test Helpers ============

/**
 * Create a test ExecutionRequest that wraps a CapabilityRequest.
 */
function createCapabilityExecutionRequest(
  capabilityId: string,
  input: Record<string, unknown>,
  overrides?: Partial<ExecutionRequest>
): ExecutionRequest {
  return {
    id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    type: 'capability',
    workspaceType: 'test',
    projectId: 'proj-capability-test',
    userId: 'user-capability-test',
    payload: {
      capabilityId,
      input,
      context: {}, // Will be filled by handler
      options: {
        temperature: 0.5,
        maxTokens: 1000,
      },
    } as CapabilityRequest,
    options: {
      timeout: 5000,
      priority: 1,
      retry: { max: 3, delay: 50, backoff: 'linear' },
      tags: ['test', 'capability-integration'],
    },
    ...overrides,
  };
}

/**
 * Wait for task to reach a terminal state.
 */
async function waitForTaskCompletion(
  engine: ExecutionEngine,
  taskId: string,
  timeoutMs: number
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const status = await engine.getStatus(taskId);
      if (['completed', 'failed', 'cancelled'].includes(status)) {
        return;
      }
    } catch {
      // Task may not be registered yet
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Timeout waiting for task ${taskId} (${timeoutMs}ms)`);
}

// ============ Tests ============

describe('Capability × Execution Integration', () => {
  let eventBus: EventBus;
  let capabilityRuntime: CapabilityRuntime;
  let mockProvider: MockCapabilityProvider;
  let translationProvider: MockTranslationProvider;

  before(() => {
    eventBus = new EventBus();
    capabilityRuntime = new CapabilityRuntime();
    mockProvider = new MockCapabilityProvider();
    translationProvider = new MockTranslationProvider();

    // Register providers
    capabilityRuntime.registerProvider(mockProvider);
    capabilityRuntime.registerProvider(translationProvider);

    // Register capability descriptors
    capabilityRuntime.registerCapability({
      id: 'llm.reasoning',
      name: 'LLM Reasoning',
      description: 'General reasoning and analysis',
      version: '1.0.0',
      provider: 'mock-provider',
      model: 'mock-model-v1',
      inputSchema: { type: 'object', properties: { prompt: { type: 'string' } } },
      outputSchema: { type: 'object', properties: { result: { type: 'string' } } },
    });

    capabilityRuntime.registerCapability({
      id: 'llm.extraction',
      name: 'LLM Extraction',
      description: 'Structured data extraction',
      version: '1.0.0',
      provider: 'mock-provider',
      model: 'mock-model-v2',
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
    });
  });

  after(() => {
    eventBus.clear();
  });

  // ============ TEST 1: Full Chain ============

  describe('1. Full chain: Execution → CapabilityRuntime → Provider → Result → Execution', () => {
    it('should submit a capability request through the execution pipeline and get a result', async () => {
      const pipeline = new DefaultExecutionPipeline(eventBus, capabilityRuntime);
      const scheduler = new InMemoryScheduler();
      const lockManager = new InMemoryLockManager();

      const engine = new ExecutionEngine(
        pipeline,
        scheduler,
        eventBus,
        lockManager,
        capabilityRuntime,
      );

      // Create request with a capability payload
      const request = createCapabilityExecutionRequest('llm.reasoning', {
        prompt: 'What is the meaning of life?',
        systemPrompt: 'You are a helpful assistant.',
      });

      // Submit and wait
      const task = await engine.submit(request);
      await waitForTaskCompletion(engine, task.id, 3000);

      // Verify final status
      const status = await engine.getStatus(task.id);
      assert.equal(status, 'completed', 'Task should complete successfully');

      // Verify result
      const result = await engine.getResult(task.id);
      assert.ok(result, 'Result should exist');
      assert.equal(result!.success, true, 'Result should be successful');
      assert.ok(result!.data, 'Result should have data');
      assert.ok(
        typeof result!.data === 'string' && result!.data.includes('Mock result for llm.reasoning'),
        'Result data should contain mock provider output'
      );
      assert.ok(result!.duration > 0, 'Duration should be positive');
      assert.equal(result!.traceId, task.traceId, 'Trace ID should match');

      // Verify the provider was called
      assert.equal(mockProvider.getCallCount(), 1, 'Provider should have been called once');

      mockProvider.reset();
      scheduler.clear();
      lockManager.clear();
    });

    it('should route to the correct provider based on capabilityId', async () => {
      const pipeline = new DefaultExecutionPipeline(eventBus, capabilityRuntime);
      const scheduler = new InMemoryScheduler();
      const lockManager = new InMemoryLockManager();

      const engine = new ExecutionEngine(
        pipeline,
        scheduler,
        eventBus,
        lockManager,
        capabilityRuntime,
      );

      // Request a translation capability — handled by MockTranslationProvider
      const request = createCapabilityExecutionRequest('llm.translation', {
        prompt: 'Hello world',
        sourceLanguage: 'en',
        targetLanguage: 'fr',
      });

      const task = await engine.submit(request);
      await waitForTaskCompletion(engine, task.id, 3000);

      const status = await engine.getStatus(task.id);
      assert.equal(status, 'completed', 'Translation task should complete');

      const result = await engine.getResult(task.id);
      assert.ok(result?.data, 'Result should have translation data');
      assert.ok(
        typeof result!.data === 'string' && result!.data.includes('Translated'),
        'Result should contain translation provider output'
      );

      scheduler.clear();
      lockManager.clear();
    });

    it('should handle capabilityId not supported by any provider', async () => {
      const pipeline = new DefaultExecutionPipeline(eventBus, capabilityRuntime);
      const scheduler = new InMemoryScheduler();
      const lockManager = new InMemoryLockManager();

      const engine = new ExecutionEngine(
        pipeline,
        scheduler,
        eventBus,
        lockManager,
        capabilityRuntime,
      );

      // Request an unknown capability
      const request = createCapabilityExecutionRequest('video.generate', {
        prompt: 'Create a video',
      });

      const task = await engine.submit(request);
      await waitForTaskCompletion(engine, task.id, 3000);

      const status = await engine.getStatus(task.id);
      assert.equal(status, 'failed', 'Task should fail for unsupported capability');

      const result = await engine.getResult(task.id);
      assert.ok(result, 'Result should exist');
      assert.equal(result!.success, false, 'Result should indicate failure');
      assert.ok(result!.error, 'Result should have error info');

      scheduler.clear();
      lockManager.clear();
    });
  });

  // ============ TEST 2: Events ============

  describe('2. Event publication during capability execution', () => {
    it('should publish SUBMITTED → STAGE_STARTED (execute) → STAGE_COMPLETED (execute) → COMPLETED', async () => {
      const pipeline = new DefaultExecutionPipeline(eventBus, capabilityRuntime);
      const scheduler = new InMemoryScheduler();
      const lockManager = new InMemoryLockManager();

      const engine = new ExecutionEngine(
        pipeline,
        scheduler,
        eventBus,
        lockManager,
        capabilityRuntime,
      );

      const publishedEvents: string[] = [];
      await eventBus.subscribe('*', async (evt) => {
        publishedEvents.push(evt.type);
      });

      const request = createCapabilityExecutionRequest('llm.reasoning', {
        prompt: 'Test event publication',
      });

      const task = await engine.submit(request);
      await waitForTaskCompletion(engine, task.id, 3000);

      // Verify the event chain
      assert.ok(
        publishedEvents.includes(ExecutionEventTypes.SUBMITTED),
        'Should publish SUBMITTED event'
      );
      assert.ok(
        publishedEvents.includes(ExecutionEventTypes.STAGE_STARTED),
        'Should publish STAGE_STARTED event'
      );
      assert.ok(
        publishedEvents.includes(ExecutionEventTypes.STAGE_COMPLETED),
        'Should publish STAGE_COMPLETED event'
      );
      assert.ok(
        publishedEvents.includes(ExecutionEventTypes.COMPLETED),
        'Should publish COMPLETED event'
      );

      // Verify ordering: SUBMITTED should come before STAGE_STARTED
      const submittedIdx = publishedEvents.indexOf(ExecutionEventTypes.SUBMITTED);
      const stageStartedIdx = publishedEvents.indexOf(ExecutionEventTypes.STAGE_STARTED);
      const completedIdx = publishedEvents.indexOf(ExecutionEventTypes.COMPLETED);

      assert.ok(submittedIdx < stageStartedIdx,
        'SUBMITTED should come before STAGE_STARTED');
      assert.ok(stageStartedIdx < completedIdx,
        'STAGE_STARTED should come before COMPLETED');

      // Verify stage events have correct stage name
      const stageStartedEvents = publishedEvents.filter(
        e => e === ExecutionEventTypes.STAGE_STARTED
      );
      assert.ok(stageStartedEvents.length > 0,
        'Should have at least one STAGE_STARTED event');

      scheduler.clear();
      lockManager.clear();
    });
  });

  // ============ TEST 3: Failure + Retry ============

  describe('3. Failure path: provider failure → FAILED event → retry', () => {
    it('should retry on provider failure and eventually succeed', async () => {
      const pipeline = new DefaultExecutionPipeline(eventBus, capabilityRuntime);
      const scheduler = new InMemoryScheduler();
      const lockManager = new InMemoryLockManager();

      // Configure mock to fail on first two calls
      mockProvider.setFail(true);
      mockProvider.reset();

      const engine = new ExecutionEngine(
        pipeline,
        scheduler,
        eventBus,
        lockManager,
        capabilityRuntime,
        { defaultMaxRetries: 3, defaultRetryDelay: 50 },
      );

      const publishedEvents: string[] = [];
      await eventBus.subscribe('*', async (evt) => {
        publishedEvents.push(evt.type);
      });

      const request = createCapabilityExecutionRequest('llm.reasoning', {
        prompt: 'Test retry mechanism',
      });

      const task = await engine.submit(request);
      await waitForTaskCompletion(engine, task.id, 5000);

      const status = await engine.getStatus(task.id);

      // The mock provider fails twice (setFail stops after 3 failures) then succeeds
      // So it should eventually complete
      assert.equal(status, 'completed', 'Task should eventually succeed after retries');

      // Verify retry events were published
      assert.ok(
        publishedEvents.includes(ExecutionEventTypes.RETRYING),
        'Should publish RETRYING events on failure'
      );

      mockProvider.reset();
      scheduler.clear();
      lockManager.clear();
    });

    it('should fail after exhausting retries when provider always fails', async () => {
      const pipeline = new DefaultExecutionPipeline(eventBus, capabilityRuntime);
      const scheduler = new InMemoryScheduler();
      const lockManager = new InMemoryLockManager();

      // Create a provider that always fails
      class AlwaysFailingProvider implements CapabilityProvider {
        readonly id = 'always-fail';
        readonly name = 'Always Failing Provider';
        readonly version = '1.0.0';
        supports(_capId: CapabilityId): boolean { return true; }
        async execute(_request: CapabilityRequest): Promise<CapabilityResult> {
          return {
            success: false,
            error: {
              code: 'ALWAYS_FAILS',
              message: 'This provider always fails',
              retryable: true,
            },
            usage: { durationMs: 5 },
          };
        }
        async health(): Promise<{ ok: boolean; latency: number }> { return { ok: true, latency: 1 }; }
        async cost(): Promise<{ input: number; output: number }> { return { input: 0, output: 0 }; }
        async limits(): Promise<{ maxTokens: number; maxConcurrent: number }> { return { maxTokens: 100, maxConcurrent: 1 }; }
      }

      const failingRuntime = new CapabilityRuntime();
      failingRuntime.registerProvider(new AlwaysFailingProvider());
      failingRuntime.registerCapability({
        id: 'llm.always-fails',
        name: 'Always Fails',
        description: 'A capability that always fails',
        version: '1.0.0',
        provider: 'always-fail',
        model: 'fail-model',
        inputSchema: {},
        outputSchema: {},
      });

      const testPipeline = new DefaultExecutionPipeline(eventBus, failingRuntime);

      const engine = new ExecutionEngine(
        testPipeline,
        new InMemoryScheduler(),
        eventBus,
        new InMemoryLockManager(),
        failingRuntime,
        { defaultMaxRetries: 2, defaultRetryDelay: 50 },
      );

      const request = createCapabilityExecutionRequest('llm.always-fails', {
        prompt: 'This should fail',
      });

      const task = await engine.submit(request);
      await waitForTaskCompletion(engine, task.id, 5000);

      const status = await engine.getStatus(task.id);
      assert.equal(status, 'failed', 'Task should fail after exhausting retries');
    });
  });

  // ============ TEST 4: CapabilityRuntime Routing ============

  describe('4. CapabilityRuntime provider resolution', () => {
    it('should discover registered capabilities', () => {
      const descriptors = capabilityRuntime.discover();
      assert.ok(descriptors.length >= 2, 'Should have at least 2 capabilities');

      const reasoningDesc = descriptors.find(d => d.id === 'llm.reasoning');
      assert.ok(reasoningDesc, 'Should include llm.reasoning');
      assert.equal(reasoningDesc!.provider, 'mock-provider');
      assert.equal(reasoningDesc!.model, 'mock-model-v1');

      const extractionDesc = descriptors.find(d => d.id === 'llm.extraction');
      assert.ok(extractionDesc, 'Should include llm.extraction');
    });

    it('should find providers that support a capability', () => {
      const providers = capabilityRuntime.discoverProviders('llm.reasoning');
      assert.ok(providers.includes('mock-provider'),
        'mock-provider should support llm.reasoning');
    });

    it('should report capability availability', () => {
      assert.ok(
        capabilityRuntime.isCapabilityAvailable('llm.reasoning'),
        'llm.reasoning should be available'
      );
      assert.ok(
        capabilityRuntime.isCapabilityAvailable('llm.translation'),
        'llm.translation should be available via translation provider'
      );
      assert.equal(
        capabilityRuntime.isCapabilityAvailable('video.generate'),
        false,
        'video.generate should not be available'
      );
    });
  });

  // ============ TEST 5: ExecutionCapabilityHandler standalone ============

  describe('5. ExecutionCapabilityHandler standalone', () => {
    it('should throw error if payload has no capabilityId', async () => {
      const handler = new ExecutionCapabilityHandler(capabilityRuntime);

      const context: ExecutionContext = {
        requestId: 'test-req',
        traceId: 'test-trace',
        userId: 'test-user',
        projectId: 'test-project',
        workspaceType: 'test',
        workspaceId: 'test-ws',
        cancellationToken: new AbortController().signal,
        capabilities: new Map(),
        startedAt: Date.now(),
        timeoutMs: 5000,
        retryCount: 0,
        maxRetries: 0,
        metadata: {},
      };

      const task: ExecutionTask = {
        id: 'test-task',
        requestId: 'test-req',
        traceId: 'test-trace',
        type: 'capability',
        status: 'executing',
        context,
        pipeline: ['execute'],
        currentStage: 0,
        payload: { someRandomData: true }, // No capabilityId
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      try {
        await handler.execute(context, task);
        assert.fail('Should have thrown an error');
      } catch (err) {
        assert.ok(err instanceof Error, 'Should throw an Error');
        assert.ok(
          (err as Error).message.includes('missing capabilityId'),
          'Error should mention missing capabilityId'
        );
      }
    });

    it('should store result in task on success', async () => {
      const handler = new ExecutionCapabilityHandler(capabilityRuntime);

      const context: ExecutionContext = {
        requestId: 'test-req',
        traceId: 'test-trace-2',
        userId: 'test-user',
        projectId: 'test-project',
        workspaceType: 'test',
        workspaceId: 'test-ws',
        cancellationToken: new AbortController().signal,
        capabilities: new Map(),
        startedAt: Date.now(),
        timeoutMs: 5000,
        retryCount: 0,
        maxRetries: 0,
        metadata: {},
      };

      const capabilityRequest: CapabilityRequest = {
        capabilityId: 'llm.reasoning',
        context, // Will be overwritten by handler
        input: { prompt: 'Test storage' },
        options: { temperature: 0.5 },
      };

      const task: ExecutionTask = {
        id: 'test-task-2',
        requestId: 'test-req',
        traceId: 'test-trace-2',
        type: 'capability',
        status: 'executing',
        context,
        pipeline: ['execute'],
        currentStage: 0,
        payload: capabilityRequest,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await handler.execute(context, task);

      assert.ok(task.result, 'Task should have result after execution');
      assert.equal(task.result!.success, true, 'Result should be successful');
      assert.ok(task.result!.data, 'Result should have data');
      assert.ok(
        typeof task.result!.data === 'string' &&
        task.result!.data.includes('Mock result'),
        'Result data should come from provider'
      );
    });
  });
});
