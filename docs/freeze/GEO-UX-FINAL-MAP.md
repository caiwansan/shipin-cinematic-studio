# GEO Product UX Final Map (P2.3)

**Status**: Design-Defined, Code Not Started
**Based On**: P2.0 Blueprint + P2.1 Capability + P2.2 State Machine
**Constraint**: ❌ 不新增 API / 不改 State Machine / 不改 PermissionService / 不扩 hydrate

---

## 0. 最终 UI 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                   Shell (Sidebar + Header)                  │
│  [☰]  projects  |  execution  |  knowledge  |  system     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1 — Execution Core                                   │
│  ┌────────────────────┐  ┌────────────────────────────┐    │
│  │  ExecutionPanel    │  │  KnowledgeGraph            │    │
│  │  (Workflow UI)     │  │  (Graph Visualization)     │    │
│  └────────────────────┘  └────────────────────────────┘    │
│                                                             │
│  Layer 2 — System Lens                                      │
│  ┌────────────────────┐  ┌────────────────────────────┐    │
│  │  InspectorPanel    │  │  SettingsPage             │    │
│  │  (System View)     │  │  (System Control)         │    │
│  └────────────────────┘  └────────────────────────────┘    │
│                                                             │
│  Layer 3 — System Metadata                                  │
│  ┌────────────────────┐                                     │
│  │  SEOPage           │                                     │
│  │  (System Metadata) │                                     │
│  └────────────────────┘                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Layer 1 — Execution Core UI (重构)

### 1.1 ExecutionPanel → Workflow UI

#### 当前（P2.2）
```
3 个独立按钮 → 各自状态 badge
```

#### P2.3 目标
```
[Workflow Timeline]
  1. 🔍 实体发现    ✓ EXECUTING → WATCHING → STABLE
       └→ 2. 🔗 知识图谱  ☐ (disabled unless Step 1 STABLE)
              └→ 3. ✅ 质量评估 ☐ (disabled unless Step 2 STABLE)
                    └→ 4. 👁️ 实时监控  running...
```

#### 架构变更（仅前端组件层）
| 当前 | P2.3 | 改动范围 |
|------|------|---------|
| 3 个独立 button | WorkflowTimeline.vue (新组件) | 纯 UI 重构 |
| per-capability state badge | Step card with state + duration | 复用 ExecutionStateManager |
| disabled 统一 | Next step disabled 逻辑 | computed 驱动 |
| — | Re-run single step (独立 rerun) | 允许从任意 STABLE 状态重跑 |

#### 数据流（不变）
```
WorkflowTimeline
  └→ PermissionService.hasCapability()  → show/hide step
  └→ ExecutionStateManager.getState()   → step status
  └→ useGeoHydrate.refresh()            → trigger refresh
```

#### 禁止
- ❌ 不动 API
- ❌ 不改 ExecutionStateManager
- ❌ 不改 hydrate

### 1.2 KnowledgeGraph → 添加 Workflow 感知

只在顶部加一行 badge 显示 workflow 状态，不触及现有 graph 渲染逻辑。

---

## 2. Layer 2 — System Lens (重构)

### 2.1 InspectorPanel → System Lens

#### 当前（P2.2）
```
project info / watcher stream / tenant info
```

#### P2.3 目标 — 四个卡片
```
┌──────────────────────────────────────────────────┐
│ 🔍 Execution Summary                             │
│  discover:  STABLE  (3m ago, 120ms)              │
│  graph:     DRIFTED (15m ago, mismatch: 2)       │
│  kq:        IDLE                                  │
├──────────────────────────────────────────────────┤
│ 📊 Project Lifecycle State                       │
│  DRAFT → ACTIVE → RUNNING → COMPLETED → ARCHIVED │
│  Current: ACTIVE                                  │
├──────────────────────────────────────────────────┤
│ 🛡️ Capability Access Map                         │
│  geo.discover        ✓ FREE                      │
│  geo.graph.build     ✓ VIP_1                     │
│  geo.kq.run          ✗ VIP_2                      │
├──────────────────────────────────────────────────┤
│ 🧠 System Health                                  │
│  Watcher: OK (8s interval)                       │
│  Mismatch: 0                                     │
│  Last Hydrate: 2s ago                            │
└──────────────────────────────────────────────────┘
```

#### 架构变更
| 当前 | P2.3 | 改动范围 |
|------|------|---------|
| data table | 结构化卡片 | 纯 UI 重构 |
| watcher raw stream | 精简为 health status | 聚合计算 |
| — | Capability Access Map | 从 PermissionService 派生 |
| — | Execution Summary | 从 ExecutionStateManager 派生 |

#### 禁止
- ❌ 不动 API
- ❌ 不改 watcher data source
- ❌ 不改 hydrate contract

### 2.2 SettingsPage — System Control (新增页面)

不是"设置中心"，而是 **System Control Panel**:

```
┌──────────────────────────────────┐
│ ⚙️ System Control                │
│                                  │
│ Feature Flags (readonly view)    │
│  PROJECT_V2_ENABLED      ✓ true  │
│  TENANT_ISOLATION        ✓ true  │
│  GEO_USE_LEGACY_PROJECT  ✗ false │
│                                  │
│ Tier Status                     │
│  Current: FREE                   │
│  Available: 6 of 16 capabilities │
│  [Show Capability Table]         │
│                                  │
│ Execution Debug Mode             │
│  [Enable] [Disable]              │
│  (development only)              │
│  localStorage: geo_debug_mode    │
└──────────────────────────────────┘
```

#### 数据源
- Feature Flags: 复用 `isFeatureEnabled()` + `getAllFeatureFlags()`
- Tier Status: `PermissionService.getAllCapabilities()`
- Debug Mode: `localStorage` 控制（不新增后端 API）

#### 禁止
- ❌ 不动 API
- ❌ 不新增 store
- ❌ 不涉及业务配置

---

## 3. Layer 3 — System Metadata (新增)

### 3.1 SEOPage — System Metadata View

不是 SEO 工具，是"系统如何被外部理解"：

```
┌──────────────────────────────────────┐
│ 🌐 System Metadata                   │
│                                      │
│ Project Metadata                     │
│  Title: ....                         │
│  Type: GEO                           │
│  Created: 2026-07-17                 │
│                                      │
│ Graph Indexability (from hydrate)    │
│  Nodes: 23                           │
│  Edges: 45                           │
│  Freshness: 92%                      │
│                                      │
│ Knowledge Exposure Level             │
│  Internal Only                       │
│  (no external publishing yet)        │
└──────────────────────────────────────┘
```

#### 数据源
- 全部来自 `useGeoHydrate` 的现有 hydrate response
- 不新增 API

---

## 4. Sidebar 更新

```
P2.2 sidebar

GEO Workspace
├── Dashboard
├── Projects (select/create)
├── Execution Panel
├── Inspector Panel
└── Knowledge Graph

P2.3 sidebar

GEO Workspace
├── Dashboard
├── Projects (select/create)
├── 📐 Execution Studio      ← ExecutionPanel workflow 化
│   ├── Workflow             ← 新 tab (default)
│   └── Raw Actions          ← 旧按钮模式（可隐藏）
├── 🔬 System Lens           ← Inspector 重命名
├── 🕸️ Knowledge Graph
├── ⚙️ System Control        ← SettingsPage 新增
└── 🌐 System Metadata       ← SEOPage 新增
```

---

## 5. P2.3 执行次序

```
Step 1: Sidebar 更新 (入口准备)
Step 2: WorkflowTimeline 组件 (UI 重构 ExecutionPanel)
Step 3: System Lens (UI 重构 InspectorPanel)
Step 4: SettingsPage (新增 UI, 不新增数据)
Step 5: SEOPage (新增 UI, 数据来自 hydrate)
```

### 每步约束验证
```
Step 1  ← 不改页面内容，只改 sidebar.ts
Step 2  ← 纯模板重构，不改 store/API
Step 3  ← 纯模板 + computed 派生
Step 4  ← 纯展示型页面，数据来自已有 flag + permission
Step 5  ← 展示型页面，数据来自 hydrate
```

---

## 6. 防回归条款

1. **所有新组件必须走 useGeoHydrate** — 禁止独立 fetch
2. **所有新组件必须走 PermissionService** — 禁止硬编码权限检查
3. **所有新组件必须走 ExecutionStateManager** — 禁止自制状态
4. **Settings + SEO 页面不接 API** — 纯展示
5. **Sidebar 入口新增不影响已有页面路由**
