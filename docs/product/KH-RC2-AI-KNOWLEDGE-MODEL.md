# KH-RC2 — AI Knowledge Model & Schema Layer

## 一句话目标
**把 AI Knowledge Hub 从"存数据"升级为"生产 AI 可消费知识资产"的引擎。**

## 状态: FINAL
冻结日期: 2026-07-02
冻结人: 熊大

## 设计原则
1. **AI First** — 输出格式以 AI 消费方（LLM 推理、检索、引用）的需求优先，其次才考虑 CMS/Website
2. **Single Source of Truth** — 所有输出从 Repository 衍生，不额外维护独立数据
3. **可组合** — Brand Package / Product Package / Organization Package 可独立使用，也可合并为完整的 Knowledge Package
4. **版本追溯** — 每次输出都带 Version + Hash + Source Trace

## 架构位置
```
AI Knowledge Hub (Repository Layer)
       │
       ▼
Knowledge Compiler ← NEW
       │
       ├─── Knowledge Package Builder
       ├─── JSON-LD Builder
       ├─── Prompt Block Builder
       └─── Knowledge Snapshot
       │
       ▼
    Knowledge Package API
       │
       ▼
    GEO Discovery Runtime ← 下一阶段
```

---

## 模块定义

### M1 — Knowledge Package Builder
将 Repository 中的 5 类数据（Brand / Product / Article / Entity / Publication）编译为一个可导出的知识包。

- **Brand Package**: 品牌名、行业、描述、使命、愿景、价值观、网站
- **Product Package**: 产品名、描述、功能列表、定价、用例
- **Organization Package**: 品牌 + 产品 + 实体的组合包
- **Entity Package**: 实体名、类型、别名、关系

输出格式: JSON（可转换 JSON-LD）

### M2 — JSON-LD Builder
根据 Knowledge Package 自动生成结构化数据（Schema.org），支撑 AI 索引和搜索引擎理解。

支持的 Schema 类型:
- Organization
- Product
- Article
- FAQ
- Breadcrumb
- WebSite
- Person（可选）

输出: 各 Schema 类型的 JSON-LD 字符串 + 完整包

### M3 — Prompt Block Builder
生成 LLM 可直接消费的知识块，支撑 AI 对品牌的检索、理解和引用。

- **LLM Summary**: 品牌一句话摘要（< 200 tokens）
- **AI Citation Block**: 可被 AI 引用的标准化信息块
- **Retrieval Context**: 用于 RAG 检索的上下文文本
- **Canonical Facts**: 不可变事实（品牌名、行业、产品、官网）
- **FAQ Prompt**: 常见问答的 LLM 友好格式

输出: 纯文本 / JSON（依具体场景）

### M4 — Knowledge Snapshot
每次打包时生成版本快照，确保输出可追溯。

- Version (SemVer)
- Hash (SHA-256 of the Knowledge Package)
- Publish Time
- Source Trace (指向 Repository 各条记录 ID)
- Evidence 关联

### M5 — Knowledge Package API
API 端点用于导出知识包。

| 端点 | 方法 | 输出 |
|------|------|------|
| `/knowledge/package` | GET | 完整 Knowledge Package（JSON） |
| `/knowledge/package/:type` | GET | 指定类型的子包（brand/product/organization/entity） |
| `/knowledge/jsonld/:type` | GET | 指定 Schema 类型的 JSON-LD |
| `/knowledge/jsonld/full` | GET | 全量 JSON-LD 包 |
| `/knowledge/prompt/:type` | GET | 指定类型的 Prompt Block |
| `/knowledge/snapshot` | GET | 最新版本快照 |
| `/knowledge/export` | GET | 一次性导出所有格式的压缩包 |

### M6 — Knowledge Compiler（核心编排器）
将原始 Repository 数据编译为输出的编排器。

```
Repository Data
    │
    ▼
Knowledge Compiler
    │
    ├── Validate (数据完整性检查)
    ├── Transform (结构转换：Repository → Package)
    ├── Enrich (补充衍生字段：汇总/摘要/评分)
    ├── Build (按目标格式生成)
    └── Snapshot (版本标记 + 缓存)
    │
    ▼
Knowledge Package / JSON-LD / Prompt Block
```

---

## 文件结构

```
backend/src/services/knowledge/
├── compiler/              ← NEW (Knowledge Compiler 模块)
│   ├── index.ts           ← 入口：compile(packageType, target)
│   ├── validator.ts       ← 数据完整性检查
│   ├── transformer.ts     ← Repository → Package 转换
│   ├── enricher.ts        ← 补充衍生字段
│   └── snapshot.ts        ← 版本标记 + 快照
├── builders/
│   ├── package-builder.ts ← Knowledge Package Builder
│   ├── jsonld-builder.ts  ← JSON-LD Builder
│   └── prompt-builder.ts  ← Prompt Block Builder
├── api/
│   └── index.ts           ← 已有，需要扩展新端点
├── repository/
│   └── index.ts           ← 已有，不做修改
└── application/
    └── service.ts         ← 已有，需要扩展
```

## 验收标准

- [ ] M1: Knowledge Package Builder — Brand / Product / Organization / Entity 四种包
- [ ] M2: JSON-LD Builder — 至少 Organization / Product / Article / FAQ 四种 Schema
- [ ] M3: Prompt Block Builder — LLM Summary / AI Citation Block / Retrieval Context / Canonical Facts / FAQ Prompt
- [ ] M4: Knowledge Snapshot — 每次打包生成 Version + Hash + Publish Time
- [ ] M5: Knowledge Package API — 7 个端点全部实现
- [ ] M6: Knowledge Compiler — 编排器完整，含 Validate → Transform → Enrich → Build → Snapshot 流程
- [ ] 全部 Build 通过
- [ ] Compiled and Deployed

## 不在此阶段
- CRUD 产品功能增强（KH-RC3）
- GEO 对接（GEO-RC2）
- Publishing Pipeline 增强（PUB-RC1）
