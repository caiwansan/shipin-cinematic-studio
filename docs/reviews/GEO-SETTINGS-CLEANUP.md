# GEO Settings Cleanup Report (Sprint 2)

> **Sprint**: V4.2A / GEO V1 Completion — Sprint 2
> **Date**: 2026-07-20
> **Focus**: 从 GEO Settings 剥离所有 Provider/Credential/Model 管理，恢复为纯 Workspace Preferences

---

## Summary

**Status**: ✅ Complete

GEO Settings 已完成架构边界清理。AI 管理职责全部移至平台层（AI Center），Settings 页面现在仅保留 Workspace 本地偏好配置。

---

## 删除的内容

### 1. Provider 管理（已全部删除）

| 删除项 | 路径 | 说明 |
|--------|------|------|
| Provider 列表 & 状态展示 | `SettingsPage.vue` | 原有的 Provider 状态卡片、配置表单、连接测试全部删除 |
| Provider 配置表单 | `SettingsPage.vue` | Provider 名称选择、API Key 输入、Endpoint 输入、模型输入全部删除 |
| Provider 保存逻辑 | `SettingsPage.vue` | `saveConfig()` 函数已删除 |
| 连接测试 | `SettingsPage.vue` | `testConnection()` 函数已删除 |
| 连接结果展示 | `SettingsPage.vue` | 连接成功/失败提示已删除 |
| `resourceService` 导入 | `SettingsPage.vue` | `import { resourceService } from '~/modules/platform/resource/services/resource.service'` 已删除 |
| 默认 Provider/模型选择 | `SettingsPage.vue` | dropdown 和 input 已删除（原为 disabled 状态） |

### 2. Credential 管理（已全部删除）

| 删除项 | 路径 | 说明 |
|--------|------|------|
| API Key 输入 | `SettingsPage.vue` | `<input v-model="configForm.apiKey" type="password">` 已删除 |
| Credential 保存 | `SettingsPage.vue` | `resourceService.storeCredential()` 调用已删除 |
| Credential 写 API 调用 | `SettingsPage.vue` | 不再调用任何 `/api/resource/credential` 写入端点 |

### 3. 连接测试说明（已删除）

| 删除项 | 路径 | 说明 |
|--------|------|------|
| "连接测试说明"卡片 | `SettingsPage.vue` | 原有的帮助说明（支持哪些 Provider、如何配置等）已删除 |

---

## 保留的内容

### Workspace Preferences（GEO 本地配置）

| 配置项 | 类型 | 存储方式 | 说明 |
|--------|------|----------|------|
| 默认语言 | Select | localStorage | 展示/输出语言 |
| 默认输出格式 | Select | localStorage | Markdown / HTML / JSON |
| 默认模板 | Select | localStorage | 标准/简报/详细 |
| 自动保存 | Checkbox | localStorage | 自动保存工作进度 |
| Knowledge 展示模式 | Select | localStorage | 紧凑/详细/图谱优先 |
| 报告偏好 | Select | localStorage | 摘要/完整/管理层摘要 |
| 启用历史记录 | Checkbox | localStorage | 记录操作历史 |

**设计原则**：所有偏好存储在 `localStorage`（键 `geo-workspace-preferences`），不写入后端。Workspace 配置不依赖平台。

---

## 新增的内容

### AI Center Summary Card（只读摘要）

```
┌─────────────────────────────────────────┐
│ 🤖 AI Center                    [已连接] │
├─────────────────────────────────────────┤
│ Provider     │ DeepSeek                  │
│ 默认模型     │ DeepSeek V4               │
│ Credential   │ ✅ 已连接                 │
│ Embedding    │ bge-m3                    │
│ 上次检测     │ 10:32 AM                  │
│ Provider 数  │ 2                         │
├─────────────────────────────────────────┤
│ [🚀 前往 AI Center] [刷新状态]         │
│ AI Provider、Credential、模型配置均     │
│ 在 AI Center 统一管理。                 │
└─────────────────────────────────────────┘
```

**特点**：
- ✅ **只读** — 无法编辑、无法保存、无法写入 API Key
- ✅ **数据来自平台** — 通过 `/api/geo/dashboard/provider-status` 读取（仅 GET，只读查询）
- ✅ **可刷新** — 点击"刷新状态"重新读取
- ✅ **统一跳转** — "前往 AI Center" → `/ai-center`（页面已预留）

---

## API 调用审计

### 已删除的写入 API 调用

| API | 方法 | 用途 | 状态 |
|-----|------|------|------|
| `/api/platform/resource/resolver/resolve` | POST | 连接测试 (testConnection) | ❌ 已删除 |
| `resourceService.storeCredential()` | POST | 保存 API Key | ❌ 已删除 |

### 保留的只读 API 调用

| API | 方法 | 用途 | 状态 |
|-----|------|------|------|
| `/api/geo/dashboard/provider-status` | GET | 仅读取 AI Center 摘要 | ✅ 只读保留 |
| `localStorage` | — | Workspace 偏好存储 | ✅ 保留 |

---

## 其他受影响的文件

| 文件 | 改动 | 说明 |
|------|------|------|
| `components/wizard/StepProvider.vue` | 更新链接 | "前往设置" → "前往 AI Center" |
| `components/GeoDashboard.vue` | 不变 | 仅读 provider-status（只读，继续保留） |
| `stores/useBrandGeoStore.ts` | 不变 | `fetchProviderStatus()` 仅读（只读，继续保留） |

---

## Architecture Boundary Diagram

完成后的分层关系：

```
┌─────────────────────────────────────────────────────────────┐
│                    Platform AI Center                        │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Provider     │  │  Credential  │  │  Model & Runtime  │  │
│  │  Management   │  │  Vault       │  │  Configuration   │  │
│  ├──────────────┤  ├──────────────┤  ├──────────────────┤  │
│  │ DeepSeek     │  │ API Key      │  │ Default Model    │  │
│  │ OpenAI       │  │ Rotation     │  │ Temperature/TopP │  │
│  │ Qwen         │  │ Expiry       │  │ Embedding        │  │
│  │ Gemini/Claude│  │ Audit        │  │ Reranker         │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               AI Center → GEO 接口                   │   │
│  │  GET /api/geo/dashboard/provider-status (只读摘要)   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                  (只读摘要，不可写入)
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Workspace GEO                             │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Brand        │  │  Knowledge   │  │  Settings         │  │
│  │  Management   │  │  Management  │  │  (Preferences)    │  │
│  ├──────────────┤  ├──────────────┤  ├──────────────────┤  │
│  │ CRUD         │  │ KO CRUD      │  │ Language         │  │
│  │ Detail       │  │ Evidence     │  │ Output Format    │  │
│  │ Wizard       │  │ Claim        │  │ Template         │  │
│  │ Keywords     │  │ KnowledgeGraph│  │ Auto Save        │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │  Report       │  │  History     │                         │
│  │  Generation   │  │  Tracking    │                         │
│  └──────────────┘  └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

**正式分层原则**：
> Workspace 不管理 AI。Workspace 消费 AI。
> AI Center 管理 AI。AI Center 提供只读摘要。
> 写入 API Key / Credential / Provider 配置 → AI Center。
> 读取 AI 状态 → 通过平台只读接口。

---

## Phase B AI Center 接口预留

GEO Settings 已为未来 AI Center 预留以下接口模式：

| 预留项 | 说明 |
|--------|------|
| `goToAICenter()` | 统一跳转函数 → `/ai-center` |
| AI Summary Card | 只读摘要 UI 模板，AI Center 上线后自动生效 |
| `fetchAISummary()` | 通过 `/api/geo/dashboard/provider-status` 读取 |
| 刷新状态按钮 | 用户手动刷新 AI Center 摘要 |

当 AI Center 页面上线后：
1. `/ai-center` 路由由 Nuxt 接管
2. `goToAICenter()` 自动跳转到完整 AI 管理页面
3. GEO Settings 的 AI Summary Card 无需任何改动

---

## Sprint 2 验收标准

| 标准 | 状态 |
|------|------|
| GEO Settings 不再管理任何 AI Provider | ✅ |
| GEO Settings 不再保存 API Key | ✅ |
| GEO Settings 不再调用 Credential 写接口 | ✅ |
| GEO Settings 成为纯 Workspace Preferences 页面 | ✅（仅 7 项本地偏好） |
| AI 相关内容收敛为只读 Summary | ✅ |
| 统一跳转到 AI Center | ✅ → `/ai-center` |
| 为 Phase B AI Center 铺平迁移路径 | ✅（接口预留完成） |
| Workspace / Platform 正式分层 | ✅ |

---

## 行数对比

| 指标 | 清理前 | 清理后 | 变化 |
|------|--------|--------|------|
| SettingsPage.vue 总行数 | 309 | ~270 | -39 |
| `import` 语句 | 2 | 1 | -1（移除 resourceService） |
| `function` 定义 | 6 | 3 | -3（移除 saveConfig/testConnection/fetchProviderStatus 中 AI 专属→改为只读 fetch） |
| `<input type="password">` | 1 | 0 | -1（API Key 输入） |
| API 写调用 | 2 | 0 | -2 |
| API 读调用 | 2 | 1 | -1（移除 testConnection 中的 resolve 调用） |

---

*End of GEO Settings Cleanup Report*
