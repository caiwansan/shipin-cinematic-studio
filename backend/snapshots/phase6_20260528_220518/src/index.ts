import 'dotenv/config'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'

// Plugin imports
import corsPlugin from './plugins/cors.js'
import authPlugin from './plugins/auth.js'
import runtimeContextPlugin from './plugins/runtime-context.js'

import projectV2Routes from './routes/projects-v2.js'
import runtimeCheckpointRoutes from './routes/runtime-checkpoint.js'
import systemVersionRoutes from './routes/system-version.js'
// Route imports
import authRoutes from './routes/auth.js'
import captchaRoutes from './routes/captcha.js'
import smsRoutes from './routes/sms.js'
import projectRoutes from './routes/projects.js'
import projectDecompositionRoutes from './routes/project-decomposition.js'
import storyboardRoutes from './routes/storyboards.js'
import taskRoutes from './routes/tasks.js'
import aiTaskRoutes from './routes/ai-tasks.js'
import aiRouterRoutes from './routes/ai-router.js'
import apiKeyRoutes from './routes/api-keys.js'
import systemHealthRoutes from './routes/system-health.js'
import observabilityRoutes from './routes/observability.js'
import optimizationRoutes from './routes/optimization.js'
import governanceRoutes from './routes/governance.js'
import sandboxRoutes from './routes/sandbox.js'
import shadowRoutes from './routes/shadow.js'
import showrunnerRoutes from './routes/showrunner.js'
import jobRoutes from './routes/jobs.js'
import directorSimulationRoutes from './routes/director-simulation.js'
import { registerObservabilitySSE, registerObservabilityREST } from './services/observability.service.js'
import { registerSimulationRoutes } from './simulation/simulation-api.js'
import { registerIsolationRoutes } from './simulation/isolation-api.js'
import { registerBackpressureRoutes } from './simulation/backpressure-api.js'
import { registerObservabilityPersistence } from './observability/api.js'
import { registerReplayRoutes } from './replay/replay-api.js'
import { registerProductionRoutes } from './production-loop/api.js'
import { registerReplayAnalyticsRoutes } from './replay-analytics/api/replay.analytics.controller.js'
import cognitionRoutes from './routes/cognition-loop.js'
import worldMemoryRoutes from './routes/world-memory.js'
import { registerOptimizationRoutes } from './graph-optimization/optimization.routes.js'
import { registerPatchRoutes } from './graph-patch/api/patch.controller.js'
// autograph imports removed — code pruned per audit recommendation (2026-05-21)
import { registerAssetEconomyRoutes } from './core/asset-economy/api/index.js'
import customerServiceRoutes from './routes/customer-service.js'
import paymentRoutes from './routes/payment.js'
import scriptSubmitRoutes from './routes/script-submit.js'
import { registerPaymentRoutes } from './payment/controllers/index.js'
import adminAuthRoutes from './routes/admin-auth.js'
import adminApiKeyRoutes from './routes/admin-api-keys.js'
import adminGlobalConfigRoutes from './routes/admin-global-config.js'
import adminStorageConfigRoutes from './routes/admin-storage-config.js'
import adminMembersStorageRoutes from './routes/admin-members-storage.js'
import agentOrchestratorRoutes from './routes/agent-orchestrator.js'
import orchestratorRoutes from './routes/orchestrator.js'
import stabilityRoutes from './routes/stability.js'
import modelRoutes from './routes/models.js'
import adminModelRoutes from './routes/admin-models.js'
import adminModelV2Routes from './routes/admin-models-v2.js'
import analyticsRoutes from './routes/analytics.js'
import { registerStudioRoutes } from './studio/studio-api.js'
import { runtimeRoutes } from './api/runtime/runtime.routes.js'
import { registerCompareRoutes } from './replay/compare-api.js'
import { registerSessionRoutes } from './simulation/session-api.js'
import { registerLongRunRoutes } from './simulation/long-run-api.js'
import { initializeRuntimeSafety, timerRegistry, getLifecycleStatus } from './services/lifecycle-manager.js'
// character routes loaded dynamically below
import sceneRoutes from './routes/scenes.js'
import assetRoutes from './routes/assets.js'
import imageRoutes from './routes/images.js'
import executionImageRoutes from './routes/execution-images.js'
import uploadRoutes from './routes/upload.js'
import wechatOAuthRoutes from './routes/wechat-oauth.js'
import qqOAuthRoutes from './routes/qq-oauth.js'
import memberRoutes from './routes/member.js'
import userCenterRoutes from './routes/user-center.js'
import optimizeRoutes from './routes/optimize.js'
import optimizeVideoPromptRoutes from './routes/optimize-video-prompt.js'
import featuredRoutes from './routes/featured.js'
import registerOnlineAIRoutes from './routes/online-ai.js'
import registerModelProviderRoutes from './routes/model-provider.js'
import renderShotsRoutes from './routes/render-shots.js'
import executionJournalRoutes from './routes/execution-journal.js'
import feedbackRoutes from './routes/feedback.js'

import queueRuntimeRoutes from './routes/queue-runtime.js'
import pipelineRoutes from './routes/pipeline.js'
import pipelineJobRoutes from './routes/pipeline-jobs.js'
import schedulerRoutes from './routes/scheduler.js'
import narrativeLLMRoutes from './routes/narrative-llm.js'
import quickCreationRoutes from './routes/quick-creation.js'
import anchorRoutes from './routes/anchor.js'
import costumeRoutes from './routes/costume.js'
import characterStateRoutes from './routes/character-state.js'
import storyGraphRoutes from './routes/story-graph.js'
import aigcSpecDbRoutes from './routes/aigc-spec-db.js'
import stageModelConfigRoutes from './routes/stage-model-config.js'
import directorEngineRoutes from './routes/director-engine.js'
import directorRoutes from './routes/director.js'
import directorV2Routes from './routes/director-v2.js'
import desktopRuntimeRoutes from './routes/desktop-runtime.js'
import executionGraphRoutes from './routes/execution-graph.js'
import executionTraceRoutes from './routes/execution-trace.js'
import executionDebugRoutes from './routes/execution-debug.js'
// import userApiKeyRoutes from './routes/user-api-keys.js'
// import userModelConfigRoutes from './routes/user-model-config.js'
// import userModelConfigV2Routes from './routes/user-model-config-v2.js'
import unifiedModelConfigRoutes from './routes/unified-model-config.js'
import workflowRoutes from './routes/workflow.js'
import workflowVisualizerRoutes from './routes/workflow-visualizer.js'
import assetRegistryRoutes from './routes/asset-registry.js'
import assetVersionRoutes from './routes/asset-versions.js'
import aiGatewayRoutes from './routes/ai-gateway.js'
import assetCardRoutes from './routes/asset-cards.js'
import continuityRoutes from './routes/continuity.js'
import jobManagerRoutes from './routes/job-manager.js'
import exportRoutes from './routes/export-runtime.js'
import { registerSSEStream } from './runtime/task-stream.js'
import communityCategoryRoutes from './routes/community/categories.js'
import communityPostRoutes from './routes/community/posts.js'
import messageRoutes from './routes/messages.js'
import communityCommentRoutes from './routes/community/comments.js'
import communityLikeRoutes from './routes/community/likes.js'


import { env } from './config/env.js'
import { startMockWorker } from './services/mock-worker.js'
import { registerRealExecutors } from './runtime/executors/executor.registry.js'
import { registerRuntimeGuard } from './runtime/runtime-guard.js'
import modelSelectionRoutes from './routes/model-selection.js'
import { providerRegistry } from './providers/core/provider-registry.js'
import { openAICompatibleAdapter } from './providers/adapters/openai-compatible.adapter.js'
import { Capability } from './core/runtime/capabilities.js'

async function main() {
  const app = Fastify({ logger: true })

  // Bootstrap real LLM executors
  registerRealExecutors()

  // ═══ P0: Config Sovereignty Layer — ENV freeze ═══
  const { bootstrapSystemConfig } = await import('./config-runtime/index.js')
  bootstrapSystemConfig()
  console.log('[startup] ✅ Config Sovereignty Layer initialized')

  // ═══ P1: 注册 Provider Adapter ═══
  console.log('[startup] 🏗️ 注册 Provider Adapter...')
  providerRegistry.register({
    name: 'deepseek',
    capabilities: [
      Capability.SCRIPT_ANALYSIS,
      Capability.PROMPT_OPTIMIZATION,
      Capability.STORY_EXPANSION,
      Capability.DIRECTOR_REASONING,
      Capability.CINEMATIC_PROMPT,
    ],
    adapter: openAICompatibleAdapter,
  })
  providerRegistry.register({
    name: 'siliconflow',
    capabilities: [
      Capability.SCRIPT_ANALYSIS,
      Capability.PROMPT_OPTIMIZATION,
      Capability.STORY_EXPANSION,
      Capability.DIRECTOR_REASONING,
      Capability.CINEMATIC_PROMPT,
    ],
    adapter: openAICompatibleAdapter,
  })
  console.log(`[startup] ✅ ${providerRegistry.listProviders().length} 个 Provider 已注册: ${providerRegistry.listProviders().join(', ')}`)

  // 从数据库加载持久化的 API Keys 到 process.env
  try {
    const { prisma } = await import('./utils/index.js')

    // Provider State Layer v1.2 Final: 初始化持久化状态服务
    const { initProviderStateService } = await import('./runtime/provider-state/index.js')
    initProviderStateService(prisma as any)
    console.log('[startup] ✅ ProviderStateService v1.2 Final initialized')

    // Workflow Execution Graph v1
    const { initWorkflowEngine } = await import('./workflow/index.js')
    const { modelAdapterRegistry } = await import('./model-adapters/index.js')
    initWorkflowEngine(modelAdapterRegistry)
    console.log('[startup] ✅ WorkflowEngine v1 initialized')

    const savedKeys = await prisma.apiKey.findMany()
    console.log(`[startup] CRYPTO_ENCRYPTION_KEY length: ${(process.env.CRYPTO_ENCRYPTION_KEY || '').length}, env keys: ${Object.keys(process.env).filter(k => k.includes('CRYPTO')).join(', ') || 'none'}`)
    const { decryptKey } = await import('./services/crypto.service.js')
    for (const key of savedKeys) {
      // 如果 process.env 已有该 key 且看起来像真实的 API key（不以密文格式开头），则不覆盖
      const existing = process.env[key.keyName]
      if (existing && (existing.startsWith('sk-') || existing.startsWith('Sk-') || existing.length > 30)) {
        console.log(`[startup] Skipped override for ${key.keyName} (${key.provider}) — already valid`)
        continue
      }
      try {
        const decrypted = decryptKey(key.keyValue)
        process.env[key.keyName] = decrypted
        console.log(`[startup] Loaded API key: ${key.keyName} (${key.provider})`)
      } catch {
        process.env[key.keyName] = key.keyValue
        console.log(`[startup] Loaded API key: ${key.keyName} (${key.provider}) [direct, not encrypted]`)
      }
    }
    if (savedKeys.length > 0) {
      console.log(`[startup] Loaded ${savedKeys.length} API keys from database`)
    }
  } catch (err) {
    console.warn('[startup] Could not load API keys from database (table may not exist yet):', (err as Error).message)
  }

  // Register plugins
  await app.register(corsPlugin)
  await app.register(jwt, { secret: env.JWT_SECRET })
  await app.register(authPlugin)
  await app.register(runtimeContextPlugin)
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } })

  // Register routes
  await app.register(authRoutes)
  registerSSEStream(app)
  await app.register(systemVersionRoutes)
  await app.register(captchaRoutes)
  await app.register(smsRoutes)
  await app.register(projectRoutes)
  await app.register(projectDecompositionRoutes)
  await app.register(storyboardRoutes)
  await app.register(taskRoutes)
  await app.register(aiTaskRoutes)
  await app.register(aiRouterRoutes)
  await app.register(sandboxRoutes)
  await app.register(shadowRoutes)
  // Showrunner Core routes (总导演大脑)
  await app.register(showrunnerRoutes)
  // Director Simulation Layer (导演预演层)
  // Job routes (异步长任务状态查询)
  await app.register(jobRoutes)
  await app.register(directorSimulationRoutes)
  registerObservabilitySSE(app)
  registerObservabilityREST(app)
  await app.register(registerSimulationRoutes)
  await app.register(registerIsolationRoutes)
  await app.register(registerBackpressureRoutes)
  await app.register(registerLongRunRoutes)
  await app.register(registerObservabilityPersistence)
  await app.register(registerStudioRoutes)
  await app.register(registerReplayRoutes)
  await app.register(registerReplayAnalyticsRoutes)
  await app.register(registerOptimizationRoutes)
  await app.register(registerPatchRoutes)
  // autograph registration removed — code pruned (2026-05-21)
  await app.register(registerCompareRoutes)
  await app.register(registerSessionRoutes)
  await app.register(registerProductionRoutes)

  // ExecutionGraph routes (Graph Runtime 前端客户端 API)
  await app.register(executionGraphRoutes)

  // characterRoutes registered dynamically below
  await app.register(sceneRoutes, { prefix: '/api' })
  await app.register(assetRoutes, { prefix: '/api' })
  await app.register(runtimeRoutes, { prefix: '/api' })
  await app.register(imageRoutes, { prefix: '/api' })
  await app.register(executionImageRoutes, { prefix: '/api' })
  await app.register(uploadRoutes)
    await app.register(adminAuthRoutes)
  await app.register(adminStorageConfigRoutes)
  await app.register(adminMembersStorageRoutes)
  await app.register(memberRoutes)
  await app.register(userCenterRoutes)
  await app.register(analyticsRoutes)
  await app.register(optimizeRoutes)
  await app.register(optimizeVideoPromptRoutes)

  await app.register(featuredRoutes)

  // Online AI routes (云端大模型 API)
  await app.register(registerOnlineAIRoutes)
  await app.register(registerModelProviderRoutes)
await app.register(queueRuntimeRoutes)

  // Pipeline routes (AI 生产流水线)
  await app.register(pipelineRoutes)
  await app.register(pipelineJobRoutes)
  await app.register(renderShotsRoutes)
  await app.register(executionJournalRoutes)
  await app.register(feedbackRoutes)

  // Scheduler routes (Multi-Graph 调度系统)
  await app.register(schedulerRoutes)
  await app.register(runtimeCheckpointRoutes)

  await app.register(projectV2Routes)

  // Narrative LLM routes (LLM 叙事分析)
  await app.register(narrativeLLMRoutes)
  await app.register(quickCreationRoutes)

  // Anchor routes (多模态角色/场景/道具锚定系统)
  await app.register(anchorRoutes)

  // Costume routes (服装持续化系统)
  await app.register(costumeRoutes)

  // Character State routes (角色状态系统)
  await app.register(characterStateRoutes)

  // Story Graph routes (剧情图谱引擎 + 自动分镜系统)
  await app.register(storyGraphRoutes)

  // Director Engine routes (导演级镜头决策引擎)
  await app.register(directorEngineRoutes)

  // Director Intelligence Layer routes (导演智能层 API)
  await app.register(directorRoutes)

  // Director V2 routes (Director OS observability layer, /api/v2/director/*)
  await app.register(directorV2Routes)

  // Desktop Runtime routes（跨平台桌面运行时）
  await app.register(desktopRuntimeRoutes)

  // User API Key management (VIP 会员接入自己的大模型)
  // await app.register(userApiKeyRoutes)

  // User Model Config (BYO API Key + 自选模型)
  // await app.register(userModelConfigRoutes)
  // User Model Config V2 (Single Source of Truth)
  // await app.register(userModelConfigV2Routes)
  await app.register(unifiedModelConfigRoutes)
  // MSAL — Single Authority Model Selection
  await app.register(modelSelectionRoutes, { prefix: '/api/v1/authority' })
  await app.register(assetRegistryRoutes)
  await app.register(assetVersionRoutes)
  await app.register(aiGatewayRoutes)
  await app.register(assetCardRoutes)
  await app.register(continuityRoutes)
  await app.register(jobManagerRoutes)

  // AI 资产经济体系（Asset Economy System）
  await app.register(registerAssetEconomyRoutes)

  // Studio V1 API routes (control panel)
  // Health check
  await app.register(wechatOAuthRoutes)
  await app.register(qqOAuthRoutes)
  // Customer Service routes (AI 智能客服)
  await app.register(customerServiceRoutes)
  await app.register(paymentRoutes)
  await app.register(scriptSubmitRoutes)

  await app.register(registerPaymentRoutes)
  await app.register(agentOrchestratorRoutes)
  await app.register(stabilityRoutes)

  // AIGC spec DB routes（AI 规格表持久化）
  await app.register(aigcSpecDbRoutes)

  // Stage model config routes（各阶段模型配置 CRUD）
  await app.register(stageModelConfigRoutes)

  // Model available routes (公共 API，无需认证)
  await app.register(modelRoutes)

  // Admin model routes (管理员 API Key 管理)
  await app.register(adminModelRoutes)
  await app.register(adminModelV2Routes)

  // Admin API Key management (大模型 API Key CRUD)
  await app.register(adminApiKeyRoutes)

  // Admin global model config (切换默认 LLM/图片/视频/语音模型)
  await app.register(adminGlobalConfigRoutes)

  // Runtime Observability Dashboard v1 (只读观测)
  const { registerRuntimeObservabilityRoutes } = await import('./routes/runtime-observability.js')
  await app.register(registerRuntimeObservabilityRoutes)

  // Phase 4.2: Runtime Trace (invocation source of truth)
  const runtimeTraceRoutes = (await import('./routes/runtime-trace.js')).default
  await app.register(runtimeTraceRoutes)

  // Phase 5.1: Self-verification kernel
  const selfCheckRoutes = (await import('./routes/self-check.js')).default
  await app.register(selfCheckRoutes)

  // EPVH — Execution Plane 验证
  const verificationRoutes = (await import('./routes/verification.js')).default
  await app.register(verificationRoutes)

  // Legacy Bridge — 受控收敛迁移控制
  const bridgeRoutes = (await import('./routes/bridge.js')).default
  await app.register(bridgeRoutes)

  // PSC-1 — Phase 1 Safe Convergence 控制器
  const psc1Routes = (await import('./routes/psc1.js')).default
  await app.register(psc1Routes)

  // 歌曲创作
  const musicRoutes = (await import('./routes/music.js')).default
  await app.register(musicRoutes)

  // TTS 语音合成
  const ttsRoutes = (await import('./routes/tts.js')).default
  await app.register(ttsRoutes)

  // 世界感知（World Model）占位 API
  const worldModelRoutes = (await import('./routes/world-model.js')).default
  await app.register(worldModelRoutes)

  // 参考图系统（Reference-Driven Generation）
  const referenceRoutes = (await import('./routes/reference.js')).default
  await app.register(referenceRoutes)

  // OMS World Runtime Routes（世界运行内核 + 叙事 + 观测者经济）
  const worldRuntimeRoutes = (await import('./routes/world-runtime.js')).default
  await app.register(worldRuntimeRoutes)

  // OMS Dashboard Routes（可视化仪表盘 V1）
  const omsDashboardRoutes = (await import('./routes/oms-dashboard.js')).default
  await app.register(omsDashboardRoutes)

  // OMS V2 Routes（三层认知可视化系统）
  const omsV2Routes = (await import('./routes/oms-v2.js')).default
  await app.register(omsV2Routes)

  // Character System V1 Routes（角色系统）
  const characterRoutes = (await import('./routes/characters.js')).default
  await app.register(characterRoutes)

  // Character-OMS Graph Fusion V1（角色图谱融合）
  const omsFusionRoutes = (await import('./routes/oms-fusion.js')).default
  await app.register(omsFusionRoutes)

  // Universe Images（作品宇宙图片引用）
  const universeImageRoutes = (await import('./routes/universe-images.js')).default
  await app.register(universeImageRoutes)

  // References（角色/场景参考图一致性系统）
  const consistencyReferenceRoutes = (await import('./routes/references.js')).default
  await app.register(consistencyReferenceRoutes)
  await app.register(apiKeyRoutes)
  // Workflow Execution Graph v1
  await app.register(workflowRoutes)
  // Workflow Visualizer v1
  await app.register(workflowVisualizerRoutes)
  // 管理员资产管理（图片上传管理）
  const adminAssetRoutes = (await import('./routes/admin-assets.js')).default
  await app.register(adminAssetRoutes)
  await app.register(executionTraceRoutes)
  await app.register(executionDebugRoutes)
  await app.register(systemHealthRoutes)
  await app.register(observabilityRoutes)
  await app.register(optimizationRoutes)
  // 编排 Agent 路由（统筹分析 → 分发各专业 agent）
  await app.register(orchestratorRoutes)

  // Voice Management（音色管理）
  const voiceRoutes = (await import('./routes/voice.js')).default
  await app.register(voiceRoutes)

  // Cognition Loop (认知循环)
  await app.register(cognitionRoutes)
  await app.register(worldMemoryRoutes)

  // Export Runtime (导出打包系统)
  await app.register(exportRoutes)
  // F1 Control Plane (v2 unified)
  const controlPlaneV2Routes = (await import('./routes/control-plane-v2.js')).default
  await app.register(controlPlaneV2Routes)
  const asyncRuntimeRoutes = (await import('./routes/async-runtime.js')).default
  await app.register(asyncRuntimeRoutes)
  const clusterRoutes = (await import('./routes/cluster.js')).default
  await app.register(clusterRoutes)
  const globalRoutes = (await import('./routes/global.js')).default
  await app.register(globalRoutes)
  const autonomousRoutes = (await import('./routes/autonomous.js')).default
  await app.register(autonomousRoutes)
  await app.register(governanceRoutes)

  // 启动进化引擎（P7）
  try {
    const { runtimeEvolutionEngine } = await import('./core/autonomous/runtime-evolution-engine.js')
    runtimeEvolutionEngine.start(60000)
    console.log('[Autonomous] P7 EvolutionEngine started (every 60s)')
  } catch (err) {
    console.warn('[Autonomous] Failed to start:', (err as Error).message)
  }

  // F6 System Dashboard
  const systemDashboardRoutes = (await import('./routes/system-dashboard.js')).default
  await app.register(systemDashboardRoutes)

  // F4/F5 Multi-Tenant
  const tenantRoutes = (await import('./routes/tenant.js')).default
  await app.register(tenantRoutes)

  // G Product Layer
  const productRoutes = (await import('./routes/product.js')).default
  await app.register(productRoutes)

  // S3 Route Redirect (deprecated routes)
  const routeRedirect = (await import('./routes/redirect.js')).default
  await app.register(routeRedirect)

  // HITL Human-in-the-Loop (昆仑镜 v2)
  const hitlRoutes = (await import('./routes/hitl.js')).default
  await app.register(hitlRoutes)

  // Schema Runtime v1 — Phase A shadow observe layer
  const schemaRuntimeRoutes = (await import('./routes/schema-runtime.js')).default
  await app.register(schemaRuntimeRoutes)

  // LLM Execution Graph Trace API
  const llmExecutionTraceRoutes = (await import('./routes/llm-execution-trace.js')).default
  await app.register(llmExecutionTraceRoutes)

  // Community System
  await app.register(communityCategoryRoutes)
  await app.register(communityPostRoutes)
  await app.register(communityCommentRoutes)
  await app.register(communityLikeRoutes)
  await app.register(messageRoutes)

  app.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString(), lifecycle: getLifecycleStatus() }
  })

  // Phase 2: Runtime Boot Pipeline — 替代 import side-effect 初始化
  try {
    const { runtimeBoot } = await import('./bootstrap/runtime-boot.js')
    await runtimeBoot()
    console.log('[startup] ✅ Runtime boot complete')
  } catch (err) {
    console.error('[startup] ❌ Runtime boot failed:', (err as Error).message)
    // Phase 2, Rule 7: boot 失败 = 系统不启动
    process.exit(1)
  }

  // 启动服务前注册全局 404 handler（API 路径返回 JSON）
  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({ success: false, error: 'Not Found' })
  })

  // Kernel v1: Canonical Kernel 路由（唯一写入口 + 唯一读入口）
  try {
    const kernelRoutes = (await import('./routes/kernel-command.js')).default
    await app.register(kernelRoutes)
    console.log('[Kernel] ✅ v1 routes registered (command / read / rebuild)')
  } catch (err) {
    console.warn('[Kernel] Failed to register:', (err as Error).message)
  }

  // Kernel v1.1: Causal Layer 路由
  try {
    const causalRoutes = (await import('./routes/kernel-causal.js')).default
    await app.register(causalRoutes)
    console.log('[Kernel] ✅ v1.1 causal routes registered (causal / trace / replay)')
  } catch (err) {
    console.warn('[Kernel] Failed to register causal routes:', (err as Error).message)
  }

  // RFVL: 注册运行时证明验证路由（必须在 listen 前注册）
  try {
    const rfvlRoutes = (await import('./routes/rfvl-verification.js')).default
    await app.register(rfvlRoutes, { prefix: '/api' })
    console.log('[RFVL] ✅ Runtime proof verification routes registered')
  } catch (err) {
    console.warn('[RFVL] Failed to register:', (err as Error).message)
  }

  try {
    registerRuntimeGuard(app)
    await app.listen({ port: env.PORT, host: '0.0.0.0' })
    console.log(`🚀 API Server running at http://localhost:${env.PORT}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }

  // 启动统一 Worker Runtime（替代旧的 mock-worker）
  try {
    const { workerPool } = await import('./queue/worker-runtime.js')
    await workerPool.start()
    console.log('[WorkerPool] Unified worker runtime started')
  } catch (err) {
    console.warn('[WorkerPool] Failed to start:', (err as Error).message)
  }

  // 初始化集群（P5）
  try {
    const { clusterManager } = await import('./core/cluster/cluster-manager.js')
    const nodeId = `node-${env.PORT || 4002}-${Date.now().toString(36)}`
    clusterManager.initialize(nodeId, 'localhost', env.PORT || 4002)
    console.log('[Cluster] P5 Cluster initialized')
  } catch (err) {
    console.warn('[Cluster] Failed to init:', (err as Error).message)
  }

  // 初始化全球调度（P6）
  try {
    const { latencyRouter } = await import('./core/global/latency-router.js')
    latencyRouter.registerDefaults()
    console.log('[Global] P6 LatencyRouter initialized')
  } catch (err) {
    console.warn('[Global] Failed to init:', (err as Error).message)
  }

  // 启动 E 层 Async Worker Pool
  try {
    const { asyncPipelineService } = await import('./services/async-pipeline.service.js')
    asyncPipelineService.initWorkers()
    console.log('[AsyncPipeline] E-layer workers initialized')
  } catch (err) {
    console.warn('[AsyncPipeline] Failed to init:', (err as Error).message)
  }
}

main()
