# LLM 密钥注入故障报告（2026-05-26）

## 故障现象

点击"AI 拆解"后，后端返回 500 Internal Server Error，前端报错内容依次为：

1. 第一阶段：`volcengine returned 403: AccountOverdueError`（账户逾期）
2. 第二阶段（用户更换阿里 Key 后）：`all LLM providers failed` + `bailian returned 403: free tier exhausted`

用户两次提供的 API Key 经独立验证均正常（HTTP 200），问题出在后端密钥注入链路。

---

## 根因 1：injectUserApiKey DEEPSEEK_API_KEY 短路（P0）

### 症状
用户在大模型设置中配置了阿里百炼 Key（`aliyun` / `qwen3.5-flash`），但系统仍在调用 volcengine，且用的是**系统的旧 Key**而非用户的 Key。

### 代码位置
`narrative-gateway.ts` `injectUserApiKey()` 第 351 行（修复前）：

```typescript
// 如果 env 已有 key（路由层已预注入），跳过所有 DB 查询
if (process.env.DEEPSEEK_API_KEY) {
  return () => {}
}
```

### 触发条件
`ecosystem.config.cjs` 中始终设置了 `DEEPSEEK_API_KEY: 'sk-27e4cff8...'`（系统默认，非空字符串）。这行代码会：

- 判断 `process.env.DEEPSEEK_API_KEY` 为 truthy → **直接返回空函数** `() => {}`
- **跳过后续所有 V2 配置读取**（`UserModelConfigV2` 表查询、密钥解密、环境变量覆盖）
- 结果：用户的 V2 阿里百炼 Key 永不生效，系统始终使用 ecosystem 中写死的旧 Key

### 修复
删除短路判断。该判断的原始意图是"路由层已预注入时跳过"，但 ecosystem 中的系统默认 Key 持续触发该短路，导致用户 Key 无法覆盖。

---

## 根因 2：环境变量名称不一致（P0）

### 症状
根因 1 修复后，系统成功读取了用户的阿里 Key（`BAILIAN_API_KEY` 正确注入），但仍返回 403 `free tier exhausted`。

### 代码位置
两处环境变量名不一致：

**写入方** — `narrative-gateway.ts` `setProviderEnv()` 第 380 行：
```typescript
const envModel = `${provKey}_MODEL`
// 写入的是 BAILIAN_MODEL
```

**读取方** — `provider.registry.ts` `refreshProviderApiKeys()`：
```typescript
bailian: { keyEnv: 'BAILIAN_API_KEY', modelEnv: 'BAILIAN_LLM_MODEL' },
// 读取的是 BAILIAN_LLM_MODEL（带 _LLM_ 前缀）
```

### 影响
- `setProviderEnv` 设置了 `BAILIAN_MODEL=qwen3.5-flash`
- `refreshProviderApiKeys` 读取的是 `BAILIAN_LLM_MODEL` → 未定义
- bailian provider 的 `models` 数组保持默认值 `['qwen-plus', 'qwen-max', 'qwen-turbo']`
- 调用时始终使用第一个模型 `qwen-plus`
- 用户的阿里 Key 的 `qwen-plus` 免费额度用尽 → 403
- 但 `qwen-flash`、`qwen3.5-flash` 额度正常且可调用

### 修复
将 `setProviderEnv` 中的环境变量名改为 `_LLM_MODEL`，与 `refreshProviderApiKeys` 保持一致。

---

## 根因 3（次要）：activeLlmConfigId 指向 V1 旧记录

### 症状
`User` 表的 `activeLlmConfigId` 字段指向 `UserModelConfig`（V1 表）中的 volcengine 记录。

### 影响
`injectUserApiKey` 的 V1 分支（`activeLlmConfigId`）优先返回，可能影响修复效果。

### 处理
清空 `activeLlmConfigId`，确保走 V2 分支逻辑。

可考虑后续代码修改：在 `UserModelConfigV2` 保存时自动清空 `activeLlmConfigId`。

---

## 修复变更汇总

| # | 文件 | 行 | 变更 | 严重度 |
|---|------|-----|------|-------|
| 1 | `narrative-gateway.ts` | 351 | 删除 `if (process.env.DEEPSEEK_API_KEY) return () => {}` 短路 | P0 |
| 2 | `narrative-gateway.ts` | 380 | `_MODEL` → `_LLM_MODEL` | P0 |
| 3 | `User` 表数据 | — | 清空 `activeLlmConfigId` | P1 |

---

## 验证结论

独立验证（直接 curl 调用 API）：
- 用户的阿里百炼 Key → ✅ HTTP 200，响应正常
- 用户的阿里百炼 Key + `qwen-plus` → ❌ HTTP 403（免费额度用尽）
- 用户的阿里百炼 Key + `qwen-flash` → ✅ HTTP 200
- 用户的阿里百炼 Key + `qwen3.5-flash` → ✅ HTTP 200

本次修复不涉及任何 API Key、模型选择或额度问题，纯粹是后端注入链路中的环境变量名称不匹配和短路逻辑错误。

---

## 建议后续改进

1. **删除 activeLlmConfigId 字段**（或保存 V2 配置时自动清除），避免双表优先级冲突
2. **统一环境变量命名规范**：对所有 provider 使用 `${provKey}_LLM_MODEL` 或 `${provKey}_MODEL` 二选一，不应参差不齐
3. **前端大模型设置保存时**：应在保存成功后在浏览器提示"配置已保存，刷新后需要 Ctrl+F5 清除缓存生效"
