# Schema Audit Report: Kunlun Mirror (昆仑镜) — Prisma Schema

**Audit Date:** 2026-07-03
**File:** `/root/shipin-cinematic-studio/backend/prisma/schema.prisma`
**Total Lines:** 6,152
**Total Models:** 325 (323 PascalCase + 2 lowercase-start: `public_V3RenderResult`, `p18_pairs`; includes 1 @ignore'd: `p18_pairs`)
**Total Enums:** 3 (`VideoTaskStatus`, `TaskLogLevel`, `AssetType`)
**Total @@index directives:** 292
**Total @@unique directives:** 52
**Total @@map directives:** 261
**@@ignore count:** 1 (model `p18_pairs`)

---

## 1. Model Inventory: Active vs Orphan

### Totals
| Category | Count |
|---|---|
| **Total model declarations** | **323** |
| Active models (with relations/referenced) | ~213 |
| Models with @ignore flag | 1 (`p18_pairs`) |
| **Models verified as true orphans** | **~109** |

### Models With NO Relations AND Not Referenced (True Orphans)

**Orphans identified (no `[]` relation fields, no `@relation()` marker, and no other model references them via `@relation`):**

| # | Model | Domain | Lines |
|---|---|---|---|
| 1 | AiStageModelConfig | Config | 10-21 |
| 2 | ImagePromptTemplates | Prompt | 248-262 |
| 3 | StyleProfile | Prompt | 608-646 |
| 4 | PromptTemplate | Prompt | 648-656 |
| 5 | Captcha | Auth | 81-88 |
| 6 | SmsCode | Auth | 90-97 |
| 7 | EmailCode | Auth | 99-106 |
| 8 | MemberPlan | Payment | 806-834 |
| 9 | AgentLevelConfig | Agent | 847-854 |
| 10| DeadLetterTask | Task | 923-934 |
| 11| AiModel | AI | 936-966 |
| 12| AiFallbackRule | AI | 968-981 |
| 13| AiRoutingPolicy | AI | 983-995 |
| 14| AiTaskTypeMapping | AI | 997-1006 |
| 15| AiExecutionLog | AI | 1008-1030 |
| 16| AiCircuitBreaker | AI | 1032-1050 |
| 17| AiSandboxLog | AI | 1052-1073 |
| 18| AiTimeoutConfig | AI | 1075-1083 |
| 19| ShadowConfig | Shadow | 1085-1097 |
| 20| ShadowDriftHistory | Shadow | 1141-1156 |
| 21| CostBudget | Cost | 1158-1174 |
| 22| SystemMetric | Monitor | 1176-1198 |
| 23| ReplayFrame | Monitor | 1200-1227 |
| 24| PromptMemory | Prompt | 1270-1296 |
| 25| ApiKey | Config | 1298-1306 |
| 26| ModelProvider | Config | 1343-1359 |
| 27| VoicePreset | Config | 1361-1375 |
| 28| AdminUser | Auth | 1392-1403 |
| 29| AssetDna | Asset | 1405-1421 |
| 30| AssetLineage | Asset | 1423-1433 |
| 31| AssetRights | Asset | 1665-1676 |
| 32| AssetReference | Asset | 1435-1448 |
| 33| ContributionWeight | Asset | 1450-1462 |
| 34| RevenueSplit | Asset | 1464-1477 |
| 35| AssetTransaction | Asset | 1479-1495 |
| 36| CreatorWallet | Asset | 1497-1508 |
| 37| ModerationQueue | Asset | 1510-1523 |
| 38| PaymentConfig | Payment | 1525-1537 |
| 39| PaymentSecret | Payment | 1539-1549 |
| 40| PaymentOrder | Payment | 1551-1578 |
| 41| UserLimit | User | 1678-1687 |
| 42| TaskQueue | Task | 1689-1709 |
| 43| TaskExecution | Task | 1711-1726 |
| 44| AgentExecutionLog | Agent | 1728-1744 |
| 45| MarketAgent | Agent | 1746-1772 |
| 46| CommissionConfig | Agent | 1774-1785 |
| 47| AgentPlan | Agent | 1806-1822 |
| 48| AgentWithdraw | Agent | 1824-1839 |
| 49| DAGGraph | DAG | 1841-1854 |
| 50| DAGState | DAG | 1856-1871 |
| 51| GPUNode | GPU | 1873-1885 |
| 52| GPUTaskLog | GPU | 1887-1907 |
| 53| GPUThrottleState | GPU | 1909-1918 |
| 54| SystemMonitor | Monitor | 1920-1932 |
| 55| RateLimit | RateLimit | 1934-1946 |
| 56| CircuitBreaker | Circuit | 1948-1961 |
| 57| WorkerHeartbeat | Worker | 1963-1975 |
| 58| DesktopRuntimeConfig | Desktop | 1977-1987 |
| 59| LocalGPUNode | GPU | 1989-2003 |
| 60| LicenseCache | License | 2005-2018 |
| 61| LocalAssetIndex | Asset | 2020-2034 |
| 62| KernelEvent | Kernel | 2036-2051 |
| 63| KernelStateSnapshot | Kernel | 2053-2063 |
| 64| RuntimeRegistry | Kernel | 2065-2079 |
| 65| KernelHealthLog | Kernel | 2081-2094 |
| 66| SchedulerTask | Kernel | 2096-2114 |
| 67| ResourceAllocation | Kernel | 2116-2132 |
| 68| EventLoopViolation | Kernel | 2134-2146 |
| 69| RuntimeDependencyGraph | Kernel | 2148-2160 |
| 70| KernelShadowEventLog | Kernel | 2162-2177 |
| 71| KernelCutoverScore | Kernel | 2179-2194 |
| 72| KernelDualExecutionLog | Kernel | 2196-2213 |
| 73| KernelStateDiffLog | Kernel | 2215-2229 |
| 74| KernelRollbackHistory | Kernel | 2231-2245 |
| 75| KernelHealthMetrics | Kernel | 2247-2261 |
| 76| GenerationReference | Gen | 2264-2278 |
| 77| ProductionRecord | Gen | 2281-2297 |
| 78| PropLibrary | Asset | 2534-2545 |
| 79| CustomerChatMemory | Chat | 2608-2618 |
| 80| UsageLog | Usage | 2640-2656 |
| 81| StoryConstitution | Story | 2676-2692 |
| 82| DirectorMemory | Story | 2694-2705 |
| 83| JobQueue | Job | 2707-2722 |
| 84| InvocationLog | Invocation | 2780-2807 |
| 85| RouteConfig | Config | 3101-3114 |
| 86| ScriptBreakdown | Script | 3116-3140 |
| 87| P18Pair | V3 | 3142-3161 |
| 88| V3RenderResult | V3 | 3163-3182 |
| 89| public_V3RenderResult | V3 | 3184-3202 |
| 90| PromptVariant | Prompt | 3569-3582 |
| 91| OptimizationExecution | GEOv4 | 5584-5616 |
| 92| VerificationJob | GEOv4 | 5618-5637 |
| 93| VerificationResult | GEOv4 | 5639-5655 |
| 94| VerificationPolicy | GEOv4 | 5657-5676 |
| 95| GrowthMemory | GEOv4 | 5678-5703 |
| 96| LearningSignal | GEOv4 | 5705-5726 |
| 97| GeoScoreVersion | GEOv4 | 5728-5741 |
| 98| GrowthKnowledge | GEOv4 | 5743-5762 |
| 99| GeoKeyword | GEO | 5530-5542 |
| 100| GeoBrandSetting | GEO | 5544-5560 |
| 101| GeoScanHistory | GEO | 5562-5578 |
| 102| DualWriteWatcherEvent | Event | 5450-5466 |
| 103| LLMUsageRecord | Usage | 5473-5499 |
| 104| KnowledgeObject | Knowledge | 5504-5525 |
| 105| WalkthroughProgress | UX | 6139-6151 |
| 106| DistributionTarget | KDP | 5903-5914 |
| 107| DistributionPlan | KDP | 5918-5930 |
| 108| DistributionAdapter | KDP | 5965-5976 |
| 109| DeliveryTarget | KDP | 6097-6108 |
| 110| Action | Platform | 4492-4501 |
| 111| SemanticTopic | Platform | 4318-4330 |
| 112| SemanticRelation | Platform | 4341-4353 |
| 113| SemanticTaxonomy | Platform | 4366-4381 |
| 114| AnalyticsDaily | Platform | 5429-5442 |

**Note:** The previous audit cited "36 orphans." This audit finds ~109+ truly disconnected models — the prior count was likely based on a narrower definition (only counting models from the old 9 "layers" rather than all disconnected models).

### Models That Serve as Join/Pivot Tables (Composite Key)
- PublishPlanToClaim
- DistributionPlanToAsset
- SemanticEntityTopic

---

## 2. Index Analysis

### Summary
- Total `@@index` directives: **292**
- Total `@@unique` directives: **52**
- Models with FK fields but **no index on those FKs**: **~40+**

### Serious Missing Foreign Key Indexes

| Model | Unindexed FK Fields |
|---|---|
| RechargeOrder | `userId` |
| StoragePack | `userId` |
| CoinLog | `userId` |
| WorkerTaskAssignment | `workerId`, `taskId` |
| WorkerHealthHistory | `workerId` |
| GenerationReference | `userId`, `taskId` |
| AgentExecution | `workflowId`, `runId`, `agentId` |
| AgentMemory | `agentId`, `projectId` |
| AgentExecutionLog | `executionId`, `agentId` |
| AgentDef | (no id @default(uuid()) — uses plain @id) |
| AgentEdge | `fromAgentId`, `toAgentId` |
| WorkflowDef | `entryAgentId` |
| CommissionOrder | `agentId`, `userId`, `orderId` |
| AgentSession | `workspaceId`, `agentId` |
| AgentStepExecution | `sessionId` |
| AgentEvent | `sessionId` |
| AgentQueue | `agentId`, `workspaceId` |
| AgentPermission | `agentId` |
| AgentArtifact | `sessionId` |
| WorkflowInstance | `workflowId`, `workspaceId` |
| WorkflowNode | `instanceId` |
| WorkflowEdge | `instanceId` |
| WorkflowCheckpoint | `instanceId` |
| WorkflowExecution | `instanceId` |
| WorkflowVariable | `instanceId` |
| WorkflowEvent | `instanceId` |
| WorkflowTemplate | `workflowId` |
| GovUser | `tenantId` |
| Role | `tenantId` |
| Subscription | `tenantId`, `planId` |
| BillingRecord | `tenantId` |
| UsageRecord | `tenantId` |
| AuditLog | `tenantId` |
| License | `tenantId` |
| Policy | `tenantId` |
| Quota | `tenantId` |
| SubscriptionPlan | (no index on code) |
| CapabilityGrant | `planId` |

### Duplicate/Overlapping Concept Indexes
- `VideoTask` has `@@index([projectId])` — this was flagged as a 55MB index with zero scans in the previous audit
- Many models index `projectId` on small lookup tables where a composite index would be more selective
- `PipelineJob` has 3 separate indexes when fewer composite indexes would suffice

### Over-Indexed Models
| Model | Index Count | Notes |
|---|---|---|
| UserAsset | 3 | `[userId,createdAt]`, `[universeScore]`, `[universeClusterId]` — `universeScore(sort:Desc)` is unused |
| GEOFreshnessRecord | 4 | Over-indexed for a freshness lookup table |
| GEOClaim | 4 | `[entityId]`, `[claimType]`, `[status]`, `[confidence]` — likely underutilized |
| AssetGraphEdge | 3 | All covering different query patterns, but could be consolidated |
| LLMUsageRecord | 4 | High write volume, 4 indexes will slow inserts |

### Missing Composite Indexes
- `PaymentOrder` has 4 separate indexes but no composite `[userId, status, createdAt]` for user order history lookups
- `UsageLog` has `[userId]`, `[createdAt]`, `[taskType]` but no composite for common query patterns
- `AnalyticsEvent` has 3 indexes where `[userId, event, createdAt]` would cover most queries
- `AgentStepExecution` has NO indexes on `[sessionId, stepName]` (no @@index at all)

---

## 3. Schema Quality

### Quality Score: **58/100**

| Criteria | Score Component | Deduction |
|---|---|---|
| Orphan models (109 disconnected) | -15 | High bloat, dead code |
| Duplicate model registries (AiModel/ModelProvider) | -5 | Overlapping domain concepts |
| Duplicate circuit breakers (CircuitBreaker/AiCircuitBreaker) | -3 | Same concept, different names |
| Missing FK indexes on 40+ models | -10 | Performance degradation at scale |
| Plain text secrets (no @db.encrypted) | -5 | Security gap |
| @ignore schema drift (p18_pairs) | -2 | Migration blocker |
| Naming inconsistency (PascalCase/snake_case tables) | -5 | Maintenance burden |
| Unbounded String fields for large content | -3 | Bloat/truncation risk |
| Models that store JSON as String instead of Json type | -3 | Type safety loss |
| Relations without explicit onDelete | -4 | Migration warnings |
| **Total** | **58/100** | |

### Naming Convention Issues

**Inconsistent table naming via @@map:**
- 150+ tables mapped as `snake_case` (e.g., `ai_stage_model_config`, `tts_records`)
- 110+ tables mapped as `PascalCase` (e.g., `AiModel`, `WorkerRegistration`, `AdminUser`)
- Some models have NO @@map at all (e.g., `PromptTemplate`, `Caption`, `SmsCode`, `EmailCode`, `AiTimeoutConfig`)

**Models without @@map (use Prisma default name, would create inconsistent tables):**
- `PromptTemplate` (line 648)
- `Captcha` (line 81)
- `SmsCode` (line 90)
- `EmailCode` (line 99)
- `AiTimeoutConfig` (line 1075)
- `AgentLevelConfig` (line 847)

**Inconsistent @map usage:**
- `ShadowConfig` uses `@map` on ID field (`@map("id")`) but not on most other fields
- `AiPropSpec` inconsistently uses `@map` on some fields (`project_id`, `sort_order`, `created_at`, `updated_at`)
- Mix of English and Chinese defaults (e.g., `@default("未命名")` in `ProductionRecord`)

### Field Type Quality Issues

1. **JSON as String carrier** (should use `Json` type):
   - `WebsiteSnapshot`: `robots String? // JSON`
   - `WebsiteSnapshot`: `sitemap String? // JSON`
   - `WebsiteSnapshot`: `meta String? // JSON`
   - `WebsiteSnapshot`: `openGraph String? // JSON`
   - `WebsiteSnapshot`: `schema String? // JSON`
   - Many Platform models store metadata as `String? // JSON`

2. **@db.Text used inconsistently**:
   - `HdzCharacter` uses `@db.Text` for description
   - `HdzChapter` uses `@db.Text` for outline/content/summary
   - Most non-HDZ models use plain `String` for potentially large content

3. **JSON fields stored as String in array**:
   - `HdzFaction`: `leaderIds String[]` — should be `String[]` or custom type, but used as array of UUIDs
   - `HdzMemory`: `content Json` — correct usage
   - `WorldMemory`: `tags String[]` — correct usage

### Relation Pattern Issues

1. **Duplicate self-referential pattern:** Two different User→Membership→children patterns (`AgentReferral` relation name used twice in `Membership`)

2. **Inconsistent cascade behavior:**
   - Most relations use `onDelete: Cascade`
   - Some skip explicit cascade (defaults to `NoAction` in Prisma)
   - `public_V3RenderResult` → `P18Pair` uses `onDelete: NoAction, onUpdate: NoAction` — unusual

3. **Stale foreign key references:**
   - `CoinLog` references `membership` via `userId` field, but named `coinlog_membership_fkey`
   - `UserAsset` references `membership` via `userId` field, named `userasset_membership_fkey`
   - `RechargeOrder` references `membership` via `userId`, named `recharge_membership_fkey`
   - All use `userId` as the FK to `Membership.userId` rather than `Membership.id` — intentional but unusual

4. **Circular dependency risk:** `Membership.parentId` references `Membership.userId` via `AgentReferral` — self-referential through `userId` field rather than `id`

---

## 4. Data Types & Enums

### Enum Coverage
Only **3 enums** for **323 models**:
- `VideoTaskStatus` (used by `VideoTask`)
- `TaskLogLevel` (used by `TaskLog`)
- `AssetType` (used by `Asset`)

**Missing enums that should exist:** Most models use `String` for status/type fields where enums would provide type safety. Examples:
- `User.memberTier` should be an enum (free, premium, pro, etc.)
- `User.memberStatus` should be an enum
- `Project.status` should be an enum (draft, active, completed, archived)
- `VideoTask.status` uses `String` but should reference `VideoTaskStatus` enum
- Community models: `status`, `category` fields
- Payment models: `status`, `method`, `type` fields
- GEO models: `status`, `type` fields everywhere
- Platform models: virtually all status fields are `String`

### JSON Field Usage
- **120+ Json fields** found across models — used extensively for flexible/extensible data
- Common usage pattern: `metadata Json? @default("{}")`, `config Json? @default("{}")`
- **Positive:** Proper use of Json for extensible schemas
- **Negative:** Some Json fields are stored as `String?` with `// JSON` comments, bypassing Prisma validation

### Optional vs Required
- Generally well-structured — most status/type fields have sensible defaults
- ID fields consistently use `String @id @default(uuid()) @db.Uuid`
- Foreign keys are consistently `String @db.Uuid` (not optional unless nullable FK)

---

## 5. Security Analysis

### Critical Security Issues

| Issue | Location | Severity |
|---|---|---|
| `passwordHash` stored as plain `String` (no @db.encrypted) | `User` (line 27) | **CRITICAL** |
| `passwordHash` stored as plain `String` | `AdminUser` (line 1395) | **CRITICAL** |
| `accessKey` and `secretKey` as plain `String` | `StorageConfig` (lines 2988-2989) | **CRITICAL** |
| `PaymentSecret.config` as plain `String` | `PaymentSecret` (line 1542) | **CRITICAL** |
| `ApiKey.keyValue` stored as plain `String` | `ApiKey` (line 1302) | **CRITICAL** |
| `*ApiKey` fields as plain `String` | `UserModelConfigV2` (multiple lines) | **HIGH** |
| `encryptedKey` — named "encrypted" but type is plain `String` | `ResourceCredential` (line 4620) | **HIGH** |
| No `@db.encrypted` anywhere in schema | Entire file | **CRITICAL** |

### Recommendations
- All sensitive fields should use `@db.encrypted` or application-level encryption at rest
- `ApiKey.keyValue` should never be stored as `@unique` — the hash should be unique, not the key itself
- Consider splitting sensitive credentials into a dedicated, encrypted service

---

## 6. Migration Readiness

### @ignore Flag
**1 model is @ignore'd:**
- `p18_pairs` (line 3204-3225) — Comment says "The underlying table does not contain a valid unique identifier"

### Schema Drift Risks

**Risk Level: HIGH**

| Risk | Impact |
|---|---|
| 261 @@map directives | High rename/alias complexity during migration |
| No @@map on 5+ models | Implicit table names would trigger `CREATE TABLE` in migration diff, causing conflicts with existing views |
| @ignore + raw SQL tables (p18_pairs) | Prisma cannot manage this table; manual migration management needed |
| Public schema model (`public_V3RenderResult`) | References to `public` schema may cause cross-schema migration issues |
| V3RenderResult (no prefix) vs public_V3RenderResult (with prefix) | Same underlying table mapped twice — guaranteed migration conflict |
| `P18Pair` uses `@db.Timestamp(6)` | Non-standard precision that may differ across PostgreSQL versions |
| `WalletAccount` references `PaymentOrder` | Cross-domain foreign key may fail if payment module is migrated separately |

### Specific Migration Blocker
- `P18Pair` and `V3RenderResult` are both mapped to V3_RenderResult table naming but with different schema prefixes — this is a **high-risk area**

---

## 7. Bloat Indicators

### Unbounded String Fields
- **200+ `String` fields** without `@db.Text` or size limits that could hold large content
- **Dangerous patterns:**
  - `content String` in `CommunityPost` — no size limit on user-generated content
  - `script String?` in `Project` — could hold entire scripts
  - `content Json @default("[]")` in `HdzManuscript` — array of full manuscript items, grows unbounded
  - `messages Json @default("[]")` in `HdzSession` — accumulates full message history
  - `json_ld String? // JSON` in `WebsiteSnapshot` — JSON-LD in String, not Json type

### String[] Arrays
- `AiModel.taskTypes String[]` — unbounded array
- `RuntimeRegistry.dependencies String[]` — unbounded array
- `EventLoopViolation.eventChain String[]` — unbounded array
- `RuntimeDependencyGraph.cyclePaths String[]` — unbounded array
- `KernelHealthLog.recommendations String[]` — unbounded array
- `HdzFaction.leaderIds String[]`, `memberIds String[]` — unbounded arrays
- `WorldMemory.tags String[]` — unbounded array
- `EntityRegistry.aliases String[]` — unbounded array

### Large JSON Blobs
- `World.state Json @default("{}")` — entire world simulation state
- `StoryConstitution.constitution Json` — full constitution document
- `DirectorMemory.continuityState Json` — full continuity state
- `RuntimeRegistry` stores dependency graphs in Json
- `HdzMemory` stores entire structured memory as Json `content`

---

## 8. Domain Analysis: 13+ Distinct "Layers"

| Layer | Models | Status |
|---|---|---|
| **Core/User** | User, CreatorDnaProfile, Captcha, SmsCode, EmailCode, UserModelConfigV2, DailyUsage, AdminUser, UserLimit, VoicePreset, ApiKey, ModelProvider, PromptMemory, UserMessage, AnalyticsEvent, UserAsset, AssetLike, AssetComment, UniverseCluster | Active |
| **Project/Workspace** | Project, Workspace, Organization, OrgMember, GeoProjectProfile, Tenant | Active |
| **AI/Video** | AiCharacterSpec, AiSceneSpec, AiVoiceConfig, AiVideoSegment, AiSegmentEdit, AiFrameDesign, AiVideoProduction, AiEffectSpec, AiActionSpec, AiPropSpec, AiCameraSpec, AiEmotionSpec, TTSRecord, Storyboard, VideoTask, VideoSegment, ExportTask, CharacterProfile, SceneProfile, Asset, AssetRegistry, AssetVersion, PipelineStage, PipelineJob, CharacterImage, SceneImage, StoryboardImage, PropImage, PropLibrary, FrameImage, CharacterReference, SceneReference, ContinuityLink, AssetGraphEdge, ImagePromptTemplates, NarrativeV3Metrics | Active |
| **Agent** | AgentDef, AgentEdge, AgentExecution, AgentMemory, AgentLevelConfig, AgentPlan, AgentWithdraw, MarketAgent, CommissionConfig, CommissionOrder, WorkflowDef, AgentExecutionLog | **Mixed** (some orphan) |
| **Kernel** | KernelEvent, KernelStateSnapshot, KernelHealthLog, KernelShadowEventLog, KernelCutoverScore, KernelDualExecutionLog, KernelStateDiffLog, KernelRollbackHistory, KernelHealthMetrics, RuntimeRegistry, ScheduleTask, ResourceAllocation, EventLoopViolation, RuntimeDependencyGraph | **Entirely orphan** |
| **GPU** | GPUNode, GPUTaskLog, GPUThrottleState | **Entirely orphan** |
| **DAG** | DAGGraph, DAGState | **Entirely orphan** |
| **Shadow** | ShadowConfig, ShadowExecutionLog, ShadowDiffResult, ShadowDriftHistory | **Entirely orphan** |
| **Monitoring** | SystemMetric, SystemMonitor, ReplayFrame, StabilitySession, DegradationEvent, RateLimit, CircuitBreaker | **Entirely orphan** |
| **Worker** | WorkerRegistration, WorkerTaskAssignment, WorkerHealthHistory, WorkerHeartbeat | **Entirely orphan** |
| **Community** | CommunityCategory, CommunitySensitiveWord, CommunityPost, CommunityComment, CommunityLike, CommunityCommentLike, CommunityReward | Active |
| **Payment** | PaymentConfig, PaymentSecret, PaymentOrder, RechargeOrder, MemberPlan | Active |
| **HDZ (混沌珠)** | HdzProject, HdzSession, HdzChapter, HdzCharacter, HdzFaction, HdzMemory, HdzStyleDna, HdzAgentTask, HdzManuscript, HdzOutline, HdzPublishLog + EntityRegistry, EventLog, SceneDag, WorldState, WriterAlignmentMetric, PlotDagEdge | Active (separate domain) |
| **GEO** | GEOBrand, GEOKnowledgeSource, GEOProject, GEODiscoveryReport, GEOActionPlan, GEOVerificationReport, GEOScanRecord, GEOEntity, GEOEntityRelation, GEOProjectVersion, GEOClaim, GEOEvidence, GEOCitation, GEOFAQ, GEOSchemaMarkup, GEOReviewQueue, GEOQualityScore, GEOFreshnessRecord, GEOBenchmarkRecord, GEOScoreSnapshot, GEOOptimizationHistory, GEOPresenceEvidence, GeoProject, GeoBrandProfile, WebsiteSnapshot, GeoGraphNode, GeoGraphEdge, GeoKeyword, GeoBrandSetting, GeoScanHistory | Active |
| **Publishing/KDP** | PublishableClaim, PublishPlan, PublishPlanToClaim, PublishingRecord, KnowledgeAsset, AssetVariant, DistributionTarget, DistributionPlan, DistributionPlanToAsset, DistributionAttempt, DistributionAdapter, KnowledgePackage, PackageManifest, PackageArtifact, DeliveryJob, DeliveryTarget, DeliveryRecord | Mostly orphan/not wired |
| **Platform (New Runtime)** | CapabilityContract, CapabilityProviderMapping, ResourceContract, ResourceCredential, ResourceHealth, ResourceCapabilityMatrix, ResourceUsage, ResourceCost, WorkspaceRuntime + 8 child models, AgentDefinition + 9 child models, WorkflowDefinition + 10 child models, Tenant + 16 child models | Active but disconnected |
| **GEOv4** | OptimizationExecution, VerificationJob, VerificationResult, VerificationPolicy, GrowthMemory, LearningSignal, GeoScoreVersion, GrowthKnowledge | **Entirely orphan** |
| **Other** | CostBudget, UsageLog, WorldMemory, StoryConstitution, DirectorMemory, JobQueue, InvocationLog, RouteConfig, ScriptBreakdown, p18_pairs, V3RenderResult, public_V3RenderResult, PromptVariant, DualWriteWatcherEvent, LLMUsageRecord, KnowledgeObject, WalkthroughProgress | Mixed |

---

## 9. Key Duplicate/Overlapping Concepts

| Concept | Model 1 | Model 2 | Analysis |
|---|---|---|---|
| Circuit Breaker | `CircuitBreaker` (line 1948) | `AiCircuitBreaker` (line 1032) | Identical purpose, different model locations |
| AI Model Registry | `AiModel` (line 936) | `ModelProvider` (line 1343) | Overlapping: both track provider+model+config |
| Agent Definition | `AgentDef` (line 1580) | `AgentDefinition` (line 4862) | Legacy vs new Platform agent model |
| Workflow Definition | `WorkflowDef` (line 1617) | `WorkflowDefinition` (line 5014) | Legacy vs new Platform workflow model |
| GEO Project | `GEOProject` (line 3662) | `GeoProject` (line 4103) | Different teams built parallel GEO models |
| Execution Log | `AiExecutionLog` (line 1008) | `AgentExecutionLog` (line 1728) | Overlapping concerns |
| VideoSegment | `VideoSegment` (line 535) | `AiVideoSegment` (line 285) | Different but related concepts |
| Task Queue | `TaskQueue` (line 1689) | `SchedulerTask` (line 2096) | Different task scheduling systems |
| p18_pairs | `p18_pairs` (line 3204, @ignore) | `P18Pair` (line 3142) | Same table, one active one ignored |
| V3RenderResult | `V3RenderResult` (line 3163) | `public_V3RenderResult` (line 3184) | Same table with/without public schema prefix |
| Renders | `V3RenderResult` (line 3163) | `public_V3RenderResult` (line 3184) | **Same underlying table mapped twice!** |

---

## 10. Recommendations

### Immediate (Critical)
1. **Remove `p18_pairs` model** — it's @ignore'd and duplicates `P18Pair`
2. **Merge or delete `CircuitBreaker`** — keep one (either generic or AI-specific)
3. **Fix double-mapped `V3RenderResult`** — `V3RenderResult` and `public_V3RenderResult` map the same table
4. **Add indexes on all unbounded FK fields** (40+ models missing FK indexes)

### High Priority
5. **Encrypt all sensitive fields** — add `@db.encrypted` or application-level encryption for passwords, API keys, secrets
6. **Consolidate duplicate registries** — merge `AiModel`/`ModelProvider`, merge `AgentDef`/`AgentDefinition`, merge `WorkflowDef`/`WorkflowDefinition`
7. **Remove Kernel, GPU, DAG, Shadow, Worker, and Monitoring layers** (72 models) — these appear to be v1/v2 systems no longer in use
8. **Standardize @@map naming** — pick snake_case for all table names (already 150+ using it) and migrate the 110+ PascalCase ones
9. **Add missing enums** — convert String-enum status/type fields to proper enums

### Medium Priority
10. **Clean up orphan GEO models** — `GeoProject`, `GeoBrandProfile`, `WebsiteSnapshot`, `GeoGraphNode`, `GeoGraphEdge` duplicate the `GEO*` model family
11. **Add @@map to all models** — ensure consistent database table naming
12. **Replace String-encoded JSON with proper Json type** across the schema
13. **Add onDelete: Cascade to all relations** where appropriate
14. **Rebalance GEO model indexes** — some are over-indexed (4+), some are under-indexed
15. **Add missing composite indexes** for common query patterns (userId+status+createdAt etc.)

### Low Priority / Nice-to-Have
16. **Consolidate the 13 layers into ~5 domain groups** (User, Project, GEO, HDZ, Platform)
17. **Add @db.Text limits** where appropriate
18. **Standardize UUID references** — ensure all use `@db.Uuid` consistently
19. **Review cascade behavior** on Platform models — ensure no accidental cascade deletes

---

## Summary

| Metric | Value |
|---|---|
| **Total Models** | **325** |
| **Active Models** | ~213 |
| **Orphan Models (no relations)** | ~109 |
| **Schema Quality Score** | **58/100** |
| **Migration Risk** | **HIGH** |
| **Duplicate Concepts** | 6+ pairs |
| **Missing FK Indexes** | 40+ models |
| **Sensitive Fields (unencrypted)** | 10+ fields |
| **@ignore'd Models** | 1 (p18_pairs) |
| **@@index Directives** | 292 |
| **@@unique Directives** | 52 |
| **@@map Directives** | 261 |
| **Enums** | 3 (insufficient) |
| **Layers/Domains** | 13+ |
