# SPRINT-07A.4-A STUDIO MODEL SETTINGS AUDIT

> 生成时间: 2026-07-27 06:45 CST
> 审计范围: 短剧工作台「大模型设置」全实现
> 审计原则: 只读，不改代码

---

## 1. 组件定位

### 1.1 核心文件

| 文件 | 行数 | 职责 |
|------|------|------|
| `frontend/components/director/ModelSettingsModal.vue` | 844 | 大模型设置弹窗组件（全局共享） |
| `frontend/studio-v2/pipeline/PipelineSidebar.vue` | ~300 | 短剧工作台左侧栏，含设置按钮 |
| `backend/src/routes/unified-model-config.ts` | ~140 | 统一模型配置 API |
| `backend/src/config/saveUnified.ts` | — | 统一模型配置存储逻辑 |
| `backend/src/config/v2.ts` | — | 配置读取 + hasApiKeyForProvider |

### 1.2 组件引用关系

```
ModelSettingsModal.vue (全局共享)
  ↑ 被以下页面引用:
  ├── studio-v2/pipeline/PipelineSidebar.vue    ← 短剧工作台左侧栏
  ├── pages/hdz/workspace/[id].vue               ← HDZ 工作台
  ├── pages/hdz/index.vue                        ← HDZ 首页
  ├── workspaces/geo/layouts/GeoWorkspaceLayout.vue  ← Geo 工作台
  ├── workspaces/legal/layouts/LegalWorkspaceLayout.vue ← 法务工作台
  └── pages/workspace/ecom-image/workbench/[id].vue   ← 电商工作台
```

**结论**: `ModelSettingsModal.vue` 已经是跨工作台复用的全局组件，不是短剧工作台私有。

---

## 2. 交互设计

### 2.1 打开方式

```
PipelineSidebar.vue
  ↓ 用户点击
  <div @click="openModelSettings" class="model-config-card">
    🤖 大模型设置
  </div>
  ↓
  showModelSettingsModal.value = true
  ↓
  <ModelSettingsModal :visible="true" @close="..." />
```

### 2.2 卡片结构

| 能力 | key | 说明 |
|------|-----|------|
| 语言模型 | `llm` | 必开，默认 volcengine |
| 图片模型 | `image` | 默认开启 |
| 视觉理解 | `visionUnderstand` | 默认开启 |
| 视频模型 | `video` | 默认开启 |
| 语音模型 | `tts` | 默认开启 |
| 音乐模型 | `music` | 默认关闭 |

每个卡片包含:
- 供应商下拉 (Provider select)
- 模型选择 (Model select)
- API Key 输入 (password, 已配置显示 ••••)
- 启用/禁用 Toggle
- 自定义端点 (provider=custom 时)

### 2.3 桌面版特有

- 本地模式切换 (Ollama)
- 钻石 VIP 会员检测
- 本地模型管理 (llm/image/video/tts)
- 本地配置存 `localStorage`

---

## 3. 数据模型

### 3.1 前端数据结构

```typescript
interface ModelCard {
  key: string                    // 能力标识
  provider: string               // 供应商
  modelName: string              // 模型名
  enabled: boolean               // 是否启用
  apiKeyInput: string            // API Key 输入
  keyConfigured: boolean         // 是否已配置
  editingKey: boolean            // 是否正在编辑
  showKey: boolean               // 是否显示明文
  baseUrlInput: string           // 自定义端点
}
```

### 3.2 API 请求/响应

**POST /api/v2/user/model-config/unified**

```json
// Request
{
  "providerMap": { "llm": "deepseek", "image": "volcengine", ... },
  "modelMap": { "llm": "deepseek-v4-flash", ... },
  "apiKeys": { "llm": "sk-xxx", ... },
  "enabledMap": { "llm": true, "music": false, ... },
  "baseUrlMap": { "llm": "https://api.deepseek.com", ... }
}

// Response
{
  "success": true,
  "data": {
    "llmProvider": "deepseek",
    "llmModel": "deepseek-v4-flash",
    "hasLlmApiKey": true,
    "imageProvider": "volcengine",
    ...
  }
}
```

**GET /api/v2/user/model-config/unified**

返回相同 `data` 结构。

### 3.3 存储层

- **数据表**: `UserModelConfigV2`
- **存储函数**: `saveUnifiedModelConfig(userId, config)`
- **读取函数**: `loadFullConfigV2(userId)`
- **Key 安全**: `hasApiKeyForProvider()` 只返回布尔值

---

## 4. 现有两套配置系统对比

| 维度 | 短剧 ModelSettingsModal | 个人 AiModelSettings |
|------|------------------------|---------------------|
| **API** | `/api/v2/user/model-config/unified` | `/api/capability/llm/config/:capability` |
| **数据** | `UserModelConfigV2` 主记录 | `UserModelConfigV2.capabilityLlmConfigs` (JSONB) |
| **能力数** | 6 (llm/image/video/tts/music/vision) | 5 (hdz/career/ppt/music/novel) |
| **打开方式** | 侧栏底部卡片点击 | 页面内折叠展开 |
| **UI 风格** | 卡片式 + Toggle | 折叠面板 + 表单 |
| **保存粒度** | 全部一次保存 | 单能力保存 |
| **工作空间** | 短剧/HDZ/Geo/法务/电商 | 仅个人设置页 |
| **桌面支持** | ✅ Ollama 本地模式 | ❌ 无 |
| **自定义端点** | ✅ 每能力独立 | ✅ 统一 |

### 冲突分析

| 能力 | 短剧 key | 个人 key | 兼容? |
|------|----------|----------|-------|
| 短剧/导演 | `llm` (导演工作台) | `hdz` | ❌ 不兼容 |
| 求职职业助理 | 无 | `career` | ❌ 不存在于短剧 |
| PPT | 无 | `ppt` | ❌ |
| Novel | 无 | `novel` | ❌ |
| 音乐 | `music` | `music` | ✅ 一致 |
| TTS | `tts` | 无 | ❌ |
| 图片 | `image` | 无 | ❌ |

**结论**: 两个系统的 key 命名完全不同，无法直接复用。

---

## 5. 求职管家现状

### 5.1 当前组件

| 组件 | 文件 | 问题 |
|------|------|------|
| `CareerModelConfig.vue` | `components/career/CareerModelConfig.vue` | ❌ 独立维护，不共享 |
| `AiModelSettings.vue` | `components/ai-model/AiModelSettings.vue` | ❌ 独立实现，不共享 |
| `ModelSettingsModal.vue` | `components/director/ModelSettingsModal.vue` | ✅ 全局共享 |

### 5.2 求职管家引用链路

```
JobWorkspaceLayout.vue
  ├── AI求职顾问区 → "昆仑镜 AI 服务 · 平台提供"
  └── AI职业助理区 → "个人模型" + "⚙️ 模型设置" → /settings/ai-models
                                          ↓
                                      AiModelSettings.vue (独立)
                                          ↓
                                      /api/capability/llm/config/:capability
                                          ↓
                                      UserModelConfigV2.capabilityLlmConfigs
```

---

## 6. Sprint-07A.4 执行计划

### Task 1: 审计短剧工作台大模型设置实现 ✅ (本文件)

### Task 2: 求职管家引用同一套组件逻辑

**目标**: 求职管家的 AI 职业助理模型设置，直接复用 `ModelSettingsModal.vue` 组件。

**方案**:
1. 在 `JobWorkspaceLayout.vue` 的 AI 职业助理区引入 `ModelSettingsModal`
2. 设置按钮打开弹窗
3. 配置存储走 `/api/v2/user/model-config/unified`（已有 API）
4. `capabilityLlmConfigs` 层继续保留作为 `career_agent` 能力配置

### Task 3: 组件复用原则

**组件选择**:
- 删除 `CareerModelConfig.vue` (独立组件)
- 保留 `ModelSettingsModal.vue` (全局共享)  
- `AiModelSettings.vue` 改为对 `ModelSettingsModal` 的包装，统一入口

### Task 4: 求职管家页面调整

**AI求职顾问**: 只显示标识，无模型设置入口
```
🤖 AI 求职顾问
昆仑镜 AI 服务 · 平台提供
```

**AI职业助理**: 显示标识 + 设置按钮
```
🤖 我的 AI 职业助理
个人模型 [⚙️]
```

点击设置按钮 → 打开 `ModelSettingsModal` → 用户配置 career_agent 能力

---

## 7. 待确认

1. **短剧工作台 `llm` key vs `hdz` key**: 短剧工作台用 `llm` 作为 key，个人设置用 `hdz`。需要确认短剧的 `llm` 是否等于个人设置的 `hdz`。

2. **两套 API 合并**: 是否需要将 `/api/capability/llm/config/:capability` 统一到 `/api/v2/user/model-config/unified`？

3. **AiModelSettings.vue 处理**: 是完全废弃还是包装为 `ModelSettingsModal` 的简化版？

---

审计完成。待掌柜确认方案后，开始执行 Sprint-07A.4。
