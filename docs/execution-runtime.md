# Execution Model（执行模型）

> 描述 Runtime 中"任务如何被执行"的完整链路。从 UI 提交到 Worker 返回结果的每一层。

---

## 1. 执行链路总览

```
UI submitAiTask(type, payload)
  │
  ▼
POST /api/v1/ai-tasks
  │  (type: image / video / tts / llm / export / frame)
  ▼
Queue Manager → BullMQ Queue('ai-runtime')
  │
  ▼
Worker Runtime → 匹配注册的 Processor
  │
  ▼
apiRouter.selectProvider(type)
  │  (百炼 → 火山引擎 → openai → siliconflow)
  ▼
Provider Adapter（HTTP 调用）
  │
  ▼
结果返回 → Worker 写 pipeline_jobs / 上传文件
  │
  ▼
UI 轮询 GET /api/v1/ai-tasks/:id → 获取结果
```

## 2. 各层详解

### 2.1 UI 层：`submitAiTask`

```typescript
submitAiTask(type: 'image' | 'tts' | 'video' | 'frame', payload: AiTaskPayload)
  → POST /api/v1/ai-tasks
  → 返回 taskId
  → 轮询 GET /api/v1/ai-tasks/:taskId
  → 执行完成 → 写 output 到 store
```

当前支持的 task 类型：`image`, `tts`, `video`, `frame`

### 2.2 API 层：`ai-tasks.ts`

注册的 taskType:
- `image`
- `video`
- `tts`
- `llm`
- `export`
- `frame`

### 2.3 Queue 层：`queue-manager.ts`

- BullMQ Queue name: `ai-runtime`
- Worker 数量: 5（可配置）
- 支持 SSE stream（`GET /api/v1/ai-tasks/:id/stream`）

### 2.4 Worker 层：`worker-runtime.ts`

Worker 执行流程：

```
receive job
  → 解析 type
  → 匹配 processor
  → apiRouter.selectProvider(type, payload)
  → callProvider(provider, payload)
  → 成功 → 返回结果
  → 失败（余额不足/403）→ 自动 fallback 下一个 provider
  → 所有 provider 失败 → 标记 failed，返回错误
```

### 2.5 Provider 路由层：`api-router.service.ts`

Provider 优先级（降序）:

| 类型 | Provider 链 |
|------|-------------|
| image | 百炼 → 火山引擎 → openai → siliconflow |
| tts | siliconflow → 火山引擎 |
| video | 火山引擎 |

Provider 选择策略：
- 按 `cost` 字段升序排列（成本优先）
- 失败时自动跳到下一个
- 所有失败后返回最后错误

## 3. Provider Adapter

每个 Provider 有对应的 adapter：
- `bailian-image.provider.ts`
- `volcengine-image.provider.ts`
- `siliconflow-tts.provider.ts`
- `siliconflow-image.provider.ts`（降级后使用）
- `aliyun-video.provider.ts`

Adapter 职责：
- 将统一 payload 转为 Provider 的 API 格式
- 发起 HTTP 调用
- 处理响应、错误、超时
- 返回统一格式的结果

## 4. 超时与重试

- Provider 调用超时: 30s
- 重试次数: 2 次（LLM 调用）
- 失败后自动 fallback: 是
