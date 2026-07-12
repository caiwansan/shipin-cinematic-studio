# Presence Engine 用户模型统一 Sprint

## 审计结论

### GEO 中所有 AI 调用路径汇总

| 功能 | 调用方式 | 用户 Provider | 问题 |
|------|---------|--------------|------|
| **Knowledge Quality** | `invokeAI` → `UserModelResolver` → `UserModelConfigV2` | ✅ | 修复前缺 userId（已修复） |
| **Discovery** | `callLLM` (通过 `legacy-deepseek-adapter`) | ✅ | 已走 UserModelConfigV2 |
| **Presence Engine** | 11 个 Adapter，`callLLM` (10 个用 process.env, 1 个用 credential) | ❌ | 产品设计决定不做改 |
| **Content Generator** | `invokeAI` → `UserModelResolver` → `UserModelConfigV2` | ✅ | 正常 |
| **v1 Geo Scan (旧版)** | `invokeAI` → `UserModelResolver` | ✅ | 正常（已废弃但可用） |

### KQ 根因（已修复）

**问题：** `geo-knowledge-quality.route.ts:236` 中 `tenantId || 'anonymous'`，前端不传 `tenantId`，导致 `userModelResolver.resolve('llm', 'anonymous')` 找不到配置。

**修复：** 
1. 从 `request.user.id` 获取真实用户 ID（认证后的用户）
2. Fallback 到 project 的 `userId` 字段
3. 移除 `'anonymous'` 回退

### Presence Engine 产品设计决策

**结论：Presence Engine 不应改为使用用户 Provider。**

原因：
- Presence Engine 扫描的是 **12 个不同的 AI 平台**（ChatGPT、Claude、Gemini 等）对品牌的认知
- 用户只配置了 1 个 Provider（如 DeepSeek），无法扫描其他 AI 平台
- 这与 KQ/Discovery 不同（KQ 是使用用户配置的 Provider 做推理）

**Presence Engine 的产品定位：** 系统级能力，不是"用用户的 Key"而是"检查各 AI 平台对品牌的了解程度"。后续应提供 enterprise 版（企业自配多 Key）和免费版（平台维护的沙盒 Key）。

### 当前 Actions（已完成）

1. ✅ KQ route userId 修复（P0）
2. ✅ UserModelConfigV2 太昊子 Key 重新加密（P0）
3. ✅ Runtime 链路全面审计  
4. ✅ 确认所有非 Presence 的 AI 调用已走 UnifiedAIGateway
5. ❌ (拒绝) 将 Presence 11 个 Adapter 改为用户 Provider 配置 — 产品逻辑不成立
