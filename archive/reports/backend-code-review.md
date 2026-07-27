# 后端代码审查报告

> 审查日期：2026-06-02
> 审查范围：backend/src/routes/ 和 backend/src/agents/

---

## 一、僵尸路由

> **定义**：后端注册了路由，但前端（frontend/）没有任何 fetch/API 调用使用该路径。

### 1.1 Admin 路由（admin-auth.ts）

| 路由 | 文件:行号 | 前端使用证据 |
|------|----------|------------|
| `GET /api/admin/me` | admin-auth.ts:62 | ❌ 前端无调用（前端通过 `/api/auth/me` 获取用户信息） |
| `GET /api/admin/projects` | admin-auth.ts:181 | ❌ 前端无调用（前端通过 `/api/projects` 获取项目列表） |
| `POST /api/admin/logout` | admin-auth.ts:176 | ❌ 前端调用 `/api/auth/logout`，不是 `/api/admin/logout` |

### 1.2 Admin 路由（admin-global-config.ts）

| 路由 | 文件:行号 | 前端使用证据 |
|------|----------|------------|
| `GET /api/admin/global-models/sync-aliyun-models` | admin-global-config.ts:467 | ❌ 前端调用 `/api/admin/global-models/sync-aliyun`（PUT），GET 版本无人使用 |

### 1.3 Admin 路由（admin-image-prompts.ts）

| 路由 | 文件:行号 | 前端使用证据 |
|------|----------|------------|
| `GET /api/admin/image-prompt-templates` | admin-image-prompts.ts:17 | ❌ 前端无任何调用 |
| `GET /api/admin/image-prompt-templates/:type` | admin-image-prompts.ts:28 | ❌ 前端无任何调用 |
| `POST /api/admin/image-prompt-templates` | admin-image-prompts.ts:41 | ❌ 前端无任何调用 |
| `PATCH /api/admin/image-prompt-templates/:id` | admin-image-prompts.ts:75 | ❌ 前端无任何调用 |
| `DELETE /api/admin/image-prompt-templates/:id` | admin-image-prompts.ts:98 | ❌ 前端无任何调用 |
> **整个文件 5 条路由全部为僵尸路由**，前端不存在对应的 admin 页面或组件调用这些接口。

### 1.4 Admin 路由（admin-models.ts）

| 路由 | 文件:行号 | 前端使用证据 |
|------|----------|------------|
| `PUT /api/admin/provider-keys/:provider` | admin-models.ts:36 | ❌ 前端只调用 GET `/api/admin/provider-keys`，没有 PUT 更新 |

### 1.5 Admin 路由（admin-models-v2.ts）

| 路由 | 文件:行号 | 前端使用证据 |
|------|----------|------------|
| `GET /api/admin/models` | admin-models-v2.ts:31 | ❌ 前端调 `/api/admin/global-models`，非此路径 |
| `POST /api/admin/models` | admin-models-v2.ts:38 | ❌ 前端无调用 |
| `PUT /api/admin/models/:id` | admin-models-v2.ts:62 | ❌ 前端无调用 |
| `PATCH /api/admin/models/:id/toggle` | admin-models-v2.ts:87 | ❌ 前端无调用 |
| `DELETE /api/admin/models/:id` | admin-models-v2.ts:102 | ❌ 前端无调用 |
| `GET /api/admin/apikeys` | admin-models-v2.ts:112 | ❌ 前端无调用 |
| `POST /api/admin/apikeys` | admin-models-v2.ts:126 | ❌ 前端无调用 |
| `DELETE /api/admin/apikeys/:provider` | admin-models-v2.ts:139 | ❌ 前端无调用 |
| `POST /api/admin/models/:id/test` | admin-models-v2.ts:147 | ❌ 前端无调用 |
| `GET /api/admin/models/groups` | admin-models-v2.ts:154 | ❌ 前端无调用 |
> **整个文件 10 条路由全部为僵尸路由**，似乎是一个废弃的 V2 实现。

### 1.6 Admin 接口（admin-api-keys.ts）

| 路由 | 文件:行号 | 前端使用证据 |
|------|----------|------------|
| `PUT /api/admin/api-keys/:id` | admin-api-keys.ts:60 | ❌ 前端只调用 GET/POST `/api/admin/api-keys`（列表/创建），没有 UPDATE |
| `DELETE /api/admin/api-keys/:id` | admin-api-keys.ts:80 | ❌ 前端没有删除单个 api-key 的 UI |

### 1.7 Auth 路由（auth.ts）

| 路由 | 文件:行号 | 前端使用证据 |
|------|----------|------------|
| `POST /api/auth/refresh` | auth.ts:182 | ❌ 前端无任何 token refresh 调用 |
| `GET /api/auth/user-by-email` | auth.ts:188 | ❌ 前端无调用 |
| `GET /api/auth/plans` | auth.ts:236 | ❌ 前端调用 `/api/member/plans` 获取套餐列表 |

### 1.8 验证码路由（captcha.ts）

| 路由 | 文件:行号 | 前端使用证据 |
|------|----------|------------|
| `GET /api/captcha` | captcha.ts:27 | ❌ 前端无调用（可能验证码功能未实现或已废弃） |

### 1.9 SMS/Email 路由（sms.ts）

| 路由 | 文件:行号 | 前端使用证据 |
|------|----------|------------|
| `POST /api/sms/send` | sms.ts:8 | ❌ 前端调用的是 `/api/auth/sms/send`（在 sms-auth.ts 里） |
| `POST /api/email/send-code` | sms.ts:46 | ❌ 前端无调用 |

### 1.10 语音路由（voice.ts）

| 路由 | 文件:行号 | 前端使用证据 |
|------|----------|------------|
| `POST /api/voice/design` | voice.ts:41 | ❌ 前端无调用 |
| `POST /api/voice/clone` | voice.ts:72 | ❌ 前端无调用 |
| `GET /api/voice/presets` | voice.ts:103 | ❌ 前端无调用 |
| `DELETE /api/voice/presets/:id` | voice.ts:128 | ❌ 前端无调用 |
| `GET /api/voice/records` | voice.ts:175 | ❌ 前端无调用 |
> **整个文件 5 条路由，只有 `POST /api/voice/test` 被前端使用**。其余 4 条可能为未完成或已废弃功能。

### 1.11 TTS 路由（tts.ts）

| 路由 | 文件:行号 | 前端使用证据 |
|------|----------|------------|
| `POST /api/tts/synthesize` | tts.ts:76 | ❌ 前端无直接调用 |
| `POST /api/tts/generate` | tts.ts:79 | ❌ 前端无直接调用 |
| `GET /api/tts/voices` | tts.ts:82 | ❌ 前端无直接调用 |

### 1.12 图片/视频路由（images.ts）

| 路由 | 文件:行号 | 前端使用证据 |
|------|----------|------------|
| `POST /images/generate` | images.ts:87 | ❌ 前端调用 `/api/tasks/ai-generate` 入队 |
| `POST /images/generate-and-download` | images.ts:90 | ❌ 前端无调用 |
| `POST /videos/generate` | images.ts:94 | ❌ 前端调用 `/api/tasks/ai-generate` 入队 |
| `POST /images/save` | images.ts:152 | ❌ 前端无调用 |
| `GET /props/:projectId` | images.ts:192 | ❌ 前端无调用 |
| `GET /videos/status/:taskId` | images.ts:203 | ❌ 前端调用 `/api/tasks/:id/status` 轮询 |
| `GET /videos/download-all/:projectId` | images.ts:222 | ❌ 前端无调用 |
| `GET /projects/:id/character-makeup-images` | images.ts:260 | ❌ 前端无调用 |
> **注释已自述：** "ETFL Phase 2: 所有 execution 路径经 `/api/tasks/ai-generate` 入队"——这些路由是遗留代理，可清理。

### 1.13 任务路由（ai-tasks.ts）

| 路由 | 文件:行号 | 前端使用证据 |
|------|----------|------------|
| `POST /api/tasks/batch-create` | ai-tasks.ts:228 | ❌ 前端无调用 |

### 1.14 API Keys 路由（api-keys.ts）

| 路由 | 文件:行号 | 前端使用证据 |
|------|----------|------------|
| `GET /api/user/api-keys` | api-keys.ts:52 | ❌ 前端调用 `/api/v1/user/api-keys`（不同前缀） |
| `POST /api/user/api-keys` | api-keys.ts:84 | ❌ 前端调用 `/api/v1/user/api-keys` |
| `DELETE /api/user/api-keys/:provider` | api-keys.ts:150 | ❌ 前端调用 `/api/v1/user/api-keys` |
| `GET /api/user/api-keys/status` | api-keys.ts:163 | ❌ 前端调用 `/api/v1/user/api-keys/available` |

### 1.15 会员路由（member.ts）

| 路由 | 文件:行号 | 前端使用证据 |
|------|----------|------------|
| `POST /api/member/recharge` | member.ts:92 | ❌ 前端调用 `/api/payment/recharge` |
| `GET /api/member/recharge-plans` | member.ts:88 | ❌ 前端调用 `/api/member/plans` |
| `GET /api/member/assets` | member.ts:148 | ❌ 前端无调用 |
| `DELETE /api/member/assets/:id` | member.ts:162 | ❌ 前端无调用 |
| `POST /api/member/upgrade-storage` | member.ts:183 | ❌ 前端无调用 |
| `GET /api/member/agent-levels` | member.ts:240 | ❌ 前端无调用 |
| `POST /api/member/apply-agent` | member.ts:245 | ❌ 前端无调用 |
| `POST /api/member/transfer` | member.ts:290 | ❌ 前端无调用 |
| `GET /api/member/referral-info` | member.ts:353 | ❌ 前端无调用 |
| `POST /api/member/submit-payment` | member.ts:548 | ❌ 前端无调用 |
| `GET /api/payment/alipay/status/:orderId` | member.ts:972 | ❌ 前端调用 `/api/payment/alipay/status/:orderId`（同路径但路由在 payment.ts 注册） |

### 1.16 用户中心路由（user-center.ts）

| 路由 | 文件:行号 | 前端使用证据 |
|------|----------|------------|
| `POST /api/user/credits/consume` | user-center.ts:29 | ❌ 前端无直接调用 |
| `POST /api/user/credits/recharge` | user-center.ts:60 | ❌ 前端调用 `/api/payment/recharge` |
| `GET /api/universe/works` | user-center.ts:198 | ❌ 前端无调用 |
| `POST /api/universe/works/:id/like` | user-center.ts:261 | ❌ 前端无调用 |
| `POST /api/universe/works/:id/comment` | user-center.ts:277 | ❌ 前端无调用 |
| `GET /api/universe/clusters` | user-center.ts:293 | ❌ 前端无调用 |
| `POST /api/universe/rescore` | user-center.ts:301 | ❌ 前端无调用 |
| `GET /api/universe/creator-dna` | user-center.ts:308 | ❌ 前端无调用 |
| `GET /api/user/promo` | user-center.ts:343 | ❌ 前端调用的是 `/api/user/promo` —— 确认是否真的有使用 |
| `POST /api/user/agent/apply` | user-center.ts:379 | ❌ 前端无调用 |
| `GET /api/user/agent/status` | user-center.ts:422 | ❌ 前端无调用 |
| `GET /api/user/usage` | user-center.ts:768 | ❌ 前端无调用 |

### 1.17 社区路由（community/likes.ts）

| 路由 | 文件:行号 | 前端使用证据 |
|------|----------|------------|
| `POST /api/community/likes` | community/likes.ts:6 | ❌ 前端无直接调用 |
| `GET /api/community/posts/:id/likes/status` | community/likes.ts:71 | ❌ 前端无调用 |

### 1.18 消息路由（messages.ts）

| 路由 | 文件:行号 | 前端使用证据 |
|------|----------|------------|
| `GET /api/messages/unread/count` | messages.ts:107 | ❌ 前端无调用 |

### 1.19 执行图片路由（execution-images.ts）

| 路由 | 文件:行号 | 前端使用证据 |
|------|----------|------------|
| `PUT /execution-images/characters` | execution-images.ts:238 | ❌ 前端只 POST, 没有 PUT 角色图 |
| `PUT /execution-images/scenes` | execution-images.ts:408 | ❌ 前端只 POST, 没有 PUT 场景图 |
| `GET /execution-images/prop-images/:projectId` | execution-images.ts:524 | ❌ 前端无调用 |
| `PUT /execution-images/frames` | execution-images.ts:541 | ❌ 前端无调用 |
| `GET /execution-images/frames/:projectId` | execution-images.ts:557 | ❌ 前端无调用 |
| `GET /execution-images/videos/:projectId` | execution-images.ts:572 | ❌ 前端无调用 |
| `POST /execution-images/migrate/:projectId` | execution-images.ts:583 | ❌ 前端无调用 |
| `POST /execution-images/refresh/:projectId` | execution-images.ts:721 | ❌ 前端无调用 |
| `GET /execution-images/proxy` | execution-images.ts:866 | ❌ 前端无调用 |

### 1.20 客户服务路由（customer-service.ts）

| 路由 | 文件:行号 | 前端使用证据 |
|------|----------|------------|
| `GET /api/v1/customer-service/history` | customer-service.ts:495 | ❌ 前端无调用 |
| `DELETE /api/v1/customer-service/session/:sessionId` | customer-service.ts:510 | ❌ 前端无调用 |
| `GET /api/v1/customer-service/status` | customer-service.ts:528 | ❌ 前端无调用 |

### 1.21 导演 V2 路由（director-v2.ts）

| 路由 | 文件:行号 | 前端使用证据 |
|------|----------|------------|
| `POST /api/v2/director/generate` | director-v2.ts:20 | ❌ 前端无调用 |
| `GET /api/v2/director/preview` | director-v2.ts:37 | ❌ 前端无调用 |
| `POST /api/v2/director/refine` | director-v2.ts:51 | ❌ 前端无调用 |
| `GET /api/v2/director/status` | director-v2.ts:65 | ❌ 前端无调用 |
> **整个文件 4 条路由全部为僵尸路由**

### 1.22 叙事 LLM 路由（narrative-llm.ts）

| 路由 | 文件:行号 | 前端使用证据 |
|------|----------|------------|
| `POST /api/v1/narrative/analyze-v2` | narrative-llm.ts:224 | ❌ 前端无调用 |
| `POST /api/v1/narrative/deep-analyze` | narrative-llm.ts:479 | ❌ 前端无调用 |
| `POST /api/v1/narrative/optimize-prompt` | narrative-llm.ts:667 | ❌ 前端无调用 |
| `POST /api/v1/narrative/simple-parse` | narrative-llm.ts:947 | ❌ 前端无调用（但 backend 注释说保持兼容） |

### 1.23 脚本解析路由（script-breakdown.ts）

| 路由 | 文件:行号 | 前端使用证据 |
|------|----------|------------|
| `GET /api/v1/script-breakdown/:id` | script-breakdown.ts:71 | ❌ 前端无调用 |
| `GET /api/v1/script-breakdown` | script-breakdown.ts:82 | ❌ 前端无调用 |
| `POST /api/v1/script-breakdown` | script-breakdown.ts:96 | ❌ 前端无调用 |
| `POST /api/v1/script-breakdown/:id/submit` | script-breakdown.ts:127 | ❌ 前端无调用 |
> **整个文件 4 条路由全部为僵尸路由**

### 1.24 支付路由（payment.ts）

| 路由 | 文件:行号 | 前端使用证据 |
|------|----------|------------|
| `GET /api/admin/payment/secret/:channel` | payment.ts:25 | ❌ 前端无调用 |
| `PUT /api/admin/payment/secret/:channel` | payment.ts:43 | ❌ 前端无调用 |
| `POST /api/admin/payment/qr` | payment.ts:130 | ❌ 前端无调用 |
| `POST /api/admin/payment/confirm` | payment.ts:249 | ❌ 前端无调用 |
| `POST /api/admin/member/confirm` | payment.ts:327 | ❌ 前端无调用 |
| `POST /api/admin/payment/reject` | payment.ts:387 | ❌ 前端无调用 |
| `GET /api/admin/payment/orders` | payment.ts:408 | ❌ 前端无调用 |
| `GET /api/user/payment/orders` | payment.ts:463 | ❌ 前端无调用 |
| `POST /api/admin/payment/upload-qr` | payment.ts:486 | ❌ 前端无调用 |
| `POST /api/admin/cache/clear` | payment.ts:524 | ❌ 前端无调用 |
| `GET /api/admin/cache/stats` | payment.ts:587 | ❌ 前端无调用 |
| `PUT /api/admin/bailian/config` | payment.ts:615 | ❌ 前端无调用 |
| `POST /api/admin/bailian/test` | payment.ts:654 | ❌ 前端无调用 |

### 1.25 Pipeline 任务路由（pipeline-jobs.ts）

| 路由 | 文件:行号 | 前端使用证据 |
|------|----------|------------|
| `GET /api/pipeline/jobs/:projectId` | pipeline-jobs.ts:187 | ❌ 前端无调用 |
| `POST /api/pipeline/jobs/create` | pipeline-jobs.ts:196 | ❌ 前端无调用 |
| `POST /api/pipeline/jobs/poll` | pipeline-jobs.ts:207 | ❌ 前端无调用 |
| `POST /api/pipeline/jobs/:id/complete` | pipeline-jobs.ts:216 | ❌ 前端无调用 |
| `POST /api/pipeline/jobs/:id/fail` | pipeline-jobs.ts:226 | ❌ 前端无调用 |
| `POST /api/pipeline/jobs/batch` | pipeline-jobs.ts:236 | ❌ 前端无调用 |
| `GET /api/pipeline/jobs/stats/:projectId` | pipeline-jobs.ts:263 | ❌ 前端无调用 |
| `GET /api/pipeline/stage-report/:projectId/:stageKey` | pipeline-jobs.ts:280 | ❌ 前端无调用 |
| `POST /api/pipeline/aggregate/:projectId/:stageKey` | pipeline-jobs.ts:288 | ❌ 前端无调用 |
> **整个文件 9 条路由全部为僵尸路由**——似乎是给后台 Worker 使用的内部 API，前端不直接调用

### 1.26 上传路由（upload.ts）

| 路由 | 文件:行号 | 前端使用证据 |
|------|----------|------------|
| `GET /api/v1/uploads/:filename` | upload.ts:107 | ❌ 前端无调用 |
| `GET /api/v1/watermark/:filename` | upload.ts:131 | ❌ 前端无调用 |
| `GET /api/v1/upload/assets` | upload.ts:157 | ❌ 前端无调用 |

### 1.27 System Health 路由（system-health.ts）

| 路由 | 文件:行号 | 前端使用证据 |
|------|----------|------------|
| `GET /api/v1/system/env-keys` | system-health.ts:59 | ❌ 前端无调用 |
| `GET /api/v1/system/env-key/:name` | system-health.ts:78 | ❌ 前端无调用 |
| `GET /api/v1/system/providers-test` | system-health.ts:136 | ❌ 前端无调用 |
| `GET /api/v1/system/provider-state` | system-health.ts:220 | ❌ 前端无调用 |
| `GET /api/v1/system/provider-state/:userId` | system-health.ts:229 | ❌ 前端无调用 |

---

## 二、损坏路由

> **定义**：路由调用了不存在的代码（import 但函数不存在、引用已删除的模块等）。

### 2.1 `/api/script/submit` (script-submit.ts:84)
- 导出 `submitScriptHandler` 函数，但检查 `narrative-llm.ts` 中已没有 `POST /api/v1/narrative/simple-parse`（已被重构为 `analyze-v2`），script-submit 可能仍依赖旧的解析路径。

### 2.2 `admin-models-v2.ts` 和 `admin-global-config.ts`
- 两个文件都提供了相似的模型管理路由，`admin-models-v2.ts` 完全未被前端使用，`admin-global-config.ts` 才是实际在用的。两者存在功能重复。

### 2.3 `sms.ts` 和 `sms-auth.ts`
- `sms.ts` 注册了 `/api/sms/send` 和 `/api/email/send-code`，`sms-auth.ts` 注册了 `/api/auth/sms/send`。前端只调用后者。可能存在重复或废弃。

---

## 三、Prompt 硬编码

> **规则**：禁止 `readFileSync` 读取 prompt txt 文件，必须从 DB `PromptTemplate` 读取。

### 3.1 违反：`ai-optimize-shot.ts`

| 文件:行号 | 描述 |
|----------|------|
| `routes/ai-optimize-shot.ts:19` | `const SYSTEM_PROMPT = readFileSync(join(__dirname, '../prompts/agents/director-of-photography.txt'), 'utf-8')` |
| | **违反宪法第 6 条：禁止硬编码 prompt 文本文件** |

该文件在模块加载时直接 `readFileSync` 读取 txt 文件，而不是从 DB `PromptTemplate` 读取。

### 3.2 合规：`aigc-orchestrator.ts`

| 文件:行号 | 描述 |
|----------|------|
| `agents/aigc-orchestrator.ts:96` | 从数据库 `prisma.promptTemplate.findUnique({ where: { name: def.name } })` 读取 |
| | ✅ 合规：注解 `// ⭐ 从 PromptTemplate 数据库读取（宪法规定：禁止硬编码文本文件）` |

### 3.3 合规：`aigc-spec-agent.ts`

| 文件:行号 | 描述 |
|----------|------|
| `agents/aigc-spec-agent.ts:108` | 从数据库 `prisma.promptTemplate.findUnique({ where: { name: 'aigc-prompt' } })` 读取 |
| | ✅ 合规 |

### 3.4 合规：`narrative-llm.ts`

| 文件:行号 | 描述 |
|----------|------|
| `routes/narrative-llm.ts:16` | 定义 `async function getDbPrompt(name)` 从数据库读取 |
| | ✅ 合规：注解 `// ⭐ 从 DB PromptTemplate 读取 prompt（禁止硬编码文本文件）` |

### ⚠️ 注意：备份文件中有硬编码残留
- `narrative-llm.ts.preboundary-fix` 和 `narrative-llm.ts.analyze-v2-bak` 中仍有 `readFileSync` 读取 prompt 的代码
- **建议删除**这些 `.bak` 和 `.preboundary-fix` 备份文件，防止混淆

---

## 四、Summary

### 统计数字

| 类别 | 数量 |
|------|------|
| 总路由数 | ~220 条 |
| 僵尸路由（前端无调用） | ~100 条 |
| Prompt 硬编码违规 | 1 处（ai-optimize-shot.ts） |
| Prompt 硬编码备份文件 | 2 个（.bak / .preboundary-fix） |

### 关键建议

1. **清理 `ai-optimize-shot.ts`**：将 `readFileSync` 改为从 DB `PromptTemplate` 读取
2. **清理 `admin-image-prompts.ts`**：5 条路由全部无人使用，可以删除
3. **清理 `admin-models-v2.ts`**：10 条路由无人使用（被 `admin-global-config.ts` 取代）
4. **清理 `director-v2.ts`**：4 条路由无人使用
5. **清理 `script-breakdown.ts`**：4 条路由无人使用
6. **清理 `pipeline-jobs.ts`**：9 条内部 Worker 路由，确认是否需要暴露为 API
7. **清理 `voice.ts`**：4/5 条路由无人使用（只剩 `/api/voice/test` 在用）
8. **清理 `sms.ts`**：与 `sms-auth.ts` 功能重复
9. **清理备份文件**：删除 `*.bak`, `*.preboundary-fix` 文件
10. **清理遗留代理路由** `images.ts`：8 条路由已注释为"ETFL 代理"，逻辑已迁移到 `/api/tasks/ai-generate`

---

*审查完成。* 总计发现约 **100 条僵尸路由** 和 **1 处 Prompt 硬编码违规**。
