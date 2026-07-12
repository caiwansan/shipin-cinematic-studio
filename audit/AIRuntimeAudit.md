# Audit B: AI Runtime 审计 (AIRuntimeAudit.md)

## 1. AI 调用链路总览

昆仑镜系统存在 4 条独立的 AI 调用路径:

### 路径 1: Runtime 主路径 (正确链路)
```
Page → Route → runtime/runtime-gateway.ts 
  → runtime/provider-registry.ts 
    → runtime/providers/* (deepseek, openai, image.base)
      → Provider API (DashScope/VolcEngine/SiliconFlow)
```

**涉及文件**: `runtime/index.ts`, `runtime/runtime-gateway.ts`, `runtime/provider-registry.ts`, `runtime/providers/deepseek.provider.ts`, `runtime/providers/openai.provider.ts`

### 路径 2: Model-Adapter 路径 (绕过 Runtime)
```
Page → Route → model-adapters/* 
  → Provider API (直连)
```

**涉及文件**: `model-adapters/video/aliyun-video.adapter.ts`, `model-adapters/video/volcengine-video.adapter.ts`, `model-adapters/tts/aliyun-tts.adapter.ts`, `model-adapters/images/wan-image.adapter.ts`

**绕过**: 不经过 `runtime/provider-registry`, 不经过 `runtime-guard`, 不经过 quota check

### 路径 3: Queue/Worker 路径 (绕过 Runtime)
```
Page → Route → queue/queue-manager.ts 
  → BullMQ → queue/worker-runtime.ts 
    → Provider API (直连)
```

**涉及文件**: `queue/worker-runtime.ts`, `queue/queue-manager.ts`, `queue/frame-sequence-engine.ts`

**绕过**: worker-runtime 直接从 payload 读取 `apiKey` 和 `baseURL`，绕过 credential 管理和 quota guard

### 路径 4: 服务直连路径 (完全绕过)
```
Page → Route → services/*.ts 
  → fetch() → Provider API
```

**涉及文件**:
- `routes/customer-service.ts:287` — `fetch` 直接调用 LLM
- `routes/narrative-llm.ts` — 直接调 LLM
- `services/deepseek-llm.provider.ts` — 直连 DeepSeek
- `services/xinghuo-ws.provider.ts` — 直连星火
- `production-loop/render-executor.ts` — 直连视频 Provider
- `production-loop/video/*.ts` — 直连百炼视频

## 2. Provider 管理

### 2.1 Provider Registry

`runtime/provider-registry.ts` 实现了统一的 Provider 注册和路由。但以下路径未使用:
- 路径 2 (model-adapters) — 不使用 Registry
- 路径 3 (queue/worker-runtime) — 不使用 Registry
- 路径 4 (services direct) — 不使用 Registry

### 2.2 凭证管理

`runtime/runtime-credential.ts` 中的凭证管理未被所有路径使用:
- 路径 1: ✅ 使用
- 路径 2: ❌ 直接通过 .env 读取
- 路径 3: ❌ 从 payload 读取
- 路径 4: ❌ 直接从 process.env 读取

## 3. Guard 检查覆盖率

| Guard | 路径1 (Runtime) | 路径2 (Adapter) | 路径3 (Queue) | 路径4 (Direct) |
|-------|:---:|:---:|:---:|:---:|
| quota check | ✅ | ❌ | ❌ | ❌ |
| permission check | ✅ | ❌ | ❌ | ❌ |
| rate limit | ✅ | ❌ | ❌ | ❌ |
| cost tracking | ✅ | ❌ | ❌ | ❌ |
| audit log | ✅ | ❌ | ❌ | ❌ |
| circuit breaker | ✅ | ❌ | ❌ | ❌ |
| telemetry | ✅ | ❌ | ❌ | ❌ |

## 4. 具体绕过漏洞

| 漏洞 ID | 位置 | 文件:行号 | 绕过内容 |
|---------|------|-----------|---------|
| B-001 | customer-service | `routes/customer-service.ts:287` | 直接 fetch LLM API |
| B-002 | narrative-llm | `routes/narrative-llm.ts:44` | 手动 jwt + 直接调 LLM |
| B-003 | aliyun-video | `model-adapters/video/aliyun-video.adapter.ts:204` | 直连 DashScope |
| B-004 | volcengine-video | `model-adapters/video/volcengine-video.adapter.ts:229` | 直连 VolcEngine |
| B-005 | deepseek-provider | `services/deepseek-llm.provider.ts:36` | 直连 DeepSeek |
| B-006 | aliyun-tts | `model-adapters/tts/aliyun-tts.adapter.ts:97` | 直连阿里云 TTS |
| B-007 | worker-runtime | `queue/worker-runtime.ts:807` | 从 payload 直接读取 apiKey |
| B-008 | render-executor | `production-loop/render-executor.ts:142` | 直连 video provider |

## 5. 调用链审计 (逐条)

### 5.1 正确调用链示例
```
用户请求 → fastify route → runtime-gateway.ts 
  → runtime-guard.ts (quota/permission/rate-limit check)
  → runtime-credential.ts → provider-registry.ts 
  → provider.adapter (openai-compatible.adapter.ts)
  → Provider API → Response → Audit Log → Return
```

### 5.2 错误调用链示例 (路径 4)
```
用户请求 → routes/customer-service.ts 
  → getCustomerServiceLLM() (读 process.env)
  → fetch(LLM_API) (无 quota/rate-limit/audit)
  → Response
```

## 6. 修复建议

1. **强制所有 AI 调用经过 Runtime Gateway**: 所有 route/service/queue 的 AI 调用必须注入 runtime-gateway
2. **消除 model-adapters 独立路径**: 将 model-adapters 功能合并到 runtime/providers
3. **Worker-runtime 集成 credential 管理**: queue/worker-runtime.ts 不应直接读取 apiKey
4. **Routes 中的直连替换**: customer-service.ts, narrative-llm.ts 等必须走 Runtime
5. **单一 Provider Registry**: 所有 Provider 只通过 `runtime/provider-registry.ts` 管理
