# 数据库表/字段僵尸审查报告

> 审查时间: 2026-06-02
> 审查范围: backend/prisma/schema.prisma + 前后端代码引用扫描（排除 node_modules/dist/snapshots/backups）
> 数据库状态: PostgreSQL 未运行（无法连接验证实际表结构），仅以 schema.prisma 为准

---

## 一、完全无代码引用的表（Zombie Tables）

以下 model 在 schema 中有完整定义，但 **后端/前端源码中零次引用 `prisma.<modelName>`**。

### 🔴 等级 A：绝对僵尸（未在任何 .ts/.tsx/.vue/.js 中出现）

| # | Model 名 | 约定义行数 | 建议 |
|---|----------|-----------|------|
| 1 | **Organization** | ~15 | 删除。这是多租户 workspace 预留表，未实现 |
| 2 | **OrgMember** | ~10 | 删除。同上 |
| 3 | **World** | ~10 | 删除。OMS/Observer Economy 世界观模拟系统，未运行 |
| 4 | **Observer** | ~12 | 删除。同上 |
| 5 | **NarrativeScene** | ~10 | 删除。同上 |
| 6 | **Character** (OMS系统) | ~25 | 删除。此 Character 与 OMS 世界观关联，非 AiCharacterSpec |
| 7 | **CharacterMemory** | ~12 | 删除 |
| 8 | **CharacterRelation** | ~12 | 删除 |
| 9 | **CharacterBehavior** | ~12 | 删除 |
| 10 | **PropLibrary** | ~10 | 删除。通用道具库，从未被引用 |
| 11 | **ShadowConfig** | ~12 | 删除。Shadow Mode 父配置表 |
| 12 | **ShadowDiffResult** | ~15 | 删除 |
| 13 | **ShadowDriftHistory** | ~12 | 删除 |
| 14 | **ProductionRecord** | ~15 | 删除。作品生成记录表，无引用 |
| 15 | **GenerationReference** | ~13 | 删除。参考图记录表，无引用 |
| 16 | **AnalyticsEvent** | ~8 | 删除。用户行为分析事件 |
| 17 | **KernelEvent** | ~12 | 删除。L8/Kernel Runtime 全部 11 张表 |
| 18 | **KernelStateSnapshot** | ~7 | 删除 |
| 19 | **RuntimeRegistry** | ~11 | 删除 |
| 20 | **KernelHealthLog** | ~9 | 删除 |
| 21 | **SchedulerTask** | ~14 | 删除 |
| 22 | **ResourceAllocation** | ~12 | 删除 |
| 23 | **EventLoopViolation** | ~10 | 删除 |
| 24 | **RuntimeDependencyGraph** | ~10 | 删除 |
| 25 | **KernelShadowEventLog** | ~12 | 删除 |
| 26 | **KernelCutoverScore** | ~12 | 删除 |
| 27 | **KernelDualExecutionLog** | ~14 | 删除 |
| 28 | **KernelStateDiffLog** | ~11 | 删除 |
| 29 | **KernelRollbackHistory** | ~11 | 删除 |
| 30 | **KernelHealthMetrics** | ~12 | 删除 |
| 31 | **DesktopRuntimeConfig** | ~8 | 删除。桌面运行时配置 |
| 32 | **LocalGPUNode** | ~10 | 删除 |
| 33 | **LocalAssetIndex** | ~12 | 删除 |
| 34 | **LicenseCache** | ~8 | 删除 |
| 35 | **GPUNode** | ~11 | 删除。L5 GPU 算力调度全部 3 张表 |
| 36 | **GPUTaskLog** | ~17 | 删除 |
| 37 | **GPUThrottleState** | ~9 | 删除 |
| 38 | **SystemMonitor** | ~9 | 删除。L6 系统监控全部 4 张表 |
| 39 | **RateLimit** | ~10 | 删除 |
| 40 | **CircuitBreaker** (HA版) | ~12 | 删除（注意：此表名为 CircuitBreaker，与 AiCircuitBreaker 无关） |
| 41 | **WorkerHeartbeat** | ~9 | 删除 |
| 42 | **UserLimit** | ~8 | 删除 |
| 43 | **TaskQueue** | ~16 | 删除。L2 任务调度全部 3 张表 |
| 44 | **TaskExecution** | ~13 | 删除 |
| 45 | **AgentExecutionLog** (HA版) | ~13 | 删除（注意：已有一个 AgentExecution 在 AgentDef 系统） |
| 46 | **DAGGraph** | ~11 | 删除。L4 DAG 层全部 2 张表 |
| 47 | **DAGState** | ~13 | 删除 |
| 48 | **StoryConstitution** | ~16 | 删除。Director OS 叙事宪法表 |
| 49 | **DirectorMemory** | ~10 | 删除 |
| 50 | **AgentEdge** | ~12 | 仅 AgentDef 被少量引用，但 Edge/WorkflowDef/AgentExecution/AgentMemory 均无引用 |

### 🟡 等级 B：轻微引用或仅 seed 脚本使用

| # | Model 名 | 引用情况 | 建议 |
|---|----------|---------|------|
| 1 | **ShadowExecutionLog** | 仅在 `observability.service.ts` 中 read-only 统计 3 次 | 可删除，Stats 从 ShadowConfig 也获取不到（父表已无引用） |
| 2 | **CostBudget** | 仅在 `observability.service.ts` 中 read-only 统计 1 次 | 可删除 |
| 3 | **PromptMemory** | 0 refs（seed 脚本无引用） | 删除 |
| 4 | **AiCircuitBreaker** | 仅在 `observability.service.ts:171` 中 count 1 次 | 可删除（裸统计无实际熔断逻辑引用） |
| 5 | **DeadLetterTask** | 在 `scheduler.service.ts:211` 和 `observability.service.ts:174` 中 count 共 2 次 | 可删除（无插入/处理逻辑） |
| 6 | **AiSandboxLog** | 0 refs | 删除 |
| 7 | **AiTimeoutConfig** | 0 refs | 删除 |
| 8 | **ReplayFrame** | 0 refs | 删除 |
| 9 | **StabilitySession** | 0 refs | 删除 |
| 10 | **DegradationEvent** | 0 refs | 删除 |
| 11 | **JobQueue** | 在 `observer-engine.ts` 中有引用（约 5 次） | 保留观察 |
| 12 | **AssetRegistry** | 在 `asset-registry.*` 中 13 次引用 | 保留 |
| 13 | **AssetVersion** | 在 `asset-registry.*` 中 7 次引用 | 保留 |
| 14 | **ContinuityLink** | 在 `continuity.*` 中 5 次引用 | 保留 |
| 15 | **AssetGraphEdge** | 0 refs（预留表） | 删除预留，实现时再建 |
| 16 | **AgentDef** | 仅在 `admin-agents.ts` 中 CRUD（4 次引用，管理后台维护） | 保留（管理入口） |
| 17 | **WorkflowDef** | 0 refs | 删除 |
| 18 | **AgentExecution** | 0 refs | 删除 |
| 19 | **AgentMemory** | 0 refs | 删除 |

---

## 二、正在使用的表（参考基准）

以下是**有实际代码引用**的重要表，方便对照僵尸表：

### 核心表
- **User**, **Project**, **Storyboard**, **VideoTask**, **VideoSegment**
- **AiCharacterSpec**, **AiSceneSpec**, **AiVideoSegment**, **AiFrameDesign**, **AiVideoProduction**
- **AiEffectSpec**, **AiActionSpec**, **AiPropSpec**, **AiCameraSpec**, **AiEmotionSpec**
- **CharacterProfile**, **SceneProfile**, **CharacterImage**, **SceneImage**, **StoryboardImage**, **FrameImage**, **PropImage**
- **CharacterReference**, **SceneReference**
- **PipelineStage**, **PipelineJob**

### 会员/支付
- **Membership**, **CoinLog**, **UserAsset**, **AssetLike**, **AssetComment**
- **RechargeOrder**, **MemberPlan**, **StoragePack**, **AgentLevelConfig**
- **PaymentConfig**, **PaymentSecret**, **PaymentOrder**

### AI 系统
- **AiModel**, **AiFallbackRule**, **AiRoutingPolicy**, **AiTaskTypeMapping**, **AiExecutionLog**
- **ModelProvider**, **VoicePreset**, **ApiKey**, **UserApiKey**
- **UserModelConfig**, **UserModelConfigV2**, **DailyUsage**

### 社区
- **CommunityCategory**, **CommunityPost**, **CommunityComment**, **CommunityLike**, **CommunityCommentLike**, **CommunityReward**, **CommunitySensitiveWord**

### 其他
- **AdminUser**, **Captcha**, **SmsCode**, **EmailCode**
- **InvocationLog**, **ScriptBreakdown**, **UsageLog**, **WorldMemory**
- **StorageConfig**, **ProviderState**, **LlmExecutionTrace**, **RouteConfig**
- **UserMessage**, **CustomerChatSession/Memory/Message**
- **WorkerRegistration**, **WorkerTaskAssignment**, **WorkerHealthHistory**
- **TaskLog**, **ExportTask**

---

## 三、资产经济系统（Asset Economy）分析

这些表在 `core/asset-economy/` 下有**实际逻辑代码**引用，但注意复用程度：

| Model | 引用 | 建议 |
|-------|------|------|
| **AssetDna** | 在 dna-generator/similarity-scorer 中引用 | 保留 |
| **AssetLineage** | 在 lineage-tracker 中引用 | 保留 |
| **AssetReference** | 在 revenue-splitter 中 1 次引用 | 保留，轻量 |
| **ContributionWeight** | 在 contribution-calc 中引用 | 保留 |
| **RevenueSplit** | 在 revenue-splitter 中引用 | 保留 |
| **AssetTransaction** | 在 revenue-splitter 中引用 | 保留 |
| **CreatorWallet** | 在 wallet-manager 中引用 | 保留 |
| **ModerationQueue** | 在 review-queue 中引用 | 保留 |
| **AssetRights** | 在 rights-manager + upload.ts 中引用 | 保留 |

---

## 四、数据库连接情况

- 连接串: `postgresql://postgres:postgres@localhost:5432/aigc_scs`
- PostgreSQL **未运行**（`/var/run/postgresql/.s.PGSQL.5432` 不存在）
- 无法验证实际表结构和数据量

---

## 五、总结与建议

### 可安全删除的表（共约 45-50 张）

**全部属于以下未上线系统：**
1. **OMS/Observer Economy 世界观模拟** (7 张): World, Observer, NarrativeScene, Character[OMS], CharacterMemory, CharacterRelation, CharacterBehavior
2. **PropLibrary** (1 张): 通用道具库
3. **Shadow Mode 影子执行** (3 张): ShadowConfig, ShadowDiffResult, ShadowDriftHistory（ShadowExecutionLog 可一同删）
4. **ProductionRecord / GenerationReference** (2 张): 生成记录系统
5. **AnalyticsEvent** (1 张): 用户分析事件
6. **Kernel Runtime L8-L9** (13 张): KernelEvent 到 KernelHealthMetrics 全部表
7. **Desktop Runtime** (4 张): DesktopRuntimeConfig, LocalGPUNode, LocalAssetIndex, LicenseCache
8. **GPU 调度 L5** (3 张): GPUNode, GPUTaskLog, GPUThrottleState
9. **系统监控 L6** (4 张): SystemMonitor, RateLimit, CircuitBreaker, WorkerHeartbeat
10. **用户限流 L1** (1 张): UserLimit
11. **任务调度 L2** (2 张): TaskQueue, TaskExecution
12. **Agent HA 层** (1 张): AgentExecutionLog
13. **DAG 层 L4** (2 张): DAGGraph, DAGState
14. **Director OS** (2 张): StoryConstitution, DirectorMemory
15. **Agent 系统未使用部分** (3 张): AgentEdge, WorkflowDef, AgentMemory, AgentExecution
16. **预留表** (1 张): AssetGraphEdge
17. **AI 系统未使用部分** (2 张): AiSandboxLog, AiTimeoutConfig
18. **稳定性测试** (3 张): ReplayFrame, StabilitySession, DegradationEvent
19. **PromptMemory** (1 张): 提示词记忆

### 可考虑删除但需谨慎的表

- **ShadowExecutionLog**, **CostBudget**: 只被 read-only 统计引用，无业务逻辑
- **AiCircuitBreaker**, **DeadLetterTask**: 只被 count 引用，无实际处理逻辑
- **ReplayFrame**, **StabilitySession**, **DegradationEvent**: 稳定性测试专用，生产环境无用

### 保留的表

所有在其他分析中标记为"有引用"的表，包括 Asset Economy 全套 + Pipeline 系统 + Community 系统。

---

*注：由于数据库未运行，无法验证实际表结构和行数。建议先启动 PostgreSQL 用 `prisma db pull` 确认真实映射。*
