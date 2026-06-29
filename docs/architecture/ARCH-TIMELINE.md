# Architecture Timeline — KMKI Platform Evolution

> **Document**: KMKI-ARCH-004 / ARCH-TIMELINE.md  
> **Status**: ✅ Ratified  
> **Last Updated**: 2026-07-17

---

## 四阶段演进路线

```
Phase A ───────── Phase B ───────── Phase C ───────── Phase D ───────── Phase E
Runtime           Knowledge         Product           Intelligence      Optimization
Foundation        Foundation        Foundation                         & AI Visibility
                                    ─────────────────────────────────────────────────
                                    │
                                    ├── GEO V1 (第一个完整产品)
                                    │
                                    └── 短剧/小说/PPT （后续迁移）
```

---

## Phase A — Runtime Foundation (2026-06 ~ 2026-07-17)

**核心成果**：KMKI Runtime V1 RC

| 里程碑 | 日期 | 内容 |
|--------|------|------|
| Runtime V1 开发 | 2026-06 | ProviderRuntime + StructuredGeneration + PromptRegistry + Benchmark |
| Runtime V1 RC Gate | 2026-07-17 | G1-G6 全部通过，20/20 Benchmark（Avg 84.38） |
| **Runtime V1 RC 冻结** | **2026-07-17** | 🧊 `backend/runtime/release/KMKI-RUNTIME-V1-RC.json` |

**约束**：Runtime V1 RC 为冻结基线，严禁修改。

---

## Phase B — Knowledge Foundation (2026-07-17)

**核心成果**：Knowledge Object 成为唯一真相源

| 里程碑 | 日期 | 内容 |
|--------|------|------|
| KO-1 Foundation | 2026-07-17 | Knowledge Object Schema + Repository + Service |
| KO-2 Migration | 2026-07-17 | Entity Pipeline 全面迁移至 KO + GraphSync |
| KO-2.5 Audit | 2026-07-17 | Write Path Clean — 无 Agent 绕过 KO 写入 Graph |
| KO-3 KEE (Architecture) | 2026-07-17 | 设计已定义，开发延后 |

**关键决策**：Knowledge Object 是 GEO 唯一知识载体，Entity/Claims/Evidence/Citations/Confidence/Provenance 全部囊括。

---

## Phase C — Product Foundation (2026-07-17)

**核心成果**：GEO V1 真正可交付 SaaS 产品

| Sprint | 日期 | 内容 |
|--------|------|------|
| P1 Brand GEO MVP | 2026-07-17 | 7 页前端 + 4 路由 + 17 API 端点 + 3 新表 |
| P1.1 Stabilization | 2026-07-17 | 7/7 任务 —— KO Migration / 前端 Guard / Console Error / Empty State |
| P1-RC | 2026-07-17 | 10/10 E2E 验收，`geo-p1-rc` tag |
| ✅ **P1-RC 冻结** | **2026-07-17** | Release Artifact: `docs/releases/KMKI-GEO-P1-RC.md` |
| P1.5 Product Polish | 2026-07-17 | KnowledgeCenter 组件拆分 + BrandCreateWizard + 架构规范升级 |

### P1.5 关键产出

- **前端架构规范 V2** — Page ≤150 行 / Feature ≤200 行 / Step ≤120 行
- **kmki-ui 规划** — 16 个共享组件目录，四个工作台共享
- **KnowledgeCenter 拆分** — 334 行 → 133 行 + 3 子组件
- **BrandCreateWizard** — 7 Step 组件 (≤87 行) + 主组件 (≤200 行)

### Git Tags

| Tag | 日期 | 说明 |
|-----|------|------|
| `geo-p1-mvp` | 2026-07-17 | Brand GEO MVP 基线 |
| `geo-p1-rc` | 2026-07-17 | P1-RC 冻结基线 |

---

## Phase D — Knowledge Intelligence (规划中)

**目标**：基于 Knowledge Object 补齐智能维度

### Sprint P2.1 — Citation Foundation

| 交付 | 类型 | 说明 |
|------|------|------|
| Citation Object | Backend | Schema + Repository |
| Citation Quality | Backend | 可信度评分 |
| Citation Timeline | Backend | 时间线聚合 |
| Citation API | Backend | CRUD 端点 |
| Citation Page | Frontend | Citation 列表 + 详情 |

### Sprint P2.2 — Evidence Foundation

| 交付 | 类型 | 说明 |
|------|------|------|
| Evidence Repository | Backend | Schema + 聚合 |
| Evidence Merge | Backend | 来源去重 |
| Evidence Timeline | Backend | 时间线 |
| Evidence Explorer | Frontend | 证据列表 + 来源映射 |

### Sprint P2.3 — Claim Foundation

| 交付 | 类型 | 说明 |
|------|------|------|
| Claim Repository | Backend | Schema + 推理 |
| Claim Graph | Backend | 支持/反驳关系 |
| Claim Confidence | Backend | 置信度计算 |
| Claim Explorer | Frontend | Claim 列表 + 证据映射 |

### Sprint P2.4 — Trust Engine（平台级）

**独立目录**：`core/trust/` 或 `runtime/trust/`

| 维度 | 说明 |
|------|------|
| Knowledge Score | 知识完整性 |
| Evidence Score | 证据质量 |
| Citation Score | 来源可信度 |
| Claim Score | 推理置信度 |
| Freshness Score | 时效性 |
| Consistency Score | 一致性 |
| Coverage Score | 覆盖面 |
| **Trust Score** | **综合评分（以上维度的加权）** |

**平台级设计**：Trust Engine 不只为 GEO 服务，短剧/小说/PPT 工作台均可调用。

---

## Phase E — Optimization & AI Visibility（后续规划）

### 依赖

```
Citiation → Evidence → Claim → Trust Engine → Report → AI Visibility → Optimization Center
```

### 开发顺序

1. **GEO Report** — 展示层，消费 Trust Engine 数据
2. **AI Visibility** — AI 搜索可见性分析
3. **Optimization Center** — 基于 Trust Score 的优化建议

---

## 架构路线图（完整）

```
Provider Runtime
│
├── StructuredGeneration
│
├── Knowledge Pipeline
│
├── Knowledge Object  ◄── Phase B Freeze
│
├── Knowledge Intelligence  ◄── Phase D
│   ├── Citation Engine
│   ├── Evidence Engine
│   ├── Claim Engine
│   └── Trust Engine （平台级）
│
├── GEO Report  ◄── Phase E-1
│
├── AI Visibility  ◄── Phase E-2
│
└── Optimization Center  ◄── Phase E-3
```

---

## 开发纪律（P2 起强制）

所有新能力必须回答三个问题：

1. **它属于哪一层？** 
   - Runtime / Knowledge / Intelligence / Product / Platform

2. **它生产数据还是消费数据？**
   - 禁止 Consumer 先于 Producer 开发

3. **它是不是平台能力？**
   - 是 → `core/` 或 `runtime/` 或 `frontend/components/kmki-ui/`
   - 否 → 工作台内

---

*End of ARCH-TIMELINE.md — KMKI Platform Evolution Timeline (Updated 2026-07-17)*
