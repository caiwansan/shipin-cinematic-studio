# 影剧厂 Director Runtime — 渲染故障排查报告

## 一、问题概述

前端项目（`director-runtime/`）中，**剧本分析完成后，只有步骤1（角色图/CharacterPanel）能正确渲染并展示数据，步骤2-8（场景图/分镜图/音色/首尾帧/视频制作/合成导出）虽然步骤条可以点击切换，但中栏只显示空状态占位文案（如"场景数据将在角色提取完成后加载"等），实际业务数据和交互 UI 未渲染。**

## 二、当前技术架构

### 2.1 项目结构
- **前端**: `/root/shipin-cinematic-studio/director-runtime/` — Vue 3 + Vite
- **后端**: `/root/shipin-cinematic-studio/backend/` — PM2 `api-server` (id 77), port 4000
- **部署**: nginx → 127.0.0.1:4000, 静态文件 `/www/wwwroot/aigc.fushtn.com/`

### 2.2 渲染架构（当前）
```
DirectorRuntime.vue
  └─ const currentStep = ref(0)       ← 所有步骤共用一个 step 状态
  └─ const currentPanel = computed()  ← 根据 currentStep.value 返回对应组件引用
  └─ <component :is="currentPanel" :key="currentStep" />  ← 动态渲染
```

### 2.3 管线步骤
| 索引 | 组件 | 状态 |
|------|------|------|
| 0 | ScriptInput | ✅ 剧本输入正常 |
| 1 | CharacterPanel | ✅ 角色图正常（角色提取+生成形象） |
| 2 | ScenePanel | ❌ 只显示空状态占位文案 |
| 3 | StoryboardPanel | ❌ 只显示空状态占位文案 |
| 4 | TTSPanel | ❌ 只显示空状态占位文案 |
| 5 | KeyframePanel | ❌ 只显示空状态占位文案 |
| 6 | VideoPanel | ❌ 只显示空状态占位文案 |
| 7 | ExportPanel | ❌ 只显示空状态占位文案 |

## 三、已做过的排查与修复

### 3.1 ❌ Step 1: 排查 `v-if` 条件渲染链

**现象**: 使用 `v-if/else-if` 链时（`<ScriptInput v-if="currentStep === 0" />` … `<ExportPanel v-else-if="currentStep === 7" />`），步骤2-8无法渲染。

**排查**:
- 通过 F12 确认 `currentStep` 被正确赋值为 0~7
- 通过 F12 Elements 面板确认 `<main class="panel panel-center">` 下没有步骤2-8的 DOM 节点
- 在组件 `<script setup>` 中加 `onMounted` 日志，确认**组件没有被实例化**（无日志输出）
- 检查 bundle 编译结果：`v-if` 链被编译为 `createBlock(ScenePanel, { key: 2 })` 等，逻辑上完全正确
- 验证所有 scopeId 不冲突

**结论**: `v-if` 链触发了 `createBlock` 但组件未被创建——原因不明。

### 3.2 ✅ Step 2: 改为 `<component :is>` 动态组件

**方案**: 用 computed 根据 `currentStep` 返回组件引用，通过 `<component :is="currentPanel" :key="currentStep" />` 渲染。

**效果**: 步骤2-8开始渲染了（能看到组件定义的模板内容），但只显示空状态占位文案，没有实际业务数据。

### 3.3 ❌ Step 3: 排查 disabled 状态影响

**现象**: 步骤条的 `enabled` 字段只有在角色提取完成后才设为 `true`，导致未生成剧本时步骤2-7的 CSS 显示为灰色不可点击（`opacity: .35; cursor: not-allowed`）。

**问题**: CSS `disabled` 状态仅影响视觉，不影响 `@click="goStep(i)"` 触发。经过验证，即使 `disabled` 也能正确切换 `currentStep`。

**修复**: 彻底删除了 `enabled/disabled/done/pending` 逻辑，所有步骤始终可点击。

## 四、当前问题定位

### 4.1 核心发现

**所有步骤页面都能通过 `<component :is>` 成功渲染组件的模板结构，但组件无法获取到对应的业务数据，因此仅显示空状态占位。**

| 步骤 | 期望数据 | 当前显示 |
|------|----------|----------|
| 场景图 | 场景列表（从剧本分析结果中提取的场景描述） | "场景数据将在角色提取完成后加载" |
| 分镜图 | 分镜头列表（基于场景数据生成） | "分镜数据将在场景图完成后加载" |
| 音色 | 角色配音列表 | "音色合成将在分镜图完成后可用" |
| 首尾帧 | 片头片尾帧配置 | "首尾帧将在音色合成完成后可用" |
| 视频制作 | 视频片段数据 | "视频制作将在所有前置步骤完成后开启" |
| 合成导出 | 导出配置 | "导出设置将在视频制作完成后可用" |

### 4.2 组件数据获取方式（当前状态）

每个 pipeline 组件的 `<script setup>` 中通过以下方式获取数据：

```typescript
// 示例：ScenePanel.vue 的期望数据获取链路
import { useDirectorStore } from '../../store/directorStore'
// → characters, scenes, shots, etc.

// 或通过 Graph Runtime API 获取
import { graphClient } from '../../runtime/graph-client'
```

**但问题是：**
1. **旧版管线**（`scheduler.js`）执行完成后，会通过 `api.emitEvent` 等方式将数据推送到 store，但现在**已改为 Graph Runtime 驱动**
2. **Graph Runtime** 执行完成后，数据存储在数据库的 `ExecutionNode` 表中，**前端 pipeline 组件没有适配从 Graph Runtime 读取这些数据**
3. 当前唯一读取 Graph Runtime 数据的组件是 `CharacterPanel.vue`（在 `generatePortrait` 方法中通过 `graphClient.appendNode` + `waitForCompletion` 获取图片 URL）

### 4.3 根因定位

**数据流断裂**：pipeline 组件的数据源仍然是旧版 store（`directorStore`），而新版 Graph Runtime 产出物没有被写入这些 store 字段，也没有被组件读取。

具体来说：
- `directorStore.scenes` — 旧版管线会填充，但 Graph Runtime 不写入
- `directorStore.shotGraph` — 同上
- 各组件只在 mounted 时从 store 读取数据，但 store 是空的，于是渲染空状态

## 五、修复建议

### 方案 A：Graph Runtime 数据桥接层（推荐）

在 `directorStore` 中添加监听机制，在 Graph Runtime 的节点完成执行后，自动将结果写入对应的 store 字段：

```typescript
// directorStore.ts 添加
function syncGraphToStore(graphId: string) {
  const graph = prisma.executionGraph.findUnique(...)
  // 读取场景节点 → store.scenes
  // 读取分镜节点 → store.shots
  // 读取音色节点 → store.ttsConfig
  // 以此类推
}
```

### 方案 B：pipeline 组件改为直接读取 Graph Runtime

每个组件在 mounted 时，查询当前项目的 `ExecutionGraph` 和相关 `ExecutionNode`，从节点 `output` 字段中解析数据：

```typescript
// ScenePanel.vue
const scenes = ref([])
onMounted(async () => {
  const result = await api.get(`/api/v1/graph/runtime/${projectId}/nodes?type=scene`)
  if (result.data?.output) {
    scenes.value = result.data.output.scenes
  }
})
```

### 方案 C：旧桥接恢复（过渡方案）

保留旧版管线在角色提取完成后通过 `directorStore.emit('scene-ready', ...)` 推送场景数据的逻辑，同时在新旧之间加一层适配器。

## 六、待解决问题

1. **`window.__debug` 返回空** — `directorStore` 中的 `__debug` hook 可能已损坏或未被注入（原代码在第 343 行注入 `(window as any).__debug = { ... }`，但最近重构中可能丢失）
2. **Graph Runtime 完成后的 callback/push 机制不存在** — 没有事件通知机制告知前端"某类节点已完成，可以刷新数据"
3. **pipeline 组件与原 store 数据结构耦合** — 不确定 `directorStore` 中 `scenes`、`shotGraph` 等字段的 schema 是否与 Graph Runtime 的输出兼容
