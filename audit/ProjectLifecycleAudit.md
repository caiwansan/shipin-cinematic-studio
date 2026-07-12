# Audit I: Project 生命周期审计 (ProjectLifecycleAudit.md)

## 1. 生命周期定义

昆仑镜系统各工作台的 Project 生命周期状态:

### 1.1 通用 Project 生命周期 (Project 模型)

Prisma `Project` 模型:
```
Draft → Generating → Review → Editing → Publishing → Completed → Archived
```

**问题**: 模型定义中 `status` 字段为 `String?` 无枚举约束:
```prisma
model Project {
  status  String?
  // 无枚举限制，可写入任意值
}
```

### 1.2 HDZ Project 生命周期

`HdzProject` 模型:
```
draft → generating → completed → published → archived
```

实现文件: `backend/src/services/hdz/repositories/`
状态迁移无统一校验。

### 1.3 GEO Project 生命周期

`GeoProject`/`GEOProject` 模型:
```
initialized → scanning → analyzing → reporting → completed
```

实现文件: `backend/src/services/geo/`

### 1.4 Platform Workflow 生命周期

`WorkflowDefinition`/`WorkflowInstance`:
```
draft → active → paused → completed → failed → archived
```

## 2. 生命周期不一致

| 阶段 | 通用 | HDZ | GEO | Platform |
|------|------|-----|-----|----------|
| 初始 | Draft | draft | initialized | draft |
| 进行中 | Generating | generating | scanning | active |
| 暂停 | — | — | — | paused |
| 审核 | Review | — | analyzing | — |
| 编辑 | Editing | — | — | — |
| 发布 | Publishing | published | reporting | — |
| 完成 | Completed | completed | completed | completed |
| 失败 | — | — | — | failed |
| 归档 | Archived | archived | — | archived |

## 3. 缺失的生命周期管理

| 缺失项 | 通用 | HDZ | GEO | Platform |
|--------|:----:|:---:|:---:|:--------:|
| 状态枚举约束 | ❌ | ❌ | ❌ | ❌ |
| 状态迁移校验 | ❌ | ❌ | ❌ | ❌ |
| 统一状态机 | ❌ | ❌ | ❌ | ❌ |
| 生命周期事件 | ❌ | ❌ | ❌ | ❌ |
| 审计日志 | ❌ | ❌ | ❌ | ❌ |

有 `platform/state-machine` 组件，但未被各工作台使用:
- 文件: `backend/src/platform/state-machine/index.ts`
- 状态: 已实现但未集成到任何 Project 模型

## 4. 建议

1. **统一生命周期**: 所有 Project 模型使用同一枚举:
   ```
   DRAFT → PROCESSING → REVIEW → PUBLISHING → COMPLETED → ARCHIVED
   ```
   (含 FAILED 终止状态)

2. **使用 Prisma Enum**: 强制状态约束

3. **集成 State Machine**: 使用已有的 `platform/state-machine` 
   实现状态迁移校验和事件

4. **生命周期事件**: 每个迁移产生 `Event` → `DualWrite` → `AuditLog`

5. **去除重复逻辑**: 统一 HDZ/GEO/Platform 的生命周期管理
