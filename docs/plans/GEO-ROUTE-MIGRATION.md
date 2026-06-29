# GEO 路由迁移计划

> **编制**: C1 实施团队
> **日期**: 2026-07-19
> **范围**: 将现有 brand-geo 后端路由迁移到平台兼容格式

---

## 一、当前路由违规状态

根据 GEO-ARCHITECTURE-AUDIT.md 审计发现，当前 GEO 路由存在以下问题：

| # | 问题 | 严重程度 | 影响路由数 |
|---|------|---------|-----------|
| 1 | 路由含 `/api/brand/` 前缀 | 🔴 Critical | 18+ |
| 2 | 无统一 ApiResponse 格式 | 🔴 Critical | 18+ |
| 3 | 无 auth 中间件 | 🔴 Critical | 18+ |
| 4 | 直接 prisma 调用 | 🔴 Critical | 多数 |
| 5 | 非标准分页参数 (pageNo/size) | 🟡 Major | 列表路由 |
| 6 | 自定义错误格式 | 🟡 Major | 所有 |

---

## 二、路由映射表

### 2.1 项目路由

| 旧路由 | 问题 | 新路由 | 迁移优先级 |
|--------|------|--------|-----------|
| `POST /api/brand/geo/projects` | brand/ 前缀, 无 ApiResponse, 无 auth | `POST /api/v1/geo/projects` | P0 |
| `GET /api/brand/geo/projects?pageNo=1&size=20` | brand/ 前缀, 非标准分页 | `GET /api/v1/geo/projects?page=1&pageSize=20` | P0 |
| `GET /api/brand/geo/projects/:id` | brand/ 前缀, 无 auth | `GET /api/v1/geo/projects/:id` | P0 |
| `PATCH /api/brand/geo/projects/:id` | brand/ 前缀 | `PATCH /api/v1/geo/projects/:id` | P0 |
| `DELETE /api/brand/geo/projects/:id` | brand/ 前缀 | `DELETE /api/v1/geo/projects/:id` | P0 |

### 2.2 Claim 路由

| 旧路由 | 问题 | 新路由 | 迁移优先级 |
|--------|------|--------|-----------|
| `POST /api/brand/geo/claims` | brand/ 前缀, 直接 prisma | `POST /api/v1/geo/projects/:projectId/claims` | P1 |
| `GET /api/brand/geo/claims?projectId=xxx` | brand/ 前缀, 非标准 | `GET /api/v1/geo/projects/:projectId/claims` | P1 |
| `PATCH /api/brand/geo/claims/:id` | brand/ 前缀 | `PATCH /api/v1/geo/claims/:id` | P1 |
| `DELETE /api/brand/geo/claims/:id` | brand/ 前缀 | `DELETE /api/v1/geo/claims/:id` | P1 |

### 2.3 Evidence 路由

| 旧路由 | 问题 | 新路由 | 迁移优先级 |
|--------|------|--------|-----------|
| `POST /api/brand/geo/evidences` | brand/ 前缀 | `POST /api/v1/geo/claims/:claimId/evidences` | P1 |
| `GET /api/brand/geo/evidences?claimId=xxx` | brand/ 前缀 | `GET /api/v1/geo/claims/:claimId/evidences` | P1 |

### 2.4 品牌分析路由

| 旧路由 | 问题 | 新路由 | 迁移优先级 |
|--------|------|--------|-----------|
| `POST /api/brand/geo/analyze` | brand/ 前缀 | `POST /api/v1/geo/brand/analyze` | P2 |
| `GET /api/brand/geo/profile/:projectId` | brand/ 前缀 | `GET /api/v1/geo/brand/profile/:projectId` | P2 |

### 2.5 工作流路由

| 旧路由 | 问题 | 新路由 | 迁移优先级 |
|--------|------|--------|-----------|
| `POST /api/brand/geo/workflows/execute` | brand/ 前缀, 命名不规范 | `POST /api/v1/geo/workflows/trigger` | P2 |
| `GET /api/brand/geo/workflows/:executionId` | brand/ 前缀 | `GET /api/v1/geo/workflows/:executionId` | P2 |

---

## 三、迁移清单

每个路由迁移需要完成以下 6 项改造：

### 3.1 改造清单

```
□ [路径] 更新路由路径: /api/brand/geo/* → /api/v1/geo/*
□ [Auth] 添加 auth 中间件: 使用 AuthService.createMiddleware()
□ [响应] 封装为 ApiResponse 格式
□ [错误] 使用标准化错误代码
□ [分页] 更新分页参数为 page/pageSize 或 cursor/limit
□ [数据] 替换直接 prisma 为 BaseRepository 调用
```

### 3.2 示例：迁移一个 GET 路由

**Before** (当前违规):
```typescript
// backend/src/routes/brand-geo/projects.ts
import { prisma } from '@/lib/prisma'
import { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.get('/api/brand/geo/projects', async (request, reply) => {
    const projects = await prisma.geoProject.findMany()
    return projects  // ❌ 无 ApiResponse, 无 auth, 直接 prisma
  })
}
```

**After** (平台合规):
```typescript
// workspace/geo/services/geo-project-service.ts
import { AuthService, ProjectService } from '@studio/platform'
import type { ApiResponse, Project } from '@studio/platform'
import { BaseRepository } from '@studio/platform/repository'

// 路由处理函数
export async function listGeoProjects(
  auth: AuthService,
  projectService: ProjectService,
  request: { headers: Record<string, string|undefined> }
): Promise<ApiResponse<Project[]>> {
  // 1. Auth middleware
  const user = await auth.createMiddleware()(request)

  // 2. Use Platform SDK service
  const result = await projectService.list({
    type: 'geo',
    userId: user.id,
    page: request.query?.page || 1,
    pageSize: request.query?.pageSize || 20,
  })

  // 3. Return ApiResponse format
  return result
}
```

---

## 四、时间线

| 阶段 | 时间 | 路由 | 交付物 |
|------|------|------|--------|
| **Phase 1** (C1) | 当前 Sprint | 项目路由 (P0) | 新路由 + 旧路由并存 |
| **Phase 2** (C2) | 下一 Sprint | Claim + Evidence 路由 (P1) | 所有数据通过 BaseRepository |
| **Phase 3** (C2) | 下一 Sprint | 品牌分析 + 工作流路由 (P2) | 完整能力 |
| **Phase 4** (C3) | 工程清理 | 全部 | 删除旧 brand-geo/ 目录和旧路由 |

### 4.1 共存策略

在 Phase 1-3 期间，新旧路由并存：
- 新路由: `/api/v1/geo/*` — 完全合规
- 旧路由: `/api/brand/geo/*` — 保留 301 重定向到新路由
- 前端逐步迁移到新路由

### 4.2 Phase 4 清理

C3 阶段完成：
- 删除旧 brand-geo/ 目录
- 删除旧路由文件
- 删除 301 重定向
- 确认所有前端引用已迁移

---

## 五、风险与回退

### 5.1 风险

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 前端未迁移导致 404 | 中 | 高 | 保留 301 重定向 + 监控日志 |
| 数据一致性 | 低 | 高 | 双写期间校验新旧数据 |
| 性能退化 | 低 | 中 | BaseRepository 增加缓存层 |

### 5.2 回退方案

如果新路由出现问题：
1. 立即恢复旧路由路径（301 回退）
2. 修复新路由问题
3. 重新部署新路由
