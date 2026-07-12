# KnowledgeObject Contract — Frozen Interface (V1.0)

> **状态：** 冻结（Frozen）  
> **冻结日期：** 2026-07-04  
> **冻结范围：** Packaging Engine 的唯一输入协议  
> **变更要求：** 任何对该 Contract 的字段增删改，需经过 Cross-Engine 评审（Packaging / Distribution / Evidence / Observation）

---

## 一、Contract 定位

```
所有 Agent ──→ Knowledge Object ──→ Package ──→ Distribute ──→ Observe
                     ↑
             唯一稳定契约（Contract）
```

KnowledgeObject 是整个 GEO 数据管道中 **唯一被所有引擎消费的公共协议**。  
- Discovery Agent **写入** KnowledgeObject
- Packaging Engine **读取** KnowledgeObject
- Evidence Engine **读取** KnowledgeObject
- Observation Engine **读取** KnowledgeObject
- Adaptive Engine **读取并更新** KnowledgeObject

**原则：**  
1. 任何新数据类型（Entity / Claim / Evidence / Citation / FAQ）都必须能映射到 KnowledgeObject 的已有字段
2. 如果映射不成立，先扩展 KnowledgeObject Schema，再扩展 Provider
3. Provider 不得直接读取独立表（GEOEntity / GEOClaim 等），只能读取 KnowledgeObject

---

## 二、Schema 定义

```typescript
// KMKI-RUNTIME-012 — Knowledge Object Schema (V1)
// 冻结版本：1.0.0

export type KOStatus = 'DISCOVERED' | 'ENRICHING' | 'VERIFIED' | 'PUBLISHED' | 'ARCHIVED'

export interface EntitySnapshot {
  id: string              // Required — 实体唯一标识
  name: string            // Required — 实体名称
  type: string            // Required — 实体类型（Concept / Brand / Product / Person / Organization / ...）
  description?: string    // Optional — 实体描述
  metadata?: Record<string, unknown>  // Optional — 扩展属性
}

export interface RelationSnapshot {
  id: string              // Required — 关系唯一标识
  sourceId: string        // Required — 源实体 ID
  targetId: string        // Required — 目标实体 ID
  type: string            // Required — 关系类型（belongsTo / produces / competesWith / ...）
  metadata?: Record<string, unknown>  // Optional — 扩展属性
}

export interface ClaimSnapshot {
  id: string              // Required — 声明唯一标识
  statement: string       // Required — 声明文本
  entityId: string        // Required — 关联实体 ID
  confidence?: number     // Optional — 置信度 [0-1]
  metadata?: Record<string, unknown>  // Optional — 扩展属性（category, sourceType, claimType 等）
}

export interface EvidenceSnapshot {
  id: string              // Required — 证据唯一标识
  content: string         // Required — 证据内容
  sourceUrl?: string      // Optional — 来源 URL
  claimId?: string        // Optional — 关联声明 ID
  reliability?: number    // Optional — 可信度 [0-1]
  metadata?: Record<string, unknown>  // Optional — 扩展属性
}

export interface CitationSnapshot {
  id: string              // Required — 引用唯一标识
  sourceUrl: string       // Required — 来源 URL
  title?: string          // Optional — 标题
  snippet?: string        // Optional — 摘要
  claimId?: string        // Optional — 关联声明 ID
  metadata?: Record<string, unknown>  // Optional — 扩展属性
}

export interface KOProvenance {
  provider: string        // Required — 提供者（presence / knowledge-learning / manual）
  model: string           // Required — 模型名称
  promptVersion: string   // Required — Prompt 版本
  traceId: string         // Required — 追踪 ID
  runtimeVersion: string  // Required — 运行时版本
}

export interface KnowledgeObjectData {
  // ── Identity ──
  id: string              // Required — UUID
  projectId: string       // Required — 项目 ID
  workflowId?: string | null  // Optional — 工作流 ID
  topic?: string | null       // Optional — 主题

  // ── Status ──
  status: KOStatus        // Required — 生命周期状态
  confidence?: number | null     // Optional — 整体置信度 [0-1]
  qualityScore?: number | null   // Optional — 质量评分 [0-1]

  // ── Provenance ──
  provenance?: KOProvenance | null  // Optional — 来源溯源

  // ── Content（核心数据） ──
  entities: EntitySnapshot[]       // Required — 实体列表（可为空数组）
  relations: RelationSnapshot[]    // Required — 关系列表（可为空数组）
  claims: ClaimSnapshot[]          // Required — 声明列表（可为空数组）
  evidence: EvidenceSnapshot[]     // Required — 证据列表（可为空数组）
  citations: CitationSnapshot[]    // Required — 引用列表（可为空数组）

  // ── Timestamps ──
  createdAt: string           // Required — ISO-8601
  updatedAt: string           // Required — ISO-8601
}
```

---

## 三、字段级别分类

| 字段 | Required | 来源 | 用途 | 备注 |
|------|----------|------|------|------|
| id | ✅ | DB 自动生成 | 唯一标识 | — |
| projectId | ✅ | 创建时传入 | 租户隔离 | — |
| workflowId | ❌ | Discovery Agent | 工作流追踪 | 可为空 |
| topic | ❌ | Discovery Agent | 知识主题 | 用于 findByProjectAndTopic |
| status | ✅ | Pipeline | 生命周期 | 默认 DISCOVERED |
| confidence | ❌ | Quality Agent | 置信度 | 可为空 |
| qualityScore | ❌ | Quality Agent | 质量评分 | 可为空 |
| provenance | ❌ | Provider | 溯源 | 可为空 |
| entities | ✅ | Entity Agent | 实体数据 | 可为空数组 |
| relations | ✅ | Entity Agent | 关系数据 | 可为空数组 |
| claims | ✅ | Claim Agent | 声明数据 | 可为空数组 |
| evidence | ✅ | Evidence Agent | 证据数据 | 可为空数组 |
| citations | ✅ | Citation Agent | 引用数据 | 可为空数组 |
| createdAt | ✅ | DB 自动 | 创建时间 | ISO-8601 |
| updatedAt | ✅ | DB 自动 | 更新时间 | ISO-8601 |

**关键说明：**
- `entities/relations/claims/evidence/citations` 全部是 `Required`，但允许空数组 `[]`
- 这意味着一个空的 KnowledgeObject 也是合法的
- Provenance 不是强制的，但建议添加以支持 Evidence Engine 溯源

---

## 四、Mapping Matrix

| KnowledgeObject 字段 | 来源 Agent | 独立表 | Prisma Model |
|---------------------|-----------|--------|-------------|
| entities[].id | Entity Discovery | GEOEntity.id | GEOEntity |
| entities[].name | Entity Discovery | GEOEntity.name | GEOEntity |
| entities[].type | Entity Discovery | GEOEntity.type | GEOEntity |
| relations[].id | Entity Discovery | GEOEntityRelation.id | GEOEntityRelation |
| claims[].id | Claim Agent | GEOClaim.id | GEOClaim |
| claims[].statement | Claim Agent | GEOClaim.text | GEOClaim |
| claims[].confidence | Claim Agent | GEOClaim.confidence | GEOClaim |
| claims[].metadata.category | Claim Agent | GEOClaim.claimType | GEOClaim |
| evidence[].id | Evidence Agent | GEOEvidence.id | GEOEvidence |
| evidence[].content | Evidence Agent | GEOEvidence.content | GEOEvidence |
| evidence[].sourceUrl | Evidence Agent | GEOEvidence.source | GEOEvidence |
| citations[].id | Citation Agent | GEOCitation.id | GEOCitation |
| citations[].sourceUrl | Citation Agent | GEOCitation.sourceUrl | GEOCitation |
| citations[].title | Citation Agent | GEOCitation.citationText | GEOCitation |

**关键发现：**
- KnowledgeObject 的 claims/evidence/citations 是 **全量快照**，独立表 GEOClaim/GEOEvidence/GEOCitation 是 **图结构持久化**
- `GraphSync` 从 KO 写入图表（单向），而不是从图表读入 KO
- 因此 Provider 读取 KO 即可获得所有数据，无需再查独立表
- **独立表在第 ⑤⑥ 引擎可能需要**（图查询、关系遍历），但 Phase 1 的 Packaging 只需 KO

---

## 五、与 Platform 层接口对齐

| KO Schema | Platform KnowledgePackage | Provider 映射 |
|-----------|-------------------------|--------------|
| claims[].statement | claims[].text | 直接映射 |
| claims[].confidence | claims[].confidence | 直接映射 |
| evidence[].content | evidence[].content | 直接映射 |
| evidence[].sourceUrl | evidence[].url | 直接映射 |
| citations[].sourceUrl | citations[].url | 直接映射 |
| citations[].title | citations[].title | 直接映射 |
| citations[].snippet | citations[].snippet | 直接映射 |
| entities[].name | assets (type=structured_data) | 需包装 |
| provenance.provider | tags | 追加 |

**结论：字段级兼容。Platform 层接口不需要修改。**

---

## 六、缺失字段评估

| 北极星需求字段 | KO 是否有 | 解决方案 |
|---------------|---------|---------|
| intent | ❌ | 通过 metadata 或 topic 间接表达 |
| audience | ❌ | 暂不纳入，Phase 2 再扩展 |
| vertical | ❌ | 暂不纳入，Phase 2 再扩展 |
| semanticState | ❌ | 暂不纳入，通过 status 间接表达 |
| truthLevel | ❌ | 暂不纳入，Phase 2 再扩展 |
| targetModels | ❌ | 暂不纳入，Phase 2 再扩展 |

**Phase 1 可接受。** 以上缺失字段不影响 KnowledgeObject → Package 的管道打通。

---

## 七、冻结规则

1. **此 Contract 在 Sprint 1A 期间为 Frozen**
2. 任何字段变更需经 Cross-Engine 评审
3. Provider 对外的 `canHandle(entityType, entityId)` 现在的逻辑是 `entityType === 'brand'`，Phase 1 可接受
4. Provider 的 `buildContent()` 输入应为 `{ koId: string }`，而非 `{ entityType, entityId }`——需调整
5. Sprint 1B 前端展示 Package 时，依赖此 Contract 不可变

---

## 八、结论

**KnowledgeObject 可立即作为 Packaging Engine 的唯一输入协议。**

- [x] Schema 完整且有 TypeScript 定义
- [x] Repository 完整（CRUD + findById/findByProject/findByProjectAndTopic）
- [x] Pipeline 完整（Entity/Evidence/Claim/Citation Agent 统一入口）
- [x] GraphSync 双向同步（KO → 独立表）
- [x] 字段与 Platform 层接口兼容
- [x] 缺失字段不影响 Phase 1 交付

**Step 1A-001 完成，可进入 Step 1A-002（填充 GeoKnowledgeProvider）。**
