import 'dotenv/config'
import path from 'path'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'

// Plugin imports
import corsPlugin from './plugins/cors.js'
import authPlugin from './plugins/auth.js'
import runtimeContextPlugin from './plugins/runtime-context.js'

import projectV2Routes from './routes/projects-v2.js'
import systemVersionRoutes from './routes/system-version.js'
import workbenchProjectRoutes from './routes/workbench-project.js'
// Route imports
import communityCategoryRoutes from './routes/community/categories.js'
import communityPostRoutes from './routes/community/posts.js'
import communityCommentRoutes from './routes/community/comments.js'
import communityLikeRoutes from './routes/community/likes.js'
import authRoutes from './routes/auth.js'
import captchaRoutes from './routes/captcha.js'
import smsRoutes from './routes/sms.js'
import smsAuthRoutes from './routes/sms-auth.js'
import projectRoutes from './routes/projects.js'
import storyboardRoutes from './routes/storyboards.js'
import aiTaskRoutes from './routes/ai-tasks.js'
import apiKeyRoutes from './routes/api-keys.js'
import systemHealthRoutes from './routes/system-health.js'
// autograph imports removed — code pruned per audit recommendation (2026-05-21)
import desktopUpdateRoutes from './routes/desktop-update.js'
import desktopOllamaRoutes from './routes/desktop-ollama.js'
import desktopTtsRoutes from './routes/desktop-tts.js'
import desktopComfyRoutes from './routes/desktop-comfy.js'
import desktopVideoRoutes from './routes/desktop-video.js'
import healthRoutes from './routes/health.js'
import observabilityRoutes from './routes/observability.js'
import providerRoutes from './routes/providers.js'
import { OGESSafetyGuard } from './infra/oges/ogesSafetyGuard.js'
import customerServiceRoutes from './routes/customer-service.js'
import paymentRoutes from './routes/payment.js'
import scriptSubmitRoutes from './routes/script-submit.js'
import adminAuthRoutes from './routes/admin-auth.js'
import adminImagePromptRoutes from './routes/admin-image-prompts.js'
import adminGlobalConfigRoutes from './routes/admin-global-config.js'
import adminStorageConfigRoutes from './routes/admin-storage-config.js'
import adminMembersStorageRoutes from './routes/admin-members-storage.js'
import adminAgentRoutes from './routes/admin-agents.js'
import adminMarketAgentRoutes from './routes/admin-market-agents.js'
import agentPlanRoutes from './routes/agent-plan.js'
import agentDefinitionRoutes from './routes/platform/agent/agent.route.js'
import agentSessionRoutes from './routes/platform/agent/session.route.js'
import agentDispatchRoutes from './routes/platform/agent/dispatch.route.js'
import agentScheduleRoutes from './routes/platform/agent/schedule.route.js'
import agentMemoryRoutes from './routes/platform/agent/memory.route.js'
import agentToolRoutes from './routes/platform/agent/tool.route.js'
import adminCustomerServiceRoutes from './routes/admin-customer-service.js'
import modelRoutes from './routes/models.js'
import styleProfileRoutes from './routes/style-profiles.js'
import adminModelRoutes from './routes/admin-models.js'
import adminModelV2Routes from './routes/admin-models-v2.js'
import voiceRoutes from './routes/voice.js'
import { initializeRuntimeSafety, timerRegistry, getLifecycleStatus } from './services/lifecycle-manager.js'
// character routes loaded dynamically below
import sceneRoutes from './routes/scenes.js'
import imageRoutes from './routes/images.js'
import executionImageRoutes from './routes/execution-images.js'
import uploadRoutes from './routes/upload.js'
import wechatOAuthRoutes from './routes/wechat-oauth.js'
import qqOAuthRoutes from './routes/qq-oauth.js'
import memberRoutes from './routes/member.js'
import userCenterRoutes from './routes/user-center.js'

import pipelineRoutes from './routes/pipeline.js'
import pipelineJobRoutes from './routes/pipeline-jobs.js'
import narrativeLLMRoutes from './routes/narrative-llm.js'
import aigcSpecDbRoutes from './routes/aigc-spec-db.js'
import tasksTelemetryRoutes from './routes/tasks-telemetry.js'
import directorV2Routes from './routes/director-v2.js'
import unifiedModelConfigRoutes from './routes/unified-model-config.js'
import administrativeRegionRoutes from './routes/regions.js'
import balanceRoutes from './routes/balance.route.js'
import { registerSSEStream } from './runtime/task-stream.js'

import { env } from './config/env.js'
import { registerRuntimeGuard } from './runtime/runtime-guard.js'
import { providerRegistry } from './providers/core/provider-registry.js'
import { openAICompatibleAdapter } from './providers/adapters/openai-compatible.adapter.js'
import { Capability } from './core/runtime/capabilities.js'

async function main() {
  const app = Fastify({ logger: true })
  // 允许空 JSON body（DELETE 请求不带 body 时不被 reject）
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req: any, body: string, done: any) => {
    try { done(null, body ? JSON.parse(body) : {}) } catch (e: any) { done(e) }
  })

  // Bootstrap real LLM executors

  // ═══ P0: Config Sovereignty Layer — ENV freeze ═══
  const { bootstrapSystemConfig } = await import('./config-runtime/index.js')
  bootstrapSystemConfig()
  console.log('[startup] ✅ Config Sovereignty Layer initialized')

  // 初始化 AI Router 配置（从 RouteConfig 表读取魔数并缓存）
  try {
    console.log('[startup] ✅ AI Router configs loaded from RouteConfig')
  } catch (e: any) {
    console.warn('[startup] ⚠️  AI Router configs not loaded (table may not exist):', e.message)
  }

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
    console.log(`[startup] ✅ 加密系统已初始化`) // CRYPTO_ENCRYPTION_KEY 检查已通过
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

  // 🛡 安全层：速率限制 + 安全头
  await app.register((await import('@fastify/rate-limit')).default, {
    max: 600,
    timeWindow: '1 minute',
    keyGenerator: (req) => {
      return req.ip || req.headers['x-forwarded-for'] as string || 'unknown'
    },
  })

  await app.register((await import('@fastify/helmet')).default, {
    contentSecurityPolicy: false, // Nuxt SPA 需要内联脚本
  })

  await app.register(jwt, { secret: env.JWT_SECRET })
  await app.register(authPlugin)
  await app.register(runtimeContextPlugin)
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } })
  await app.register((await import('@fastify/formbody')).default)

  // ⭐ 静态文件服务（托管 public/uploads 下的本地下载图片）
  // 用 __dirname 确定路径（兼容 CJS 和 ESM）
  const __uploadsRoot = path.resolve(process.cwd(), 'public', 'uploads')
  await app.register((await import('@fastify/static')).default, {
    root: __uploadsRoot,
    prefix: '/uploads/',
    decorateReply: false,
  })

  // Register routes
  await app.register(authRoutes)
  registerSSEStream(app)
  await app.register(systemVersionRoutes)
  await app.register(captchaRoutes)
  await app.register(smsRoutes)
  await app.register(smsAuthRoutes)
  await app.register(projectRoutes)
  // REMOVED: projectDecompositionRoutes
  await app.register(storyboardRoutes)
  // REMOVED: taskRoutes
  await app.register(aiTaskRoutes)
  // REMOVED: sandboxRoutes
  // REMOVED: shadowRoutes
  // Showrunner Core routes (总导演大脑)
  // Director Simulation Layer (导演预演层)
  // Job routes (异步长任务状态查询)
  // REMOVED: jobRoutes
  // autograph registration removed — code pruned (2026-05-21)

  // ExecutionGraph routes (Graph Runtime 前端客户端 API)
  // REMOVED: executionGraphRoutes
  await app.register(sceneRoutes, { prefix: '/api' })
  await app.register(imageRoutes, { prefix: '/api' })
  await app.register(executionImageRoutes, { prefix: '/api' })
  await app.register(uploadRoutes)
    await app.register(adminAuthRoutes)
  await app.register(adminStorageConfigRoutes)
  await app.register(adminMembersStorageRoutes)
  await app.register(memberRoutes)
  await app.register(userCenterRoutes)
  // REMOVED: analyticsRoutes
  // REMOVED: optimizeRoutes

  // REMOVED: featuredRoutes

  // Online AI routes (云端大模型 API)
  // REMOVED: registerOnlineAIRoutes
  // REMOVED: registerModelProviderRoutes
// REMOVED: queueRuntimeRoutes

// OGES v1 Observability (observe-only, no production impact)
await app.register(observabilityRoutes)

// Provider Routes (FRE v1: Provider Verify API + Registry)
await app.register(providerRoutes)

  // Pipeline routes (AI 生产流水线)
  await app.register(pipelineRoutes)
  await app.register(pipelineJobRoutes)
  // REMOVED: executionJournalRoutes

  // Scheduler routes (Multi-Graph 调度系统)
  // REMOVED: runtimeCheckpointRoutes

    await app.register(communityCategoryRoutes)
  await app.register(communityPostRoutes)
  await app.register(communityCommentRoutes)
  await app.register(communityLikeRoutes)
await app.register(projectV2Routes)

  // Narrative LLM routes (LLM 叙事分析)
  await app.register(narrativeLLMRoutes)
  // ScriptBreakdown routes (固定指令剧本拆解任务)
  await app.register(await import('./routes/script-breakdown.js').then(m => m.default))
  // HDZ — 混沌珠小说工作台（独立子路由，不走 studio-v2 体系）
  await app.register(await import('./routes/hdz/index.js').then(m => m.default))
  // P1.7 — V3 Schema 三层审计系统（只读观测路由）
  await app.register(await import('./routes/v3-metrics.js').then(m => m.default))
  // P1.8 — 生产切换决策模型（只读评估，不修改任何系统状态）
  await app.register(await import('./routes/p1.8-evaluate.js').then(m => m.default))
  // P1.8 — Data Activation Layer（双轨采样系统）
  await app.register(await import('./routes/p18-data-activation.js').then(m => m.default))
  // REMOVED: quickCreationRoutes

  // Anchor routes (多模态角色/场景/道具锚定系统)
  // REMOVED: anchorRoutes

  // Costume routes (服装持续化系统)
  // REMOVED: costumeRoutes

  // Character State routes (角色状态系统)
  // REMOVED: characterStateRoutes

  // Story Graph routes (剧情图谱引擎 + 自动分镜系统)
  // REMOVED: storyGraphRoutes

  // Director Engine routes (导演级镜头决策引擎)
  // REMOVED: directorEngineRoutes

  // Director Intelligence Layer routes (导演智能层 API)

  // Director V2 routes (Director OS observability layer, /api/v2/director/*)
  await app.register(directorV2Routes)

  // Desktop Runtime routes（跨平台桌面运行时）
  // REMOVED: desktopRuntimeRoutes

  // User API Key management (VIP 会员接入自己的大模型)

  // User Model Config (BYO API Key + 自选模型)
  // User Model Config V2 (Single Source of Truth)
  await app.register(unifiedModelConfigRoutes)
  // MSAL — Single Authority Model Selection
  // REMOVED: assetRegistryRoutes
  // REMOVED: aiGatewayRoutes
  // REMOVED: continuityRoutes
  // REMOVED: jobManagerRoutes

  // AI 资产经济体系（Asset Economy System）

  // Studio V1 API routes (control panel)
  // Health check
  await app.register(wechatOAuthRoutes)
  await app.register(qqOAuthRoutes)
  // Customer Service routes (AI 智能客服)
  await app.register(customerServiceRoutes)
  await app.register(paymentRoutes)
  await app.register(scriptSubmitRoutes)

  // REMOVED: agentOrchestratorRoutes
  // REMOVED: stabilityRoutes

  // AIGC spec DB routes（AI 规格表持久化）
  await app.register(aigcSpecDbRoutes)

  // Telemetry 接收端点（前端 FRE 埋点静默接收）
  await app.register(tasksTelemetryRoutes)

  // Stage model config routes（各阶段模型配置 CRUD）
  // REMOVED: stageModelConfigRoutes

  // Model available routes (公共 API，无需认证)
  await app.register(modelRoutes)
  await app.register(styleProfileRoutes)

  // Admin model routes (管理员 API Key 管理)
  await app.register(adminModelRoutes)
  await app.register(adminModelV2Routes)

  // Admin Image Prompt Templates (提示词模板管理)
  await app.register(adminImagePromptRoutes)

  // Admin global model config (切换默认 LLM/图片/视频/语音模型)
  await app.register(adminGlobalConfigRoutes)

  // Admin Agent management
  await app.register(adminAgentRoutes)

  // Admin Market Agents
  await app.register(adminMarketAgentRoutes)

  // Agent Plans (前台+后台)
  await app.register(agentPlanRoutes)
  // Agent Runtime routes (KMKI-PLAT-010)
  await app.register(agentDefinitionRoutes)
  await app.register(agentSessionRoutes)
  await app.register(agentDispatchRoutes)
  await app.register(agentScheduleRoutes)
  await app.register(agentMemoryRoutes)
  await app.register(agentToolRoutes)

  // Admin Customer Service settings
  await app.register(adminCustomerServiceRoutes)

  // Runtime Observability Dashboard v1 (只读观测)

  // Phase 4.2: Runtime Trace (invocation source of truth)
  // REMOVED: runtimeTraceRoutes

  // Phase 5.1: Self-verification kernel

  // EPVH — Execution Plane 验证
  // REMOVED: verificationRoutes

  // Legacy Bridge — 受控收敛迁移控制
  // REMOVED: bridgeRoutes

  // PSC-1 — Phase 1 Safe Convergence 控制器
  // REMOVED: psc1Routes

  // 歌曲创作
  const musicRoutes = (await import('./routes/music.js')).default
  await app.register(musicRoutes)

  // TTS 语音合成
  const ttsRoutes = (await import('./routes/tts.js')).default
  await app.register(ttsRoutes)

  // ASR 语音识别（语音转字幕）
  const asrRoutes = (await import('./routes/asr.js')).default
  await app.register(asrRoutes)

  // 音色管理路由（voice records/save, voice/design 等）
  await app.register(voiceRoutes)

  // AI 优化视频脚本（导演级逐秒优化）
  const aiOptimizeShotRoutes = (await import('./routes/ai-optimize-shot.js')).default
  await app.register(aiOptimizeShotRoutes)

  // 世界感知（World Model）占位 API
  // REMOVED: worldModelRoutes

  // 参考图系统（Reference-Driven Generation）
  // REMOVED: referenceRoutes

  // 帧图提示词优化
  const aiOptimizeFramePromptRoutes = (await import('./routes/ai-optimize-frame-prompt.js')).default
  await app.register(aiOptimizeFramePromptRoutes)

  // 视频 prompt 优化（镜头语言）
  const aiOptimizeVideoPromptRoutes = (await import('./routes/ai-optimize-video-prompt.js')).default
  await app.register(aiOptimizeVideoPromptRoutes)

  // 广告脚本优化
  const aiOptimizeAdScriptRoutes = (await import('./routes/ai-optimize-ad-script.js')).default
  await app.register(aiOptimizeAdScriptRoutes)

  // 广告视频生成
  const aiGenerateAdVideoRoutes = (await import('./routes/ai-generate-ad-video.js')).default
  await app.register(aiGenerateAdVideoRoutes)

  // 图片提示词优化
  const aiOptimizeImagePromptRoutes = (await import('./routes/ai-optimize-image-prompt.js')).default
  await app.register(aiOptimizeImagePromptRoutes)

  // 用户模型配置查询（广告页面使用）
  const userLLMConfigRoutes = (await import('./routes/user-llm-config.js')).default
  await app.register(userLLMConfigRoutes)

  // 视频合成拼接（AI 视频段 → 完整 MP4）
  const videoMergeRoutes = (await import('./routes/video-merge.js')).default
  await app.register(videoMergeRoutes)

  // 视频段编辑状态持久化
  const projectSegmentStateRoutes = (await import('./routes/project-segment-state.js')).default
  await app.register(projectSegmentStateRoutes)

  // 图片代理（解决火山 TOS CORS）
  const proxyImageRoutes = (await import('./routes/proxy-image.js')).default
  await app.register(proxyImageRoutes)

  // OMS World Runtime Routes（世界运行内核 + 叙事 + 观测者经济）
  // REMOVED: worldRuntimeRoutes

  // OMS Dashboard Routes（可视化仪表盘 V1）
  // REMOVED: omsDashboardRoutes

  // OMS V2 Routes（三层认知可视化系统）
  // REMOVED: omsV2Routes

  // Character System V1 Routes（角色系统）

  // Character-OMS Graph Fusion V1（角色图谱融合）
  // REMOVED: omsFusionRoutes

  // Universe Images（作品宇宙图片引用）
  // REMOVED: universeImageRoutes

  // References（角色/场景参考图一致性系统）
  await app.register(apiKeyRoutes)
  // Workflow Execution Graph v1
  // REMOVED: workflowRoutes
  // Workflow Visualizer v1
  // 管理员资产管理（图片上传管理）
  // REMOVED: adminAssetRoutes
  // REMOVED: executionTraceRoutes
  // REMOVED: executionDebugRoutes
  await app.register(systemHealthRoutes)
  // Desktop update routes（桌面端升级）
  await app.register(desktopUpdateRoutes)
  // Desktop Ollama routes（本地大模型检测）
  await app.register(desktopOllamaRoutes)
  // Desktop TTS routes（本地语音合成）
  await app.register(desktopTtsRoutes)
  // Desktop ComfyUI routes（本地图片引擎）
  await app.register(desktopComfyRoutes)
  // Desktop video routes（本地视频引擎检测）
  await app.register(desktopVideoRoutes)
  // Brand GEO routes (Phase 2)
  await app.register(await import('./routes/geo/geo-project.js').then(m => m.default))
  await app.register(await import('./routes/geo/geo-brand.js').then(m => m.default))
  await app.register(await import('./routes/geo/geo-scanner.js').then(m => m.default))
  await app.register(await import('./routes/geo/geo-graph.js').then(m => m.default))

  // Unified Asset Runtime routes (Platform Level, Phase 2.5)
  await app.register(await import('./routes/asset/asset.route.js').then(m => m.default))
  await app.register(await import('./routes/asset/asset-version.route.js').then(m => m.default))
  await app.register(await import('./routes/asset/asset-scanner.route.js').then(m => m.default))
  // Production health / monitoring routes
  await app.register(healthRoutes)
  // REMOVED: observabilityRoutes
  // REMOVED: optimizationRoutes
  // 编排 Agent 路由（统筹分析 → 分发各专业 agent）
  // REMOVED: orchestratorRoutes

  // Voice Management（音色管理）

  // Cognition Loop (认知循环)
  // REMOVED: worldMemoryRoutes

  // Export Runtime (导出打包系统)
  // REMOVED: exportRoutes
  // F1 Control Plane (v2 unified)
  // REMOVED: controlPlaneV2Routes
  // REMOVED: clusterRoutes
  // REMOVED: globalRoutes
  // REMOVED: autonomousRoutes
  // REMOVED: governanceRoutes
  await app.register(workbenchProjectRoutes)

  // ⭐ 行政区划 API
  await app.register(administrativeRegionRoutes)
  await app.register(balanceRoutes)

  // 启动进化引擎（P7）
  try {
    const { runtimeEvolutionEngine } = await import('./core/autonomous/runtime-evolution-engine.js')
    runtimeEvolutionEngine.start(60000)
    console.log('[Autonomous] P7 EvolutionEngine started (every 60s)')
  } catch (err) {
    console.warn('[Autonomous] Failed to start:', (err as Error).message)
  }

  // 初始化 Asset Runtime（Phase 2.5 平台级基础设施）
  try {
    const { assetRuntime } = await import('./services/asset/runtime/asset.runtime.js')
    await assetRuntime.initialize()
    console.log('[AssetRuntime] ✅ Unified Asset Runtime initialized')
  } catch (err) {
    console.warn('[AssetRuntime] Failed to initialize:', (err as Error).message)
  }

  // Semantic Runtime routes (Phase 3 — Platform Level Unified Semantic Layer)
  await app.register(await import('./routes/semantic/entity.route.js').then(m => m.default))
  await app.register(await import('./routes/semantic/topic.route.js').then(m => m.default))
  await app.register(await import('./routes/semantic/taxonomy.route.js').then(m => m.default))
  await app.register(await import('./routes/semantic/alias.route.js').then(m => m.default))
  await app.register(await import('./routes/semantic/keyword.route.js').then(m => m.default))
  await app.register(await import('./routes/semantic/semantic.route.js').then(m => m.default))

  // 初始化 Semantic Runtime（Phase 3 平台级语义层）
  try {
    const { semanticRuntime } = await import('./services/semantic/runtime/semantic.runtime.js')
    await semanticRuntime.initialize()
    console.log('[SemanticRuntime] ✅ Unified Semantic Runtime initialized')
  } catch (err) {
    console.warn('[SemanticRuntime] Failed to initialize:', (err as Error).message)
  }

  // Capability Platform routes (Phase 6 — Platform Level Capability Contract Layer)
  await app.register(await import('./routes/platform/capability/contract.route.js').then(m => m.default))
  await app.register(await import('./routes/platform/capability/registry.route.js').then(m => m.default))
  await app.register(await import('./routes/platform/capability/resolver.route.js').then(m => m.default))
  await app.register(await import('./routes/platform/capability/validator.route.js').then(m => m.default))
  await app.register(await import('./routes/platform/capability/catalog.route.js').then(m => m.default))
  await app.register(await import('./routes/platform/capability/capability-main.route.js').then(m => m.default))

  // Resource Platform routes (KMKI-PLAT-008 — AI Resource Runtime)
  await app.register(await import('./routes/platform/resource/contract.route.js').then(m => m.default))
  await app.register(await import('./routes/platform/resource/credential.route.js').then(m => m.default))
  await app.register(await import('./routes/platform/resource/resolver.route.js').then(m => m.default))
  await app.register(await import('./routes/platform/resource/health.route.js').then(m => m.default))
  await app.register(await import('./routes/platform/resource/usage.route.js').then(m => m.default))
  await app.register(await import('./routes/platform/resource/cost.route.js').then(m => m.default))
  await app.register(await import('./routes/platform/resource/matrix.route.js').then(m => m.default))
  await app.register(await import('./routes/platform/resource/resource-main.route.js').then(m => m.default))

  // 初始化 Capability Runtime（Phase 6 平台级能力契约层）
  try {
    const { capabilityRuntime } = await import('./services/platform/capability/runtime/capability.runtime.js')
    await capabilityRuntime.initialize()

    // Register routing strategies
    const { capabilityResolver } = await import('./services/platform/capability/resolver/capability-resolver.js')
    const { qualityFirstStrategy } = await import('./services/platform/capability/resolver/routing-strategies/quality-first.js')
    const { costFirstStrategy } = await import('./services/platform/capability/resolver/routing-strategies/cost-first.js')
    const { latencyFirstStrategy } = await import('./services/platform/capability/resolver/routing-strategies/latency-first.js')
    const { balancedStrategy } = await import('./services/platform/capability/resolver/routing-strategies/balanced.js')

    capabilityResolver.registerStrategy(qualityFirstStrategy)
    capabilityResolver.registerStrategy(costFirstStrategy)
    capabilityResolver.registerStrategy(latencyFirstStrategy)
    capabilityResolver.registerStrategy(balancedStrategy)
    console.log('[CapabilityRuntime] ✅ Capability Runtime initialized with 4 routing strategies')
  } catch (err) {
    console.warn('[CapabilityRuntime] Failed to initialize:', (err as Error).message)
  }

  // 初始化 Resource Runtime（KMKI-PLAT-008 — AI Resource Runtime）
  try {
    const { resourceRuntime } = await import('./services/platform/resource/runtime/resource.runtime.js')
    await resourceRuntime.init({})
    // Register default streaming adapters
    const { registerDefaultAdapters } = await import('./services/platform/resource/streaming/streaming-adapter.js')
    registerDefaultAdapters()
    console.log('[ResourceRuntime] ✅ AI Resource Runtime initialized with streaming adapters')
  } catch (err) {
    console.warn('[ResourceRuntime] Failed to initialize:', (err as Error).message)
  }

  // Goal Runtime routes (Phase 4 — Platform Level Growth Execution Layer)
  await app.register(await import('./routes/goal/goal.route.js').then(m => m.default))
  await app.register(await import('./routes/goal/strategy.route.js').then(m => m.default))
  await app.register(await import('./routes/goal/workflow.route.js').then(m => m.default))
  await app.register(await import('./routes/goal/task.route.js').then(m => m.default))
  await app.register(await import('./routes/goal/action.route.js').then(m => m.default))
  await app.register(await import('./routes/goal/execution.route.js').then(m => m.default))
  await app.register(await import('./routes/goal/review.route.js').then(m => m.default))
  await app.register(await import('./routes/goal/goal-main.route.js').then(m => m.default))

  // Execution Runtime routes (KMKI-PLAT-007 — Platform Execution Kernel)
  await app.register(await import('./routes/platform/execution/execution-main.route.js').then(m => m.default))

  // Initialize Execution Runtime (KMKI-PLAT-007 — Platform Execution Kernel)
  try {
    const { executionRuntime } = await import('./services/platform/execution/runtime/execution.runtime.js')
    await executionRuntime.init({})
    console.log('[ExecutionRuntime] ✅ Execution Runtime initialized')
  } catch (err) {
    console.warn('[ExecutionRuntime] Failed to initialize:', (err as Error).message)
  }

  // 初始化 Goal Runtime（Phase 4 平台级增长执行层）
  try {
    const { goalRuntime } = await import('./services/goal/runtime/goal.runtime.js')
    await goalRuntime.initialize()
    console.log('[GoalRuntime] ✅ Goal Runtime initialized')

    // Register placeholder action handlers
    await import('./services/goal/registry/actions/generate-faq.js')
    await import('./services/goal/registry/actions/publish-cms.js')
    await import('./services/goal/registry/actions/update-knowledge-graph.js')
    console.log('[GoalRuntime] ✅ Registered placeholder action handlers')
  } catch (err) {
    console.warn('[GoalRuntime] Failed to initialize:', (err as Error).message)
  }

  // F6 System Dashboard
  // REMOVED: systemDashboardRoutes

  // F4/F5 Multi-Tenant
  // REMOVED: tenantRoutes

  // G Product Layer
  // REMOVED: productRoutes

  // S3 Route Redirect (deprecated routes)

  // HITL Human-in-the-Loop (昆仑镜 v2)
  // REMOVED: hitlRoutes

  // Schema Runtime v1 — Phase A shadow observe layer
  // REMOVED: schemaRuntimeRoutes

  // LLM Execution Graph Trace API
  // REMOVED: llmExecutionTraceRoutes

  // Community System
  // REMOVED: communityCategoryRoutes
  // REMOVED: communityPostRoutes
  // REMOVED: communityCommentRoutes
  // REMOVED: communityLikeRoutes
  // REMOVED: messageRoutes

  app.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString(), lifecycle: getLifecycleStatus() }
  })

  // 🔍 版本指纹接口 — 用于前端确认当前加载的是哪一版
  app.get('/api/version', async () => {
    return {
      build: '20260624-LAST',
      time: new Date().toISOString(),
      frontend: 'aigc.fushtn.com',
      note: '部署后清除浏览器缓存 / Ctrl+Shift+R 强制刷新'
    }
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
    console.log('[Kernel] ✅ v1 routes registered (command / read / rebuild)')
  } catch (err) {
    console.warn('[Kernel] Failed to register:', (err as Error).message)
  }

  // Kernel v1.1: Causal Layer 路由
  try {
    console.log('[Kernel] ✅ v1.1 causal routes registered (causal / trace / replay)')
  } catch (err) {
    console.warn('[Kernel] Failed to register causal routes:', (err as Error).message)
  }

  // RFVL: 注册运行时证明验证路由（必须在 listen 前注册）
  try {
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

  // 启动 CTBL Decision Engine（自动 CSIP 门控）
  try {
    console.log('[CTBL] ⏳ Booting decision engine...')
    const { startDecisionScheduler } = await import('./observability/ctblScheduler.js')
    await startDecisionScheduler()
    console.log('[CTBL] ✅ Decision engine booted at', new Date().toISOString())
  } catch (err) {
    console.warn('[CTBL] Failed to start decision engine:', (err as Error).message)
  }

  // 初始化 Unified Orchestrator Agent (UOA)
  try {
    const { uoa } = await import('./agents/orchestrator/UOA.js')
    console.log('[UOA] ✅ Orchestrator Agent online')
    // Baseline v1.0 safety check
    OGESSafetyGuard.assertReadOnlyMode()
    console.log('[OGES] ✅ Baseline v1.0 immutable — safety guard active:', JSON.stringify(OGESSafetyGuard.runtimeCheck()))
  } catch (err) {
    console.warn('[UOA] Failed to init:', (err as Error).message)
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
