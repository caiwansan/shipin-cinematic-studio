# Cross-Workspace Impact Audit — Phase 1 Tenant & Project Center

**Date:** 2026-07-18  
**Question:** 这次 `Project → Tenant` 改造是否影响其他 Workspace？

---

## 1. 短剧工作台（Video Workspace）

### 1.1 当前状态

短剧使用平台 `Project` 表（直接操作 `prisma.project`），**没有自己的独立 Project 表**。

| 依赖项 | 受影响？ | 说明 |
|--------|---------|------|
| `prisma.project` 查询 | ⚠️ 间接影响 | Project 加 `tenantId`/`type` 字段后，短剧所有 `findMany` 需加 `where: { type: 'video' }` 过滤 |
| `Project` 字段（`script`/`plotBlueprint` 等） | ✅ 不受影响 | 不改字段名，不改字段类型 |
| `frontend/stores/project.ts` | ⚠️ 间接影响 | Store 中 `Project` 接口需扩展 `type`/`tenantId`/`ownerId` |
| `frontend/pages/workspace/scene.vue` | ✅ 不受影响 | 不直接引用 Project 表 |
| `backend/src/services/script-submit.ts` | ✅ 不受影响 | 使用 `prisma.project.findUnique`，传入 id 不变 |
| `backend/src/services/worker-runtime.ts` | ✅ 不受影响 | 使用 `prisma.project.findUnique` |

### 1.2 改造要求

```typescript
// 前端 Project 接口扩展
interface Project {
  // 现有字段
  id: string
  title: string
  status: string
  // ...
  
  // 新增（Phase 1）
  type: string       // 'video' | 'geo' | 'novel' | 'ppt' | 'custom'
  tenantId: string
  ownerId: string
  resourceCount: number
  lastActivityAt?: string
}

// 所有项目列表查询需加 type 过滤
const projects = await prisma.project.findMany({
  where: { type: 'video', tenantId, ... }
})
```

### 1.3 影响范围

| 文件 | 变更类型 |
|------|---------|
| `frontend/stores/project.ts` | 🟡 接口扩展 |
| 短剧所有 `prisma.project.findMany` 调用 | 🟡 加 `type` 过滤 |
| `backend/src/routes/xxx`（短剧 API） | 🟢 如需查询所有 type，改 `where` |

---

## 2. 小说工作台（Novel / HDZ Workspace）

### 2.1 当前状态

小说使用独立 `HdzProject` 表，**不从平台 Project 继承**。

| 依赖项 | 受影响？ | 说明 |
|--------|---------|------|
| `prisma.hdzProject` | ⚠️ 间接影响 | Phase 1 不处理 HdzProject，但未来需要回填 `tenantId` |
| `backend/src/services/hdz/orchestrator.service.ts` | ✅ 不受影响 | 仍使用 `prisma.hdzProject.findUnique` |
| `backend/src/services/hdz/planner.service.ts` | ✅ 不受影响 | 同上 |
| `backend/src/services/hdz/writer.service.ts` | ✅ 不受影响 | 同上 |
| `backend/src/services/hdz/reviewer.service.ts` | ✅ 不受影响 | 同上 |
| `backend/src/services/hdz/llm.client.ts` | ✅ 不受影响 | 同上 |
| `backend/src/services/hdz/worldbuilder.service.ts` | ✅ 不受影响 | 同上 |
| `backend/src/services/hdz/character.service.ts` | ✅ 不受影响 | 同上 |
| `backend/src/services/hdz/director.service.ts` | ✅ 不受影响 | 同上 |
| `frontend/pages/hdz/index.vue` | ✅ 不受影响 | 使用自有 API |

### 2.2 改造要求

**Phase 1 不处理小说工作台。** 但 `HdzProject` 也需要加 `tenantId` 和 `type='novel'`。建议在 Phase 1.1（短剧 Tenant 适配）后，再安排迁移。

### 2.3 影响范围

| 文件 | 变更类型 | 阶段 |
|------|---------|------|
| `HdzProject` Prisma 模型 | 🟡 加 tenantId | Phase 1.1（后续） |
| HDZ Service 层 | 🟡 加 tenant 过滤 | Phase 1.1（后续） |
| HDZ API | 🟢 不需要改入口 | Phase 1.1（后续） |

---

## 3. PPT 工作台

当前状态：PPT 工作台（banana-slides）是独立进程（PM2 process 3），使用独立的 MongoDB，**不涉及平台数据库**。

| 依赖项 | 受影响？ | 说明 |
|--------|---------|------|
| banana-slides 数据库 | ✅ 不受影响 | 独立 MongoDB |
| banana-slides API | ✅ 不受影响 | 独立端口 |
| banana-slides 前端 | ✅ 不受影响 | 独立部署 |

**PPT 工作台完全不受影响。**

---

## 4. 后台管理（Admin）

| 依赖项 | 受影响？ | 说明 |
|--------|---------|------|
| 用户管理 → Tenant 管理 | ⚠️ 间接影响 | 需新增 Personal Tenant 查看/管理页面 |
| 项目管理 → 统一项目列表 | ⚠️ 间接影响 | 需要同时支持旧 GEOProject 和新 Project |
| 小说管理 → HdzProject | ✅ 不受影响 | 仍使用 HdzProject API |

**后台管理建议：Phase 1a 迁移完成后，统一到 `Project` 表管理。Phase 1.0 阶段不修改后台代码。**

---

## 5. 平台 SDK (`@studio/platform`)

| 依赖项 | 受影响？ | 说明 |
|--------|---------|------|
| SDK 的 Workspace 模块 | ✅ 不受影响 | 不直接使用 Project 表 |
| SDK 的 Capability/Router | ✅ 不受影响 | 不涉及 Project/Tenant |
| SDK 的 Execution 模块 | ✅ 不受影响 | 使用 `projectId` 字符串，不关心表结构 |

**SDK 完全不受影响。**

---

## 6. Agent / Execution Pipeline

| 依赖项 | 受影响？ | 说明 |
|--------|---------|------|
| GEO Agents（research/entity/kg） | ⚠️ 间接影响 | 通过 `geoProjectService` 间接使用 GEOProject，Service 层改造后跟随迁移 |
| 短剧 Agents | ✅ 不受影响 | 不引用 GEOProject |
| Execution Pipeline | ✅ 不受影响 | 使用 `projectId` 字符串 |

**GEO Agents 受影响，但通过 Service 层改造即可隔离，Agent 代码不需要修改。**

---

## 7. 定时任务 / 后台 Job

| 依赖项 | 受影响？ | 说明 |
|--------|---------|------|
| 目前无直接引用 GEOProject 的定时任务 | ✅ 不受影响 | — |

**无定时任务受影响。**

---

## 8. 汇总

| Workspace | 当前状态 | Phase 1 影响 | Phase 1.1 需要 |
|-----------|---------|-------------|---------------|
| 🔴 **GEO** | 独立 `GEOProject` 表 | 完全重写 | 迁移到 Project + GeoProfile |
| 🟡 **短剧** | 平台 `Project` 表 | 接口扩展 | 加 `type`/`tenantId` 过滤 |
| 🟡 **小说** | 独立 `HdzProject` 表 | 不处理 | 后续加 tenantId |
| 🟢 **PPT** | 独立 MongoDB | 无 | 无 |
| 🟢 **SDK** | 不引用 Project | 无 | 无 |
| 🟢 **后台管理** | 各自 API | 无 | 后续统一项目列表 |
| 🟢 **Agent/Pipeline** | Service 层隔离 | 无直接变更 | 无 |
| 🟢 **定时任务** | 无引用 | 无 | 无 |

---

## 9. 结论

| 影响级别 | 数量 | 说明 |
|---------|------|------|
| 🔴 需重写 | 1 | GEO（Phase 1a-c） |
| 🟡 需扩展 | 2 | 短剧 Project + 小说 HdzProject（Phase 1d / 后续） |
| 🟢 无影响 | 5 | PPT / SDK / 后台管理 / Agent / 定时任务 |

**Phase 1 的变更范围是可控的。核心影响在 GEO，短剧和小说仅需接口兼容。PPT 和 SDK 完全不受影响。**
