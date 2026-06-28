# 系统流程文档 — 视频影像工作室

> 项目根目录：`/root/shipin-cinematic-studio/`
> 更新时间：2026-05-20

---

## 1. 系统架构

### 1.1 整体架构

| 层级 | 技术栈 | 端口 | 入口文件 |
|------|--------|------|----------|
| 后端 | **Fastify** + **Prisma** + **PM2 cluster** | `4002` | `backend/src/index.ts` |
| 前端 | **Nuxt 3** + **Pinia** + **SSG** | `4001` | `frontend/nuxt.config.ts`, `frontend/app.vue` |
| 数据库 | **PostgreSQL** (via Prisma ORM) | — | `backend/prisma/schema.prisma` |
| AI 网关 | **narrative-gateway.ts** 统一调用阿里百炼/火山引擎 | — | `backend/src/runtime/narrative-gateway.ts` |
| 域名 | `aigc.fushtn.com` | — | 配置在 `env.ts` 中 `PUBLIC_DOMAIN` |

### 1.2 后端启动（PM2）

PM2 配置位于 `backend/ecosystem.config.cjs`:

```javascript
module.exports = {
  apps: [{
    name: 'api-server-aigc',
    script: './dist/index.js',
    instances: 1,
    exec_mode: 'cluster',
    env: { PORT: '4002' /* ... */ }
  }]
}
```

- **端口**: Fastify 监听 `4002` 端口
- **Cluster 模式**: PM2 单实例 cluster
- **入口**: `backend/src/index.ts` — 加载 Fastify 实例、注册 `jwt`/`multipart` 插件、导入所有路由

### 1.3 前端构建

- **SSR 关闭** (`ssr: false`) — Nuxt 作为纯 SPA 构建
- **Nitro preset**: `node-server`，部署为 node 服务
- **API 代理**: Nuxt 配置 proxy `http://localhost:4002/api/runtime/**` → 后端 4002 端口
- **输出目录**: `frontend/.output/`

### 1.4 AI 网关

- `backend/src/runtime/narrative-gateway.ts` — **NarrativeLLMGateway** 类
- 封装：O11y (tracing + metrics)、Policy Engine (timeout + retry + circuit breaker)、Router (provider list + fallback chain)、Fallback Layer、Async Degrade Mode、Response Normalizer
- 核心方法：`gateway.execute(request: GatewayRequest): GatewayResponse`
- 支持 `timeoutTier`: `'fast' | 'normal' | 'batch'`
- 路径：`backend/src/runtime/providers/` 下面的 Provider 实现：
  - `base.provider.ts` — LLMProvider 接口
  - `deepseek.provider.ts`
  - `openai.provider.ts`
  - `provider.registry.ts` — 注册与发现

---

## 2. 认证系统

### 2.1 后端认证路由

**文件**: `backend/src/routes/auth.ts`

| 端点 | 方法 | 功能 | 认证 |
|------|------|------|------|
| `/api/auth/register` | POST | 邮箱或手机号注册 | — |
| `/api/auth/login` | POST | 邮箱登录 | — |
| `/api/auth/refresh` | POST | 刷新 token | — |
| `/api/auth/me` | GET | 获取当前用户信息 | JWT (`fastify.authenticate`) |
| `/api/auth/user-by-email` | GET | 通过邮箱查询用户（公开） | — |
| `/api/auth/plans` | GET | 套餐列表 | JWT |

**登录流程**:
1. `POST /api/auth/login` → `authService.login(email, password, fastify)`
2. 返回 `{ accessToken, user }`
3. JWT 通过 `@fastify/jwt` 签发，payload 包含 `{ id, email }`

**注册流程**:
1. `POST /api/auth/register` — 支持邮箱/手机号注册
2. 密码 bcrypt hash 存储
3. 自动创建 `membership`（`{ tier: 'free' }`）
4. 赠送注册积分（邮箱 10 积分，手机号 58 积分）
5. 返回 `{ accessToken, user }`

**认证中间件**: `backend/src/plugins/auth.ts` + `backend/src/plugins/cors.ts`（注册 `fastify.authenticate`）

### 2.2 前端登录页面

**文件**: `frontend/pages/login.vue`

- 登录/注册双模式切换（URL `?register=1` 直接显示注册）
- 调用 `authStore.login(email, password)`
- 登录成功后跳转 `?redirect=` 参数或默认 `/studio/production`
- 支持邮箱注册

### 2.3 Auth Store

**文件**: `frontend/stores/auth.ts`

```typescript
export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: string,
    user: { id, username, email, coins, memberTier } | null,
  }),
  actions: {
    login(email, password) → fetch('/api/auth/login')
    logout()
    fetchMe() → GET /api/auth/me
    restoreSession() — 从 cookie/localStorage 恢复
  }
})
```

- Token 持久化到 `cookie`（`auth_token`）+ `localStorage`
- 用户信息同样持久化

### 2.4 前端路由中间件

**文件**: `frontend/middleware/auth.ts`

- 保护 `/studio/*`, `/dashboard/*`, `/user/*` 路径
- 跳过 `/login` 路径
- 未认证时先尝试 `authStore.restoreSession()`
- 仍无 token 则 `navigateTo('/login?redirect=')` 跳转

---

## 3. 工作台流程（核心用户路径）

### 3.1 阶段 1：剧本输入

**前端组件**: `frontend/components/studio/execution/ScriptInput.vue`

**页面**: `pages/studio/index.vue` → 重定向到 `/studio/production`

**流程**:
1. 用户输入剧本标题 + 剧本正文
2. 支持上传 `.txt`/`.md` 文件、模板选择
3. 点击「AI 拆解剧本」按钮

**调用路径**:
- `POST /api/v1/script/parse` — 后端 `routes/script-submit.ts`
- 传入 `{ title, script, aspectRatio, visualStyle }`
- 只跑**剧情总指挥 Agent**（`section: 'supervisor'`），输出剧情蓝图
- 后端调用 `aigcOrchestrator.generate({ section: 'supervisor' })`
- 返回 `{ success, data, meta, projectId }`

**后端路由**: `backend/src/routes/script-submit.ts`

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/script/submit` | POST | 多 Agent 全流程并行分析（旧接口） |
| `/api/v1/script/parse` | POST | V1 兼容接口，仅跑剧情总指挥（快速模式） |
| `/api/script/regenerate` | POST | 重新生成单项（`section: character/scene/storyboard/voice/video/props`） |

### 3.2 阶段 2：角色设计

**前端组件**: `frontend/components/studio/execution/CharacterCreation.vue`

**功能**:
- 每个角色卡显示：姓名、性别、年龄、外貌描述、服装、道具、性格、imagePrompt、negativePrompt
- 卡片可折叠/展开
- 支持参考图上传（换脸）、作品宇宙引用

**AI 补全/优化**:
- **单卡「🔄 补全角色细节」**: `POST /api/script/regenerate` (section: character) — 调用 `aigcOrchestrator.generate({ section: 'character' })`
- **优化提示词「🔄 重新构思」**: `POST /api/v1/narrative/regen-spec` (type: character) — 带剧本原文 + 影视导演身份

**角色形象生成**:
- 调用 `POST /api/model-providers` 获取可用模型列表
- `POST /api/execution-images/characters` — 保存生成的图片
- 支持文生图/图生图模式切换、模型选择

### 3.3 阶段 3：场景设计

**前端组件**: `frontend/components/studio/execution/SceneGeneration.vue`

**功能**:
- 每个场景卡片显示：场景名、描述、画幅比例、imagePrompt
- 场景图生成展示

**优化 prompt**:
- **单卡「✨ 优化提示词」**: `POST /api/v1/narrative/regen-spec` (type: scene)
- **批量「全部优化提示词」**: 循环调用 `POST /api/v1/narrative/regen-spec` (type: scene)
- 带剧本原文 + 影视导演身份
- 场景 prompt 使用**表格化格式**（景别构图、环境描述、光线色调等），禁止出现人物

### 3.4 阶段 4：分镜/视频设计

**分镜组件**: `frontend/components/studio/execution/StoryboardProduction.vue`
**视频组件**: `frontend/components/studio/execution/DirectorStudio.vue`

**分镜流程**:
- 每个段落卡片展示：关联场景、镜头手法、时长、景别/角度/光线/AIGC 规格
- `POST /api/v1/narrative/storyboard-prompt` — 生成标准分镜图 prompt
  - 传入完整上下文：标题、narrativePurpose、shotPattern、emotionArc、角色、场景、aigcSpec、rawScript、前后段落、特效/运镜/情绪规格
  - 返回 `{ prompt, negativePrompt }`
- `POST /api/v1/narrative/regen-spec` (type: storyboard) — 分镜 prompt 优化

**视频 prompt 优化**:
- `POST /api/v1/optimize-video-prompts` — 后端 `routes/optimize-video-prompt.ts`
  - 读取 Prisma 中 `AiVideoSegment`、`AiFrameDesign`、`AiVideoProduction`
  - 组装 contextJson 调用 `narrativeGateway.execute()`（prompt: `video-prompt-optimizer.txt`）
  - 返回 200-500 字详细视频描述 prompt

**视频生成流程**:
1. 出图（角色图/场景图/首尾帧/分镜图）
2. 首帧图 + 视频 prompt → wan2.7-i2v 图生视频
3. 多段视频 + 音频合成最终成品

### 3.5 阶段 5：图片生成

**后端路由**: `backend/src/routes/images.ts`

| 端点 | 方法 | 功能 |
|------|------|------|
| `/images/generate` | POST | 通用图片生成（动态选择 Provider） |
| `/videos/generate` | POST | 视频生成（火山引擎 Seedance） |
| `/images/save` | POST | 保存生成的图片到项目 |
| `/images/character` | — | 角色图相关（通过 execution-images 路由处理） |
| `/images/scene` | — | 场景图相关 |
| `/images/storyboard` | — | 分镜图相关 |
| `/execution-images/characters/:projectId` | GET | 获取项目角色图 |
| `/execution-images/scenes/:projectId` | GET | 获取项目场景图 |

**图片 Provider 适配器模式**:

| Provider | 文件 | 说明 |
|----------|------|------|
| 阿里百炼 | `backend/src/services/aliyun-image.provider.ts` | wan2.7-image-pro / wanx2.1-t2i-turbo |
| 火山引擎 | `backend/src/services/volcengine-image.provider.ts` | Seedream 文生图 |
| 硅基流动 | `backend/src/routes/images.ts` (内联) | FLUX.1-dev / 图生图 |
| 通用适配器 | `backend/src/core/provider-adapters/aliyun-image.adapter.ts` | |
| 通用适配器 | `backend/src/core/provider-adapters/volcengine-image.adapter.ts` | |
| 通用适配器 | `backend/src/core/provider-adapters/siliconflow-image.adapter.ts` | |

**图片存储**: MinIO 对象存储（配置在 `env.ts` — `MINIO_ENDPOINT`, `MINIO_BUCKET: 'aigc-assets'`）

### 3.6 阶段 6：TTS 配音

**Provider**: `backend/src/services/aliyun-tts.provider.ts`

**模型**:
- `qwen3-tts-flash` — 女声（Cherry）
- `qwen3-tts-instruct-flash` — 男声（Cherry + instructions 描述男声）

**API**: 同步 HTTP API，超时 120s

**音色映射**:
- 女声音色: Cherry, Stella
- 男声音色通过 `zh_male_deep/warm/calm/cheerful/young/authoritative` 等标识符选择 → 映射到 qwen3-tts-instruct-flash

**TTS 路由**: `backend/src/routes/tts.ts`

**其他 TTS Provider**:
- `backend/src/services/volcengine-tts.provider.ts` — 火山引擎 TTS
- `backend/src/services/siliconflow-tts.provider.ts` — 硅基流动 TTS
- `backend/src/core/provider-adapters/aliyun-tts.adapter.ts`
- `backend/src/core/provider-adapters/volcengine-tts.adapter.ts`
- `backend/src/core/provider-adapters/siliconflow-tts.adapter.ts`

### 3.7 阶段 7：视频合成

**后端视频 Provider**: `backend/src/services/aliyun-video.provider.ts`

**模型**: `wan2.7-i2v` / `wan2.7-t2v`（阿里百炼通义万相）

**流程**:
1. 首帧图 + 视频 prompt → 图生视频（异步任务模式）
2. 创建任务 → `POST https://dashscope.aliyuncs.com/compatible-mode/v1/images/generations` (OpenAI 兼容格式)
3. 轮询结果: `GET /videos/status/:taskId`
4. 多段视频打包下载: `GET /videos/download-all/:projectId`

**其他视频 Provider**:
- `backend/src/services/volcengine-video.provider.ts` — 火山引擎 Seedance
- `backend/src/core/provider-adapters/aliyun-video.adapter.ts`
- `backend/src/core/provider-adapters/volcengine-video.adapter.ts`
- `backend/src/production-loop/video/bailian.video.ts`
- `backend/src/production-loop/video/volcengine.video.ts`
- `backend/src/production-loop/video/video-provider.ts`

---

## 4. Agent 系统

### 4.1 Orchestrator

**文件**: `backend/src/agents/aigc-orchestrator.ts`

**类**: `AigcSpecOrchestrator`

**核心方法**: `generate(input: AigcSpecInput): { success, data, meta }`

**编排流程**:
```
Phase 0: 剧情总指挥 → 输出剧情蓝图
  ↓
Phase 1: 角色设计师 ── 场景设计师（并行，带剧情蓝图）
  ↓
Phase 2: 声音设计师 ── 画面设计师（并行，依赖角色+场景+蓝图）
  ↓
Phase 3: 道具设计师（依赖角色+场景+蓝图）
  ↓
Phase 4: 镜头/特效师（依赖前面全部）
  ↓
合并输出 → action-optimizer 逐段优化（通过 CinematicIR）
```

### 4.2 Agent 列表

| Agent | prompt 文件 | outputKey | 路由名 |
|-------|-------------|-----------|--------|
| 剧情总指挥 | `plot-supervisor.txt` | `plotBlueprint` | `supervisor` |
| 角色设计师 | `character-designer.txt` | `characterSpecs` | `character` |
| 场景设计师 | `scene-designer.txt` | `sceneSpecs` | `scene` |
| 声音设计师 | `sound-designer.txt` | `voiceConfigs` | `voice` |
| 画面设计师 | `frame-designer.txt` | `frameDesign` | `storyboard` / `video` |
| 道具设计师 | `props-designer.txt` | `propSpecs` | `props` |
| 镜头/特效师 | `director-of-photography.txt` | `effectSpecs` | — |
| 动作优化 | `action-optimizer.txt` | (用于逐段动作优化) | — |
| 视频 prompt 优化 | `video-prompt-optimizer.txt` | (用于 optimize-video-prompts) | — |

所有 prompt 文件位于: `backend/src/prompts/agents/`

### 4.3 Section 模式

通过 `input.section` 参数支持只重新生成单个 Agent 的输出，不做全量编排。

```typescript
const sectionAgentMap = {
  supervisor: 0, character: 1, scene: 2,
  voice: 3, storyboard: 4, video: 4,
  props: 5
}
```

### 4.4 regen-spec 接口

**后端路由**: `backend/src/routes/narrative-llm.ts` — `POST /api/v1/narrative/regen-spec`

支持所有类型优化:
- `type: 'character'` — 角色 imagePrompt 优化（角色卡：表格化格式，纯白背景全身，时代风格字段）
- `type: 'scene'` — 场景 imagePrompt 优化（表格化格式，禁止出现人物）
- `type: 'storyboard'` — 分镜 prompt 优化（流畅画面描述，150-300字）
- `type: 'voice'` — 音色推荐（voiceType/speakingStyle/pitch/speed）

**请求体**:
```json
{
  "type": "character | scene | storyboard | voice",
  "data": { /* 原始规格数据 */ },
  "context": { "storyText": "...", "projectName": "...", "aspectRatio": "..." }
}
```

### 4.5 AIGC Spec Agent

**文件**: `backend/src/agents/aigc-spec-agent.ts`

支持 `regenerateType()` 方法：`POST /api/v1/narrative/regen-agent`

---

## 5. 模型/厂商

### 5.1 LLM 模型

| 厂商 | API Key 环境变量 | 默认模型 | Provider 文件 |
|------|-----------------|----------|---------------|
| 阿里百炼 | `ALIYUN_API_KEY` | qwen3.6-max-preview | `services/aliyun-llm.provider.ts` |
| 火山引擎 | `VOLCENGINE_API_KEY` | doubao-seed-2-0-mini-260428 | `runtime/providers/deepseek.provider.ts`（兼容） |

- 用户可 **BYO API Key**（通过 `UserModelConfig` 表配置）
- 后端通过 `runtime/with-user-model-config.ts` + `services/user-model-resolver.ts` 动态切换用户 Key
- Cloud LLM 调用通过 `narrative-gateway.ts` 统一路由

### 5.2 图片模型

| 厂商 | 默认模型 | Provider 文件 |
|------|---------|---------------|
| 阿里百炼 | `wan2.7-image-pro` / `wanx2.1-t2i-turbo` | `services/aliyun-image.provider.ts` |
| 火山引擎 | `doubao-seedream-4-0-250828` | `services/volcengine-image.provider.ts` |
| 硅基流动 | `black-forest-labs/FLUX.1-dev` | 内联于 `routes/images.ts` |

**适配器模式**: 通过 `core/provider-adapters/` 目录下的适配器文件支持统一的图片生成接口：
- `aliyun-image.adapter.ts`
- `volcengine-image.adapter.ts`
- `siliconflow-image.adapter.ts`

**动态选择**: `getImageProviderAndModel(mode?, userId?)` 函数按优先级：用户 BYOK > 阿里百炼 > 火山引擎

### 5.3 视频模型

| 厂商 | 默认模型 | Provider 文件 |
|------|---------|---------------|
| 阿里百炼 | `wan2.7-t2v` / `wan2.7-i2v`（图生视频） | `services/aliyun-video.provider.ts` |
| 火山引擎 | `doubao-seedance-1-5-pro-251215` | `services/volcengine-video.provider.ts` |

**阿里百炼视频流程**:
- 图生视频：首帧图 + prompt → 异步任务创建
- 轮询任务状态：`GET /videos/status/:taskId`
- 端点：`https://dashscope.aliyuncs.com/compatible-mode/v1/images/generations`

### 5.4 TTS 模型

| 厂商 | 模型 | 说明 |
|------|------|------|
| 阿里百炼 | `qwen3-tts-flash` | 女声 Cherry/Stella，同步 API |
| 阿里百炼 | `qwen3-tts-instruct-flash` | 男声（通过 instructions），超时 120s |
| 火山引擎 | — | `services/volcengine-tts.provider.ts` |
| 硅基流动 | — | `services/siliconflow-tts.provider.ts` |

### 5.5 BYO API Key 配置

**数据库表**: `UserModelConfig`（Prisma model）

用户可以自主配置各厂商 API Key 和模型选择，涵盖：阿里云、火山引擎、DeepSeek、OpenAI、自定义端点。

---

## 6. 数据库模型

### 6.1 核心表

**Prisma schema 文件**: `backend/prisma/schema.prisma`

**用户与项目**:
```
User (1) ──→ Project (N)
├─ memberships (Membership)
├─ modelConfigs (UserModelConfig)
├─ apiKeys (UserApiKey)
└─ dailyUsage (DailyUsage)
```

**Project 关联的 AIGC 数据**:
```
Project (1) ──→ AiCharacterSpec (N)  — 角色设计规格
Project (1) ──→ AiSceneSpec (N)      — 场景设计规格
Project (1) ──→ AiVoiceConfig (N)    — 音色配置
Project (1) ──→ AiVideoSegment (N)   — 视频段落规划
Project (1) ──→ AiFrameDesign (N)    — 首尾帧设计
Project (1) ──→ AiVideoProduction (1)— 视频总设置
Project (1) ──→ AiEffectSpec (N)     — 特效规范
Project (1) ──→ AiActionSpec (N)     — 动作规范
Project (1) ──→ AiCameraSpec (N)     — 运镜规范
Project (1) ──→ AiEmotionSpec (N)    — 情绪规范
Project (1) ──→ Storyboard (N)       — 分镜表
Project (1) ──→ VideoTask (N)        — 视频生成任务
Project (1) ──→ CharacterProfile (N) — 角色档案（旧的）
Project (1) ──→ SceneProfile (N)     — 场景档案（旧的）
Project (1) ──→ ExportTask (N)       — 导出任务
```

### 6.2 关键表字段

**User**:
- `id` (uuid), `email` (unique), `username` (unique), `passwordHash`, `phone` (unique), `phoneVerified`
- `coins` (Int), `memberTier` (String, default "free"), `memberExpiresAt`

**UserModelConfig**（BYO API Key）:
- `userId`, `provider` (aliyun\|volcengine\|deepseek\|openai\|custom)
- `apiKey`, `baseUrl`
- `llmModel`, `llmEnabled`
- `imageModel` (default "wan2.7-image-pro"), `imageEnabled`
- `videoModel` (default "wan2.7-t2v"), `videoEnabled`
- `ttsModel` (default "cosyvoice-v3.5-plus"), `ttsEnabled`

**AiCharacterSpec**:
- `projectId`, `characterName`, `gender`, `age`, `physicalDescription`, `clothing`
- `imagePrompt`, `negativePrompt`, `referenceImageUrl`, `confirmed`, `sortOrder`

**AiSceneSpec**:
- `projectId`, `sceneId`, `sceneName`, `description`
- `imagePrompt`, `negativePrompt`, `aspectRatio`, `confirmed`, `sortOrder`

**AiVideoSegment**:
- `projectId`, `segmentId`, `title`, `associatedScenes`
- `duration`, `narrativePurpose`, `shotPattern`, `emotionArc`, `backgroundMusic`
- `videoUrl` (生成的视频 URL), `confirmed`, `sortOrder`

**AiFrameDesign**:
- `projectId`, `segmentId`
- `firstFrameDesc`, `firstFramePrompt`, `firstFrameAngle`
- `lastFrameDesc`, `lastFramePrompt`, `lastFrameAngle`

**AiVideoProduction**:
- `projectId` (unique), `overallStyle`, `fps`, `resolution`, `colorPalette`, `transitionStyle`, `subtitleStyle`

**Storyboard**:
- `projectId`, `shotIndex`, `duration`, `shotType`, `subject`, `action`, `expression`
- `cameraMovement`, `lens`, `lighting`, `emotion`, `environment`, `cinematicStyle`
- `storyboardImage`, `negativePrompt`

**VideoTask**:
- `projectId`, `storyboardId`, `status` (queued\|processing\|...\|completed\|failed)
- `progress`, `error`, `retryCount`, `maxRetries`, `taskType`
- `scheduledFor`, `completedAt`

### 6.3 辅助表

- **EmailCode** — 邮箱验证码
- **SmsCode** — 短信验证码
- **ModelProvider** — 模型提供商元数据
- **Model** — 具体模型定义
- **Captcha** — 图形验证码
- **VoicePreset** — 自定义音色预设
- **Asset** — 资源（图片/视频/音频）
- **CharacterImage, SceneImage, StoryboardImage, PropImage, FrameImage** — 各类型生成图片
- **ExportTask** — 导出打包任务
- **PipelineStage, PipelineJob** — 工作流阶段/任务记录

---

## 附录 A：API 路由汇总

### 认证
| 端点 | 文件 |
|------|------|
| `POST /api/auth/register` | `routes/auth.ts` |
| `POST /api/auth/login` | `routes/auth.ts` |
| `POST /api/auth/refresh` | `routes/auth.ts` |
| `GET /api/auth/me` | `routes/auth.ts` |
| `GET /api/auth/user-by-email` | `routes/auth.ts` |
| `GET /api/auth/plans` | `routes/auth.ts` |

### 剧本/Agent
| 端点 | 文件 |
|------|------|
| `POST /api/script/submit` | `routes/script-submit.ts` |
| `POST /api/v1/script/parse` | `routes/script-submit.ts` |
| `POST /api/script/regenerate` | `routes/script-submit.ts` |

### Narrative LLM
| 端点 | 文件 |
|------|------|
| `POST /api/v1/narrative/analyze` | `routes/narrative-llm.ts` |
| `POST /api/v1/narrative/simple-parse` | `routes/narrative-llm.ts` |
| `POST /api/v1/narrative/aigc-spec` | `routes/narrative-llm.ts` |
| `POST /api/v1/narrative/storyboard-prompt` | `routes/narrative-llm.ts` |
| `POST /api/v1/narrative/regen-spec` | `routes/narrative-llm.ts` |
| `POST /api/v1/narrative/regen-agent` | `routes/narrative-llm.ts` |

### 图片/视频
| 端点 | 文件 |
|------|------|
| `POST /images/generate` | `routes/images.ts` |
| `POST /videos/generate` | `routes/images.ts` |
| `POST /images/save` | `routes/images.ts` |
| `GET /videos/status/:taskId` | `routes/images.ts` |
| `GET /videos/download-all/:projectId` | `routes/images.ts` |
| `GET /execution-images/characters/:projectId` | `routes/execution-images.ts` |
| `GET /execution-images/scenes/:projectId` | `routes/execution-images.ts` |
| `POST /api/v1/optimize-video-prompts` | `routes/optimize-video-prompt.ts` |

## 附录 B：关键文件路径索引

| 文件 | 说明 |
|------|------|
| `backend/src/index.ts` | Fastify 应用入口 |
| `backend/ecosystem.config.cjs` | PM2 集群配置 |
| `backend/prisma/schema.prisma` | 数据库 schema |
| `backend/src/config/env.ts` | 环境变量配置 |
| `backend/src/runtime/narrative-gateway.ts` | AI 网关核心 |
| `backend/src/agents/aigc-orchestrator.ts` | Agent 编排引擎 |
| `backend/src/agents/aigc-spec-agent.ts` | Agent 规格重生成 |
| `backend/src/prompts/agents/` | Agent 系统提示词 |
| `backend/src/routes/auth.ts` | 认证路由 |
| `backend/src/routes/script-submit.ts` | 剧本提交路由 |
| `backend/src/routes/narrative-llm.ts` | Narrative LLM 路由 |
| `backend/src/routes/images.ts` | 图片/视频生成路由 |
| `backend/src/routes/optimize-video-prompt.ts` | 视频 prompt 优化 |
| `backend/src/services/aliyun-image.provider.ts` | 阿里云图片 |
| `backend/src/services/aliyun-tts.provider.ts` | 阿里云 TTS |
| `backend/src/services/aliyun-video.provider.ts` | 阿里云视频 |
| `backend/src/services/volcengine-image.provider.ts` | 火山引擎图片 |
| `backend/src/services/volcengine-tts.provider.ts` | 火山引擎 TTS |
| `backend/src/services/volcengine-video.provider.ts` | 火山引擎视频 |
| `frontend/nuxt.config.ts` | Nuxt 配置 |
| `frontend/pages/login.vue` | 登录页面 |
| `frontend/stores/auth.ts` | 认证 store |
| `frontend/middleware/auth.ts` | 认证中间件 |
| `frontend/components/studio/execution/ScriptInput.vue` | 剧本输入组件 |
| `frontend/components/studio/execution/CharacterCreation.vue` | 角色设计组件 |
| `frontend/components/studio/execution/SceneGeneration.vue` | 场景设计组件 |
| `frontend/components/studio/execution/StoryboardProduction.vue` | 分镜制作组件 |
| `frontend/components/studio/execution/DirectorStudio.vue` | 导演运镜/视频合成组件 |
