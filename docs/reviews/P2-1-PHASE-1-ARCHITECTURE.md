# Phase 1 — Architecture Report

> Sprint: P2.1 Citation Foundation
> Phase: 1 / 11
> Date: 2026-07-17
> Status: ✅ Completed

---

## 1. Citation 层级归属（三层问题回答）

| 问题 | 答案 |
|------|------|
| **属于哪一层？** | `core/citation/` — 平台级知识基础设施 |
| **生产还是消费数据？** | Producer（向 Knowledge Object 生产 Citation 数据） |
| **是不是平台能力？** | ✅ 是 — 短剧/小说/PPT/GEO 四个工作台共享 |

**架构决策**：Citation 不是 GEO 私有能力，而是昆仑镜平台的知识引用基础设施。

---

## 2. 模块边界

### 2.1 `core/citation/` — 平台核心

```
backend/src/core/citation/
├── index.ts                  ← 统一导出
├── types.ts                  ← 平台级 Citation 类型（无 GEO 依赖）
├── CitationService.ts        ← 业务逻辑（CRUD + Format + Search + Import/Export）
├── CitationRepository.ts     ← 数据库访问
├── CitationValidator.ts      ← 输入校验
├── CitationFormatter.ts      ← 格式化（APA/MLA/Custom）
├── dto/
│   ├── create.dto.ts
│   ├── update.dto.ts
│   ├── search.dto.ts
│   └── response.dto.ts
└── routes/
    └── citation.route.ts     ← 平台级 REST 端点
```

### 2.2 GEO Adapter — 工作台集成

```
backend/src/services/geo/adapters/citation/
├── index.ts                  ← 导出 GEO 专用的 Citation 方法
├── GeoCitationAdapter.ts     ← 桥接 core/citation → GEO Workspace
└── routes.ts                 ← GEO 命名空间下的端点（代理到 core）
```

### 2.3 依赖关系

```
GEO Workbench
     │
     ▼
GeoCitationAdapter
     │
     ▼
core/citation ───────────► Trust Engine (P2.4)
     │
     ▼
Knowledge Object (KO)
     │
     ▼
Evidence (P2.2) → Claim (P2.3)
```

---

## 3. 数据模型（复用 Prisma GEOCitation）

现有 `kmki_geo_citations` 表可直接作为基础。P2.1 期间不需要改 Schema，只需扩展 Index：

```prisma
model GEOCitation {
  id            String   @id @default(uuid())
  evidenceId    String
  format        String   @default("custom")
  tenantId      String?  @db.Uuid         ← 租户隔离
  citationText  String   @default("")
  sourceUrl     String?
  publisher     String?
  author        String?
  datePublished String?
  authorityLevel String  @default("news")  // government, academic, industry, news, community
  provenance    Json     @default("{}")
  metadata      Json?    @default("{}")    ← 扩展字段（未来用于 Relevance/Tags）
  createdAt     DateTime @default(now())
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  evidence GEOCitation @relation(fields: [evidenceId], references: [id], onDelete: Cascade)

  @@index([evidenceId])
  @@index([authorityLevel])
  @@index([tenantId])                      ← 建议新增
  @@map("kmki_geo_citations")
}
```

**Prisma 表重命名**：建议不重命名，跨版本兼容。平台化后统一加 `kmki_` 前缀是现有规范。

---

## 4. API 设计

### 4.1 平台级端点（core/ → 给 Admin + 跨工作台）

| Method | Path | 说明 |
|--------|------|------|
| `GET` | `/api/citations?evidenceId=xxx` | 列表 |
| `GET` | `/api/citations/:id` | 详情 |
| `POST` | `/api/citations` | 创建 |
| `PATCH` | `/api/citations/:id` | 更新 |
| `DELETE` | `/api/citations/:id` | 软删除 |
| `GET` | `/api/citations/search?q=xxx` | 搜索 |
| `POST` | `/api/citations/import` | 批量导入 |
| `GET` | `/api/citations/export?evidenceId=xxx` | 批量导出 |

### 4.2 GEO 命名空间下的代理端点

| Method | Path | 代理到 |
|--------|------|--------|
| `GET` | `/api/geo/citations?evidenceId=xxx` | `core/citation` |
| `POST` | `/api/geo/citations` | `core/citation` |
| `PATCH` | `/api/geo/citations/:id` | `core/citation` |
| `DELETE` | `/api/geo/citations/:id` | `core/citation` |

GEO Adapter 端点仅做代理 + GEO 特定的权限/租户检查，不包含业务逻辑。

---

## 5. 对后续 Sprint 的扩展预留

### Evidence (P2.2)
```
core/evidence/
├── EvidenceService.ts    ← 依赖 CitationService
├── EvidenceMerge.ts      ← 基于 Citation 去重
└── EvidenceTimeline.ts   ← 基于 Citation 的时间线
```

### Claim (P2.3)
```
core/claim/
├── ClaimService.ts       ← 依赖 EvidenceService
├── ClaimGraph.ts         ← 支持/反驳关系
└── ClaimConfidence.ts    ← 基于 Evidence 的置信度
```

### Trust Engine (P2.4)
```
core/trust/
├── TrustEngine.ts        ← 依赖 Citation + Evidence + Claim
├── CitationDimension.ts   ← 来源可信度
├── EvidenceDimension.ts   ← 证据质量
├── ClaimDimension.ts      ← 推理置信度
└── ...
```

---

## 6. Migration 策略（从 geo/ 到 core/）

**原则：保持 API 稳定，不破坏现有依赖**

| 步骤 | 内容 | 影响 |
|------|------|------|
| 1 | 创建 `core/citation/`，复制现有 Service/Repository | 无（新目录） |
| 2 | 创建 GEO Adapter，代理到 `core/citation/` | 无（新文件） |
| 3 | 注册 Route（core + geo 各一份） | 无 |
| 4 | 旧 `geo-citation.service.ts` 改为引用 Adapter | 内部重构 |
| 5 | 待 P2.1 通过验收后，清理 `geo/` 下的直接实现 | 清理 |

**不直接删除旧文件**，通过 Adapter 模式过渡。

---

## 7. Architecture 检查清单

| ID | 检查项 | 状态 |
|----|--------|------|
| ARC-001 | Citation 属于 core/ —— 平台能力 | ✅ |
| ARC-002 | 未来四工作台共享时无需大改 | ✅（已设计） |
| ARC-003 | Workspace 层无状态（GEO Adapter 仅代理） | ✅ |
| ARC-004 | 禁止业务逻辑写死在工作台层 | ✅（在 core/ 中） |
| ARC-005 | 对 Evidence/Claim/Trust 有扩展方案 | ✅（Section 5） |
| ARC-006 | Migration 有过渡期，不破坏现有代码 | ✅（Adapter 模式） |

**Phase 1 结论：✅ Architecture 通过，可进入 Phase 2（Backend Service）。**
