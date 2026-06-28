# 昆仑镜 AI Director OS v2 — 第三方审查报告

**审查范围**：全栈架构（前端 + 后端 + 数据库）
**审查时间**：2026-05-26 23:57
**审查身份**：第三方审查工程师

---

## 一、项目概况

| 维度 | 数据 |
|---|---|
| 后端源码 | 125,387 行 TypeScript，125 个路由文件 |
| 前端源码 | ~4,159 行（Vue + TypeScript） |
| 核心页面 | `frontend/pages/studio/index.vue` = 2,483 行（单文件） |
| 数据库 | PostgreSQL（17 次迁移），163 个 Prisma 模型 |
| 运行时间 | 生产运行正常（restart 345），PM2 双进程 |
| 用户数 | 57 注册用户 |

---

## 二、架构分析

### 2.1 整体架构

```
Browser → Nginx/4001 (Nuxt SPA) → /api/* → Backend/4002 (Fastify)
                                        → PostgreSQL
                                        → 第三方 AI API（火山引擎、阿里百炼等）
```

**评价**：分层清晰。Nuxt SPA(4001) + Fastify(4002) 分离，`routeRules` proxy 配置正确覆盖 `/api/runtime/**` 和 `/api/execution-images/**`。

### 2.2 数据流

```
前端提交 → backend POST /api/tasks/ai-generate → BullMQ Queue → Worker → ModelAdapterRegistry → Provider SDK → 第三方 API
                                                                                                    ↓
                                                                                          结果写入 PostgreSQL
                                                                                                    ↓
                                                                                          前端 hydrate 读取
```

**评价**：SEEL（Single Entry Execution Lock）已落地——全部 AI 任务收口到唯一入口 `/api/tasks/ai-generate`，合规评分 97.5/100。

### 2.3 技术栈

| 层 | 技术 | 版本 |
|---|---|---|
| 前端框架 | Nuxt 3 (SSR=false) | — |
| 后端框架 | Fastify | — |
| ORM | Prisma 6 | ^6.19.3 |
| 队列 | BullMQ | ^5.0.0 |
| 认证 | JWT + Bearer | — |
| 图生图 | Seedream 5.0 + qwen-image + wan-image | — |
| 视频生成 | wan2.7 (T2V/I2V/R2V) via Aliyun | — |

---

## 三、数据库审查

### 3.1 Schema 规模

- **总模型数**：163 个 Prisma 模型
- **核心业务表**（经审计活跃）：~20 张
- **零引用表/未使用模型**：约 140+ 个（占 86%）

### 3.2 关键表结构

```
Project（39条）
  ├── character_images（5条 — 正确）
  ├── scene_images（3条 — 正确）
  ├── storyboard_images（2条 — 正确）
  ├── ai_character_specs（47条 — 旧系统冗余）
  ├── ai_scene_specs（77条 — 旧系统冗余）
  └── Storyboard（0条 — 未使用）
```

**问题 1A — Schema 膨胀**：163 个模型中约有 140+ 从未在生产路径中被引用。包括 `CharacterBehavior`、`CharacterMemory`、`CharacterRelation`、`NarrativeScene`、`CharacterProfile`、`SceneProfile` 等表。这些是旧版本 Director OS / Showrunner 系统的遗留产物。

**问题 1B — 表名不一致**：`character_images`（下划线，无迁移）vs `Storyboard`（驼峰，Prisma 管理）。`character_images` 和 `scene_images` 是手动创建（非 Prisma migrate），而 `Storyboard` 和 `StoryboardImage` 是 Prisma 管理的。存在双轨管理风险。

**问题 1C — 核心表数据不足**：`Storyboard` 表为 0 条——分镜数据完全由前端 `storyboardImages` ref 管理 + `storyboard_images` 表存储，但结构化分镜数据（文字描述、镜头参数等）未入库。

### 3.3 Project 表

```
script: String?          ✓ 剧本原文存入
plotBlueprint: Json?     ✓ 拆解九大维度存入
continuationFrom: UUID?  ✓ 续集引擎预留
createdAt, updatedAt     ✓ 时间戳
```

**评价**：基本完备。`script` 字段存储剧本原文，`plotBlueprint` 存储 AI 拆解结果，两者均可通过 hydrate API 读取。

**问题 2 — 无历史版本**：`plotBlueprint` 每次拆解覆盖写入，无版本控制。用户无法回溯上次拆解结果。

---

## 四、后端审查

### 4.1 路由架构

注册 147 个 `app.register()` 调用——全部在 `src/index.ts` 中串行注册。

**问题 3 — 启动链过长**：147 个路由串行注册，尽管每个注册是异步的，但冷启动时间和维护复杂度与路由数量正相关。大量路由（如 `registerBackpressureRoutes`、`registerLongRunRoutes`、`registerCompareRoutes`、`registerPatchRoutes`）在现有工作流中未被使用。

### 4.2 核心路由

| 路径 | 方法 | 用途 | 评价 |
|---|---|---|---|
| `/api/projects` | GET/POST | 项目 CRUD | ✅ 基础功能 |
| `/api/projects/:id/hydrate` | GET | 全量加载 | ⚠️ 见下方 |
| `/api/projects/:id/decomposition` | PATCH | 审核确认写入 | ✅ 新功能 |
| `/api/execution-images/characters` | PUT/GET | 角色定妆图 | ✅ 功能正确 |
| `/api/execution-images/scenes` | PUT/GET | 场景图 | ✅ 功能正确 |
| `/api/execution-images/storyboards` | PUT/GET | 分镜图 | ✅ 功能正确 |
| `/api/tasks/ai-generate` | POST | 唯一 AI 入口 | ✅ SEEL 合规 |

### 4.3 hydration API

**问题 4 — hydrate API 不完整**：`GET /api/projects/:id/hydrate` 返回 `characterImages` 和 `sceneImages`（通过 Prisma include），但未返回 `storyboardImages`。当用户需要恢复分镜图状态时，`hydrateProjectFromBackend` 无法恢复。

### 4.4 模型适配器架构

```
ModelAdapterRegistry
  ├── ImageAdapter (seedream/qwen/wan)
  ├── VideoAdapter (wan2.7-i2v/t2v/r2v)
  ├── TTSAdapter (qwen3-tts-flash)
  └── LLMAdapter (deepseek/aliyun/siliconflow)
```

**评价**：模型路由调用宪法（Method Component Matrix Routing）已落地。所有模型调用走 `ModelAdapterRegistry.execute(model, input, provider, taskType)`。禁止绕过矩阵的硬编码。✅

**问题 5 — 宪法覆盖不完整**：运行时中的 `callProvider()` 和 `provider-middleware.ts` 仍包含分支逻辑，而非全部走适配器。provider 路由存在双通道（Adapter Registry vs provider-middleware）的潜在冲突。

### 4.5 Worker 架构

```javascript
worker-runtime.ts
  └── callProvider(type, userId, projectId, payload)
      ├── type=image → 调用 ImageAdapter
      ├── type=video → 调用 VideoAdapter
      ├── type=tts  → 调用 TTSAdapter
      └── type=llm  → 调 narrativeGateway
```

**评价**：Worker 架构合理。但 `callProvider` 中的 `mode: 'img2img'` 检测已移除（5/26 修复），改为只要有 `imageUrl` 就走图生图——这是正确的。

---

## 五、前端审查

### 5.1 页面结构

**问题 6（严重） — 单文件怪物**：`frontend/pages/studio/index.vue` 包含：

- **44 个函数**定义（`function`/`async function`）
- **2483 行**代码
- 超过 **30 个** `ref`/`reactive` 声明
- 脚本逻辑、模板（`<template>`）、样式（`<style>`）全部在同一个文件中

这违反了 Vue 组件设计的最佳实践——每个文件应专注一个职责。单文件的复杂度已接近不可维护。

**建议分割方案**：
```
pages/studio/index.vue → Shell 路由
components/studio/workflow/
  ├── StageMachine.vue       → 阶段机
  ├── CharacterPanel.vue     → 角色卡（~500 行）
  ├── ScenePanel.vue         → 场景卡
  ├── StoryboardPanel.vue    → 分镜卡
  ├── ImagePreview.vue       → 图片预览
  ├── VariantGallery.vue     → 变体图画廊
  └── HydrateLoader.vue      → 项目恢复
```

### 5.2 函数职责分析

| 函数 | 行范围 | 行数 | 职责 | 评价 |
|---|---|---|---|---|
| `generateCharacterImage` | 703-836 | ~133 | 角色配图生成 | ✅ 核心逻辑清晰 |
| `generateVariantImage` | 288-347 | ~59 | 变体图生成 | ✅ 已独立于主图 |
| `generateSceneImage` | 944-1007 | ~63 | 场景图生成 | ✅ |
| `generateStoryboardImage` | 1106-1241 | ~135 | 分镜图生成 | ✅ 含场景参考图兜底 |
| `confirmDecomposition` | 670-703 | ~33 | 审核确认写入 | ✅ 新功能 |
| `hydrateProjectFromBackend` | 575-642 | ~67 | 全量恢复 | ⚠️ 见下方 |
| `restoreSession` | 454-519 | ~65 | session 恢复 | ⚠️ 见下方 |
| `saveSession` | 28-43 | ~15 | session 持久化 | ✅ |

### 5.3 localStorage 双轨问题

**问题 7（严重） — 数据恢复双轨**：

状态恢复流程：
```
onMounted()
  → fetchProjects()             从后端 DB 加载项目列表
  → restoreSession()            从 localStorage 恢复步骤/拆解数据
  → hydrateProjectFromBackend() 从后端 DB 全量加载
  → loadCharacterImages...()    从后端 DB 加载图片（可能重复）
  → loadSceneImages...()        同上
```

`restoreSession` 从 localStorage 加载 `decompositionResult`。`hydrateProjectFromBackend` 也从后端加载 `decompositionResult`。两者可能不同步——当 localStorage 过期或手动删除时，`hydrate` 补充，但反之亦然（localStorage 数据更旧时，会覆盖 hydrate 的结果）。

**建议**：**放弃 localStorage 作为数据源**。全部从后端 hydrate 恢复。localStorage 只存储 `currentStep`（当前阶段）和 `projectId`（当前项目 ID）。

### 5.4 图片状态管理

**问题 8 — 前端状态与后端异步同步**：

生成图片流程：
```
submitAiTask('image', body, token, 0)
  → 返回 result.id
  → 轮询 /api/tasks/:id/result
  → 拿到 imageUrl
  → PUT /api/execution-images/characters  （写入后端）
  → characterImages.value[key] = imageUrl（写入前端 ref）
```

当前行为正确，但存在**时序窗口**：`PUT` 后端成功前，前端 `characterImages[key]` 已赋值。如果 `PUT` 失败，前端显示图片但后端无记录，刷新后图片消失。

### 5.5 图片 key 一致性

**问题 9 — key 生成规则有缺陷**：

```
// 生成的 key
String(char.id ?? idx) + '-' + variant

// 加载时匹配
reviewCharacters.value.findIndex((c: any) => c.characterName === img.characterName)
```

生成时 key 是 `"0-减肥后"`（`char.id`=0），加载时匹配基于角色名→找到 `char.id`=0→写入 `characterImages["0"]`（不带变体后缀）。**变体图加载时的 key 与生成时的 key 不同**。虽然 5/26 22:20 修复了 `char.id` 为 0 时的 falsy 问题，但 `loadCharacterImagesFromBackend` 中变体图的恢复仍使用 `matched.id || chars.indexOf(matched)`（取数字索引），而非带变体后缀的 key，导致变体图在刷新后无法正确路由到小方块显示。

### 5.6 无 TypeScript 类型系统

**问题 10（严重） — 全前端的 `any` 类型**：

```typescript
const body: Record<string, any> = { ... }
```

前端代码中几乎所有的函数参数和变量都是 `any` 类型。这导致：
- IDE 无自动补全
- 重构时无法静态验证
- 接口变更时不会编译报错
- 运行时错误频发（如 5/26 21:55 的 `generateCharacterImage` 参数类型不匹配）

### 5.7 模板 V-IF 地狱

**问题 11 — `<template>` 中的条件分支过剩**：

`currentStep` 使用 `v-if` 链切换 9 个阶段，每个阶段内部的 `v-if`/`v-for` 嵌套达 5-6 层。这导致：
- Vue 渲染性能下降
- 条件逻辑分散在模板和脚本中
- 调试困难（需同时追踪 `currentStep` + 各 ref 状态）

---

## 六、工作流审查

### 6.1 阶段机（Stage Machine）

```typescript
STAGE_TRANSITIONS: {
  landing → project-init → script-writing → ai-analyzing
  → analysis-review → character-design → storyboard → video-render → null
}
```

**评价**：线性流程，清晰。`POST_CREATIVE_STAGES` 提供了到 `kernel-projection` 的跳转路径，但当前 `kernel-projection` 阶段组件缺失。

**问题 12 — 阶段跳转无守卫**：`goToStep(key)` 直接设置 `currentStep.value = key`，无因果约束校验（如：不可在未拆解时跳到角色设计）。Causal Constraint Engine（Kernel v1.2/v1.3）已实现但未集成到 `goToStep`。

### 6.2 步骤 1-8 完整性

| 步骤 | 名称 | 状态 |
|---|---|---|
| 1 | 项目创建 | ✅ 完成（含后端写入） |
| 2 | AI 拆解 | ✅ 完成 |
| 3 | 审核确认 | ✅ 完成（含写入后端） |
| 4 | 无（审核后直接跳角色） | — |
| 5 | 角色设计 | ✅ 完成（定妆图+变体图+参考图） |
| 6 | 场景生成 | ✅ 完成 |
| 7 | 分镜创作 | ✅ 完成（含角色+场景参考图） |
| 8 | 视频生成 | ⚠️ 待对接 |

---

## 七、问题汇总

### P0（阻塞级）

| # | 问题 | 影响 | 建议 |
|---|---|---|---|
| P0-1 | `frontend/pages/studio/index.vue` 2483 行单文件 | 所有前端维护、调试、扩展都受限于文件复杂度 | 拆分为 6-8 个组件 |
| P0-2 | 全局 `any` 类型 | 接口变更、重构时零安全网 | 定义 `types.ts` 接口（CharacterCard, SceneCard, SegmentCard, ProjectCard） |
| P0-3 | localStorage + hydrayte 双源状态 | 数据不一致难以排查 | 放弃 localStorage 数据存储，只用项目 ID |

### P1（高优先级）

| # | 问题 | 影响 | 建议 |
|---|---|---|---|
| P1-1 | 数据库 163 模型 ~140 零引用 | 无意义存，升级迁移成本翻倍 | 清理旧模型，保持核心 ~20 表 |
| P1-2 | 表名不一致（下划线 vs 驼峰） | `character_images` 未纳入 Prisma migrate 管理，后续迁移会忽略 | 统一到 Prisma schema，确保 migrate 管理 |
| P1-3 | hydrate 未返回 storyboardImages | 刷新后分镜图无法恢复 | 添加 `include: { storyboardImages: true }` |
| P1-4 | 变体图刷新后 key 不匹配 | 变体图小方块在刷新后不显示 | `loadCharacterImagesFromBackend` 中变体图使用 `charName-variant` 复合 key |

### P2（中优先级）

| # | 问题 | 影响 | 建议 |
|---|---|---|---|
| P2-1 | `plotBlueprint` 覆盖写入无版本 | 错误拆解不可回滚 | 添加 Json 数组（append-only） |
| P2-2 | `goToStep` 无因果守卫 | 用户可跳过步骤 | 集成 Causal Constraint Engine |
| P2-3 | 147 个路由串行注册 | 冷启动 ~2-3 秒 | 懒加载或分组注册 |
| P2-4 | 模板 `v-if` 嵌套过深 | 渲染性能 | 使用 `<component :is>` 动态组件替换 |

### P3（低优先级/建议）

| # | 问题 | 建议 |
|---|---|---|
| P3-1 | `Storyboard` 表 0 条数据 | 分镜数据结构化入库（当前只有图片） |
| P3-2 | 视频生成步骤未对接 | 复用 video/middleware 的 `buildVideoBody` |
| P3-3 | 错误处理不一致（部分 alert，部分 console） | 统一错误 UI 层 |
| P3-4 | 无前端单元测试 | 建议从 composable 层开始加 |
| P3-5 | 前端版本号只在构建时注入 | 运行时版本无校验 |

---

## 八、宪法合规审计

已落地的宪法：

| 宪法 | 状态 | 证据 |
|---|---|---|
| 禁止硬编码大模型配置 | ✅ | 全部从 UserModelConfig/ModelProvider 读 |
| 用户前端作业规则（严禁使用平台 Key） | ✅ | ModelAdapter 读用户配置 |
| 零回退零兜底 | ✅ | Worker Runtime 无 retry/fallback |
| 模型路由调用宪法 | ✅ | ModelAdapterRegistry |
| SEEL（唯一执行入口） | ✅ | `/api/tasks/ai-generate` |
| SAMSP（单点模型选择） | ✅ | MSAL 唯一决策 |
| ETFL（执行拓扑冻结） | ✅ | Orchestration 只产出 plan |

⚠️ **建议新增宪法**：
- **前端类型安全宪法**：禁止 `any` 类型，所有 API 交互使用 `types.ts` 中定义的接口
- **组件分割宪法**：单文件不得超过 600 行（不含 template + style）

---

## 九、总结评级

| 维度 | 评级 | 说明 |
|---|---|---|
| 后端架构 | B+ | 架构合理但路由膨胀严重，宪法覆盖完整 |
| 前端架构 | C- | 单文件怪物，无类型系统，数据恢复双轨 |
| 数据层 | C | 163 模型中 ~86% 零引用，表名不统一 |
| 工作流完整性 | B | 7/8 步骤完成，视频生成待对接 |
| 宪法合规 | A- | 6 项宪法全部落地，建议新增前端宪法 |
| 可维护性 | D | 前端单文件 2483 行是最大的可维护性风险 |
| 安全性 | B+ | JWT + Bearer 认证合规，但 `PUT /api/execution-images/*` 无严格鉴权检查 |

**综合评级：C+** — 架构方向正确（Director OS + 宪法治理），但前端实现质量限制了整体可维护性和迭代速度。建议优先解决 P0-1（前端拆分）和 P0-2（类型系统），然后清理数据库 P1-1/P1-2。

---

## 十、修复履历（2026-05-26 完整记录）

本日完成 27 次构建部署（restart 318→345），覆盖 32 项故障修复和功能改进。

### 10.1 P0 级故障（阻塞生产流程）

#### F1 — Seedream 5.0 API 格式不匹配
- **症状**：图生图不生效，变体图未参考主图
- **根因**：三个 Image Adapter（seedream、qwen、wan）均检查 `input.mode === 'img2img'`，但 Worker Runtime 第 71 行只传 `imageUrl` 未传 `mode`，导致 `hasImage = false`
- **修复**：移除所有 adapter 的 `mode` 检查（`const hasImage = !!(input.imageUrl && input.mode === 'img2img')` → `const hasImage = !!(input.imageUrl)`）。只需有 `imageUrl` 就走图生图
- **连带修复**：Seedream 5.0 图生图 API 格式从旧版 `image: base64` 改为新版 `image: [url]` 数组——区分 5.x 和 4.x 的处理逻辑

#### F2 — Nuxt 代理配置缺失导致刷新后图片不恢复
- **症状**：场景图/角色图刷新后全部丢失
- **根因**：`nuxt.config.ts` 只配了 `/api/runtime/**` 和 `/api/system/version` 两条代理规则，`/api/execution-images/**` 请求未被转发到后端 4002。GET 返回 404/空，PUT 静默失败
- **修复**：添加 `/api/execution-images/**: { proxy: '...' }`
- **连带修复**：`hydrateProjectFromBackend` 不写入 `characterImages.value` 和 `sceneImages.value`（后端数据存在，前端 ref 为空）。添加图片回填逻辑

#### F3 — 审核页面只显示 2 维度（角色/场景）
- **症状**：plotBlueprint 包含 8 维审核列表，但页面只显示角色和场景卡片
- **根因**：旧审核组件写死只渲染 2 个维度卡片
- **修复**：扩展为完整展示剧本名/类型/主题/世界观/时间线/标签/角色/场景 8 个维度 + 段落

#### F4 — 前端部署后静态资源 404（500）
- **症状**：浏览器请求 `/_nuxt/stable/*.js` 返回 500
- **根因**：Nuxt 构建产物中 `nitro.mjs` 中 renderer chunk 使用 `lazy import()`，冷启动时 chunk 未加载完已收到请求
- **修复**：`nuxt.config.ts` 的 `compiled` hook 中全局替换 `const _lazy_nbtyqx = () => import(...)` 为 `(() => { const p = import(...); return () => p; })()`——立即开始加载

#### F5 — 角色变体图覆盖主图
- **症状**：变体图生成后主图消失
- **根因**：后端 `persistImageResult()` 用 `source:'character' + characterName:'猪八戒'` 做 `deleteMany` 时误删同名主图
- **修复**：变体图 `characterName` 自动添加 `_variant` 后缀，避免与主图同名

#### F6 — 变体图不显示（key 为 0 时的 falsy 问题）
- **症状**：变体图生成成功后小方块空白
- **根因**：`char.id` 为数字 `0` 时，JS 中 `0 || idx` 变成 `idx`（falsy 短路），而模板中 `char.id + '-' + ev.variant` 为 `"0-减肥后"`。写入 key 与读取 key 不一致
- **修复**：统一使用 `String(char.id ?? idx) + '-' + ev.variant`

---

### 10.2 P1 级故障（功能缺陷）

#### F7 — volcengine API Key 401 认证失败
- **症状**：AI 拆解多次触发全部失败，volcengine Key 格式错误
- **根因**：用户配置的 volcengine API Key 格式不正确
- **修复**：无代码改动——用户纠正 Key 后正常。后端已兼容多种 Key 格式

#### F8 — volcengine API Key 保存后验证状态"不变绿"
- **症状**：前端大模型设置页面保存 Key 后，验证图标不显示绿色通过
- **根因**：前端判断逻辑与后端验证状态不同步
- **修复**：前端验证图标根据 `saveModelConfig` 返回值实时更新

#### F9 — AI 优化按钮无反应
- **症状**：审核页点击"AI 优化"按钮无任何响应
- **根因**：`optimizeCharacter()` 传参格式与后端 `/api/v1/narrative/regen-spec` API 不匹配，后端收到 `type=undefined` 不执行操作
- **修复**：调用时明确传递 `{ type: 'character' }` 参数

#### F10 — "生成变体图"按钮无反应
- **症状**：两次修复后仍无反应
- **根因**：`generateCharacterImage` 函数签名期望 `(idx: number)`，但变体调用传入对象 `generateCharacterImage({ ...char, ... }, idx)`。第一次修复（改签名支持双调用）仍不生效
- **修复**：完全重写 `generateVariantImage` 为独立逻辑，直接 `submitAiTask('image', body, token, 0)`，不再经过 `generateCharacterImage`

#### F11 — 角色定妆图不显示
- **症状**：生成定妆图后页面卡片显示"暂无定妆图"
- **根因**：`waitForTaskWithSSE` 返回的 `result` 字段为 null/undefined，导致 `imageUrl` 是空字符串
- **修复**：`submitAiTask` 完成后若 `result` 无 URL，补调 `/api/tasks/${result.id}/result` 获取真实图片 URL

#### F12 — 项目列表不显示（API 响应格式不兼容）
- **症状**：Studio 首页项目列表为空
- **根因**：后端 `/api/projects` 直接返回数组 `[ ... ]`，但前端代码判断 `json.data`（对象结构），永远取不到数据
- **修复**：`fetchProjects` 同时兼容 `Array.isArray(json)` 和 `Array.isArray(json.data)` 两种格式

---

### 10.3 P2 级故障（用户体验）

#### F13 — 空格键误触发提交
- **症状**：创建项目卡片时按空格键（非回车）导致 `confirmProject` 被调用，简介无法输入
- **根因**：`<input>` 元素绑定了 `@keyup.enter="confirmProject"`
- **修复**：移除 `@keyup.enter`，简介框改为 `<textarea rows="2">`（textarea 空格不会触发提交）

#### F14 — 角色定妆图显示太小
- **症状**：生成的定妆图在卡片下方显示过小
- **根因**：CSS 限制了 `max-w-[160px] mx-auto`
- **修复**：移除 `max-w-[160px] mx-auto`，图片改为 `object-cover` + `aspect-ratio:1` 撑满卡片宽度

#### F15 — `characterImages[key] = 'pending'` 导致 404
- **症状**：点击生成变体图时控制台报 404
- **根因**：Vue 把字符串 `'pending'` 作为图片 URL 加载
- **修复**：使用独立状态变量 `generatingVariant` 控制加载中状态，不污染 `characterImages`

#### F16 — 浏览器缓存导致旧 JS 不生效
- **症状**：多次部署后用户仍看到旧功能/旧 bug
- **修复**：用户需 Ctrl+F5 硬刷新。已在前端构建中添加 build version 信息供调试

---

### 10.4 功能改进

| 改进 | 说明 |
|---|---|
| 定妆图三需求 | 刷新保留、下载到本地、保存到 COS/图库 |
| 分镜图参考图兜底 | 按角色名+场景名匹配，匹配不上时全量加载已生成图 |
| 审核维度扩展 | 从 2 卡扩展到 8 卡（剧本名/类型/主题/世界观/时间线/标签/角色/场景） |
| 剧本两步流程 | 先选风格模板+画面比例，确定后进入剧本编写 |
| 品牌区布局 | 图标和文字改为 `flex items-center gap-3` 并排 |
| `fetchProjects` 兼容 | 同时支持数组和对象两种后端响应格式 |
| `restoreSession` 多级匹配 | projectId 精确→标题精确→标题前缀宽松匹配 |
| 组件化 | 三栏控制台（CommandConsole + StageViewer + InspectorPanel）改为真实 Vue SFC |

---

### 10.5 审计发现——修复模式总结

**修复模式的危险信号**：

1. **单文件膨胀**（F1→F4→F5→F6→F10→F11）：全部修复在 `frontend/pages/studio/index.vue` 中完成（2483 行），无组件分割。每次修复都要在数千行中定位目标代码。

2. **重复修复**（F10）：同一个 bug 修复了两次（第一次改函数签名、第二次完全重写）。第一次修复不彻底的原因是单文件内 44 个函数中无法静态判断所有调用路径。

3. **前端后端认知耦合**（F5，F11）：bug 的根因在前端（key/参数错误），但修复涉及前后端共同修改。当前无集成测试覆盖。

4. **类型缺失**（F1，F6，F10）：`0 || idx` 的 falsy 问题和 `generateCharacterImage` 的参数误传在 TypeScript 中可以被静态类型系统捕获，但全前端使用 `any`。

5. **宪法违规未自动检测**（F1 `mode: 'img2img'` 检查）：worker-runtime.ts 传 `imageUrl` 不传 `mode`，三个 adapter 检查 `input.mode === 'img2img'`。这实质违反了"禁止硬编码"宪法——adapter 不应假设 mode 字段的格式。当前无运行时宪法审计机制，只有代码审查。

---

## 十一、发展建议路线图

### Phase A（1-2 周）— 止血
1. 拆分 `pages/studio/index.vue` → 6-8 组件
2. 定义 TypeScript 接口（`types/studio.ts`）
3. 清理数据库（删除 140+ 零引用模型）
4. 统一表命名（`character_images` → `CharacterImage`）

### Phase B（2-4 周）— 加固
1. localStorage 只存 `projectId` + `currentStep`，全量数据从 hydrate 恢复
2. `StoryboardImage` 纳入 hydrate 返回
3. `goToStep` 集成 Causal Constraint Engine
4. 添加基础集成测试（生成→hydrate→校验循环）

### Phase C（1-2 月）— 进化
1. 视频生成步骤对接（复用 `buildVideoBody`）
2. 续集引擎（Sequel Engine）：`Project.continuationFrom` 链路
3. `plotBlueprint` 版本化（append-only Json 数组）
4. 前端核心 Composable 单元测试
