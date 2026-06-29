# V4.2 Phase A2 — Platform Classification Plan

> 日期：2026-07-19
> 前置：A1 Dependency Discovery ✅ 完成
> 依据：V41-PLATFORM-CONVERGENCE-DECISION.md

---

## 分类体系

V4.2 引入五级分类，取代之前的二元决策（删除/保留）：

| 级别 | 含义 | 行动 |
|------|------|------|
| **KEEP** | 活跃开发，长期保留 | 继续演进 |
| **FREEZE** | 不开发不删除，仅兼容性维护 | LTS 模式 |
| **MAINTAIN** | 仅维护兼容性，无新功能 | Bugfix only |
| **DEPRECATE** | 业务废弃，切断入口，逐步清理 | 下线流程 |
| **REMOVE** | 安全删除，已确认零引用 | 立即执行 |

这五个级别是 V4.2 平台收敛的最终成果。新增文档 `V42-PLATFORM-CLASSIFICATION.md` 记录所有模块的分类归属。

---

## 执行批次

### 第一批：立即执行（REMOVE）

| 模块 | 文件数 | 依据 |
|------|--------|------|
| `constraint-physics/` | 4 | 零外部引用，完全孤岛 |
| `style-evolution/` | 5 | 零外部引用，完全孤岛 |
| 前端 `modules/geo/` | 13 | DEPRECATED 声明 + 零外部引用 |
| 前端 `brand-geo/` | — | 已有替代路径 |
| 8 个 `.bak` 文件 | 8 | 原始文件均存在或已不需要 |
| `schema.prisma.bak.phasex` | 1 | 旧 schema 备份 |

**动作：** 删除文件，更新六份架构真相源。不需要依赖迁移。

### 第二批：业务收敛（DEPRECATE → 后续 REMOVE）

| 模块 | 文件数 | 当前状态 | 动作 |
|------|--------|---------|------|
| **生活助手（Customer Service）** | 4 API + 9 页面 + 3 表 | 完全活跃但业务废弃 | 切断菜单 → 停止入口 → 停止路由 → 停止后台权限 → 确认无人调用 → 下一版本删除 |

**Deprecate 流程（生活助手）：**

```
Phase A2  Deprecate 标记
    ↓
切断前端菜单（移除 KunlunNav.vue 中的入口）
    ↓
停止路由注册（从 index.ts 移除 customer-service 路由）
    ↓
停止后台权限（从 Admin 菜单移除）
    ↓
确认 4 周内无用户投诉
    ↓
Phase B/C 最终删除代码 + 表
```

### 第三批：基础设施重分类（MAINTAIN / FREEZE）

| 模块 | 文件数 | 当前分类 | 新分类 | 动作 |
|------|--------|---------|--------|------|
| **盘古斧系统（Pangu）** | 32 引用 | 误判为废弃 | 🛠️ **Infrastructure / Toolchain / Maintenance Only** | SST 重新归类，标签为内部工具链 |
| **Phase I Runtime** | 133 文件 | 活跃 | ❄️ **FREEZE** | 停止开发，15 个引用点逐步迁移后正式冻结 |
| **P18 实验** | 9 + 4 表 | 实验 | ⏸️ **DEPRECATE** | 停止功能开发 |
| **p0-gateway 子系统** | 15 + 前端 | 实验 | ⏸️ **DEPRECATE** | 将引用迁移到新方案 |

**盘古斧 SST 重分类：**

之前：
```
Workspace → [Pangu] ❌
```

之后：
```
Infrastructure
└── Toolchain
    └── Pangu（Maintenance Only）
      ├── Gateway
      ├── SSE
      ├── Event Bus
      └── Core Runtime
```

### 第四批：平台冻结（FREEZE）

| 模块 | 路径 | 状态 |
|------|------|------|
| Phase I Runtime | `backend/src/runtime/` | ❄️ FREEZE |
| Provider Runtime | `core/runtime/` | ❄️ FREEZE（V1 RC） |
| Execution Engine | `services/platform/execution/` | ❄️ FREEZE |
| Capability Platform | `services/platform/capability/` | ❄️ FREEZE |
| Resource Runtime | `services/platform/resource/` | ❄️ FREEZE |
| Workspace Runtime | `services/platform/workspace/` | ❄️ FREEZE |
| Agent Runtime | `services/platform/agent/` | ❄️ FREEZE |
| Workflow Runtime | `services/platform/workflow/` | ❄️ FREEZE |

---

## 执行顺序

由 A1 依赖分析结果决定的最终顺序：

```
Step 1: REMOVE 删除候选（0 风险资产）
  ↓
Step 2: Pangu SST 重分类（仅文档，不删代码）
  ↓
Step 3: 生活助手 Deprecate 流程（切断入口，确认无人调用）
  ↓
Step 4: P18 / p0-gateway Deprecate 标记（仅文档 + 标签）
  ↓
Step 5: Phase I Runtime 引用点迁移计划（进入 A3 Execution）
  ↓
Step 6: 更新六份架构真相源
  ↓
Step 7: 收敛审计（A4）
```

---

## 新增文档

除了现有六份真相源，新增：

**`V42-PLATFORM-CLASSIFICATION.md`**
记录每个模块的最终五级分类。作为 Plateform Convergence 的总结档案。

任何人在 SST 中看到模块后，再查此文档即可明确：
- 它是不是正式产品的一部分
- 是否允许继续开发
- 是否只维护
- 是否计划删除
- 是否已经冻结

---

*End of V4.2 Phase A2 — Platform Classification Plan*
