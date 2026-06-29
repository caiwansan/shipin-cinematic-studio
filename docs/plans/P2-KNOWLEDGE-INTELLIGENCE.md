# Sprint P2.0（规划中）— Knowledge Intelligence Foundation

> 注意：P2.0 现已细化为 P2.1-P2.4 四个 Sprint，见各分文件。

> 基于 P1-RC 冻结的 Knowledge Object，补齐三个核心维度
> 开发顺序：Citation → Evidence → Claim（数据依赖链）

## 为什么这个顺序

Claim 依赖 Evidence，Evidence 依赖 Citation。

- Citation 是原始素材（来源管理 → 可信度）
- Evidence 是 Citation 的聚合分析（来源聚合 → 证据类型）
- Claim 是 Evidence 的推理结果（支持证据 → 置信度）

跳级做 Claim 会导致数据根基不稳。

## Sprint 1 — Citation Center

**目标：** CI（Citation Intelligence）模块，每条知识对象可关联多个 Citation

### Backend

| 任务 | 说明 | 优先级 |
|------|------|--------|
| `GET /api/geo/knowledge/:id/citations` | 获取 KO 下所有 Citation | P0 |
| `POST /api/geo/knowledge/:id/citations` | 添加 Citation | P0 |
| `DELETE /api/geo/knowledge/:id/citations/:cid` | 删除 Citation | P1 |
| Citation 可信度评分 | 基于 Source URL 域权威度、内容时效性等 | P1 |
| Citation 来源管理 | 聚合去重、来源统计 | P2 |

### Frontend

| 任务 | 说明 | 优先级 |
|------|------|--------|
| CitationList 组件 | 展示 KO 的 Citation 列表（来源/可信度/时间） | P0 |
| CitationDetail 组件 | 单个 Citation 详情（包含关联 Evidence） | P1 |
| Citation 来源管理面板 | 聚合来源、去重、可信度排序 | P1 |

### API 设计

```ts
// GET /api/geo/knowledge/:id/citations
interface CitationResponse {
  id: string
  koId: string
  sourceUrl: string
  citationText: string
  confidence: number     // 0-1
  sourceDomain: string
  citedAt: string
  relevance: string      // high / medium / low
  tags: string[]
}

// POST /api/geo/knowledge/:id/citations
interface CreateCitationRequest {
  sourceUrl: string
  citationText: string
  relevance?: string
  tags?: string[]
}
```

---

## Sprint 2 — Evidence Center

**目标：** EI（Evidence Intelligence），基于 Citation 的聚合分析

### Backend

| 任务 | 说明 | 优先级 |
|------|------|--------|
| `GET /api/geo/knowledge/:id/evidence` | 获取 KO 下所有 Evidence | P0 |
| `POST /api/geo/knowledge/:id/evidence` | 聚合生成 Evidence | P1 |
| Evidence 类型分类 | factual / analytical / statistical / testimonial | P1 |
| Evidence 时间线 | 按时间维度聚合 | P2 |

### Frontend

| 任务 | 说明 | 优先级 |
|------|------|--------|
| EvidenceList 组件 | 展示 Evidence 列表（类型/来源聚合/可信度） | P0 |
| EvidenceTimeline 组件 | 时间线视图 | P1 |
| Evidence SourceMap | 来源关系图 | P2 |

---

## Sprint 3 — Claim Center

**目标：** CLI（Claim Intelligence），基于 Evidence 的推理

### Backend

| 任务 | 说明 | 优先级 |
|------|------|--------|
| `GET /api/geo/knowledge/:id/claims` | 获取 KO 下所有 Claim | P0 |
| `POST /api/geo/knowledge/:id/claims` | 基于 Evidence 生成 Claim | P1 |
| 支持/反驳证据映射 | 每条 Claim 关联支持/反驳的 Evidence | P1 |
| Confidence 计算 | 基于支持证据数量与质量 | P1 |

### Frontend

| 任务 | 说明 | 优先级 |
|------|------|--------|
| ClaimList 组件 | 展示 Claim（置信度/支持证据/反驳证据） | P0 |
| ClaimDetail 组件 | Claim 详情 + 证据映射 | P1 |
| Claim Confidence 可视化 | 置信度仪表盘 | P2 |

---

## Sprint 4 — Trust Engine（后续）

基于 Claim / Evidence / Citation 的综合可信度评分：

```
TrustScore = f(
  Citation Coverage,
  Evidence Quality,
  Claim Confidence,
  Entity Freshness,
  Source Diversity
)
```

**不在此 Sprint 范围内。** 待前三个模块稳定后再启动。

---

## Sprint 5 — GEO Report（后续）

Report 是下游消费端，依赖 Trust Engine 的输出数据。不会在 P2.0 范围内。

---

## 验收标准

- [ ] Citation Center：可查看/添加/删除 KO 的 Citation
- [ ] Evidence Center：可查看/生成 KO 的 Evidence
- [ ] Claim Center：可查看/生成 KO 的 Claim
- [ ] 所有新组件遵守 Frontend Architecture V2 规范
- [ ] 无 token 截断错误
- [ ] 编译通过
- [ ] PM2 后端重启后正常
