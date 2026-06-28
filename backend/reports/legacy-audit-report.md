# 🧹 Legacy Code Audit Report

**Date:** 2026-05-24 23:00
**Scope:** `/root/shipin-cinematic-studio/backend/src`
**Total TS files:** 715
**Total TS lines:** 114945

## Module Size Distribution

| Module | Lines | % of total |
|--------|-------|-----------|
| routes | 23937 | 20.8% |
| director-v2 | 19779 | 17.2% |
| core | 14251 | 12.4% |
| services | 13825 | 12.0% |
| runtime | 5288 | 4.6% |
| simulation | 4187 | 3.6% |
| production-loop | 3081 | 2.7% |
| jobs | 2061 | 1.8% |
| queue | 1745 | 1.5% |
| director | 1716 | 1.5% |
| model-adapters | 1715 | 1.5% |
| agents | 1607 | 1.4% |
| studio | 1601 | 1.4% |
| graph-runtime | 1591 | 1.4% |
| engine | 1581 | 1.4% |
| observability | 1199 | 1.0% |
| governance | 1196 | 1.0% |
| optimization | 1106 | 1.0% |
| cinematic-ir | 1055 | 0.9% |
| graph-patch | 940 | 0.8% |
| payment | 877 | 0.8% |
| cognition-loop | 854 | 0.7% |
| api | 833 | 0.7% |
| showrunner | 806 | 0.7% |
| replay | 769 | 0.7% |
| replay-analytics | 703 | 0.6% |
| scheduler | 701 | 0.6% |
| scripts | 663 | 0.6% |
| director-simulation | 627 | 0.5% |
| bootstrap | 574 | 0.5% |
| index.ts | 547 | 0.5% |
| providers | 525 | 0.5% |
| chaos-test.ts | 456 | 0.4% |
| graph-optimization | 359 | 0.3% |
| truth | 262 | 0.2% |
| kernel | 260 | 0.2% |
| control-plane | 256 | 0.2% |
| worker | 233 | 0.2% |
| transport | 214 | 0.2% |
| utils | 190 | 0.2% |
| plugins | 181 | 0.2% |
| phase7a-declaration.ts | 163 | 0.1% |
| workers | 112 | 0.1% |
| storage | 96 | 0.1% |
| schemas | 80 | 0.1% |
| middleware | 70 | 0.1% |
| config | 50 | 0.0% |
| types | 23 | 0.0% |

## Legacy Directories

Found 2 legacy-named directories:

- `director-v2/`
- `director-v2/dpm-v2/`

## Legacy & Deprecated Reference Scan

### legacy_dirs

Pattern `legacy` — 197 hits:

  - /root/shipin-cinematic-studio/backend/src/routes/projects.ts:120:    // Full replace mode (legacy)
  - /root/shipin-cinematic-studio/backend/src/routes/tts.ts:76:            legacyExecutor: async () => {
  - /root/shipin-cinematic-studio/backend/src/routes/tts.ts:107:            legacyExecutor: async () => {
  - /root/shipin-cinematic-studio/backend/src/routes/tts.ts:138:          legacyExecutor: async () => {
  - /root/shipin-cinematic-studio/backend/src/routes/voice.ts:154:        legacyExecutor: async () => {
  - /root/shipin-cinematic-studio/backend/src/routes/control-plane-v2.ts:42:        legacy: 'worker-runtime (frozen)',
  - /root/shipin-cinematic-studio/backend/src/routes/bridge.ts:11:import { legacyBridge, BridgeMode, LegacyBridgeConfig } from '../core/bridge/legacy-provider-bridge.js'
  - /root/shipin-cinematic-studio/backend/src/routes/bridge.ts:69:    description: '所有路径 cutover 模式，legacy 代码可删除',
  - /root/shipin-cinematic-studio/backend/src/routes/bridge.ts:81:    if (!legacyBridge.getConfig()[path as keyof LegacyBridgeConfig]) {
  - /root/shipin-cinematic-studio/backend/src/routes/bridge.ts:82:      return { success: false, error: `未知路径: ${path}，可用: ${Object.keys(legacyBridge.getConfig()).join(', ')}` }
  ... (+187 more)

Pattern `old` — 374 hits:

  - /root/shipin-cinematic-studio/backend/src/routes/shadow.ts:13:  updateGrayThreshold,
  - /root/shipin-cinematic-studio/backend/src/routes/shadow.ts:40:    return reply.send({ enabled: config.enabled, grayThreshold: config.grayThreshold })
  - /root/shipin-cinematic-studio/backend/src/routes/shadow.ts:44:  fastify.post('/api/shadow/gray-threshold', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  - /root/shipin-cinematic-studio/backend/src/routes/shadow.ts:45:    const { threshold } = request.body as any
  - /root/shipin-cinematic-studio/backend/src/routes/shadow.ts:46:    if (typeof threshold !== 'number' || threshold < 0 || threshold > 100) {
  - /root/shipin-cinematic-studio/backend/src/routes/shadow.ts:47:      return reply.status(400).send({ error: 'threshold must be 0-100' })
  - /root/shipin-cinematic-studio/backend/src/routes/shadow.ts:49:    const config = await updateGrayThreshold(threshold)
  - /root/shipin-cinematic-studio/backend/src/routes/shadow.ts:50:    return reply.send({ enabled: config.enabled, grayThreshold: config.grayThreshold })
  - /root/shipin-cinematic-studio/backend/src/routes/shadow.ts:111:      alertThreshold: b.alertThreshold,
  - /root/shipin-cinematic-studio/backend/src/routes/shadow.ts:112:      blockThreshold: b.blockThreshold,
  ... (+364 more)

Pattern `v1` — 734 hits:

  - /root/shipin-cinematic-studio/backend/src/config/env.ts:23:  MUREKA_BASE_URL: z.string().default('https://api.mureka.ai/v1'),
  - /root/shipin-cinematic-studio/backend/src/config/env.ts:25:  SUNO_BASE_URL: z.string().default('https://api.suno.ai/v1'),
  - /root/shipin-cinematic-studio/backend/src/config/env.ts:27:  MUSIC15_BASE_URL: z.string().default('https://api.music15.ai/v1'),
  - /root/shipin-cinematic-studio/backend/src/config/env.ts:30:  SILICONFLOW_BASE_URL: z.string().default('https://api.siliconflow.cn/v1'),
  - /root/shipin-cinematic-studio/backend/src/plugins/auth.ts:10:  '/api/v1/pipeline',
  - /root/shipin-cinematic-studio/backend/src/plugins/auth.ts:11:  '/api/v1/narrative',
  - /root/shipin-cinematic-studio/backend/src/plugins/auth.ts:12:  '/api/v1/customer-service',
  - /root/shipin-cinematic-studio/backend/src/plugins/runtime-context.ts:18:    '/api/v1/system/health',
  - /root/shipin-cinematic-studio/backend/src/plugins/runtime-context.ts:19:    '/api/v1/system/version',
  - /root/shipin-cinematic-studio/backend/src/routes/storyboards.ts:73:    const baseUrl = env.DEEPSEEK_API_KEY ? 'https://api.deepseek.com/v1' : 'https://api.openai.com/v1'
  ... (+724 more)

Pattern `v2` — 282 hits:

  - /root/shipin-cinematic-studio/backend/src/routes/anchor.ts:37:        faceEmbedding: `v2/embed/face/${id}`,
  - /root/shipin-cinematic-studio/backend/src/routes/customer-service.ts:2: * 智能客服 Agent 路由 — 小麒 v2.0
  - /root/shipin-cinematic-studio/backend/src/routes/world-runtime.ts:2:// World Runtime Backend v2 — 带DB持久化
  - /root/shipin-cinematic-studio/backend/src/routes/oms-v2.ts:12:  fastify.get('/api/oms/v2/causal-graph', async (_req, reply) => {
  - /root/shipin-cinematic-studio/backend/src/routes/oms-v2.ts:58:  fastify.get('/api/oms/v2/structure-map', async (_req, reply) => {
  - /root/shipin-cinematic-studio/backend/src/routes/oms-v2.ts:99:  fastify.get('/api/oms/v2/influence-flow', async (_req, reply) => {
  - /root/shipin-cinematic-studio/backend/src/routes/oms-v2.ts:135:  fastify.get('/api/oms/v2/stream', async (req, reply) => {
  - /root/shipin-cinematic-studio/backend/src/routes/narrative-llm.ts:312:  // POST /api/v1/narrative/aigc-spec — AigcSpecOrchestrator v2（多 Agent 架构）
  - /root/shipin-cinematic-studio/backend/src/routes/governance.ts:4: *  - GET  /api/v2/governance/status      — 系统稳定性状态
  - /root/shipin-cinematic-studio/backend/src/routes/governance.ts:5: *  - GET  /api/v2/governance/policy       — 当前策略
  ... (+272 more)

Pattern `backup` — 6 hits:

  - /root/shipin-cinematic-studio/backend/src/runtime/narrative-gateway.ts:347:    const backup: Record<string, string | undefined> = {}
  - /root/shipin-cinematic-studio/backend/src/runtime/narrative-gateway.ts:385:        if (!(envKey in backup)) backup[envKey] = process.env[envKey]
  - /root/shipin-cinematic-studio/backend/src/runtime/narrative-gateway.ts:389:          if (!(envBaseUrl in backup)) backup[envBaseUrl] = process.env[envBaseUrl]
  - /root/shipin-cinematic-studio/backend/src/runtime/narrative-gateway.ts:393:          if (!(envModel in backup)) backup[envModel] = process.env[envModel]
  - /root/shipin-cinematic-studio/backend/src/runtime/narrative-gateway.ts:443:              for (const [k, v] of Object.entries(backup)) {
  - /root/shipin-cinematic-studio/backend/src/runtime/narrative-gateway.ts:489:          for (const [k, v] of Object.entries(backup)) {

Pattern `deprecated` — 8 hits:

  - /root/shipin-cinematic-studio/backend/src/routes/ai-router.ts:19:    if (!['active', 'degraded', 'deprecated', 'disabled'].includes(status)) {
  - /root/shipin-cinematic-studio/backend/src/services/mock-worker.ts:3: * @deprecated 已由 queue/worker-runtime.ts（BullMQ 真 Worker）取代
  - /root/shipin-cinematic-studio/backend/src/services/user-model-resolver-v2.ts:4: * LEGACY: 旧版 resolve('llm', userId) 已被标记为 @deprecated
  - /root/shipin-cinematic-studio/backend/src/services/user-model-resolver-v2.ts:63:   * @deprecated 不要直接调用，通过 runtimeDispatcher.execute() 间接调用
  - /root/shipin-cinematic-studio/backend/src/services/user-model-resolver-v2.ts:120:   * @deprecated 旧版 resolve 方法，仅用于过渡期
  - /root/shipin-cinematic-studio/backend/src/index.ts:465:  // S3 Route Redirect (deprecated routes)
  - /root/shipin-cinematic-studio/backend/src/queue/task-queue.ts:29: * @deprecated 使用 queue-manager.enqueueTask 替代
  - /root/shipin-cinematic-studio/backend/src/director-v2/diagnostics/emotional-trajectory.ts:105:    // shots (deprecated but sometimes used)

### legacy_names

Pattern `legacy-provider` — 2 hits:

  - /root/shipin-cinematic-studio/backend/src/routes/bridge.ts:11:import { legacyBridge, BridgeMode, LegacyBridgeConfig } from '../core/bridge/legacy-provider-bridge.js'
  - /root/shipin-cinematic-studio/backend/src/providers/legacy-provider-adapter.ts:2: * providers/legacy-provider-adapter.ts — 旧 Provider 适配器

Pattern `shadow` — 206 hits:

  - /root/shipin-cinematic-studio/backend/src/routes/shadow.ts:5: * 全部挂载在 /api/shadow/* 下
  - /root/shipin-cinematic-studio/backend/src/routes/shadow.ts:11:  shadowGate,
  - /root/shipin-cinematic-studio/backend/src/routes/shadow.ts:12:  shadowQueueExecute,
  - /root/shipin-cinematic-studio/backend/src/routes/shadow.ts:18:} from '../services/shadow-execution.service'
  - /root/shipin-cinematic-studio/backend/src/routes/shadow.ts:22:export default async function shadowRoutes(fastify: FastifyInstance) {
  - /root/shipin-cinematic-studio/backend/src/routes/shadow.ts:28:  fastify.get('/api/shadow/status', { preHandler: [fastify.authenticate] }, async (_request, reply) => {
  - /root/shipin-cinematic-studio/backend/src/routes/shadow.ts:34:  fastify.post('/api/shadow/toggle', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  - /root/shipin-cinematic-studio/backend/src/routes/shadow.ts:44:  fastify.post('/api/shadow/gray-threshold', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  - /root/shipin-cinematic-studio/backend/src/routes/shadow.ts:58:  fastify.post('/api/shadow/smoke', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  - /root/shipin-cinematic-studio/backend/src/routes/shadow.ts:66:    const gate = await shadowGate(user.id)
  ... (+196 more)

Pattern `control-plane-v2` — 1 hits:

  - /root/shipin-cinematic-studio/backend/src/index.ts:432:  const controlPlaneV2Routes = (await import('./routes/control-plane-v2.js')).default

### fallback_refs

Pattern `process.env\.ALIYUN` — 10 hits:

  - /root/shipin-cinematic-studio/backend/src/config/env.ts:50:process.env.ALIYUN_API_KEY = env.ALIYUN_API_KEY
  - /root/shipin-cinematic-studio/backend/src/routes/images.ts:94:      const oldKey = process.env.ALIYUN_API_KEY
  - /root/shipin-cinematic-studio/backend/src/routes/images.ts:95:      process.env.ALIYUN_API_KEY = userConfig.apiKey
  - /root/shipin-cinematic-studio/backend/src/routes/images.ts:105:            process.env.ALIYUN_API_KEY = oldKey
  - /root/shipin-cinematic-studio/backend/src/routes/system-health.ts:19:        aliyunApiKey: mask(process.env.ALIYUN_API_KEY || process.env.BAILIAN_API_KEY),
  - /root/shipin-cinematic-studio/backend/src/routes/system-health.ts:137:    const aliyunKey = process.env.ALIYUN_API_KEY || process.env.BAILIAN_API_KEY
  - /root/shipin-cinematic-studio/backend/src/routes/admin-global-config.ts:618:      const apiKey = process.env.ALIYUN_API_KEY || env.ALIYUN_API_KEY
  - /root/shipin-cinematic-studio/backend/src/routes/admin-global-config.ts:698:      const apiKey = process.env.ALIYUN_API_KEY || env.ALIYUN_API_KEY
  - /root/shipin-cinematic-studio/backend/src/routes/model-provider.ts:84:          modelName: process.env.ALIYUN_IMAGE_MODEL || 'wanx2.1-t2i-turbo',
  - /root/shipin-cinematic-studio/backend/src/core/provider-adapters/aliyun-tts.adapter.ts:89:    return !!(process.env.ALIYUN_API_KEY || process.env.ALIYUN_API_KEY)

Pattern `process.env\.VOLCENGINE` — 17 hits:

  - /root/shipin-cinematic-studio/backend/src/config/env.ts:44:process.env.VOLCENGINE_API_KEY = env.VOLCENGINE_API_KEY
  - /root/shipin-cinematic-studio/backend/src/routes/images.ts:79:        const oldKey = process.env.VOLCENGINE_API_KEY
  - /root/shipin-cinematic-studio/backend/src/routes/images.ts:80:        process.env.VOLCENGINE_API_KEY = userConfig.apiKey
  - /root/shipin-cinematic-studio/backend/src/routes/images.ts:88:              process.env.VOLCENGINE_API_KEY = oldKey
  - /root/shipin-cinematic-studio/backend/src/routes/system-health.ts:22:        volcengineApiKey: mask(process.env.VOLCENGINE_API_KEY),
  - /root/shipin-cinematic-studio/backend/src/routes/system-health.ts:23:        volcengineLlmModel: process.env.VOLCENGINE_LLM_MODEL || '',
  - /root/shipin-cinematic-studio/backend/src/routes/system-health.ts:24:        volcengineImageModel: process.env.VOLCENGINE_IMAGE_MODEL || '',
  - /root/shipin-cinematic-studio/backend/src/routes/system-health.ts:25:        volcengineVideoModel: process.env.VOLCENGINE_VIDEO_MODEL || '',
  - /root/shipin-cinematic-studio/backend/src/routes/system-health.ts:151:    if (process.env.VOLCENGINE_API_KEY) {
  - /root/shipin-cinematic-studio/backend/src/routes/system-health.ts:152:      const model = process.env.VOLCENGINE_LLM_MODEL || 'doubao-seed-2-0-mini-260428'
  ... (+7 more)

Pattern `process.env\.DEEPSEEK` — 12 hits:

  - /root/shipin-cinematic-studio/backend/src/config/env.ts:41:process.env.DEEPSEEK_API_KEY = env.DEEPSEEK_API_KEY
  - /root/shipin-cinematic-studio/backend/src/routes/system-health.ts:17:        deepseekApiKey: mask(process.env.DEEPSEEK_API_KEY),
  - /root/shipin-cinematic-studio/backend/src/routes/system-health.ts:129:    if (process.env.DEEPSEEK_API_KEY) {
  - /root/shipin-cinematic-studio/backend/src/routes/system-health.ts:130:      results.push(await testProvider('deepseek', 'DeepSeek', 'https://api.deepseek.com/v1/chat/completions', 'deepseek-chat', process.env.DEEPSEEK_API_KEY))
  - /root/shipin-cinematic-studio/backend/src/routes/director-v2.ts:22:      console.log(`[director-v2] generate called. ENV DEEPSEEK_KEY length: ${(process.env.DEEPSEEK_API_KEY || '').length}`)
  - /root/shipin-cinematic-studio/backend/src/routes/render-shots.ts:74:      // provider 使用 process.env.DEEPSEEK_API_KEY 获取 key
  - /root/shipin-cinematic-studio/backend/src/routes/render-shots.ts:83:          process.env.DEEPSEEK_API_KEY = decrypted
  - /root/shipin-cinematic-studio/backend/src/routes/render-shots.ts:85:            process.env.DEEPSEEK_BASE_URL = userModelConfig.baseUrl
  - /root/shipin-cinematic-studio/backend/src/routes/render-shots.ts:88:            process.env.DEEPSEEK_MODEL = userModelConfig.model
  - /root/shipin-cinematic-studio/backend/src/runtime/narrative-gateway.ts:351:    if (process.env.DEEPSEEK_API_KEY) {
  ... (+2 more)

Pattern `process.env\.SILICON` — 7 hits:

  - /root/shipin-cinematic-studio/backend/src/config/env.ts:48:process.env.SILICONFLOW_API_KEY = env.SILICONFLOW_API_KEY
  - /root/shipin-cinematic-studio/backend/src/config/env.ts:49:process.env.SILICONFLOW_BASE_URL = env.SILICONFLOW_BASE_URL
  - /root/shipin-cinematic-studio/backend/src/routes/system-health.ts:18:        siliconflowApiKey: mask(process.env.SILICONFLOW_API_KEY),
  - /root/shipin-cinematic-studio/backend/src/routes/system-health.ts:133:    if (process.env.SILICONFLOW_API_KEY) {
  - /root/shipin-cinematic-studio/backend/src/routes/system-health.ts:134:      results.push(await testProvider('siliconflow', '硅基流动', 'https://api.siliconflow.cn/v1/chat/completions', 'Qwen/Qwen2.5-7B-Instruct', process.env.SILICONFLOW_API_KEY))
  - /root/shipin-cinematic-studio/backend/src/core/provider-adapters/siliconflow-image.adapter.ts:83:      const apiKey = process.env.SILICONFLOW_API_KEY || env.SILICONFLOW_API_KEY
  - /root/shipin-cinematic-studio/backend/src/core/provider-adapters/siliconflow-tts.adapter.ts:77:    return !!process.env.SILICONFLOW_API_KEY

Pattern `process.env\.OPENAI` — 4 hits:

  - /root/shipin-cinematic-studio/backend/src/config/env.ts:42:process.env.OPENAI_API_KEY = env.OPENAI_API_KEY
  - /root/shipin-cinematic-studio/backend/src/routes/system-health.ts:21:        openaiApiKey: mask(process.env.OPENAI_API_KEY),
  - /root/shipin-cinematic-studio/backend/src/routes/system-health.ts:146:    if (process.env.OPENAI_API_KEY) {
  - /root/shipin-cinematic-studio/backend/src/routes/system-health.ts:147:      results.push(await testProvider('openai', 'OpenAI', 'https://api.openai.com/v1/chat/completions', 'gpt-4o-mini', process.env.OPENAI_API_KEY))

### runtime_deprecated

Pattern `RuntimeContext` — 90 hits:

  - /root/shipin-cinematic-studio/backend/src/plugins/runtime-context.ts:4: * 在每个请求入口创建 RuntimeContext（Execution Envelope）
  - /root/shipin-cinematic-studio/backend/src/routes/images.ts:222:                const ctx = (await import('../services/runtime-context.js')).getRuntimeContext()
  - /root/shipin-cinematic-studio/backend/src/services/volcengine-image.provider.ts:8:import { getRuntimeContext } from './runtime-context.js'
  - /root/shipin-cinematic-studio/backend/src/services/volcengine-image.provider.ts:31:  const ctx = (getRuntimeContext() as any)
  - /root/shipin-cinematic-studio/backend/src/services/siliconflow-tts.provider.ts:47:// 尝试从 RuntimeContext 读用户专属 key
  - /root/shipin-cinematic-studio/backend/src/services/siliconflow-tts.provider.ts:51:    const { getRuntimeContext } = require('./runtime-context.js')
  - /root/shipin-cinematic-studio/backend/src/services/siliconflow-tts.provider.ts:52:    const ctx = getRuntimeContext()
  - /root/shipin-cinematic-studio/backend/src/services/with-user-key.ts:14: * ⚠️ 不再修改 process.env，改为合并到 RuntimeContext
  - /root/shipin-cinematic-studio/backend/src/services/with-user-key.ts:20:import { getRuntimeContext } from './runtime-context.js'
  - /root/shipin-cinematic-studio/backend/src/services/with-user-key.ts:55:  // 合并 secrets 到已有 RuntimeContext
  ... (+80 more)

Pattern `AsyncLocalStorage` — 4 hits:

  - /root/shipin-cinematic-studio/backend/src/services/runtime-context.ts:15:import { AsyncLocalStorage } from 'async_hooks'
  - /root/shipin-cinematic-studio/backend/src/services/runtime-context.ts:75:// ============ AsyncLocalStorage 实例 ============
  - /root/shipin-cinematic-studio/backend/src/services/runtime-context.ts:77:const asyncLocalStorage = new AsyncLocalStorage<RuntimeContext>()
  - /root/shipin-cinematic-studio/backend/src/runtime/with-user-model-config.ts:143:    /* noop — AsyncLocalStorage 自动恢复 */

Pattern `getRuntimeContext` — 55 hits:

  - /root/shipin-cinematic-studio/backend/src/routes/images.ts:222:                const ctx = (await import('../services/runtime-context.js')).getRuntimeContext()
  - /root/shipin-cinematic-studio/backend/src/services/volcengine-image.provider.ts:8:import { getRuntimeContext } from './runtime-context.js'
  - /root/shipin-cinematic-studio/backend/src/services/volcengine-image.provider.ts:31:  const ctx = (getRuntimeContext() as any)
  - /root/shipin-cinematic-studio/backend/src/services/siliconflow-tts.provider.ts:51:    const { getRuntimeContext } = require('./runtime-context.js')
  - /root/shipin-cinematic-studio/backend/src/services/siliconflow-tts.provider.ts:52:    const ctx = getRuntimeContext()
  - /root/shipin-cinematic-studio/backend/src/services/with-user-key.ts:20:import { getRuntimeContext } from './runtime-context.js'
  - /root/shipin-cinematic-studio/backend/src/services/with-user-key.ts:56:  const ctx = getRuntimeContext()
  - /root/shipin-cinematic-studio/backend/src/services/aliyun-video.provider.ts:16:import { getRuntimeContext } from './runtime-context.js'
  - /root/shipin-cinematic-studio/backend/src/services/aliyun-video.provider.ts:21:  const fromCtx = getRuntimeContext()?.secrets?.aliyunApiKey
  - /root/shipin-cinematic-studio/backend/src/services/aliyun-video.provider.ts:31:  return getRuntimeContext()?.secrets?.aliyunVideoModel
  ... (+45 more)


## Runtime Execution Graph Files

239 runtime-related files:

- `bootstrap/determinism-test.ts`
- `bootstrap/preflight/adapters.ts`
- `bootstrap/preflight/db.ts`
- `bootstrap/preflight/providers.ts`
- `bootstrap/preflight/queue.ts`
- `bootstrap/runtime-boot.ts`
- `bootstrap/self-test/mock-runtime.ts`
- `bootstrap/self-test/regression-guard.ts`
- `bootstrap/self-test/runtime-self-test.ts`
- `bootstrap/self-test/test-adapters.ts`
- `bootstrap/self-test/test-providers.ts`
- `bootstrap/self-test/test-queue.ts`
- `bootstrap/self-test/test-runtime.ts`
- `bootstrap/worker-guard.ts`
- `core/agent-graph/agent-edge.ts`
- `core/agent-graph/agent-graph.ts`
- `core/agent-graph/agent-node.ts`
- `core/agent-graph/agent-registry.ts`
- `core/agent-graph/graph-executor.ts`
- `core/agent-graph/graph-scheduler.ts`
- `core/asset-economy/api/asset-economy.routes.ts`
- `core/asset-economy/api/index.ts`
- `core/asset-economy/asset-dna/dna-generator.ts`
- `core/asset-economy/asset-graph/graph-builder.ts`
- `core/asset-economy/attribution-engine/contribution-calc.ts`
- `core/asset-economy/creator-wallet/wallet-manager.ts`
- `core/asset-economy/lineage-engine/lineage-tracker.ts`
- `core/asset-economy/moderation/review-queue.ts`
- `core/asset-economy/revenue-engine/revenue-splitter.ts`
- `core/asset-economy/rights-engine/rights-manager.ts`
- `core/asset-economy/similarity-engine/similarity-scorer.ts`
- `core/asset-economy/transaction-engine/transaction-logger.ts`
- `core/async-runtime/async-executor.ts`
- `core/async-runtime/checkpoint-manager.ts`
- `core/async-runtime/event-bus.ts`
- `core/async-runtime/events/execution-event.ts`
- `core/async-runtime/execution-state-store.ts`
- `core/async-runtime/index.ts`
- `core/async-runtime/resume-engine.ts`
- `core/autonomous/adaptive-cluster-scaler.ts`
- `core/autonomous/execution-pattern.ts`
- `core/autonomous/index.ts`
- `core/autonomous/pattern-learner.ts`
- `core/autonomous/runtime-evolution-engine.ts`
- `core/autonomous/self-optimizing-scheduler.ts`
- `core/backpressure.ts`
- `core/bridge/legacy-provider-bridge.ts`
- `core/bridge/phase1/ab-router.ts`
- `core/bridge/phase1/convergence-controller.ts`
- `core/bridge/phase1/index.ts`
- `core/bridge/phase1/latency-gate.ts`
- `core/bridge/phase1/rollback-engine.ts`
- `core/bridge/phase1/shadow-executor.ts`
- `core/bridge/phase1/validation-harness.ts`
- `core/circuit-breaker.ts`
- `core/cluster/cluster-manager.ts`
- `core/cluster/cluster-node.ts`
- `core/cluster/consistency-manager.ts`
- `core/cluster/distributed-scheduler.ts`
- `core/cluster/heartbeat-service.ts`
- `core/cluster/index.ts`
- `core/cluster/node-registry.ts`
- `core/cluster/task-migrator.ts`
- `core/constraint-physics/feedback-bias.ts`
- `core/constraint-physics/index.ts`
- `core/constraint-physics/slack-engine.ts`
- `core/constraint-physics/types.ts`
- `core/control-plane/backpressure/backpressure.ts`
- `core/control-plane/control-plane.ts`
- `core/control-plane/cutover/execution-cutover.ts`
- `core/control-plane/isolation/execution-context.ts`
- `core/control-plane/queue/execution-queue.ts`
- `core/control-plane/scheduler/scheduler.ts`
- `core/control-plane/stream/stream-controller.ts`
- `core/control-plane/worker-pool/worker-pool.ts`
- `core/cost-guard.ts`
- `core/global/cluster-federation.ts`
- `core/global/cost-based-router.ts`
- `core/global/global-scheduler.ts`
- `core/global/global-state-mesh.ts`
- `core/global/index.ts`
- `core/global/latency-router.ts`
- `core/global/region-router.ts`
- `core/global/region.ts`
- `core/governance/drift-detector.ts`
- `core/governance/evolution-guard.ts`
- `core/governance/index.ts`
- `core/governance/learning-audit-log.ts`
- `core/governance/policy-engine.ts`
- `core/governance/rollback-manager.ts`
- `core/governance/stability-controller.ts`
- `core/job-envelope.ts`
- `core/lifecycle-integration.ts`
- `core/lifecycle-state-machine.ts`
- `core/policy-adapter/fallback-policy.ts`
- `core/policy-adapter/fallback-state-machine.ts`
- `core/policy-adapter/index.ts`
- `core/policy-adapter/policy-adapter.ts`
- `core/policy-adapter/policy-adapter.types.ts`
- `core/policy-signal/index.ts`
- `core/policy-signal/policy-signal.types.ts`
- `core/policy-signal/render-intelligence-adapter.ts`
- `core/provider-adapters/aliyun-image.adapter.ts`
- `core/provider-adapters/aliyun-tts.adapter.ts`
- `core/provider-adapters/aliyun-video.adapter.ts`
- `core/provider-adapters/index.ts`
- `core/provider-adapters/llm-execution.adapter.ts`
- `core/provider-adapters/siliconflow-image.adapter.ts`
- `core/provider-adapters/siliconflow-tts.adapter.ts`
- `core/provider-adapters/video.failure.ts`
- `core/provider-adapters/volcengine-image.adapter.ts`
- `core/provider-adapters/volcengine-tts.adapter.ts`
- `core/provider-adapters/volcengine-video.adapter.ts`
- `core/provider-registry/fallback-resolver.ts`
- `core/provider-registry/index.ts`
- `core/provider-registry/merged-view.ts`
- `core/provider-registry/plugin-registry.ts`
- `core/provider-registry/types.ts`
- `core/provider-wrapper/volcengine/index.ts`
- `core/provider-wrapper/volcengine/volcengine-image.wrapper.ts`
- `core/provider-wrapper/volcengine/volcengine-method-bindings.ts`
- `core/provider-wrapper/volcengine/volcengine-proxy.factory.ts`
- `core/provider-wrapper/volcengine/volcengine-tts.wrapper.ts`
- `core/provider-wrapper/volcengine/volcengine-video.wrapper.ts`
- `core/rate-limiter.ts`
- `core/runtime/capabilities.ts`
- `core/runtime/runtime-dispatcher.ts`
- `core/runtime/user-instance-registry.ts`
- `core/stream-plane/index.ts`
- `core/stream-plane/planes.ts`
- `core/stream-plane/stream-chunk.ts`
- `core/stream-plane/stream-event-bus.ts`
- `core/stream-plane/stream-plane.ts`
- `core/style-evolution/index.ts`
- `core/style-evolution/style-divergence-controller.ts`
- `core/style-evolution/style-memory-graph.ts`
- `core/style-evolution/style-vectorizer.ts`
- `core/style-evolution/types.ts`
- `core/verification/execution-plane/adapter-coverage-mapper.ts`
- `core/verification/execution-plane/index.ts`
- `core/verification/execution-plane/runtime-call-tracer.ts`
- `core/verification/execution-plane/static-path-scanner.ts`
- `core/verification/execution-plane/violation-reporter.ts`
- `governance/audit-log.ts`
- `governance/audit/execution-audit.ts`
- `governance/change-rate-limiter.ts`
- `governance/cost/cost-controller.ts`
- `governance/dag/execution-dag.ts`
- `governance/governance-controller.ts`
- `governance/governance-gate.ts`
- `governance/init-governance.ts`
- `governance/optimization-budget.ts`
- `governance/rate-limit/runtime-rate-limit.ts`
- `governance/rollback-manager.ts`
- `governance/system-health.ts`
- `governance/system-policy.ts`
- `governance/tenant/tenant-isolation.ts`
- `kernel/dag/execution-dag.ts`
- `kernel/distributed/worker-consistency.ts`
- `kernel/event-sourcing/execution-event-store.ts`
- `kernel/init-kernel.ts`
- `kernel/replay/deterministic-executor.ts`
- `kernel/replay/execution-replay.ts`
- `model-adapters/images/dalle-image.adapter.ts`
- `model-adapters/images/index.ts`
- `model-adapters/images/qwen-image.adapter.ts`
- `model-adapters/images/seedream-image.adapter.ts`
- `model-adapters/images/siliconflow-image.adapter.ts`
- `model-adapters/images/wan-image.adapter.ts`
- `model-adapters/index.ts`
- `model-adapters/llm/aliyun-llm.adapter.ts`
- `model-adapters/llm/index.ts`
- `model-adapters/llm/openai-compat.adapter.ts`
- `model-adapters/llm/volcengine-llm.adapter.ts`
- `model-adapters/registry.ts`
- `model-adapters/tts/aliyun-tts.adapter.ts`
- `model-adapters/tts/index.ts`
- `model-adapters/tts/siliconflow-tts.adapter.ts`
- `model-adapters/tts/volcengine-tts.adapter.ts`
- `model-adapters/types.ts`
- `model-adapters/video/aliyun-video.adapter.ts`
- `model-adapters/video/index.ts`
- `model-adapters/video/volcengine-video.adapter.ts`
- `queue/capability-dispatcher.ts`
- `queue/job-events.ts`
- `queue/mock-provider.ts`
- `queue/queue-manager.ts`
- `queue/redis.ts`
- `queue/task-queue.ts`
- `queue/worker-runtime.ts`
- `runtime/assert-runtime-integrity.ts`
- `runtime/asset-state-audit.ts`
- `runtime/asset-state-guard.ts`
- `runtime/asset-state-machine.ts`
- `runtime/asset-state-transition.ts`
- `runtime/asset-status.enum.ts`
- `runtime/build-runtime-payload.ts`
- `runtime/degrade-engine.ts`
- `runtime/execution-guard.ts`
- `runtime/executors/base-llm.executor.ts`
- `runtime/executors/base.executor.ts`
- `runtime/executors/executor.registry.ts`
- `runtime/executors/image-gen.executor.ts`
- `runtime/executors/image-prompt.executor.ts`
- `runtime/executors/prompt-builder.executor.ts`
- `runtime/executors/script-writer.executor.ts`
- `runtime/executors/shot-split.executor.ts`
- `runtime/executors/storyboard.executor.ts`
- `runtime/graph/execution-graph.ts`
- `runtime/index.ts`
- `runtime/kernel/drift-engine.ts`
- `runtime/kernel/state-reconstructor.ts`
- `runtime/kernel/verifier.ts`
- `runtime/narrative-gateway.ts`
- `runtime/pipeline-executor.ts`
- `runtime/pipeline/PipelineAdapter.ts`
- `runtime/provider-middleware.ts`
- `runtime/providers/base.provider.ts`
- `runtime/providers/deepseek.provider.ts`
- `runtime/providers/image.base.provider.ts`
- `runtime/providers/openai.provider.ts`
- `runtime/providers/provider.registry.ts`
- `runtime/providers/replicate.image.provider.ts`
- `runtime/resolveRuntimeConfig.ts`
- `runtime/runtime-contract.ts`
- `runtime/runtime-gate.ts`
- `runtime/runtime-gateway.ts`
- `runtime/runtime-guard.ts`
- `runtime/runtime-payload.ts`
- `runtime/task-stream.ts`
- `runtime/trace/runtime-trace.ts`
- `runtime/validate-runtime.ts`
- `runtime/with-user-model-config.ts`
- `truth/arbitration-engine.ts`
- `truth/consensus-engine.ts`
- `truth/init-truth.ts`
- `truth/scoring-engine.ts`
- `truth/store/truth-store.ts`
- `truth/truth-model.ts`

## Build Errors

**Total type errors:** 295

```
src/agents/aigc-orchestrator.ts(445,26): error TS2304: Cannot find name 'frameDesign'.
src/agents/portrait-prompt.agent.ts(132,45): error TS2345: Argument of type '(v: string) => string' is not assignable to parameter of type '(value: unknown, index: number, array: unknown[]) => string'.
src/core/provider-adapters/siliconflow-image.adapter.ts(22,5): error TS18004: No value exists in scope for the shorthand property 'model'. Either declare one or provide an initializer.
src/core/provider-adapters/siliconflow-image.adapter.ts(34,31): error TS2304: Cannot find name 'baseUrl'.
src/core/provider-adapters/siliconflow-image.adapter.ts(36,79): error TS2304: Cannot find name 'apiKey'.
src/core/verification/execution-plane/adapter-coverage-mapper.ts(43,17): error TS2339: Property 'TTS' does not exist on type 'typeof Capability'.
src/core/verification/execution-plane/index.ts(5,29): error TS2724: '"./static-path-scanner.js"' has no exported member named 'StaticPathScanner'. Did you mean 'staticPathScanner'?
src/core/verification/execution-plane/index.ts(6,29): error TS2724: '"./runtime-call-tracer.js"' has no exported member named 'RuntimeCallTracer'. Did you mean 'runtimeCallTracer'?
src/core/verification/execution-plane/index.ts(7,33): error TS2724: '"./adapter-coverage-mapper.js"' has no exported member named 'AdapterCoverageMapper'. Did you mean 'adapterCoverageMapper'?
src/core/verification/execution-plane/index.ts(8,29): error TS2724: '"./violation-reporter.js"' has no exported member named 'ViolationReporter'. Did you mean 'violationReporter'?
src/director-v2/cinematic-compiler/cinematic-compiler.ts(13,30): error TS2305: Module '"../render/backends/execution-plan.js"' has no exported member 'ShotPlan'.
src/director-v2/cinematic-compiler/cinematic-compiler.ts(517,30): error TS2339: Property 'shots' does not exist on type 'ExecutionPlan'.
src/director-v2/cinematic-compiler/cinematic-compiler.ts(521,31): error TS7006: Parameter 'shot' implicitly has an 'any' type.
src/director-v2/cinematic-compiler/cinematic-compiler.ts(521,37): error TS7006: Parameter 'i' implicitly has an 'any' type.
src/director-v2/cinematic-compiler/cinematic-compiler.ts(531,30): error TS7006: Parameter 'shot' implicitly has an 'any' type.
src/director-v2/compat/director-adapter.ts(216,19): error TS2304: Cannot find name 'T'.
src/director-v2/compat/director-adapter.ts(217,15): error TS2304: Cannot find name 'T'.
src/director-v2/constitution-compiler.ts(32,34): error TS2724: '"./schema/story-constitution.js"' has no exported member named 'StoryConstitutionFields'. Did you mean 'StoryConstitution'?
src/director-v2/constitution-compiler.ts(173,9): error TS2741: Property 'confidence' is missing in type '{ constitution: StoryConstitution; actions: never[]; }' but required in type 'RepairResult'.
src/director-v2/constitution-compiler.ts(196,9): error TS2322: Type '"skeleton"' is not assignable to type '"schema_validation" | "llm_call" | "normalization" | "semantic_repair"'.
src/director-v2/constitution-compiler.ts(213,11): error TS2741: Property 'confidence' is missing in type '{ constitution: StoryConstitution; actions: never[]; }' but required in type 'RepairResult'.
src/director-v2/constitution-compiler.ts(293,11): error TS2322: Type '"enrichment"' is not assignable to type '"schema_validation" | "llm_call" | "normalization" | "semantic_repair"'.
src/director-v2/constitution-compiler.ts(338,11): error TS2322: Type '"drift_detector"' is not assignable to type '"schema_validation" | "llm_call" | "normalization" | "semantic_repair"'.
src/director-v2/constitution-compiler.ts(372,9): error TS2322: Type '"enrichment"' is not assignable to type '"schema_validation" | "llm_call" | "normalization" | "semantic_repair"'.
src/director-v2/constitution-compiler.ts(389,11): error TS2741: Property 'confidence' is missing in type '{ constitution: StoryConstitution; actions: never[]; }' but required in type 'RepairResult'.
src/director-v2/diagnostics/director-field.ts(718,7): error TS2322: Type '{ admissibleRange: [number, number]; anchorStrength?: number | undefined; signConstraint: "negative"; } | { admissibleRange: [number, number]; anchorStrength?: number | undefined; signConstraint: "any" | "positive"; } | ... 6 more ... | { ...; }' is not assignable to type 'never'.
src/director-v2/diagnostics/system-diagnostics.ts(148,56): error TS2339: Property '__type' does not exist on type 'SystemDiagnosticsReport'.
src/director-v2/memory/constitution-store.ts(10,50): error TS2307: Cannot find module './constitution-fingerprint.js' or its corresponding type declarations.
src/director-v2/memory/constitution-store.ts(84,9): error TS2322: Type 'Record<string, unknown>' is not assignable to type 'JsonNull | InputJsonValue'.
src/director-v2/memory/director-memory.ts(100,9): error TS2322: Type 'Record<string, unknown>' is not assignable to type 'JsonNull | InputJsonValue'.
... (+265 more)
```

## Type Drift Analysis

- LLM / Provider layer: 52 errors
- Prisma / DB layer: 47 errors
- Director-v2 layer: 86 errors
- Worker / Queue layer: 17 errors
- Other: 93 errors

## Fallback / Default Chain Analysis

Pattern `fallback` or `default` in runtime code:


## Summary

- New constitutional system: ~4007 lines (3%)
- Legacy core areas (control-plane/autonomous/bridge/cluster/global): ~0 lines (0%)
- Pre-existing type errors: 295 (all non-blocking)
- Legacy runtime directories: 2