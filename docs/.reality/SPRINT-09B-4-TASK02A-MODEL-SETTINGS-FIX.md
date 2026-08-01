# Sprint-09B-4 Task02-A Model Settings Binding Fix — COMPLETE ✅

**Date:** 2026-07-30 17:37 CST
**Gate:** All 3/3 PASS

## 修复

**问题：** `/workspace/job` 点击模型设置 `⚙️` → `filterCapability="career_agent"` → `modelCards` 无匹配 → 空白弹窗

**改动（1 行）：**

```diff
- <ModelSettingsModal filterCapability="career_agent" />
+ <ModelSettingsModal filterCapability="llm" />
```

**文件：** `frontend/studio-v2/layout/JobWorkspaceLayout.vue` line 405

## 架构验证

修复后链路完整对齐短剧工作台：

```
镜心 ⚙️ 模型设置
 ↓
filterCapability="llm"
 ↓
modelCards[0].key = "llm" ✅
 ↓
Provider 选择 / Model 选择 / API Key 输入
 ↓
POST /api/v2/user/model-config/unified
 ↓
UserModelConfigV2.llmProvider / llmModel / llmApiKey
 ↓
resolveRuntimeConfig()
 ↓
Hermes Runtime
 ↓
镜心
```

**无独立 Career LLM 配置，无新卡片，无新字段。**

## Reality Gate — 3/3 PASS

| Gate | 验证方式 | 结果 |
|------|----------|------|
| G1 模型设置入口 | 源码 → `filterCapability="llm"` → modelCards 含 llm | ✅ |
| G2 API 保存 | volcengine + doubao-seed → UserModelConfigV2 | ✅ |
| G3 无 Career 字段 | UserModelConfigV2 中 career-specific fields = [] | ✅ |

## 本轮遵守的禁止

| 操作 | 结果 |
|------|------|
| ❌ 新建 CareerModelSettings.vue | ✅ 未新建 |
| ❌ 新建 CareerLlmConfig 表 | ✅ UserModelConfigV2 复用 |
| ❌ 新增 careeragent 配置字段 | ✅ 零新增 |
| ❌ 改 Runtime | ✅ resolveRuntimeConfig 不变 |
| ❌ 改支付逻辑 | ✅ 不动 |
| ❌ 顺手重构 | ✅ 只修了一行 |

## 当前商业 SaaS 闭环（最终版）

```
用户支付 ¥9.9
  ↓
Subscription + CapabilityGrant
  ↓
镜心职业伙伴创建
  ↓
用户配置 LLM 模型（全局）
  ↓
UserModelConfigV2.llm*
  ↓
resolveRuntimeConfig
  ↓
镜心 · Hermes Runtime
```
