# Knowledge Hub Runtime Baseline v1 — KH1 Canonical Package Runtime

> **日期**: 2026-07-22
> **版本**: v1.0
> **基线**: KH1 Sprint Freeze
> **前驱**: KH0 Platformization Validation
> **状态**: ✅ FROZEN

---

## 运行时架构

```
Workspace Provider
        │
        ▼
  ┌──────────────┐
  │ PackageBuilder │  ← 不感知 Workspace，仅依赖 Provider
  └──────┬───────┘
         ▼
  ┌──────────────┐
  │PackageValidator│  ← 唯一验证入口，Schema + 完整性
  └──────┬───────┘
         ▼
  ┌──────────────────────┐
  │KnowledgePackageRepo   │  ← 唯一数据访问层
  └──────┬───────────────┘
         ▼
  ┌───────────────┐
  │ VersionEngine  │  ← 唯一版本管理，不可变快照
  └───────────────┘
         ▼
  ┌───────────────┐
  │ Runtime API    │  ← 仅返回 Canonical DTO
  └───────────────┘
```

## Provider Contract（已冻结）

```typescript
interface KnowledgeProvider {
  workspace: string
  name: string
  buildContent(pkg): Promise<KnowledgePackage | null>
  canHandle(entityType, entityId): boolean
  getClaims?(pkg): KnowledgeClaim[]
  getEvidence?(pkg): KnowledgeEvidence[]
  getAssets?(pkg): KnowledgeAsset[]
  getCitations?(pkg): Citation[]
  getPublishingTargets?(pkg): PublishingTarget[]
}
```

## Canonical Package Schema（版本 v1.0）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | ✅ | UUID |
| workspace | string | ✅ | geo / novel / drama / ppt |
| entityType | string | ✅ | 实体类型 |
| entityId | string | ✅ | 实体 ID |
| title | string | ✅ | 标题 |
| description | string | - | 描述 |
| version | string | ✅ | semver |
| status | enum | ✅ | draft / review / approved / published / archived |
| statusHistory | StatusChange[] | ✅ | 状态变更记录 |
| claims | KnowledgeClaim[] | ✅ | 知识声明 |
| evidence | KnowledgeEvidence[] | ✅ | 证据 |
| assets | KnowledgeAsset[] | ✅ | 附件 |
| citations | Citation[] | ✅ | 引用 |
| tags | string[] | ✅ | 标签 |
| recommendations | Recommendation[] | - | 仅 GEO 使用 |
| publishingTargets | PublishingTarget[] | ✅ | 发布目标 |
| createdAt | string | ✅ | 创建时间 |
| updatedAt | string | ✅ | 更新时间 |

### 不允许出现的字段
- `brand`, `score`, `BrandScore`, `GeoBrand`, `GeoEvidence`, `BII`, `ADI`

## API Contract（已冻结）

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | /api/knowledge/packages | 创建 Package | 否 |
| GET | /api/knowledge/packages | 列表 | 否 |
| GET | /api/knowledge/packages/:id | 详情 | 否 |
| POST | /api/knowledge/packages/:id/validate | 校验 | 否 |
| POST | /api/knowledge/packages/:id/version | 创建版本 | 否 |
| GET | /api/knowledge/packages/:id/history | 版本历史 | 否 |
| GET | /api/knowledge/providers | 已注册 Provider | 否 |

### 响应格式
```json
{ "success": true, "data": T }
{ "success": false, "error": "..." }
```

## 版本生命周期

```
draft ─► snapshot ─► release_candidate ─► released ─► archived
  │                                                    │
  └────────────────── rollback ────────────────────────┘
```

- 快照不可修改
- 回滚创建新版本（不修改历史）

## 注册 Provider

| Workspace | Provider | 状态 |
|-----------|----------|------|
| GEO | GeoKnowledgeProvider | ✅ 已实现 |
| Novel | NovelKnowledgeProvider | 🔷 Stub |
| Drama | StoryKnowledgeProvider | 🔷 Stub |
| PPT | PresentationKnowledgeProvider | 🔷 Stub |

## Runtime Gate 验收

| 验收项 | 状态 |
|--------|------|
| Builder 不依赖具体 Workspace | ✅ |
| Provider Contract 冻结无修改 | ✅ |
| Repository 为唯一数据访问入口 | ✅ |
| Validator 为唯一验证入口 | ✅ |
| VersionEngine 为唯一版本管理入口 | ✅ |
| API 不暴露内部 ORM 模型 | ✅ |
| 4 个 Provider 已注册 | ✅ |
| tsc --noEmit 通过 | ✅ |
| 线上 API 响应正常 | ✅ |

## 目录结构

```
backend/src/platform/knowledge-hub/
├── index.ts                         # 平台入口
├── core/
│   ├── types.ts                     # Canonical 类型定义
│   ├── package-builder.ts           # KH1-T001
│   ├── package-validator.ts         # KH1-T002
│   ├── version-engine.ts            # KH1-T004
│   └── provider-runtime.ts          # KH1-T005
├── repository/
│   └── package-repository.ts        # KH1-T003
├── providers/
│   ├── geo/geo-knowledge.provider.ts # 正式
│   └── stubs/                       # Stub
├── api/
│   └── routes.ts                    # KH1-T006
├── asset-builder.service.ts         # 遗留(KDP)→Phase 3 删除
├── attempt-scheduler.service.ts     # 遗留(KDP)→Phase 3 删除
├── distribution-planner.service.ts  # 遗留(KDP)→Phase 3 删除
├── packaging-*.ts                   # 遗留(KDP)→Phase 3 删除
├── packagers/                       # 遗留(KDP)→Phase 3 删除
├── delivery/                        # 遗留(KDP)→Phase 3 删除
└── repos/                           # 遗留(KDP)→Phase 3 删除
```

## KH1 里程碑

| Sprint | 状态 | Tag |
|--------|------|-----|
| Architecture Freeze | ✅ | kh-architecture-freeze-v1 |
| KH0 Platformization Validation | ✅ | （同上 commit） |
| KH1 Canonical Package Runtime | ✅ | （当前） |

**KH1 完成**: Knowledge Hub 正式拥有独立的平台运行时。
