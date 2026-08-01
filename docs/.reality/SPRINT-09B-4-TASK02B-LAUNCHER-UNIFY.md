# Sprint-09B-4 Task02-B ModelSettingsLauncher 统一入口 — COMPLETE ✅

**Date:** 2026-07-30 17:38 CST
**Gate:** All 3/3 PASS

## 问题

JobWorkspaceLayout 直接引用 `ModelSettingsModal`（带自己的 `showModelSettings` 状态），未走统一 `ModelSettingsLauncher` 入口。存在入口分叉风险。

## 改动

**文件：** `frontend/studio-v2/layout/JobWorkspaceLayout.vue`

### 移除（5 处）

```
- <button @click="showModelSettings = true">⚙️ 模型设置</button>  (×2)
- <ModelSettingsModal :visible="showModelSettings" ... />
- import ModelSettingsModal from '~/components/director/ModelSettingsModal.vue'
- const showModelSettings = ref(false)
```

### 新增（2 处）

```
+ <ModelSettingsLauncher capability="llm" />  (×2)
+ import ModelSettingsLauncher from '~/components/ai-model/ModelSettingsLauncher.vue'
```

### 原理

```text
Before:  2 × <button> + showModelSettings → ModelSettingsModal（私有入口）
After:   2 × <ModelSettingsLauncher> → 自身 button + ModelSettingsModal（统一入口）
```

Launcher 组件自带 button + modal，v-if 分支互斥确保同一时间仅一个实例活跃。

## Reality Gate — 3/3 PASS

| Gate | 验证方式 | 结果 |
|------|----------|------|
| G1 入口一致 | 短剧/小说/求职 三个工作台均使用 `ModelSettingsLauncher` | ✅ |
| G2 数据一致 | POST → UserModelConfigV2.llmProvider/llmModel 仅一份 | ✅ |
| G3 镜心运行不变 | resolveRuntimeConfig → UserModelConfigV2.llm* | ✅ |

## 遵守禁止

| 操作 | 结果 |
|------|------|
| ❌ 修改 ModelSettingsModal | ✅ 未碰 |
| ❌ 修改 UserModelConfigV2 | ✅ 未碰 |
| ❌ 修改 API | ✅ 未碰 |
| ❌ 修改 Runtime | ✅ 未碰 |
| ❌ 修改支付权益 | ✅ 未碰 |
| ❌ 顺手重构 | ✅ 只换了入口 |

## 完成状态

```
Sprint-09B-0  Identity (镜心)
Sprint-09B-1  Identity 接入 Career Agent
Sprint-09B-2  Platform AI Gateway
Sprint-09B-3A 支付 + 权益 + Provision
Sprint-09B-4  Task 01  Audit       ✅
Sprint-09B-4  Task 02-A  Model Fix  ✅
Sprint-09B-4  Task 02-B  Launcher   ✅  ← NOW
                ↓
Sprint-09C  Commercial Reality Gate  ← NEXT
```
