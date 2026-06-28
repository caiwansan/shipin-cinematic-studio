# API 一致性审查报告

> 审查时间：2026-06-02
> 审查范围：后端 `/root/shipin-cinematic-studio/backend/src/routes/*.ts` ↔ 前端 `/root/shipin-cinematic-studio/frontend/studio-v2/`

---

## 前端有但后端无的路由

### 1. `PATCH /api/executions/:pid`
| 前端调用 | 文件 | 行号 |
|---------|------|------|
| `fetch(\`/api/executions/${pid}\`, { method: 'PATCH' })` | `workspace/video-generation/VideoGenerationWorkspace.vue` | 1413 |

> **说明：** 前端在视频生成完成后，尝试对 `/api/executions/:pid` 发 `PATCH` 请求，但后端所有路由文件中均无 `/api/executions/` 相关的路由注册。后端仅有 `/api/projects/:id/execution-results` 和 `/api/projects/:id/hydrate` 等，无独立的 `/api/executions/` 资源路由。

---

## 后端有但前端无的路由（孤立路由）

以下后端路由在前端 `studio-v2` 中没有任何 `fetch` 调用（可能由其他客户端或内部服务调用）：

### 认证 / 用户
| 后端路由 | 文件 |
|---------|------|
| `POST /api/auth/register` | auth.ts:11 |
| `POST /api/auth/login` | auth.ts:161 |
| `POST /api/auth/refresh` | auth.ts:182 |
| `GET /api/auth/user-by-email` | auth.ts:188 |
| `GET /api/auth/me` | auth.ts:209 |
| `GET /api/auth/plans` | auth.ts:236 |
| `POST /api/auth/logout` | auth.ts:254 |
| `GET /api/captcha` | captcha.ts:27 |
| `POST /api/sms/send` | sms.ts:8 |
| `POST /api/email/send-code` | sms.ts:46 |
| `POST /api/auth/sms/send` | sms-auth.ts:119 |
| `POST /api/auth/sms/login` | sms-auth.ts:173 |
| `POST /api/auth/sms/reset-password` | sms-auth.ts:265 |
| `GET /api/admin/sms-auth/config` | sms-auth.ts:67 |
| `PUT /api/admin/sms-auth/config` | sms-auth.ts:87 |

### 项目
| 后端路由 | 文件 |
|---------|------|
| `GET /api/projects` | projects.ts:9 |
| `GET /api/projects/:id` | projects.ts:15 |
| `POST /api/projects` | projects.ts:21 |
| `POST /api/projects/full-create` | projects.ts:28 |
| `POST /api/projects/:id/save-specs` | projects.ts:37 |
| `PUT /api/projects/:id` | projects.ts:109 |
| `DELETE /api/projects/:id` | projects.ts:124 |
| `GET /api/projects/:id/hydrate` | projects.ts:130 |
| `GET /api/projects/:id/execution-results` | projects.ts:141 |
| `PUT /api/projects/:id/execution-results` | projects.ts:153 |
| `GET /api/projects/:projectId/scenes` | scenes.ts:7 |
| `GET /api/scenes/:id` | scenes.ts:13 |
| `POST /api/projects/:projectId/scenes` | scenes.ts:19 |
| `PUT /api/scenes/:id` | scenes.ts:26 |
| `DELETE /api/scenes/:id` | scenes.ts:33 |
| `GET /api/projects/:projectId/storyboards` | storyboards.ts:10 |
| `GET /api/storyboards/:id` | storyboards.ts:16 |
| `POST /api/projects/:projectId/storyboards` | storyboards.ts:22 |
| `PUT /api/storyboards/:id` | storyboards.ts:29 |
| `DELETE /api/storyboards/:id` | storyboards.ts:36 |
| `POST /api/projects/:projectId/storyboards/generate` | storyboards.ts:44 |

### V1 项目（projects-v2）
| 后端路由 | 文件 |
|---------|------|
| `POST /api/v1/projects` | projects-v2.ts:89 |
| `GET /api/v1/projects` | projects-v2.ts:118 |
| `GET /api/v1/projects/:id` | projects-v2.ts:160 |
| `GET /api/v1/projects/:id/stream` | projects-v2.ts:176 |
| `PUT /api/v1/projects/:id` | projects-v2.ts:224 |
| `DELETE /api/v1/projects/:id` | projects-v2.ts:236 |
| `DELETE /api/v1/projects/:id/clear` | projects-v2.ts:247 |

### Pipeline
| 后端路由 | 文件 |
|---------|------|
| `GET /api/pipeline/graph/:projectId` | pipeline.ts:20 |
| `GET /api/pipeline/stages/:projectId` | pipeline.ts:29 |
| `GET /api/pipeline/stage/:projectId/:stageKey` | pipeline.ts:55 |
| `PUT /api/pipeline/stage/:projectId/:stageKey` | pipeline.ts:67 |
| `GET /api/pipeline/prerequisites/:projectId/:stageKey` | pipeline.ts:115 |
| `POST /api/pipeline/graph/recalc` | pipeline.ts:154 |
| `GET /api/pipeline/references/:projectId/:type` | pipeline.ts:163 |
| `GET /api/pipeline/jobs/:projectId` | pipeline-jobs.ts:187 |
| `POST /api/pipeline/jobs/create` | pipeline-jobs.ts:196 |
| `POST /api/pipeline/jobs/poll` | pipeline-jobs.ts:207 |
| `POST /api/pipeline/jobs/:id/complete` | pipeline-jobs.ts:216 |
| `POST /api/pipeline/jobs/:id/fail` | pipeline-jobs.ts:226 |
| `POST /api/pipeline/jobs/batch` | pipeline-jobs.ts:236 |
| `GET /api/pipeline/jobs/stats/:projectId` | pipeline-jobs.ts:263 |
| `GET /api/pipeline/stage-report/:projectId/:stageKey` | pipeline-jobs.ts:280 |
| `POST /api/pipeline/aggregate/:projectId/:stageKey` | pipeline-jobs.ts:288 |

### 图片 / 视频（images routes）
| 后端路由 | 文件 |
|---------|------|
| `POST /api/images/generate` | images.ts:87 |
| `POST /api/images/generate-and-download` | images.ts:90 |
| `POST /api/videos/generate` | images.ts:94 |
| `POST /api/images/save` | images.ts:152 |
| `GET /api/videos/status/:taskId` | images.ts:203 |
| `GET /api/videos/download-all/:projectId` | images.ts:222 |

### 执行图片（execution-images routes）
| 后端路由 | 文件 |
|---------|------|
| `POST /api/execution-images/characters` | execution-images.ts:85 |
| `PUT /api/execution-images/characters` | execution-images.ts:238 |
| `GET /api/execution-images/characters/:projectId` | execution-images.ts:271 |
| `POST /api/execution-images/scenes` | execution-images.ts:287 |
| `PUT /api/execution-images/scenes` | execution-images.ts:408 |
| `GET /api/execution-images/scenes/:projectId` | execution-images.ts:440 |
| `PUT /api/execution-images/storyboards` | execution-images.ts:455 |
| `GET /api/execution-images/all/:projectId` | execution-images.ts:505 |
| `GET /api/execution-images/prop-images/:projectId` | execution-images.ts:524 |
| `PUT /api/execution-images/frames` | execution-images.ts:541 |
| `GET /api/execution-images/frames/:projectId` | execution-images.ts:557 |
| `GET /api/execution-images/videos/:projectId` | execution-images.ts:572 |
| `POST /api/execution-images/migrate/:projectId` | execution-images.ts:583 |
| `POST /api/execution-images/refresh/:projectId` | execution-images.ts:721 |
| `GET /api/execution-images/proxy` | execution-images.ts:866 |
| `DELETE /api/execution-images/characters/:id` | execution-images.ts:898 |
| `DELETE /api/execution-images/scenes/:id` | execution-images.ts:912 |
| `POST /api/v1/aigc-spec/generate-prop-image` | execution-images.ts:928 |

### 社区（Community）
| 后端路由 | 文件 |
|---------|------|
| `GET /api/community/categories` | community/categories.ts:6 |
| `GET /api/community/posts` | community/posts.ts:8 |
| `GET /api/community/sidebar` | community/posts.ts:74 |
| `POST /api/community/posts` | community/posts.ts:99 |
| `GET /api/community/posts/:id` | community/posts.ts:165 |
| `DELETE /api/community/posts/:id` | community/posts.ts:225 |
| `GET /api/community/admin/posts` | community/posts.ts:269 |
| `PATCH /api/community/admin/posts/:id/approve` | community/posts.ts:298 |
| `PATCH /api/community/admin/posts/:id/reject` | community/posts.ts:302 |
| `PATCH /api/community/admin/posts/:id/pin` | community/posts.ts:308 |
| `PATCH /api/community/admin/posts/:id/essence` | community/posts.ts:315 |
| `DELETE /api/community/admin/posts/:id` | community/posts.ts:322 |
| `POST /api/community/comments` | community/comments.ts:8 |
| `DELETE /api/community/comments/:id` | community/comments.ts:78 |
| `POST /api/community/likes` | community/likes.ts:6 |
| `GET /api/community/posts/:id/likes/status` | community/likes.ts:71 |

### 会员
| 后端路由 | 文件 |
|---------|------|
| `GET /api/member/coin-logs` | member.ts:62 |
| `GET /api/member/recharge-plans` | member.ts:88 |
| `POST /api/member/recharge` | member.ts:92 |
| `GET /api/member/assets` | member.ts:148 |
| `DELETE /api/member/assets/:id` | member.ts:162 |
| `POST /api/member/upgrade-storage` | member.ts:183 |
| `GET /api/member/agent-levels` | member.ts:240 |
| `POST /api/member/apply-agent` | member.ts:245 |
| `POST /api/member/transfer` | member.ts:290 |
| `GET /api/member/referral-info` | member.ts:353 |
| `GET /api/member/plans` | member.ts:384 |
| `POST /api/member/upgrade-vip` | member.ts:397 |
| `POST /api/member/submit-payment` | member.ts:548 |
| `POST /api/member/pay-confirm` | member.ts:576 |
| `GET /api/payment/alipay/status/:orderId` | member.ts:972 |

### 用户中心
| 后端路由 | 文件 |
|---------|------|
| `GET /api/user/credits/logs` | user-center.ts:13 |
| `POST /api/user/credits/consume` | user-center.ts:29 |
| `POST /api/user/credits/recharge` | user-center.ts:60 |
| `GET /api/user/library` | user-center.ts:105 |
| `GET /api/user/library/:id` | user-center.ts:121 |
| `POST /api/user/regenerate-thumbnails` | user-center.ts:140 |
| `DELETE /api/user/library/:id` | user-center.ts:175 |
| `GET /api/universe/works` | user-center.ts:198 |
| `POST /api/universe/works/:id/like` | user-center.ts:261 |
| `POST /api/universe/works/:id/comment` | user-center.ts:277 |
| `GET /api/universe/clusters` | user-center.ts:293 |
| `POST /api/universe/rescore` | user-center.ts:301 |
| `GET /api/universe/creator-dna` | user-center.ts:308 |
| `GET /api/user/promo` | user-center.ts:343 |
| `POST /api/user/agent/apply` | user-center.ts:379 |
| `GET /api/user/agent/status` | user-center.ts:422 |
| `GET /api/user/client/versions` | user-center.ts:452 |
| `GET /api/user/client/download/:platform` | user-center.ts:464 |
| `GET /api/user/referral-code` | user-center.ts:482 |
| `GET /api/user/gallery` | user-center.ts:495 |
| `DELETE /api/user/gallery/:type/:id` | user-center.ts:643 |
| `GET /api/user/storage` | user-center.ts:701 |
| `GET /api/user/usage` | user-center.ts:768 |

### API Keys
| 后端路由 | 文件 |
|---------|------|
| `GET /api/user/api-keys` | api-keys.ts:52 |
| `POST /api/user/api-keys` | api-keys.ts:84 |
| `DELETE /api/user/api-keys/:provider` | api-keys.ts:150 |
| `GET /api/user/api-keys/status` | api-keys.ts:163 |

### 消息
| 后端路由 | 文件 |
|---------|------|
| `POST /api/messages/send` | messages.ts:10 |
| `GET /api/messages/conversations` | messages.ts:32 |
| `GET /api/messages/:userId` | messages.ts:69 |
| `GET /api/messages/unread/count` | messages.ts:107 |
| `DELETE /api/messages/:id` | messages.ts:116 |
| `GET /api/messages/users/search` | messages.ts:131 |

### 系统 / 健康
| 后端路由 | 文件 |
|---------|------|
| `GET /api/v1/system/env-keys` | system-health.ts:59 |
| `GET /api/v1/system/env-key/:name` | system-health.ts:78 |
| `GET /api/v1/system/health` | system-health.ts:93 |
| `GET /api/v1/system/providers-test` | system-health.ts:136 |
| `GET /api/v1/system/provider-state` | system-health.ts:220 |
| `GET /api/v1/system/provider-state/:userId` | system-health.ts:229 |
| `GET /api/v1/system/version` | system-version.ts (implied) |
| `GET /api/v1/models/available` | models.ts:75 |
| `GET /api/public/global-models` | admin-global-config.ts:544 |

### 上传
| 后端路由 | 文件 |
|---------|------|
| `POST /api/v1/upload/asset` | upload.ts:15 |
| `POST /api/v1/upload/local` | upload.ts:54 |
| `GET /api/v1/uploads/:filename` | upload.ts:107 |
| `GET /api/v1/watermark/:filename` | upload.ts:131 |
| `GET /api/v1/upload/assets` | upload.ts:157 |

### 语音 / TTS
| 后端路由 | 文件 |
|---------|------|
| `POST /api/tts/synthesize` | tts.ts:76 |
| `POST /api/tts/generate` | tts.ts:79 |
| `GET /api/tts/voices` | tts.ts:82 |
| `POST /api/voice/design` | voice.ts:41 |
| `POST /api/voice/clone` | voice.ts:72 |
| `GET /api/voice/presets` | voice.ts:103 |
| `DELETE /api/voice/presets/:id` | voice.ts:128 |
| `POST /api/voice/test` | voice.ts:142 |
| `GET /api/voice/records` | voice.ts:175 |

### 导演 / 叙事
| 后端路由 | 文件 |
|---------|------|
| `POST /api/v2/director/generate` | director-v2.ts:20 |
| `GET /api/v2/director/preview` | director-v2.ts:37 |
| `POST /api/v2/director/refine` | director-v2.ts:51 |
| `GET /api/v2/director/status` | director-v2.ts:65 |
| `POST /api/v1/narrative/analyze` | narrative-llm.ts:153 |
| `POST /api/v1/narrative/analyze-v2` | narrative-llm.ts:224 |
| `POST /api/v1/narrative/deep-analyze` | narrative-llm.ts:479 |
| `PUT /api/v1/narrative/duration` | narrative-llm.ts:650 |
| `POST /api/v1/narrative/optimize-prompt` | narrative-llm.ts:667 |
| `POST /api/v1/narrative/regen-spec` | narrative-llm.ts:690 |
| `POST /api/v1/narrative/simple-parse` | narrative-llm.ts:947 |
| `POST /api/v1/script-breakdown` | script-breakdown.ts:96 |
| `GET /api/v1/script-breakdown/:id` | script-breakdown.ts:71 |
| `GET /api/v1/script-breakdown` | script-breakdown.ts:82 |
| `POST /api/v1/script-breakdown/:id/submit` | script-breakdown.ts:127 |
| `POST /api/v1/script/parse` | script-submit.ts:173 |

### 模型配置
| 后端路由 | 文件 |
|---------|------|
| `POST /api/v2/user/model-config/unified` | unified-model-config.ts:15 |
| `GET /api/v2/user/model-config/unified` | unified-model-config.ts:49 |

### 客服
| 后端路由 | 文件 |
|---------|------|
| `GET /api/v1/customer-service/history` | customer-service.ts:495 |
| `DELETE /api/v1/customer-service/session/:sessionId` | customer-service.ts:510 |
| `GET /api/v1/customer-service/status` | customer-service.ts:528 |

### OAuth / 第三方登录
| 后端路由 | 文件 |
|---------|------|
| `GET /api/admin/wechat-oauth/config` | wechat-oauth.ts:19 |
| `PUT /api/admin/wechat-oauth/config` | wechat-oauth.ts:34 |
| `GET /api/auth/wechat/authorize` | wechat-oauth.ts:53 |
| `GET /api/auth/wechat/callback` | wechat-oauth.ts:67 |
| `POST /api/auth/wechat/callback` | wechat-oauth.ts:119 |
| `GET /api/auth/wechat/status` | wechat-oauth.ts:225 |
| `GET /api/admin/qq-oauth/config` | qq-oauth.ts:21 |
| `PUT /api/admin/qq-oauth/config` | qq-oauth.ts:36 |
| `GET /api/auth/qq/authorize` | qq-oauth.ts:55 |
| `GET /api/auth/qq/callback` | qq-oauth.ts:75 |
| `POST /api/auth/qq/callback` | qq-oauth.ts:176 |
| `GET /api/auth/qq/status` | qq-oauth.ts:281 |

### 支付
| 后端路由 | 文件 |
|---------|------|
| `GET /api/admin/payment/secret/:channel` | payment.ts:25 |
| `PUT /api/admin/payment/secret/:channel` | payment.ts:43 |
| `GET /api/admin/payment/config` | payment.ts:77 |
| `POST /api/admin/payment/config` | payment.ts:91 |
| `POST /api/admin/payment/qr` | payment.ts:130 |
| `GET /api/payment/methods` | payment.ts:152 |
| `POST /api/payment/recharge` | payment.ts:197 |
| `POST /api/admin/payment/confirm` | payment.ts:249 |
| `POST /api/admin/member/confirm` | payment.ts:327 |
| `POST /api/admin/payment/reject` | payment.ts:387 |
| `GET /api/admin/payment/orders` | payment.ts:408 |
| `GET /api/user/payment/orders` | payment.ts:463 |
| `POST /api/admin/payment/upload-qr` | payment.ts:486 |
| `POST /api/admin/cache/clear` | payment.ts:524 |
| `GET /api/admin/cache/stats` | payment.ts:587 |
| `PUT /api/admin/bailian/config` | payment.ts:615 |
| `POST /api/admin/bailian/test` | payment.ts:654 |

### 管理后台（Admin）
| 后端路由 | 文件 |
|---------|------|
| `GET /api/admin/vip-orders` | member.ts:638 |
| `POST /api/admin/vip-orders/:id/approve` | member.ts:691 |
| `POST /api/admin/vip-orders/:id/reject` | member.ts:757 |
| `GET /api/admin/member-plans` | member.ts:784 |
| `POST /api/admin/member-plans` | member.ts:792 |
| `PUT /api/admin/member-plans/:id` | member.ts:815 |
| `DELETE /api/admin/member-plans/:id` | member.ts:836 |
| `POST /api/admin/member-plans/:id/toggle` | member.ts:845 |
| `GET /api/admin/members` | member.ts:859 |
| `POST /api/admin/members` | member.ts:881 |
| `PUT /api/admin/members/:id` | member.ts:906 |
| `DELETE /api/admin/members/:id` | member.ts:963 |
| `GET /api/admin/agents` | admin-agents.ts:17 |
| `POST /api/admin/agents` | admin-agents.ts:25 |
| `PUT /api/admin/agents/:id` | admin-agents.ts:51 |
| `DELETE /api/admin/agents/:id` | admin-agents.ts:68 |
| `GET /api/admin/api-keys` | admin-api-keys.ts:23 |
| `POST /api/admin/api-keys` | admin-api-keys.ts:38 |
| `PUT /api/admin/api-keys/:id` | admin-api-keys.ts:60 |
| `DELETE /api/admin/api-keys/:id` | admin-api-keys.ts:80 |
| `GET /api/admin/customer-service/settings` | admin-customer-service.ts:33 |
| `PUT /api/admin/customer-service/settings` | admin-customer-service.ts:57 |
| `GET /api/admin/global-models` | admin-global-config.ts:256 |
| `PUT /api/admin/global-models` | admin-global-config.ts:293 |
| `PUT /api/admin/global-models/toggle` | admin-global-config.ts:332 |
| `PUT /api/admin/global-models/save-models` | admin-global-config.ts:360 |
| `PUT /api/admin/global-models/sync-aliyun` | admin-global-config.ts:386 |
| `GET /api/admin/global-models/sync-aliyun-models` | admin-global-config.ts:467 |
| `GET /api/admin/image-prompt-templates` | admin-image-prompts.ts:17 |
| `GET /api/admin/image-prompt-templates/:type` | admin-image-prompts.ts:28 |
| `POST /api/admin/image-prompt-templates` | admin-image-prompts.ts:41 |
| `PATCH /api/admin/image-prompt-templates/:id` | admin-image-prompts.ts:75 |
| `DELETE /api/admin/image-prompt-templates/:id` | admin-image-prompts.ts:98 |
| `GET /api/admin/members-storage` | admin-members-storage.ts:9 |
| `GET /api/admin/provider-keys` | admin-models.ts:21 |
| `PUT /api/admin/provider-keys/:provider` | admin-models.ts:36 |
| `GET /api/admin/models` | admin-models-v2.ts:31 |
| `POST /api/admin/models` | admin-models-v2.ts:38 |
| `PUT /api/admin/models/:id` | admin-models-v2.ts:62 |
| `PATCH /api/admin/models/:id/toggle` | admin-models-v2.ts:87 |
| `DELETE /api/admin/models/:id` | admin-models-v2.ts:102 |
| `GET /api/admin/apikeys` | admin-models-v2.ts:112 |
| `POST /api/admin/apikeys` | admin-models-v2.ts:126 |
| `DELETE /api/admin/apikeys/:provider` | admin-models-v2.ts:139 |
| `POST /api/admin/models/:id/test` | admin-models-v2.ts:147 |
| `GET /api/admin/models/groups` | admin-models-v2.ts:154 |
| `GET /api/admin/storage-config` | admin-storage-config.ts:32 |
| `POST /api/admin/storage-config` | admin-storage-config.ts:50 |
| `DELETE /api/admin/storage-config/:id` | admin-storage-config.ts:91 |
| `POST /api/admin/storage-config/:id/default` | admin-storage-config.ts:106 |
| `POST /api/admin/storage-config/:id/toggle` | admin-storage-config.ts:122 |

### 其他
| 后端路由 | 文件 |
|---------|------|
| `GET /api/props/:projectId` | images.ts:192 |
| `GET /api/projects/:id/character-makeup-images` | images.ts:260 |
| `GET /api/execution-images/storyboards/:projectId` | execution-images.ts:479 |

---

## 已匹配的路由摘要（前端有 → 后端也有）

以下前端调用的路由在后端找到了对应注册：

| 前端 URL | 后端路由 | 后端文件 |
|---------|---------|---------|
| `GET/POST/DELETE /api/execution-images/characters`(及ID变体) | `/execution-images/characters` (with `/api` prefix) | execution-images.ts |
| `GET/POST/DELETE /api/execution-images/scenes`(及ID变体) | `/execution-images/scenes` (with `/api` prefix) | execution-images.ts |
| `GET/PUT /api/execution-images/storyboards`(及ID变体) | `/execution-images/storyboards` (with `/api` prefix) | execution-images.ts |
| `GET /api/execution-images/all/:projectId` | `/execution-images/all/:projectId` (with `/api` prefix) | execution-images.ts |
| `GET /api/execution-images/storyboards/all` | `/execution-images/storyboards/all` (with `/api` prefix) | execution-images.ts |
| `POST /api/tasks/ai-generate` | `/api/tasks/ai-generate` | ai-tasks.ts:26 |
| `GET /api/tasks/:id/status` | `/api/tasks/:id/status` | ai-tasks.ts:151 |
| `GET /api/tasks/:id/result` | `/api/tasks/:id/result` | ai-tasks.ts:189 |
| `POST /api/script/submit` | `/api/script/submit` | script-submit.ts:84 |
| `POST /api/script/regenerate` | `/api/script/regenerate` | script-submit.ts:243 |
| `POST /api/ai/optimize-shot-script` | `/api/ai/optimize-shot-script` | ai-optimize-shot.ts:37 |
| `GET /api/v1/narrative/duration` | `/api/v1/narrative/duration` | narrative-llm.ts:633 |
| `GET/POST /api/v2/workbench/project` | `/api/v2/workbench/project` | workbench-project.ts |
| `GET/PUT/DELETE /api/v2/workbench/project/:id` | `/api/v2/workbench/project/:id` | workbench-project.ts |
| `GET /api/v2/workbench/projects` | `/api/v2/workbench/projects` | workbench-project.ts |
| `POST /api/v2/workbench/project/:id/save-image` | `/api/v2/workbench/project/:id/save-image` | workbench-project.ts |
| `POST /api/v2/workbench/project/:id/save-video` | `/api/v2/workbench/project/:id/save-video` | workbench-project.ts |
| `POST /api/v2/workbench/upload-reference` | `/api/v2/workbench/upload-reference` | workbench-project.ts |
| `GET /api/member/profile` | `/api/member/profile` | member.ts:12 |
| `GET /api/user/profile` | `/api/user/profile` | auth.ts:242 |
| `POST /api/aigc-spec/:projectId/save` | `/api/aigc-spec/:projectId/save` | aigc-spec-db.ts:307 |
| `GET /api/aigc-spec/:projectId/load` | `/api/aigc-spec/:projectId/load` | aigc-spec-db.ts:309 |
| `POST /api/v1/aigc-spec/generate-prop-image` | `/api/v1/aigc-spec/generate-prop-image` | execution-images.ts:928 |
| `GET /api/pipeline/stage/:projectId/:stageKey` | `/api/pipeline/stage/:projectId/:stageKey` | pipeline.ts:55 |

---

## 关键发现

### 🔴 严重 —— 前端调用无后端路由
- **`PATCH /api/executions/:pid`** — 在 `VideoGenerationWorkspace.vue:1413` 中调用，后端完全无此路由

### 🟡 备注 —— 前后端路由前缀不一致（但已通过 prefix 注册解决）
- `execution-images/` 系列后端路由写的是 `/execution-images/...`，但通过 `app.register(executionImageRoutes, { prefix: '/api' })` 实际对外暴露为 `/api/execution-images/...`
- `images/`、`videos/` 、`props/` 等后端路由同理，通过 `imageRoutes` 注册的 `{ prefix: '/api' }` 补全

### 📊 统计
| 类别 | 数量 |
|------|------|
| 前端 fetch 调用总数 | ~58 处 |
| 前端唯一 API 路径数 | ~30 个 |
| 后端唯一路由总数 | ~309 条 |
| 前端有但后端无 | **1 条**（`PATCH /api/executions/:pid`） |
| 后端有前端无（孤立路由） | ~250+ 条（绝大多数是管理后台、认证、内部服务路由） |
