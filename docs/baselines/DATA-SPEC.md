# 昆仑镜 V4 数据规范

> **版本**: v1.0 · **状态**: 架构基线 (C0) · **日期**: 2026-07-18
> **范围**: 所有数据库模型、Repository、命名规范

---

## 1. 核心原则

### 原则一：单一 Project 表

整个昆仑镜只有**一张** `Project` 表。不存在 `GEOProject`、`VideoProject`、`NovelProject` 等独立表。

```prisma
// schema.prisma — 正确的做法
enum ProjectType {
  video
  novel
  ppt
  geo
  music
  image
}

model Project {
  id          String      @id @default(uuid())
  name        String
  description String?
  type        ProjectType // ← 核心：用类型枚举区分
  status      ProjectStatus @default(draft)
  userId      String
  metadata    Json?       // ← workspace-specific 元数据

  claims      KnowledgeClaim[]
  entities    KnowledgeEntity[]
  // ... 其他关联

  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  deletedAt   DateTime?   // 软删除
}
```

### 原则二：领域命名统一为 `Knowledge*` 而非 `Geo*`

领域模型属于 Domain 层，命名不应反映 Workspace 归属。

| 旧名（禁止） | 新名（强制） | 领域 |
|-------------|-------------|------|
| `GeoClaim` | `KnowledgeClaim` | Knowledge |
| `GeoEvidence` | `KnowledgeEvidence` | Knowledge |
| `GEOCitation` | `KnowledgeCitation` | Knowledge |
| `GEOFAQ` | `KnowledgeFAQ` | Knowledge |
| `GEOSchemaMarkup` | `KnowledgeSchema` | Knowledge |
| `GEOQualityScore` | `KnowledgeQualityScore` | Knowledge |
| `GEOFreshnessRecord` | `KnowledgeFreshnessRecord` | Knowledge |
| `GEOEntity` | `KnowledgeEntity` | Knowledge |
| `GEOEntityRelation` | `KnowledgeRelation` | Knowledge |

### 原则三：所有模型通过 FK 引用 Project

不允许存在与 Project 无关的独立根模型。每个业务模型必须通过 `projectId` FK 关联到 `Project`。

```prisma
model KnowledgeClaim {
  id        String   @id @default(uuid())
  projectId String   // ← 必须 FK 到 Project
  project   Project  @relation(fields: [projectId], references: [id])

  title     String
  content   String
  status    ClaimStatus @default(pending)

  evidences KnowledgeEvidence[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  @@index([projectId])
  @@index([projectId, status])
}
```

---

## 2. 数据访问层架构: Repository → ORM Adapter 模式

### 2.1 架构概览

数据访问层采用分层抽象，确保 ORM 实现可替换，业务代码不直接依赖具体数据库库：



### 2.2 ORMAdapter 接口定义

`ORMAdapter` 是数据库访问的核心抽象，Prisma 只是其中一种实现：



### 2.3 改造后的 BaseRepository（引用 ORMAdapter 而非直接 Prisma）



### 2.4 PrismaAdapter 实现（默认 ORM 实现）

以下代码展示了 PrismaAdapter 如何实现 ORMAdapter 接口。当一个具体的 Repository 要使用 Prisma 时，将 PrismaAdapter 注入即可：



### 2.5 注入方式（依赖注入）



### 2.6 为什么使用 Repository + ORM Adapter 模式？

| 原因 | 说明 |
|------|------|
| **ORM 可替换** | Prisma 不是终局选择，Drizzle/Kysely 都是备选 |
| **可测试** | 可以 mock ORMAdapter 而无需启动数据库 |
| **集中错误处理** | 在 Adapter 层统一处理数据库错误、超时、重连 |
| **数据变换统一** | mapToDomain 在 Repository 而非分散在 Service 中 |
| **消除重复 mapPrisma** | 原先 13 个 mapPrisma 函数分散在 8 个 Repository + 3 个 Service 中 |


## 3. 完整数据模型

> **注意**: 以下 Prisma schema 展示的是 PrismaAdapter 对应的模型定义。切换 ORM 实现时（如换用 Drizzle），对应的 schema 定义会使用 Drizzle 的 schema 语法。**Repository 层的接口不变，只需更换 ORMAdapter 实现即可。**

### 2.1 Project — 统一项目表

```prisma
enum ProjectType {
  video
  novel
  ppt
  geo
  music
  image
}

enum ProjectStatus {
  draft
  active
  paused
  completed
  archived
}

model Project {
  id          String        @id @default(uuid())
  name        String
  description String?
  type        ProjectType
  status      ProjectStatus @default(draft)
  userId      String
  metadata    Json?         // workspace-specific 数据

  // 领域关联 (Knowledge)
  knowledgeClaims     KnowledgeClaim[]
  knowledgeEntities   KnowledgeEntity[]
  knowledgeRelations  KnowledgeRelation[]
  knowledgeFAQs       KnowledgeFAQ[]
  knowledgeSchemas    KnowledgeSchema[]
  knowledgeScores     KnowledgeQualityScore[]
  knowledgeFreshness  KnowledgeFreshnessRecord[]

  // 领域关联 (Brand)
  brandProfiles       BrandProfile[]
  websiteSnapshots    WebsiteSnapshot[]

  // 基础字段
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  @@index([userId])
  @@index([userId, type])
  @@index([userId, status])
  @@index([type, status])
}
```

### 2.2 Knowledge 领域模型

```prisma
model KnowledgeEntity {
  id          String   @id @default(uuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id])
  name        String
  type        String   // person / organization / concept / product / etc.
  description String?
  metadata    Json?

  sourceRelations  KnowledgeRelation[] @relation("SourceEntity")
  targetRelations  KnowledgeRelation[] @relation("TargetEntity")
  claims           KnowledgeClaim[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  @@index([projectId])
  @@index([projectId, type])
}

model KnowledgeRelation {
  id          String   @id @default(uuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id])
  sourceId    String
  source      KnowledgeEntity @relation("SourceEntity", fields: [sourceId], references: [id])
  targetId    String
  target      KnowledgeEntity @relation("TargetEntity", fields: [targetId], references: [id])
  relationType String  // owns / competes / supplies / etc.
  weight      Float?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  @@index([projectId])
  @@index([sourceId])
  @@index([targetId])
}

model KnowledgeClaim {
  id          String      @id @default(uuid())
  projectId   String
  project     Project     @relation(fields: [projectId], references: [id])
  entityId    String?
  entity      KnowledgeEntity? @relation(fields: [entityId], references: [id])
  title       String
  content     String
  source      String?
  confidence  Float?
  status      ClaimStatus @default(pending)

  evidences   KnowledgeEvidence[]

  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  deletedAt   DateTime?

  @@index([projectId])
  @@index([projectId, status])
}

model KnowledgeEvidence {
  id        String   @id @default(uuid())
  claimId   String
  claim     KnowledgeClaim @relation(fields: [claimId], references: [id])
  content   String
  source    String
  type      String   // text / image / url / document
  relevance Float?

  citations KnowledgeCitation[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  @@index([claimId])
}

model KnowledgeCitation {
  id         String @id @default(uuid())
  evidenceId String
  evidence   KnowledgeEvidence @relation(fields: [evidenceId], references: [id])
  url        String
  title      String
  snippet    String?
  source     String

  createdAt DateTime @default(now())
  deletedAt DateTime?

  @@index([evidenceId])
}

model KnowledgeFAQ {
  id        String @id @default(uuid())
  projectId String
  project   Project @relation(fields: [projectId], references: [id])
  question  String
  answer    String
  category  String?
  priority  Int     @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  @@index([projectId])
  @@index([projectId, category])
}

model KnowledgeSchema {
  id        String @id @default(uuid())
  projectId String
  project   Project @relation(fields: [projectId], references: [id])
  type      String  // article / product / organization / etc.
  markup    Json

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  @@index([projectId])
  @@index([projectId, type])
}

model KnowledgeQualityScore {
  id        String   @id @default(uuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id]) // ← 必须有 FK
  dimension String   // accuracy / completeness / freshness / relevance
  score     Float
  details   Json?

  createdAt DateTime @default(now())

  @@index([projectId])
  @@index([projectId, dimension])
}

model KnowledgeFreshnessRecord {
  id        String   @id @default(uuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id]) // ← 必须有 FK
  url       String
  lastCrawled DateTime
  isFresh   Boolean
  changeLog Json?

  createdAt DateTime @default(now())

  @@index([projectId])
  @@index([projectId, isFresh])
}
```

### 2.3 Brand 领域模型

```prisma
model BrandProfile {
  id           String @id @default(uuid())
  projectId    String
  project      Project @relation(fields: [projectId], references: [id])
  name         String
  description  String?
  website      String?
  industry     String?
  targetMarket String?
  keywords     String[]
  metadata     Json?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  @@index([projectId])
}

model WebsiteSnapshot {
  id        String   @id @default(uuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id])
  url       String
  title     String?
  content   String?
  metaTags  Json?
  snapshotAt DateTime

  createdAt DateTime @default(now())

  @@index([projectId])
  @@index([projectId, snapshotAt])
}
```

---

## 3. Repository 模式

### 3.1 BaseRepository 基类

所有 Repository 必须继承 `BaseRepository`，禁止直接 import prisma。

```typescript
// @studio/platform/repository/base.repository.ts
import { PrismaClient } from '@prisma/client'

export abstract class BaseRepository<T, TPrisma> {
  protected prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** Prisma 模型 → 业务模型映射（子类必须实现） */
  protected abstract mapPrisma(record: TPrisma): T

  /** 业务模型 → Prisma 创建数据映射 */
  protected abstract toCreateInput(data: Partial<T>): unknown

  /** 业务模型 → Prisma 更新数据映射 */
  protected abstract toUpdateInput(data: Partial<T>): unknown

  /** 创建 */
  async create(data: Partial<T>): Promise<T> {
    const record = await (this.prisma as any)[this.tableName].create({
      data: this.toCreateInput(data)
    })
    return this.mapPrisma(record)
  }

  /** 批量创建 */
  async createMany(data: Partial<T>[]): Promise<number> {
    const result = await (this.prisma as any)[this.tableName].createMany({
      data: data.map(d => this.toCreateInput(d))
    })
    return result.count
  }

  /** 根据 ID 查询 */
  async findById(id: string): Promise<T | null> {
    const record = await (this.prisma as any)[this.tableName].findUnique({
      where: { id, deletedAt: null }
    })
    return record ? this.mapPrisma(record) : null
  }

  /** 条件查询 */
  async findMany(where?: Partial<T>, options?: {
    skip?: number
    take?: number
    orderBy?: Record<string, 'asc' | 'desc'>
    include?: Record<string, boolean>
  }): Promise<T[]> {
    const records = await (this.prisma as any)[this.tableName].findMany({
      where: { ...where, deletedAt: null, ...options?.include },
      skip: options?.skip,
      take: options?.take,
      orderBy: options?.orderBy
    })
    return records.map((r: TPrisma) => this.mapPrisma(r))
  }

  /** 更新 */
  async update(id: string, data: Partial<T>): Promise<T> {
    const record = await (this.prisma as any)[this.tableName].update({
      where: { id },
      data: this.toUpdateInput(data)
    })
    return this.mapPrisma(record)
  }

  /** 软删除 */
  async softDelete(id: string): Promise<void> {
    await (this.prisma as any)[this.tableName].update({
      where: { id },
      data: { deletedAt: new Date() }
    })
  }

  /** 版本更新（乐观锁） */
  async updateWithVersion(id: string, version: number, data: Partial<T>): Promise<T> {
    const record = await (this.prisma as any)[this.tableName].updateMany({
      where: { id, version },
      data: { ...this.toUpdateInput(data), version: version + 1 }
    })
    if (record.count === 0) {
      throw new Error(`Version conflict: ${id} at version ${version}`)
    }
    return this.findById(id) as Promise<T>
  }

  protected abstract tableName: string
}
```

### 3.2 具体 Repository 实现示例

```typescript
// workspace/geo/repositories/knowledge-claim.repository.ts
import { BaseRepository } from '@studio/platform/repository'
import { KnowledgeClaim } from '../types'
import { Prisma } from '@prisma/client'

type PrismaClaim = Prisma.KnowledgeClaimGetPayload<{}>
type PrismaClaimCreate = Prisma.KnowledgeClaimCreateInput
type PrismaClaimUpdate = Prisma.KnowledgeClaimUpdateInput

export class KnowledgeClaimRepository
  extends BaseRepository<KnowledgeClaim, PrismaClaim> {

  protected tableName = 'knowledgeClaim'

  protected mapPrisma(record: PrismaClaim): KnowledgeClaim {
    return {
      id: record.id,
      projectId: record.projectId,
      entityId: record.entityId,
      title: record.title,
      content: record.content,
      source: record.source,
      confidence: record.confidence?.toNumber(),
      status: record.status as KnowledgeClaim['status'],
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    }
  }

  protected toCreateInput(data: Partial<KnowledgeClaim>): PrismaClaimCreate {
    return {
      project: { connect: { id: data.projectId! } },
      title: data.title!,
      content: data.content!,
      source: data.source,
      confidence: data.confidence,
      status: data.status ?? 'pending'
    }
  }

  protected toUpdateInput(data: Partial<KnowledgeClaim>): PrismaClaimUpdate {
    return {
      title: data.title,
      content: data.content,
      source: data.source,
      confidence: data.confidence,
      status: data.status
    }
  }
}
```

### 3.3 Repository 使用示例

```typescript
// 在 Service 中使用
import { KnowledgeClaimRepository } from './repositories/knowledge-claim.repository'

export class GeoClaimService {
  private repo: KnowledgeClaimRepository

  constructor(repo: KnowledgeClaimRepository) {
    this.repo = repo
  }

  async findByProject(projectId: string) {
    return this.repo.findMany({ projectId })
  }

  async updateStatus(id: string, status: string) {
    return this.repo.update(id, { status })
  }

  async softDelete(id: string) {
    return this.repo.softDelete(id)
  }
}
```

---

## 4. 迁移路径：Geo* → Knowledge*

### 4.1 分步迁移

```
Phase 1: 创建新表（无数据迁移）
  1. 在 schema.prisma 中定义 Knowledge* 模型
  2. 定义 Project 表（type enum 含 'geo'）
  3. 运行 prisma migrate dev 创建新表
  4. 新旧表并存

Phase 2: 双写（C1 期间）
  1. 所有写操作同时写入 Geo* 和 Knowledge* 表
  2. 读操作从 Geo* 读取
  3. 监控数据一致性

Phase 3: 切换读取源（C2）
  1. 读操作切换到 Knowledge* 表
  2. 验证所有功能正常
  3. 保留 Geo* 表作为回滚用

Phase 4: 删除旧表（C3+）
  1. 确认 Knowledge* 表数据完整
  2. 备份 Geo* 表数据
  3. 删除 Geo* 表
```

### 4.2 迁移映射

| Geo* 列名 | Knowledge* 列名 | 数据转换 |
|-----------|----------------|----------|
| `GeoClaim.id` | `KnowledgeClaim.id` | 直接复制 UUID |
| `GeoClaim.projectId` | `KnowledgeClaim.projectId` | 映射到新 Project.id |
| `GeoClaim.title` | `KnowledgeClaim.title` | 直接复制 |
| `GeoClaim.content` | `KnowledgeClaim.content` | 直接复制 |
| `GeoClaim.status` | `KnowledgeClaim.status` | 直接复制 |
| `GeoEvidence.claimId` | `KnowledgeEvidence.claimId` | FK 指向新 KnowledgeClaim |
| `GEOCitation.evidenceId` | `KnowledgeCitation.evidenceId` | FK 指向新 KnowledgeEvidence |

### 4.3 数据迁移 SQL 示例

```sql
-- 迁移 GEOProject → Project
INSERT INTO "Project" (id, name, description, type, status, "userId", metadata)
SELECT
  id,
  name,
  description,
  'geo'::"ProjectType" as type,
  status::"ProjectStatus",
  "userId",
  '{}'::jsonb as metadata
FROM "GEOProject";

-- 迁移 GeoClaim → KnowledgeClaim
INSERT INTO "KnowledgeClaim" (id, "projectId", title, content, source, confidence, status)
SELECT
  id,
  "projectId",
  title,
  content,
  source,
  confidence,
  status
FROM "GeoClaim";
```

---

## 5. 约束与索引规范

### 5.1 所有模型必须的字段

| 字段 | 类型 | 必须 | 说明 |
|------|------|------|------|
| `id` | UUID | ✅ | 主键 |
| `createdAt` | DateTime | ✅ | 创建时间 |
| `updatedAt` | DateTime | ✅ | 更新时间 |
| `deletedAt` | DateTime? | ✅ | 软删除时间（所有模型必须支持软删除） |

### 5.2 索引规范

| 索引类型 | 必须 | 说明 |
|---------|------|------|
| `projectId` 单列索引 | ✅ | 所有 FK 到 Project 的字段必须有索引 |
| `projectId + status` 复合索引 | ✅ | 常见查询模式 |
| `createdAt` 排序索引 | 建议 | 列表查询优化 |
| 唯一约束 | 按业务需求 | 如 `url` 唯一、`name + projectId` 唯一 |

### 5.3 FK 约束规范

| 场景 | 规范 | 反例 |
|------|------|------|
| FK 到 Project | ✅ 必须加 FK 约束 | `GEOQualityScore` 无 FK→Project 🔴 |
| 级联删除 | ❌ 禁止级联 | 使用软删除 |
| 级联更新 | ❌ 禁止级联 | ID 不应变更 |

---

## 6. 验证规则

### PR 审查检查项

```
□ 模型命名是否使用 Knowledge* 而非 Geo*？
□ 是否所有模型都有 projectId FK 到 Project 表？
□ 是否所有模型都有 deletedAt 软删除字段？
□ 是否所有模型都有 createdAt/updatedAt？
□ 是否每个 FK 字段都有索引？
□ Repository 是否继承了 BaseRepository？
□ Repository 是否实现了 mapPrisma/toCreateInput/toUpdateInput？
□ Service 层是否通过 Repository 而非直接 prisma 操作数据库？
```

---

*数据规范确保了昆仑镜平台的数据一致性和可维护性。违反数据规范意味着数据孤岛、重复代码和迁移噩梦。*
*所有数据模型变更必须经过架构评审。*
