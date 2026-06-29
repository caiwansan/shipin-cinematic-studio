# GEO Productization Blueprint v1

**Status**: Design Document (No Code Phase)
**Based on**: GEO-FRONTEND-FREEZE-MANIFEST.md (P1.C Lock)
**Next Step**: P2.1 Capability System Implementation

---

## 1. Capability Tree（能力树）

GEO 系统的所有能力以 `CapabilityID` 为原子单位。每个 Capability 绑定一个 API + 一个 Feature Gate + 一个 UI Action。

```
geo
├── project
│   ├── geo.project.create          — POST /api/geo/projects
│   ├── geo.project.read            — GET  /api/geo/projects/:id
│   ├── geo.project.update          — PUT  /api/geo/projects/:id
│   └── geo.project.delete          — DELETE /api/geo/projects/:id
│
├── execution
│   ├── geo.execution.discover      — POST /api/geo/projects/:id/discover
│   ├── geo.execution.graph.build   — POST /api/geo/projects/:id/graph/build
│   ├── geo.execution.kq            — POST /api/geo/knowledge-quality
│   └── geo.execution.watch         ── hydrate + watcher (read-only feedback)
│
├── graph
│   ├── geo.graph.read              — GET  /api/geo/projects/:id/graph
│   ├── geo.graph.edges             — GET  /api/geo/projects/:id/graph/edges
│   ├── geo.graph.node.create       ── POST /api/geo/entities (w/ entity relation)
│   └── geo.graph.edge.create       ── POST /api/geo/entities/:id/relations
│
└── system
    ├── geo.system.hydrate          — GET  /api/projects/:id/hydrate
    └── geo.system.watcher          — GET  /api/geo/watcher/recent?entityId=
```

### 约束
- ❌ `geo.brand.*` 不存在（Frozen Layer 3）
- ❌ `geo.dashboard.*` 不存在
- ❌ `geo.task.*` 不存在

---

## 2. Project Lifecycle Model

```
DRAFT ──→ ACTIVE ──→ RUNNING ──→ COMPLETED ──→ ARCHIVED
  │          │           │             │
  │          │     ┌─────┴─────┐       │
  │          │     │           │       │
  │     can execute    discover     graph build
  │     only hydrate   │               │
  │                     ▼               ▼
  │                STABLE         STABLE or FAULT
```

### 生命周期事件绑定
| State | Allowed Capabilities | UI State |
|-------|---------------------|----------|
| DRAFT | geo.project.update, geo.system.hydrate | 仅查看 |
| ACTIVE | geo.execution.* (除 watch), geo.graph.* | 可执行 |
| RUNNING | geo.execution.watch only | 只读 |
| COMPLETED | geo.execution.watch, geo.graph.read | 只读 |
| ARCHIVED | geo.system.hydrate | 仅查看 |

---

## 3. Execution Lifecycle Model

每个 execution action 独立走以下生命周期：

```
       ┌─────────────────────────────────────┐
       │                                     │
       ▼                                     │
   IDLE ──→ EXECUTING ──→ WATCHING ──→ STABLE
                                  │
                                  └──→ DRIFTED ──→ (re-execute)
```

### 状态定义
| State | Meaning | UI Behavior |
|-------|---------|-------------|
| IDLE | 尚未执行过 | Show "Execute" button |
| EXECUTING | API 已调用，等待返回 | Show spinner, disable button |
| WATCHING | 执行完成，watcher 事件流跟踪中 | Show watcher stream, 8s polling |
| STABLE | watcher 事件稳定（无 mismatch） | Show green check, hide spinner |
| DRIFTED | watcher 检测到不一致（mismatch > 0） | Show yellow warning, re-execute available |

### 状态机代码结构（未来实现）
```typescript
interface ExecutionState {
  capabilityId: string
  status: 'idle' | 'executing' | 'watching' | 'stable' | 'drifted'
  lastExecutedAt?: string
  lastWatcherEvent?: WatcherEvent
  mismatchCount: number
}
```

---

## 4. VIP / Permission 接入点

### Gate 结构（基于已有 FeatureFlag 体系）
```
FeatureFlag.permission.gates
├── geo.execution.discover           →  [FREE, VIP_1, VIP_2]
├── geo.execution.graph.build        →  [VIP_1, VIP_2]
├── geo.execution.kq                 →  [VIP_2]
└── geo.system.watcher               →  [FREE]
```

### 用户 → Capability 解析链
```
User
  → Tenant (personal/org)
    → Subscription (FREE / VIP_1 / VIP_2)
      → FeatureGate.permission[capabilityId] ⊆ subscription
        → UI show/hide button
```

### 前端接入点（不增加新 store）
```typescript
// 在 useGeoHydrate 或现有 components 中
const canExecute = computed(() => {
  const tier = userStore.tenant?.subscriptionTier || 'free'
  const requiredTiers = FEATURE_FLAGS.permission['geo.execution.discover']
  return requiredTiers.includes(tier)
})
```

---

## 5. UI 映射关系

| Capability | UI Component | Panel | Gate |
|-----------|-------------|-------|------|
| geo.project.create | ProjectCreatePage | projects | FREE |
| geo.project.read | ProjectSelectPage | projects | FREE |
| geo.execution.discover | ExecutionPanel → "实体发现" button | execution | FREE |
| geo.execution.graph.build | ExecutionPanel → "知识图谱" button | execution | VIP_1 |
| geo.execution.kq | ExecutionPanel → "质量评估" button | execution | VIP_2 |
| geo.execution.watch | InspectorPanel watcher stream | inspector | FREE |
| geo.graph.read | KnowledgeGraphPage tabs | knowledge-graph | FREE |
| geo.system.hydrate | All panels (via useGeoHydrate) | — | FREE |

### UI 层级
```
Navigation Layer (sidebar)
  ├── dashboard    — 项目级概览
  ├── projects     — 项目 CRUD
  ├── execution    — 执行控制台（Capability driven）
  ├── inspector    — 系统检视器（只读）
  └── graph        — 知识图谱
```

---

## 6. Frozen Layer — 扩展边界

### 永远不会实现的 Capability
- `geo.brand.*` — 无后端合约，Layer 3 冻结
- `geo.dashboard.*` — 無后端合约，已从 store 清除
- `geo.task.*` — 无后端合约，已从 store 清除

### 未来可能扩展（Phase 3+）
- `geo.export` — 导出 execution report
- `geo.schedule` — 定时执行
- `geo.compare` — 多项目对比

---

## 7. 执行路线图（P2.x）

```
P2.0 [已交付] Product Model Definition（本文档）

P2.1 Capability System
  ├── FeatureFlag.permission 扩展（支持 tier 数组）
  ├── VIP 接入 PermissionService.hasCapability(tier, capabilityId)
  └── UI button 级 gate（show/hide + disabled）

P2.2 Execution State Machine
  ├── ExecutionState type + per-capability tracker
  ├── ExecutionPanel 改为状态驱动 UI
  └── Watcher 绑定到 execution state（非独立轮询）

P2.3 Project Lifecycle UI
  ├── Project state badge / tag
  ├── State transition rules (UI 限制)
  └── 生命周期拦阻性提示（"需先执行 discover 才能 build graph"）

P2.4 Orchestration Layer（可选）
  ├── executeCapability(projectId, capabilityId) dispatcher
  ├── Sequential / parallel workflow
  └── 与 Platform Execution Engine 集成
```

---

## 8. 冻结保护条款

1. **P2.x 所有实现必须遵守 Freeze Manifest** — 不新增 API / store / store fetch
2. **P2.0 定义的 Capability Tree 是最终列表** — 扩展必须经 product review
3. **对所有新 UI 组件强制执行单向数据流审计**
4. **Brand / Task / Dashboard 域名永久冻结** — 不允许任何形式的复活
