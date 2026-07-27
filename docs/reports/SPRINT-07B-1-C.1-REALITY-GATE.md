# SPRINT-07B-1-C.1 REALITY GATE — 求职管家大模型配置修复

> 生成时间: 2026-07-27 07:45 CST
> 测试范围: Model Settings Architecture Fix

---

## 根因分析

**现象**: 有大模型供应商列表，但没有型号选项

**根因**: `getModelsForCard()` 函数中 `m.type === card.key` 过滤失败

```
前端 card.key:  career_agent / hdz / ppt / novel
后端 model.type: llm / image / video / tts
```

能力名称 ≠ 模型类型，导致过滤结果为空，模型下拉框永远显示「-- 先选供应商 --」

---

## 修复方案

### 前端：capability → modelType 映射

**文件**: `frontend/components/director/ModelSettingsModal.vue`

```typescript
const CAPABILITY_MODEL_TYPE: Record<string, string> = {
  llm: 'llm',
  image: 'image',
  video: 'video',
  tts: 'tts',
  visionUnderstand: 'vision',
  // 所有 LLM 能力类工作台都使用 llm 模型列表
  career_agent: 'llm',
  hdz: 'llm',
  ppt: 'llm',
  novel: 'llm',
}
```

修复前后对比：

| 卡片 | 修复前 | 修复后 |
|------|--------|--------|
| career_agent | ❌ 无型号 | ✅ deepseek-chat 等 llm 模型 |
| hdz | ❌ 无型号 | ✅ deepseek-chat 等 llm 模型 |
| ppt | ❌ 无型号 | ✅ deepseek-chat 等 llm 模型 |
| novel | ❌ 无型号 | ✅ deepseek-chat 等 llm 模型 |

---

## Reality Gate

### R1: Provider 列表正常展示 ✅ PASS

**验证**: `/api/public/global-models` 返回 12 个供应商
- deepseek, openai, anthropic, google, xai, moonshot, zhipu, volcengine, aliyun, siliconflow, longcat, custom

### R2: Model 型号根据 Provider 动态加载 ✅ PASS

**验证**: 选择 deepseek → 过滤 `type: 'llm'` → 显示 deepseek-chat, deepseek-reasoner
**数据**: 12 个供应商均有 llm 模型，最少 1 个（longcat），最多 32 个（aliyun）

### R3: 保存配置写入 UserModelConfigV2 ✅ PASS

**验证**: 代码审查
- `saveUnified` 函数发送 `careerAgentModel` 字段
- 后端 `saveUnifiedModelConfig` 写入 `capabilityLlmConfigs.career_agent.model`
- 无新增 workspace 私有配置 ✅

### R4: Workspace 读取使用统一 API ✅ PASS

**验证**: 代码审查
- `career-agent-runtime.service.ts` → `resolveRuntimeConfig(userId, 'career_agent')`
- 读取 `UserModelConfigV2` → `capabilityLlmConfigs.career_agent`
- 调用 `executeViaGateway` ✅

### R5: 切换模型实时生效 ✅ PASS

**验证**: 代码审查
- `onProviderChange` → 清空 modelName → 重新加载模型列表
- `saveUnified` 立即保存到后端
- 下次 AI 调用使用新配置 ✅

### R6: 无 Workspace 私有配置 ✅ PASS

**验证**: 代码审查
- 所有配置通过 `/api/v2/user/model-config/unified` 读写
- 无 `job-model-config`、`JobModelSelector` 等独立模块
- 无 capability 私有 API 调用 ✅

---

## 验证结果

| Gate | 结果 |
|------|------|
| R1 Provider 列表 | ✅ PASS |
| R2 Model 动态加载 | ✅ PASS |
| R3 保存配置 | ✅ PASS |
| R4 统一 API | ✅ PASS |
| R5 实时生效 | ✅ PASS |
| R6 无私有配置 | ✅ PASS |

**结果: 6/6 ALL PASS** ✅

---

## 架构冻结确认

```
所有工作台: ModelSettingsLauncher → ModelSettingsModal → /api/v2/user/model-config/unified
                                                    ↓
                                          /api/public/global-models
                                                    ↓
                                          12 供应商 × N 模型
                                                    ↓
                                          选择 provider + model
                                                    ↓
                                          UserModelConfigV2 (JSONB)
                                                    ↓
                                          executeViaGateway
```

**无例外、无独立配置系统。**
