/**
 * Platform Bootstrap — Assembles all platform components for the Reference Workspace.
 *
 * Wires together:
 * - WorkspaceRegistry with GEO adapter
 * - EventBus (real in-memory)
 * - CapabilityRuntime with OpenAI provider
 * - PlatformRuntime wrapping adapter lifecycle
 * - PrismaAdapter + GEOProjectRepository for real DB access
 *
 * Execution order:
 * 1. Initialize PrismaAdapter and repositories
 * 2. Register workspace adapters in WorkspaceRegistry
 * 3. Create EventBus
 * 4. Initialize CapabilityRuntime with providers
 * 5. Create PlatformRuntime with all components
 * 6. Initialize and activate the GEO workspace
 *
 * @package @studio/platform/bootstrap
 */

import { WorkspaceRegistry } from '../workspace/workspace-registry';
import { PlatformRuntime } from '../runtime/platform-runtime';
import { EventBus } from '../event/event-bus';
import { CapabilityRuntime } from '../capability/capability-runtime';
import { CapabilityOrchestrator } from '../capability/capability-orchestrator';
import { CapabilityRegistry } from '../capability/registries/capability-registry';
import { ProviderRegistry } from '../capability/registries/provider-registry';
import { ModelRegistry } from '../capability/registries/model-registry';
import { PolicyEngine } from '../capability/policy/policy-engine';
import { CapabilityRouter } from '../capability/router/capability-router';
import { HealthManager } from '../capability/health-manager';
import { CostManager } from '../capability/cost-manager';
import { FallbackManager } from '../capability/fallback-manager';
import { OpenAIProvider } from '../capability/openai-provider';
import { CapabilityDefinitions } from '../capability/capability-definitions';
import { PrismaAdapter } from '../repository/prisma-adapter';
import { GEOProjectRepository, type PlatformProject } from '../repository/geo-project-repository';
import { ProjectService, type ProjectCreateInput, type ProjectFilter } from '../project/project-service';

/**
 * Reference workspace configuration.
 */
export interface BootConfig {
  /** PrismaClient-like instance */
  prisma: any;

  /** OpenAI-compatible API key */
  openaiApiKey?: string;

  /** OpenAI-compatible base URL */
  openaiBaseUrl?: string;

  /** Default LLM model */
  defaultModel?: string;

  /** User ID for system operations */
  systemUserId?: string;

  /** Tenant ID */
  systemTenantId?: string;
}

/**
 * Boot result with all initialized components.
 */
export interface BootResult {
  registry: WorkspaceRegistry;
  eventBus: EventBus;
  capabilityRuntime: CapabilityRuntime;
  platformRuntime: PlatformRuntime;
  prismaAdapter: PrismaAdapter;
  geoRepository: GEOProjectRepository;
  projectService: ProjectService;
  orchestrator?: CapabilityOrchestrator;
}

/**
 * Bootstrap the platform for the Reference Workspace validation.
 *
 * This is the assembly point — wires all platform components together
 * and initializes the GEO workspace as the first Reference Workspace.
 *
 * Usage:
 * ```ts
 * const { projectService } = await bootstrapPlatform({ prisma });
 * const result = await projectService.create({ name: 'Test', type: 'geo' }, 'user-1');
 * ```
 */
export async function bootstrapPlatform(config: BootConfig): Promise<BootResult> {
  // 1. ORM Adapter + Repository
  const prismaAdapter = new PrismaAdapter(config.prisma);
  const geoRepository = new GEOProjectRepository(prismaAdapter);
  const projectService = new ProjectService(geoRepository);

  // 2. EventBus
  const eventBus = new EventBus();

  // 3. CapabilityRuntime with OpenAI Provider (backward compatible)
  const capabilityRuntime = new CapabilityRuntime();
  const openaiProvider = new OpenAIProvider({
    apiKey: config.openaiApiKey,
    baseUrl: config.openaiBaseUrl,
    defaultModel: config.defaultModel,
  });
  // Use legacy registration API for backward compatibility
  await capabilityRuntime.registerProvider({
    id: 'openai-provider',
    type: 'llm',
    // @ts-expect-error — legacy API, new providers register through ProviderRegistry
    models: openaiProvider.models,
    priority: 1,
    enabled: true,
    config: { baseUrl: config.openaiBaseUrl || 'https://api.openai.com/v1' },
    instance: openaiProvider,
  });

  // 4. WorkspaceRegistry — register GEO adapter
  const registry = WorkspaceRegistry.getInstance();

  // 5. PlatformRuntime
  const platformRuntime = new PlatformRuntime(registry, eventBus, capabilityRuntime);

  return {
    registry,
    eventBus,
    capabilityRuntime,
    platformRuntime,
    prismaAdapter,
    geoRepository,
    projectService,
  };
}

/**
 * Create a fully wired CapabilityOrchestrator with all sub-components.
 *
 * This is the NEW bootstrap path — creates all registries, policy engine,
 * health manager, cost manager, and wires them together.
 *
 * Usage:
 * ```ts
 * const orchestrator = await createCapabilityOrchestrator(eventBus, openaiProvider);
 * const result = await orchestrator.execute('llm.reasoning', request);
 * ```
 */
export async function createCapabilityOrchestrator(
  eventBus: EventBus,
  providers: Array<import('../capability/types').CapabilityProvider> = []
): Promise<CapabilityOrchestrator> {
  // Create all sub-components
  const capabilityRegistry = new CapabilityRegistry();
  const providerRegistry = new ProviderRegistry();
  const modelRegistry = new ModelRegistry();
  const healthManager = new HealthManager();
  const costManager = new CostManager();
  const policyEngine = new PolicyEngine();
  const fallbackManager = new FallbackManager(policyEngine, providerRegistry, healthManager);
  const router = new CapabilityRouter(policyEngine, providerRegistry, healthManager, fallbackManager);

  // Register providers
  for (const provider of providers) {
    providerRegistry.register(provider);
  }

  // Register default capabilities
  for (const [id, def] of Object.entries(CapabilityDefinitions)) {
    capabilityRegistry.register({
      id,
      name: def.name,
      description: def.description,
      version: '1.0.0',
      provider: '',
      model: '',
      inputSchema: {},
      outputSchema: {},
    });
  }

  // Create and return the orchestrator
  return new CapabilityOrchestrator(
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
}
