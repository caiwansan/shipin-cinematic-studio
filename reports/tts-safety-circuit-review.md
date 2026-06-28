# TTS 安全护栏阻断审查报告

**日期**: 2026-05-25 21:45  
**审查标题**: 角色「百花仙子」语音生成失败 — `[ExecutionSafety] Provider siliconflow 被安全护栏阻断: invalid_key`  
**审查范围**: 前端任务提交路由 → 后端适配器 → 安全护栏 → ProviderState 熔断系统

---

## 1. 事实确认：当前系统状态

### DB ProviderState 记录
```json
{
  "id": "cmpkyrjyp0002clxgv8w6j563",
  "userId": "5cbabc6d-60f1-48e6-b8fe-cb4a15ac50e0",
  "provider": "siliconflow",
  "status": "invalid_key",
  "lastError": "硅基 TTS 失败 (403): {\"code\":30003,\"message\":\"Model disabled.\",\"data\":null}",
  "errorCode": "FORBIDDEN",
  "failureCount": 13,
  "circuitOpenedAt": "2026-05-25T13:16:24.430Z"
}
```

### 熔断日志
```
[SafetyGate] provider=siliconflow status=invalid_key enabled=true failures=13
```

### 熔断原因
硅基流动 API 返回 **403 `Model disabled`**→ `classifyProviderError` 匹配 `403/Forbidden` 分支→分类为 `invalid_key`

---

## 2. 前端任务提交路由审查（✅ 无问题）

### 调用链路
```
VoiceGeneration.vue → submitAiTask('tts', input) → POST /api/tasks/ai-generate
```

### 前端做了什么
1. 收集角色名、音色、文本 → `{ text, voiceId, characterName, idx, source: 'voice' }`
2. 通过 `submitAiTask()` 提交到 `/api/tasks/ai-generate`
3. 前端**不传 provider/model**，遵循 SAMSP 宪法

### 路由层做了什么 (`ai-tasks.ts`)
1. 验证 `projectId`、`taskType`
2. 调 `resolveProviderFromUserConfig(user.id, preferModel, 'tts')` → 解析用户的配置
3. 组装 `RuntimePayload { provider, apiKey, model, ... }`
4. 提交到 BullMQ 队列

### 结论
前端 + 路由无问题。严格遵循了 SAMSP（Single Authority Model Selection Protocol）。

---

## 3. 后端适配器审查（⚠️ 一个问题）

### 调用链路
```
Worker (queue) → modelAdapterRegistry.execute(runtime, input)
  → safetyGate() ← 这里阻拦了
  → siliconflowTtsAdapter.execute()
```

### 硅基 TTS 适配器逻辑
```
if (CosyVoice2 + zh_female*):
  model = fishaudio/fish-speech-1.5  // 自动切换

if (model === fishaudio/*):
  发送: POST { model, voice: zh_female_..., input: text }
else if (model === FunAudioLLM/CosyVoice2*):
  发送: POST { model, voice: model:benjamin, ... }
```

### 问题 1：适配器执行前的安全护栏阻断（主问题）
安全护栏在 execute() 之前运行。`getProviderStateService().get()` 从 DB 读到 `invalid_key` → 直接拒绝执行 → **适配器根本没机会运行**。

### 问题 2：403 "Model disabled" 被误分类为 `invalid_key`（根因）
`classifyProviderError()` 中的匹配顺序：
```
if (msg.includes('403') || msg.includes('Forbidden') ...)
  → invalid_key / FORBIDDEN         ← 403 Model disabled 走这条
```

实际是**模型被禁用**（配额/权限/过期），不是 Key 无效。正确的分类应该是 `degraded`（临时降级）。

### 问题 3：`Model disabled` 没有独立分类（遗漏）
目前只检查了几种已知错误模式，`Model disabled` 会":
1. 匹配 `403/Forbidden`（第一层）→ 分类为 `invalid_key`
2. 安全护栏持续阻断后续请求（第 13 次失败循环）

---

## 4. 安全护栏审查（⚠️ 一个设计问题）

### 当前设计
```
SafetyGate: status=invalid_key → blocked (allowed=false)
SafetyGate: status=degraded     → allowed (上一个 fix 已改)
```

### 问题：`circuitOpenedAt` 的默认"过期"逻辑缺失
安全护栏检查 `failureCount=13, circuitOpenedAt=14分钟前` 但**没有超时过期机制**。只有 `markSuccess()` 才能恢复健康状态。如果用户一直失败（每次都被阻断），就永远无法恢复。

**缺少自动降级触发**：
- 熔断未设置窗口期（如 5 分钟内累计 5 次失败才阻断）
- 阻断后未设置冷却时间（如 60 秒后自动降为 degraded 重试）
- 当前是所有失败立即累积，累计后不自动恢复

---

## 5. ProviderState 缓存审查（✅ 已修复）

### 历史问题
- Cache 无 TTL → 重启后 cache 为空，一旦 markFailure 就永久驻留
- 即使 DB 被清空，markFailure 后重新写入 `invalid_key`

### 当前状态
✅ Cache TTL 30s（本次会话已修复）
✅ `get()` 超 30s 重新读 DB
✅ `markSuccess/markFailure` 带时间戳

---

## 6. 根因总结

| 层级 | 问题 | 严重性 |
|------|------|--------|
| **根因** | 硅基流动 API 返回 403 `Model disabled`，但 `classifyProviderError` 将其归类为 `invalid_key` | 🔴 |
| **次因** | 安全护栏没有熔断超时机制，阻断状态永不自动恢复 | 🟡 |
| **次因** | `Model disabled` 没有独立的错误码映射 | 🟡 |
| **非问题** | 前端路由（✅ 合规） | ✅ |
| **非问题** | DB 缓存（✅ 已修复） | ✅ |
| **非问题** | 适配器逻辑（✅ 正确） | ✅ |

### 最简修复路径
1. `classifyProviderError` 中新增 `Model disabled` 检测 → 优先级高于 `403/Forbidden`，返回 `degraded`
2. 修复后在 DB 中重置 ProviderState

---

## 7. 结论

**实际原因不是安全护栏系统有 bug，而是分类器将 403 Model disabled 误判为 invalid_key，导致 API Key 问题以外的场景被永久阻断。**

修复量极小（1 行新增判断 + DB 重置），由你决定是否立刻修。
