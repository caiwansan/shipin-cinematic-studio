// ════════════════════════════════════════════════════════════
// GeoKDP Adapter — Phase 1 Compatibility Layer
// ════════════════════════════════════════════════════════════
// Bridges Knowledge Hub (platform/knowledge-hub/) with GEO's existing KDP callers.
// Workspace callers keep importing from services/geo/kdp/ — those files now
// re-export through this adapter. No caller-side changes needed.
//
// Phase 2: Replace with GeoKnowledgeProvider
// Phase 3: Delete this file + old GEO KDP directory
// ════════════════════════════════════════════════════════════

export {
  // Pipeline
  PackagingPipeline,
  PipelineInput,
  PipelineOutput,
  PipelineResult,
} from '../../platform/knowledge-hub/packaging-pipeline.js'

export {
  PackagingAdapterRegistry,
} from '../../platform/knowledge-hub/packaging-adapter-registry.js'

export {
  PackagingOrchestrator,
} from '../../platform/knowledge-hub/packaging-orchestrator.js'

export {
  DistributionPlannerService,
} from '../../platform/knowledge-hub/distribution-planner.service.js'

export {
  AssetBuilderService,
} from '../../platform/knowledge-hub/asset-builder.service.js'

export {
  AttemptSchedulerService,
} from '../../platform/knowledge-hub/attempt-scheduler.service.js'

// Delivery
export {
  DeliveryRuntime,
} from '../../platform/knowledge-hub/delivery/delivery-runtime.js'

export {
  LocalDeliveryAdapter,
} from '../../platform/knowledge-hub/delivery/local-delivery.adapter.js'

export {
  PublishManifest,
} from '../../platform/knowledge-hub/delivery/publish-manifest.js'

export {
  PublishPipeline,
} from '../../platform/knowledge-hub/delivery/publish-pipeline.js'

export {
  StaticDeliveryService,
} from '../../platform/knowledge-hub/delivery/static-delivery.js'

// Repos
export {
  KnowledgePackageRepository,
} from '../../platform/knowledge-hub/repos/package.repository.js'

export {
  ManifestRepository,
} from '../../platform/knowledge-hub/repos/manifest.repository.js'

export {
  ArtifactRepository,
} from '../../platform/knowledge-hub/repos/artifact.repository.js'

export {
  JobRepository,
} from '../../platform/knowledge-hub/delivery/repos/job.repository.js'

export {
  TargetRepository,
} from '../../platform/knowledge-hub/delivery/repos/target.repository.js'

export {
  RecordRepository,
} from '../../platform/knowledge-hub/delivery/repos/record.repository.js'

// Delivery Repos
export {
  AdapterRegistry,
} from '../../platform/knowledge-hub/delivery/adapter-registry.js'

export {
  CredentialCenter,
} from '../../platform/knowledge-hub/delivery/credential-center.js'

// Types are still defined in GEO — no re-export needed
// Phase 2: Types move to platform/knowledge-hub/
