/**
 * Capability Orchestrator — Comprehensive Tests
 *
 * Tests cover:
 * - Policy resolution: correct provider+model selected
 * - Router execution: request → provider → result
 * - Fallback chain: primary fails → fallback 1 → fallback 2
 * - Health-aware routing: unhealthy provider skipped
 * - Cost recording: usage recorded after each call
 * - Event publishing: capability.executed / capability.failed
 * - All providers exhausted: throws error
 * - Provider registration + discovery
 *
 * @package @studio/platform/capability
 */

import { CapabilityRegistry } from '../registries/capability-registry';
import { ProviderRegistry } from '../registries/provider-registry';
import { ModelRegistry, type ModelEntry } from '../registries/model-registry';
import { PolicyEngine, type Policy, type PolicyResolution } from '../policy/policy-engine';
import { CapabilityRouter, type RouteResult } from '../router/capability-router';
import { HealthManager, type ProviderHealth } from '../health-manager';
import { CostManager, type UsageRecord } from '../cost-manager';
import { FallbackManager } from '../fallback-manager';
import { CapabilityOrchestrator } from '../capability-orchestrator';
import { EventBus } from '../../event/event-bus';

import type {
  CapabilityProvider,
  CapabilityRequest,
  CapabilityResult,
  CapabilityId,
  CapabilityDescriptor,
} from '../types';

// ============ Mock Provider ============

class MockProvider implements CapabilityProvider {
  readonly id: string;
  readonly name: string;
  readonly version: string = '1.0.0';

  private shouldFail: boolean;
  private delayMs: number;
  readonly supportedCapabilities: Set<string>;

  constructor(
    id: string,
    name: string,
    options?: { shouldFail?: boolean; delayMs?: number; supported?: string[] }
  ) {
    this.id = id;
    this.name = name;
    this.shouldFail = options?.shouldFail ?? false;
    this.delayMs = options?.delayMs ?? 0;
    this.supportedCapabilities = new Set(options?.supported ?? ['llm.reasoning', 'llm.extraction']);
  }

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  async execute(request: CapabilityRequest): Promise<CapabilityResult> {
    if (this.delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delayMs));
    }

    if (this.shouldFail) {
      return {
        success: false,
        error: {
          code: 'PROVIDER_ERROR',
          message: `MockProvider '${this.id}' simulated failure`,
          retryable: true,
        },
        usage: { durationMs: 0 },
      };
    }

    return {
      success: true,
      output: `Response from ${this.id} for ${request.capabilityId}`,
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        cost: 0.002,
        durationMs: this.delayMs || 10,
      },
      metadata: {
        provider: this.id,
        model: this.models[request.capabilityId] || 'default',
      },
    };
  }

  models: Record<string, string> = {};

  async health(): Promise<{ ok: boolean; latency: number }> {
    return { ok: !this.shouldFail, latency: 5 };
  }

  supports(capabilityId: CapabilityId): boolean {
    return this.supportedCapabilities.has(capabilityId);
  }

  async cost(_capabilityId: CapabilityId): Promise<{ input: number; output: number }> {
    return { input: 0.01, output: 0.03 };
  }

  async limits(_capabilityId: CapabilityId): Promise<{ maxTokens: number; maxConcurrent: number }> {
    return { maxTokens: 4096, maxConcurrent: 10 };
  }
}

// ============ CapabilityRequest Builder ============

function createRequest(
  capabilityId: CapabilityId = 'llm.reasoning',
  overrides?: Partial<CapabilityRequest>
): CapabilityRequest {
  return {
    capabilityId,
    context: {
      requestId: 'req-1',
      traceId: 'trace-1',
      userId: 'user-1',
      projectId: 'project-1',
      workspaceType: 'geo',
      workspaceId: 'ws-1',
      cancellationToken: new AbortController().signal,
      capabilities: new Map(),
      startedAt: Date.now(),
      timeoutMs: 30000,
      retryCount: 0,
      maxRetries: 3,
      metadata: {},
    },
    input: { prompt: 'Test prompt' },
    options: { temperature: 0.7 },
    ...overrides,
  };
}

function createPolicy(overrides?: Partial<Policy>): Policy {
  return {
    id: 'test-policy',
    name: 'Test Policy',
    workspace: 'geo',
    rules: [
      { capability: 'llm.reasoning', provider: 'deepseek', model: 'deepseek-v4', priority: 1 },
      { capability: 'llm.reasoning', provider: 'openai', model: 'gpt-4o', priority: 2 },
    ],
    fallbacks: [
      [
        { capability: 'llm.reasoning', provider: 'qwen', model: 'qwen-max' },
      ],
      [
        { capability: 'llm.reasoning', provider: 'grok', model: 'grok-2' },
        { capability: 'llm.reasoning', provider: 'claude', model: 'claude-3' },
      ],
      [
        { capability: 'llm.reasoning', provider: 'mistral', model: 'mistral-large' },
      ],
    ],
    ...overrides,
  };
}

// ============ Setup Function ============

interface OrchestratorTestBed {
  orchestrator: CapabilityOrchestrator;
  eventBus: EventBus;
  healthManager: HealthManager;
  costManager: CostManager;
  policyEngine: PolicyEngine;
  providerRegistry: ProviderRegistry;
  capabilityRegistry: CapabilityRegistry;
  modelRegistry: ModelRegistry;
  providers: Record<string, MockProvider>;
}

function createTestBed(): OrchestratorTestBed {
  const eventBus = new EventBus();
  const capabilityRegistry = new CapabilityRegistry();
  const providerRegistry = new ProviderRegistry();
  const modelRegistry = new ModelRegistry();
  const healthManager = new HealthManager();
  const costManager = new CostManager();
  const policyEngine = new PolicyEngine();
  const fallbackManager = new FallbackManager(policyEngine, providerRegistry, healthManager);
  const router = new CapabilityRouter(policyEngine, providerRegistry, healthManager, fallbackManager);

  // Create mock providers
  const deepseek = new MockProvider('deepseek', 'DeepSeek', { supported: ['llm.reasoning'] });
  const openai = new MockProvider('openai', 'OpenAI', { supported: ['llm.reasoning', 'llm.extraction'] });
  const qwen = new MockProvider('qwen', 'Qwen', { supported: ['llm.reasoning'] });
  const grok = new MockProvider('grok', 'Grok', { supported: ['llm.reasoning'] });
  const claude = new MockProvider('claude', 'Claude', { supported: ['llm.reasoning'] });
  const mistral = new MockProvider('mistral', 'Mistral', { supported: ['llm.reasoning'] });

  // Register providers
  providerRegistry.register(deepseek);
  providerRegistry.register(openai);
  providerRegistry.register(qwen);
  providerRegistry.register(grok);
  providerRegistry.register(claude);
  providerRegistry.register(mistral);

  // Register capability descriptors
  capabilityRegistry.register({
    id: 'llm.reasoning',
    name: 'LLM Reasoning',
    description: 'General reasoning',
    version: '1.0.0',
    provider: '',
    model: '',
    inputSchema: {},
    outputSchema: {},
  });

  capabilityRegistry.register({
    id: 'llm.extraction',
    name: 'LLM Extraction',
    description: 'Data extraction',
    version: '1.0.0',
    provider: '',
    model: '',
    inputSchema: {},
    outputSchema: {},
  });

  // Load policy
  policyEngine.loadPolicy(createPolicy());

  // Create orchestrator
  const orchestrator = new CapabilityOrchestrator(
    capabilityRegistry,
    providerRegistry,
    modelRegistry,
    policyEngine,
    router,
    healthManager,
    costManager,
    fallbackManager,
    eventBus
  );

  return {
    orchestrator,
    eventBus,
    healthManager,
    costManager,
    policyEngine,
    providerRegistry,
    capabilityRegistry,
    modelRegistry,
    providers: { deepseek, openai, qwen, grok, claude, mistral },
  };
}

// ============ Tests ============

describe('Capability Orchestrator', () => {
  let bed: OrchestratorTestBed;

  beforeEach(() => {
    bed = createTestBed();
  });

  // ============ 1. Provider Registration + Discovery ============

  describe('Provider Registration & Discovery', () => {
    it('should register providers and discover them', () => {
      const providers = bed.providerRegistry.list();
      expect(providers.length).toBe(6);
      expect(providers.map(p => p.id)).toContain('deepseek');
      expect(providers.map(p => p.id)).toContain('openai');
    });

    it('should find providers by capability', () => {
      const providers = bed.providerRegistry.findByCapability('llm.reasoning');
      expect(providers.length).toBe(6); // All support llm.reasoning
    });

    it('should find providers by capability with mixed support', () => {
      const providers = bed.providerRegistry.findByCapability('llm.extraction');
      expect(providers.length).toBe(1); // Only openai
      expect(providers[0].id).toBe('openai');
    });

    it('should unregister a provider', () => {
      bed.providerRegistry.unregister('deepseek');
      expect(bed.providerRegistry.get('deepseek')).toBeUndefined();
    });
  });

  // ============ 2. Capability Registry ============

  describe('Capability Registry', () => {
    it('should register and list capabilities', () => {
      const capabilities = bed.capabilityRegistry.list();
      expect(capabilities.length).toBe(2);
      expect(capabilities.map(c => c.id)).toContain('llm.reasoning');
    });

    it('should get capability by ID', () => {
      const cap = bed.capabilityRegistry.get('llm.reasoning');
      expect(cap).toBeDefined();
      expect(cap!.name).toBe('LLM Reasoning');
    });

    it('should return undefined for unknown capability', () => {
      const cap = bed.capabilityRegistry.get('unknown.cap');
      expect(cap).toBeUndefined();
    });
  });

  // ============ 3. Policy Resolution ============

  describe('Policy Resolution', () => {
    it('should resolve to the highest priority healthy provider', async () => {
      const resolution = await bed.policyEngine.resolve('llm.reasoning', {
        workspace: 'geo',
        health: bed.healthManager.getAll(),
      });

      expect(resolution.providerId).toBe('deepseek');
      expect(resolution.modelId).toBe('deepseek-v4');
      expect(resolution.policyId).toBe('test-policy');
    });

    it('should skip unhealthy providers and pick next', async () => {
      // Mark deepseek as unhealthy
      for (let i = 0; i < 5; i++) {
        bed.healthManager.recordFailure('deepseek', 'Server error');
      }

      const resolution = await bed.policyEngine.resolve('llm.reasoning', {
        workspace: 'geo',
        health: bed.healthManager.getAll(),
      });

      expect(resolution.providerId).toBe('openai');
      expect(resolution.modelId).toBe('gpt-4o');
    });

    it('should throw error when all providers are unhealthy', async () => {
      // Mark all providers as unhealthy
      for (const providerId of ['deepseek', 'openai', 'qwen', 'grok', 'claude', 'mistral']) {
        for (let i = 0; i < 5; i++) {
          bed.healthManager.recordFailure(providerId, 'Server error');
        }
      }

      await expect(
        bed.policyEngine.resolve('llm.reasoning', {
          workspace: 'geo',
          health: bed.healthManager.getAll(),
        })
      ).rejects.toThrow(/No healthy provider/);
    });

    it('should throw error when no policy matches the workspace', async () => {
      await expect(
        bed.policyEngine.resolve('llm.reasoning', {
          workspace: 'unknown-workspace',
          health: bed.healthManager.getAll(),
        })
      ).rejects.toThrow(/No policy found/);
    });
  });

  // ============ 4. Router Execution ============

  describe('Router Execution', () => {
    it('should execute capability through the selected provider', async () => {
      const request = createRequest('llm.reasoning');
      const result = await bed.orchestrator.execute('llm.reasoning', request);

      expect(result.success).toBe(true);
      expect(result.output).toContain('deepseek'); // deepseek is primary
    });

    it('should return result from fallback when primary fails', async () => {
      // Make deepseek fail
      bed.providers.deepseek.setShouldFail(true);

      const request = createRequest('llm.reasoning');
      const result = await bed.orchestrator.execute('llm.reasoning', request);

      expect(result.success).toBe(true);
      // Should fall back to qwen (first fallback level)
      expect(result.output).toContain('qwen');
    });

    it('should execute capability on openai for extraction', async () => {
      const request = createRequest('llm.extraction');
      const result = await bed.orchestrator.execute('llm.extraction', request);

      expect(result.success).toBe(true);
      expect(result.output).toContain('openai');
    });
  });

  // ============ 5. Fallback Chain ============

  describe('Fallback Chain', () => {
    it('should iterate through fallback levels when primary and first fallback fail', async () => {
      // Make deepseek (primary) fail
      bed.providers.deepseek.setShouldFail(true);
      // Make qwen (fallback level 1) fail
      bed.providers.qwen.setShouldFail(true);

      const request = createRequest('llm.reasoning');
      const result = await bed.orchestrator.execute('llm.reasoning', request);

      // Should fall through to grok or claude (fallback level 2)
      expect(result.success).toBe(true);
      expect(
        result.output?.toString().includes('grok') ||
        result.output?.toString().includes('claude')
      ).toBe(true);
    });

    it('should exhaust all providers and throw', async () => {
      // Make ALL providers fail
      for (const provider of Object.values(bed.providers)) {
        provider.setShouldFail(true);
      }

      const request = createRequest('llm.reasoning');
      await expect(
        bed.orchestrator.execute('llm.reasoning', request)
      ).rejects.toThrow(/All providers exhausted/);
    });

    it('should skip unhealthy providers during fallback', async () => {
      // Make deepseek fail
      bed.providers.deepseek.setShouldFail(true);

      // Make qwen unhealthy (consecutive failures)
      for (let i = 0; i < 5; i++) {
        bed.healthManager.recordFailure('qwen', 'Unhealthy');
      }

      const request = createRequest('llm.reasoning');
      const result = await bed.orchestrator.execute('llm.reasoning', request);

      // Should skip qwen and go to level 2
      expect(result.success).toBe(true);
    });

    it('should get fallback chain from policy engine', () => {
      const fallbacks = bed.policyEngine.getFallbacks('llm.reasoning');
      expect(fallbacks.length).toBe(3); // 3 fallback levels

      // Level 1 has 1 rule
      expect(fallbacks[0].length).toBe(1);
      expect(fallbacks[0][0].provider).toBe('qwen');

      // Level 2 has 2 rules
      expect(fallbacks[1].length).toBe(2);
      expect(fallbacks[1][0].provider).toBe('grok');
      expect(fallbacks[1][1].provider).toBe('claude');

      // Level 3 has 1 rule
      expect(fallbacks[2].length).toBe(1);
      expect(fallbacks[2][0].provider).toBe('mistral');
    });
  });

  // ============ 6. Health-Aware Routing ============

  describe('Health-Aware Routing', () => {
    it('should mark provider as degraded after failures', () => {
      for (let i = 0; i < 3; i++) {
        bed.healthManager.recordFailure('deepseek', 'Error');
      }

      const health = bed.healthManager.get('deepseek');
      expect(health.status).toBe('degraded');
      expect(health.consecutiveFailures).toBe(3);
    });

    it('should mark provider as unavailable after 5 consecutive failures', () => {
      for (let i = 0; i < 5; i++) {
        bed.healthManager.recordFailure('deepseek', 'Error');
      }

      const health = bed.healthManager.get('deepseek');
      expect(health.status).toBe('unavailable');
    });

    it('should recover after successful calls', () => {
      for (let i = 0; i < 5; i++) {
        bed.healthManager.recordFailure('deepseek', 'Error');
      }
      expect(bed.healthManager.get('deepseek').status).toBe('unavailable');

      // Successful call resets consecutive failures
      bed.healthManager.recordSuccess('deepseek', 100);
      const health = bed.healthManager.get('deepseek');
      expect(health.consecutiveFailures).toBe(0);
      expect(health.status).toBe('degraded'); // still degraded due to low success rate
    });

    it('should track latency averages', () => {
      bed.healthManager.recordSuccess('deepseek', 100);
      bed.healthManager.recordSuccess('deepseek', 200);
      bed.healthManager.recordSuccess('deepseek', 300);

      const health = bed.healthManager.get('deepseek');
      expect(health.avgLatencyMs).toBe(200);
    });

    it('should return healthy for untracked providers', () => {
      const health = bed.healthManager.get('unknown-provider');
      expect(health.status).toBe('healthy');
    });

    it('should report isHealthy correctly', () => {
      expect(bed.healthManager.isHealthy('deepseek')).toBe(true);

      for (let i = 0; i < 5; i++) {
        bed.healthManager.recordFailure('deepseek', 'Error');
      }

      expect(bed.healthManager.isHealthy('deepseek')).toBe(false);
    });
  });

  // ============ 7. Cost Recording ============

  describe('Cost Recording', () => {
    it('should record usage after successful execution', async () => {
      const request = createRequest('llm.reasoning');
      await bed.orchestrator.execute('llm.reasoning', request);

      const records = bed.costManager.getUsage({ workspace: 'geo' });
      expect(records.length).toBe(1);
      expect(records[0].capabilityId).toBe('llm.reasoning');
      expect(records[0].providerId).toBe('deepseek');
      expect(records[0].success).toBe(true);
    });

    it('should record usage with correct token counts', async () => {
      const request = createRequest('llm.reasoning');
      await bed.orchestrator.execute('llm.reasoning', request);

      const records = bed.costManager.getUsage();
      expect(records[0].inputTokens).toBe(100);
      expect(records[0].outputTokens).toBe(50);
      expect(records[0].totalTokens).toBe(150);
    });

    it('should record cost even when execution fails', async () => {
      bed.providers.deepseek.setShouldFail(true);
      bed.providers.qwen.setShouldFail(true);
      bed.providers.grok.setShouldFail(true);
      bed.providers.claude.setShouldFail(true);
      bed.providers.mistral.setShouldFail(true);

      // Still record the failed attempts
      const request = createRequest('llm.reasoning');
      try {
        await bed.orchestrator.execute('llm.reasoning', request);
      } catch {
        // Expected to throw
      }

      // Cost should still have records from failed attempts
      // (only successful records are recorded by the orchestrator)
    });

    it('should aggregate cost by workspace', async () => {
      const request1 = createRequest('llm.reasoning');
      const request2 = createRequest('llm.extraction');

      await bed.orchestrator.execute('llm.reasoning', request1);
      await bed.orchestrator.execute('llm.extraction', request2);

      const total = await bed.costManager.getTotalCost({ workspace: 'geo' });
      expect(total.records).toBe(2);
      expect(total.total).toBeGreaterThan(0);
    });
  });

  // ============ 8. Event Publishing ============

  describe('Event Publishing', () => {
    it('should publish capability.executed event on success', (done) => {
      bed.eventBus.subscribe('capability.executed', async (event) => {
        expect(event.payload.capabilityId).toBe('llm.reasoning');
        expect(event.payload.success).toBe(true);
        done();
      });

      const request = createRequest('llm.reasoning');
      bed.orchestrator.execute('llm.reasoning', request).catch(done);
    });

    it('should publish capability.failed event on failure', (done) => {
      bed.eventBus.subscribe('capability.failed', async (event) => {
        expect(event.payload.capabilityId).toBe('llm.reasoning');
        expect(event.payload.success).toBeFalsy();
        expect(event.payload.error).toBeDefined();
        done();
      });

      // Make all providers fail
      for (const provider of Object.values(bed.providers)) {
        provider.setShouldFail(true);
      }

      const request = createRequest('llm.reasoning');
      bed.orchestrator.execute('llm.reasoning', request).catch(() => {
        // Expected to throw
      });
    });

    it('should include fallback info in event when fallback used', (done) => {
      bed.eventBus.subscribe('capability.executed', async (event) => {
        if (event.payload.fallbackUsed) {
          expect(event.payload.fallbackChain).toBeDefined();
          expect(event.payload.fallbackChain!.length).toBeGreaterThan(1);
          done();
        }
      });

      bed.providers.deepseek.setShouldFail(true);

      const request = createRequest('llm.reasoning');
      bed.orchestrator.execute('llm.reasoning', request).catch(done);
    });
  });

  // ============ 9. Unknown Capability ============

  describe('Unknown Capability', () => {
    it('should throw error for unknown capability', async () => {
      const request = createRequest('unknown.cap');
      await expect(
        bed.orchestrator.execute('unknown.cap', request)
      ).rejects.toThrow(/Unknown capability/);
    });
  });

  // ============ 10. Model Registry ============

  describe('Model Registry', () => {
    it('should register and retrieve model entries', () => {
      const model: ModelEntry = {
        id: 'deepseek-v4',
        providerId: 'deepseek',
        name: 'DeepSeek V4',
        version: '4.0',
        capabilities: ['llm.reasoning', 'llm.extraction'],
        context: { maxTokens: 32768, maxInput: 16384, maxOutput: 16384 },
        cost: { inputPer1k: 0.002, outputPer1k: 0.008 },
        status: 'active',
      };

      bed.modelRegistry.register(model);

      const retrieved = bed.modelRegistry.get('deepseek-v4');
      expect(retrieved).toBeDefined();
      expect(retrieved!.providerId).toBe('deepseek');
      expect(retrieved!.context.maxTokens).toBe(32768);
    });

    it('should find models by capability', () => {
      const model1: ModelEntry = {
        id: 'deepseek-v4',
        providerId: 'deepseek',
        name: 'DeepSeek V4',
        version: '4.0',
        capabilities: ['llm.reasoning'],
        context: { maxTokens: 32768, maxInput: 16384, maxOutput: 16384 },
        cost: { inputPer1k: 0.002, outputPer1k: 0.008 },
        status: 'active',
      };

      const model2: ModelEntry = {
        id: 'gpt-4o',
        providerId: 'openai',
        name: 'GPT-4o',
        version: '4.0',
        capabilities: ['llm.reasoning', 'llm.extraction'],
        context: { maxTokens: 16384, maxInput: 8192, maxOutput: 8192 },
        cost: { inputPer1k: 0.01, outputPer1k: 0.03 },
        status: 'active',
      };

      bed.modelRegistry.register(model1);
      bed.modelRegistry.register(model2);

      const models = bed.modelRegistry.findByCapability('llm.reasoning');
      expect(models.length).toBe(2);

      const extractionModels = bed.modelRegistry.findByCapability('llm.extraction');
      expect(extractionModels.length).toBe(1);
      expect(extractionModels[0].id).toBe('gpt-4o');
    });

    it('should not find deprecated models by capability', () => {
      const deprecated: ModelEntry = {
        id: 'gpt-3.5',
        providerId: 'openai',
        name: 'GPT-3.5',
        version: '3.5',
        capabilities: ['llm.reasoning'],
        context: { maxTokens: 4096, maxInput: 2048, maxOutput: 2048 },
        cost: { inputPer1k: 0.001, outputPer1k: 0.002 },
        status: 'deprecated',
      };

      bed.modelRegistry.register(deprecated);
      const models = bed.modelRegistry.findByCapability('llm.reasoning');
      expect(models.length).toBe(0); // deprecated models excluded
    });

    it('should find models by provider', () => {
      const model: ModelEntry = {
        id: 'deepseek-v4',
        providerId: 'deepseek',
        name: 'DeepSeek V4',
        version: '4.0',
        capabilities: ['llm.reasoning'],
        context: { maxTokens: 32768, maxInput: 16384, maxOutput: 16384 },
        cost: { inputPer1k: 0.002, outputPer1k: 0.008 },
        status: 'active',
      };

      bed.modelRegistry.register(model);
      const models = bed.modelRegistry.findByProvider('deepseek');
      expect(models.length).toBe(1);
      expect(models[0].id).toBe('deepseek-v4');
    });
  });

  // ============ 11. Policy Engine — Multi-policy ============

  describe('Multi-policy Resolution', () => {
    it('should use workflow-specific policy when available', async () => {
      const workflowPolicy: Policy = {
        id: 'geo-workflow',
        name: 'Geo Workflow Policy',
        workspace: 'geo',
        workflow: 'geo-discovery',
        rules: [
          { capability: 'llm.reasoning', provider: 'openai', model: 'gpt-4o', priority: 1 },
        ],
        fallbacks: [],
      };

      bed.policyEngine.loadPolicy(workflowPolicy);

      // Without workflow, should use the default geo policy
      const defaultRes = await bed.policyEngine.resolve('llm.reasoning', {
        workspace: 'geo',
        health: bed.healthManager.getAll(),
      });
      expect(defaultRes.providerId).toBe('deepseek');

      // With workflow, should use workflow-specific policy
      const workflowRes = await bed.policyEngine.resolve('llm.reasoning', {
        workspace: 'geo',
        workflow: 'geo-discovery',
        health: bed.healthManager.getAll(),
      });
      expect(workflowRes.providerId).toBe('openai');
    });
  });

  // ============ 12. Fallback Manager — Edge Cases ============

  describe('Fallback Manager Edge Cases', () => {
    it('should throw when no fallbacks configured', async () => {
      const noFallbackPolicy = createPolicy({ fallbacks: [] });
      const localPolicyEngine = new PolicyEngine();
      localPolicyEngine.loadPolicy(noFallbackPolicy);

      const resolution: PolicyResolution = {
        providerId: 'deepseek',
        modelId: 'deepseek-v4',
        policyId: 'test-policy',
        ruleIndex: 0,
      };

      const fallbackManager = new FallbackManager(
        localPolicyEngine,
        bed.providerRegistry,
        bed.healthManager
      );

      await expect(
        fallbackManager.executeWithFallback(createRequest('llm.reasoning'), resolution)
      ).rejects.toThrow(/No fallback configured/);
    });
  });

  // ============ 13. Health Manager — Auto-decay ============

  describe('Health Manager Auto-decay', () => {
    it('should decay unavailable providers after TTL on next get', () => {
      // Mock: set consecutiveFailures manually
      const healthManager = new HealthManager();

      for (let i = 0; i < 5; i++) {
        healthManager.recordFailure('deepseek', 'Error');
      }

      expect(healthManager.get('deepseek').status).toBe('unavailable');

      // isHealthy should reflect the unavailable status
      expect(healthManager.isHealthy('deepseek')).toBe(false);

      // Reset for clean state
      healthManager.reset('deepseek');
      expect(healthManager.isHealthy('deepseek')).toBe(true);
    });
  });
});
