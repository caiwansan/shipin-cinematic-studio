# Architecture Convergence v1 — Production Ready Baseline

**Frozen at:** 2026-06-27 18:05 CST  
**Audit Lead:** 熊二  
**Approved:** 熊大

## Frozen Core

以下模块已收敛为单一生产链路，**除非发现严重缺陷，不得修改**：

| Module | Status | Notes |
|--------|--------|-------|
| Credential Pipeline | ✅ Frozen | UserModelConfigV2 → resolveProviderFromUserConfig → RuntimePayload |
| RuntimeCredential | ✅ Frozen | runtime/runtime-credential.ts — 唯一凭据接口 |
| ModelAdapterRegistry | ✅ Frozen | model-adapters/registry.ts — 唯一 Provider Dispatch |
| Worker Runtime | ✅ Frozen | queue/worker-runtime.ts — RuntimePayload 消费 |
| Adapter Registration | ✅ Frozen | model-adapters/{video,image,llm,tts}/index.ts — 注册入口 |

## Deleted

旧 `production-loop/video/` 目录下 6 个死文件已物理删除：

- `volcengine.video.ts` — 旧火山引擎视频 Provider（const API_KEY = ''）
- `bailian.video.ts` — 旧阿里百炼 Provider（const BAILIAN_KEY = ''）
- `replicate.video.ts` — 旧 Replicate Provider（const REPLICATE_KEY = ''）
- `mock.video.ts` — Mock Provider（仅用于未注册的旧链路）
- `video-provider.ts` — 旧 VideoProviderRegistry（被 ModelAdapterRegistry 取代）
- `init.ts` — 旧启动器（initVideoProviders 从未被调用）

**保留且已改造：**
- `volcengine.image.ts` — 已改为 Credential Injection 模式（setVolcImageCredential）

## Architecture (Post-Convergence)

```
UserModelConfigV2 (AES encrypted)
  ↓ resolveProviderFromUserConfig()
RuntimePayload { apiKey, provider, model, baseURL }
  ↓ WorkerRuntime / queue
ModelAdapterRegistry.execute(runtime, input)
  ↓ Adapter (video/image/llm/tts)
  ↓ Provider API
```

**核心原则：**
- Provider 不读取 `.env`
- Provider 不访问数据库
- Provider 不解析用户配置
- Provider 仅消费 `RuntimePayload.apiKey`

## Known Issues (not blocking)

| Issue | Impact | Resolution |
|-------|--------|------------|
| Prisma QueryEngine debian-openssl-3.0.x 不匹配 | 日志错误，服务仍运行 | 需更新 `schema.prisma` binaryTargets |
| 43 用户仅 6 人配置了 UserModelConfigV2 | 新用户首体验为空 | P4-0 Provider Configuration Wizard |
| demo 用户无 API Key | E2E 返回"用户未配置大模型" | 业务配置状态，非架构问题 |

## Phase 4 路线图 (Updated 2026-06-27)

### P4-1 Provider Onboarding（最高优先级）
目标：把"技术可用"变成"用户可用"

- [ ] **Provider Configuration Wizard** — 新用户首次进入工作台时检测无 Provider，引导配置
- [ ] **多 Provider 支持** — DeepSeek / OpenAI / 火山 / 阿里百炼 / Gemini / Claude / SiliconFlow / Ollama
- [ ] **Key 实时验证** — 输入后 Test Connection，确认有效再保存
- [ ] **Provider Health 记录** — 保存时记录状态/延迟/可用模型/配额

### P4-2 Runtime Governance（基础设施治理）
- [ ] **Runtime Timeout** — LLM 60s, Image 5m, Video 10m, TTS 30s
- [ ] **Retry Policy** — 网络瞬时→重试, 429→指数退避, 无效 Key→立即失败
- [ ] **Circuit Breaker** — 连续失败 N 次→OPEN→半开恢复
- [ ] **Provider Health Check** — 持续健康探测

### P4-3 Runtime Observability（可观测性）
- [ ] **Runtime Trace** — 统一 Request → Queue → Worker → Adapter → Provider → Result 全链路追踪
- [ ] **Metrics 采集** — 请求量/成功率/重试率/超时率/延迟/Token 用量/成本

### P4-4 Provider Policy（策略引擎）
- [ ] **Provider 自动 Failover** — 主 Provider 失败→自动切换备选
- [ ] **Provider 智能路由** — 按成本/延迟/质量动态选择

### P4-5 Runtime Dashboard（运维面板）
- [ ] 今日调用 / 成功率 / Provider 排名 / 平均耗时 / 失败原因 / 成本统计

### P4-6 Capability Registry（能力扩展）
- [ ] 统一注册 Capability → Provider → Model → Policy → Runtime
- [ ] 未来能力（Music / GEO / PPT / Novel / Search / Browser / OCR / ASR）无需修改 Runtime 主流程

## 下一步

`production-loop/prompt-compiler.ts` 仍被 `runtime/feedback-loop/` 引用，需单独审计后再决定保留/迁移/重构。建议在 Phase 4 期间并行处理。
