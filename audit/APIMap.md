# Audit K: API 审计 (APIMap.md)

## 1. API 路由树

### 1.1 后端 API 前缀分类

| 前缀 | 路由文件 | 用途 |
|------|---------|------|
| `/api/auth` | `routes/auth.ts` | 认证 |
| `/api/sms-auth` | `routes/sms-auth.ts` | 短信认证 |
| `/api/qq-oauth` | `routes/qq-oauth.ts` | QQ OAuth |
| `/api/wechat-oauth` | `routes/wechat-oauth.ts` | 微信 OAuth |
| `/api/projects` | `routes/projects.ts` | 项目管理 |
| `/api/projects-v2` | `routes/projects-v2.ts` | 项目 V2 |
| `/api/scenes` | `routes/scenes.ts` | 场景 |
| `/api/pipeline` | `routes/pipeline.ts` | 流水线 |
| `/api/models` | `routes/models.ts` | 模型管理 |
| `/api/agents` | `routes/agent-plan.ts` | Agent |
| `/api/voice` | `routes/voice.ts` | 语音 |
| `/api/tts` | `routes/tts.ts` | TTS |
| `/api/asr` | `routes/asr.ts` | ASR |
| `/api/music` | `routes/music.ts` | 音乐 |
| `/api/wallet` | `routes/wallet.ts` | 钱包 |
| `/api/payment` | `routes/payment.ts` | 支付 |
| `/api/captcha` | `routes/captcha.ts` | 验证码 |
| `/api/sms` | `routes/sms.ts` | 短信 |
| `/api/health` | `routes/health.ts` | 健康检查 |
| `/api/director` | `routes/director-v2.ts` | 导演系统 |
| `/api/v1/director` | (旧) | 旧导演 |
| `/api/v2/director` | (新) | 新导演 |
| `/api/tasks` | `routes/ai-tasks.ts` | AI 任务 |
| `/api/platform/` | `routes/platform/` | 平台管理 (14个子模块) |
| `/api/admin/` | `routes/admin-*.ts` | 后台管理 (18个路由) |
| `/api/hdz/` | `routes/hdz/` | HDZ 子系统 (12个路由) |
| `/api/geo/` | `services/geo/routes/` | GEO 子系统 |
| `/api/community/` | `routes/community/` | 社区 |
| `/api/semantic/` | `routes/semantic/` | 语义 |
| `/api/r11` | `routes/r11-console.ts` | R11 控制台 |
| `/api/p0` | `routes/p0-gateway-route.ts` | P0 网关 |
| `/api/p18` | `routes/p18-data-activation.ts` | P18 数据激活 |
| `/api/proxy-image` | `routes/proxy-image.ts` | 图片代理 |
| `/api/scripts` | `routes/script-breakdown.ts` | 剧本拆解 |
| `/api/styles` | `routes/style-profiles.ts` | 风格 |

## 2. 重复 API

| 重复 API | 文件 1 | 文件 2 |
|---------|--------|--------|
| Project CRUD | `routes/projects.ts` | `routes/projects-v2.ts` |
| Director | `routes/director-v2.ts` | `routes/director-v2.old.ts` 可能存在 |
| Admin 管理 | `routes/admin-*.ts` 18个 | `routes/platform/` 中部分重叠 |
| Model 管理 | `routes/models.ts` | `routes/admin-models-v2.ts` |
| Prompt 管理 | `routes/prompt-registry.ts` | `routes/admin-prompt-runtime.ts` |
| 任务管理 | `routes/ai-tasks.ts` | `routes/tasks-telemetry.ts` |

## 3. 废弃 API

| API | 状态 | 依据 |
|-----|------|------|
| v1/director | 废弃但保留 | 注释: "与老系统共存" |
| project-v2 | 过渡性 | 应合一到 projects |
| p0-gateway | 实验性 | P0 实验路由 |
| p1.8-evaluate | 实验性 | P1.8 实验路由 |

## 4. 无人调用 API 检测

通过搜索前端 fetch/axios 调用识别:

| API 路径 | 后端文件 | 前端引用 | 状态 |
|---------|---------|---------|------|
| `/api/v1/exports/download` | `storage/artifact-storage.ts:51` | 未找到引用 | 可能废弃 |
| `/api/desktop/video/check` | `routes/desktop-video.ts` | 有引用 | 可用 |
| `/api/r11/drift/timeline` | `routes/r11-console.ts` | 有引用 | 可用 |
| `/api/p0/gateway` | `p0-gateway-route.ts` | 仅后端引用 | 废弃? |

## 5. 前端 API 调用方式混乱

前端使用了 3 种不同的 HTTP 客户端:

| 客户端 | 使用位置 | 使用量 |
|--------|---------|--------|
| `fetch()` | 大部分 pages | 广泛使用 |
| `$fetch` | 少量 pages | Nuxt 内置 |
| `ofetch` | GEO workspace | 特定 |
| `apiKernel.execute()` | composables/usePipeline | 自定义封装 |

**问题**: 混合使用导致:
- 认证头设置方式不统一
- 错误处理不一致
- 难以统一拦截/重试

## 6. 建议

1. **统一 API 客户端**: 只使用 `apiKernel` 或 `$fetch`
2. **消除重复 API**: 合并 projects/projects-v2
3. **清理废弃 API**: 删除 P0/P1.8 实验路由
4. **API 版本策略**: 明确 API version 策略 (v1/v2)
5. **API 目录文档**: 生成完整 swagger/openapi 文档
