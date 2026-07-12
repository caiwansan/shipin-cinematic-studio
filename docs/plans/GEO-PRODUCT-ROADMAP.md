# GEO 产品路线图 V3 — RC3 Production: AI-first Knowledge Platform

**更新日期**: 2026-07-02（V3）
**当前状态**: RC3 Foundation ✅ → RC3 Production 🔜 P1

---

## 完成里程碑

| 里程碑 | 内容 | 日期 |
|--------|------|------|
| RC2 | Knowledge Hub → Golden Evaluation 完整闭环 | 2026-07-02 |
| RC3 Gate A | DeepSeek 生产接入 + 评测基线校准 | 2026-07-02 |
| B1+B1.5 | Evidence Quality Engine (5 维) + Registry | 2026-07-02 |
| B2 | Production Replay Learning（Candidate → Review → Promotion） | 2026-07-02 |

---

## RC3 Production — 新四层架构

从"评测引擎周边"转向 **AI-first Knowledge Platform**。

### 产品闭环

```
Create → Structure → Publish → Discover → Consume → Measure → Learn → Optimize → Republish
```

### URL 信息架构

```
aigc.fushtn.com
  /
  /workspace/*              登录后的工作台
  /knowledge/
    brand/{slug}             品牌知识页
    entity/{slug}            实体知识页
    topic/{slug}             主题知识页
    faq/{slug}               FAQ 页面
    claim/{id}               声明详情页
  /robots.txt                搜索引擎指引
  /sitemap*.xml              站点地图
  /llms.txt                  LLM 发现指引
  /ai-feed.xml               AI 更新通知
  /api/*                     API
```

---

### P1 — Public Publishing Platform

**目标**: 将 Knowledge Hub 的内容发布为永久公开页面，AI 可直接访问。

**核心抽象**: **Publish Manifest** — Compiler 输出的统一发布对象，包含 HTML / JSON-LD / OG / Meta / Sitemap Entry / Feed Entry。

#### T001 — 页面永久 URL
- Brand / Entity / Topic / FAQ / Claim 各自拥有 `{slug}`
- 每个对象: canonical URL, permanent URL, slug, version, updatedAt

#### T002 — AI Landing Page
- 自动生成的 AI 阅读页，统一结构
- 不是 CMS 页面，是 AI 可直接解析的结构化知识页
- 包含: Title / Definition / Summary / Features / Use Cases / FAQ / JSON-LD / Related / References

#### T003 — Publish Manifest
- Compiler 输出标准化 Manifest
- 一个 Manifest 包含所有发布目标所需的数据
- Manifest → Adapter → Website / Feed / Sitemap / API

#### T004 — Nuxt Public Routes
- `/knowledge/*` 路由映射到 Publish Manifest
- 支持 SSR / ISR 渲染策略
- Loading / Empty / Error / Success 四态

#### T005 — Canonical & Meta
- Compiler 自动生成 canonical, hreflang, robots, meta, og, twitter, schema

---

### P2 — AI Discoverability Layer

**目标**: 让 AI 能发现、愿意抓取、持续重新访问知识内容。

#### T101 — Sitemap Engine
- 自动生成: sitemap.xml, sitemap-index.xml, sitemap-knowledge.xml
- 每次发布自动刷新

#### T102 — llms.txt
- 自动生成 llms.txt（AI 可读的站点索引）
- 按品牌/实体/FAQ 分组

#### T103 — AI Feed
- 自动生成 ai-feed.xml（含知识更新通知）
- RSS / Atom 兼容

#### T104 — Crawl Control
- robots.txt 自动更新
- 可配置抓取频率
- Freshness Signals

#### T105 — Knowledge API
- 公开 REST API，按 slug 查询知识
- JSON 格式，支持 LLM 消费

---

### P3 — Structured Knowledge Layer

**目标**: 从"给人看的内容"升级为"AI 可直接消费的数据源"。

#### T201 — Schema Coverage (20+)
- 从当前 6 个 Schema.org 类型扩展到 20+
- Organization, Product, Service, SoftwareApplication, WebSite, Article, TechArticle, FAQPage, HowTo, Person, Brand, Review, Rating, Breadcrumb, VideoObject, ImageObject, Dataset, DefinedTerm, CollectionPage

#### T202 — Entity Graph
- Compiler 自动构建 Brand → Product → Feature → Article → FAQ → Evidence → Citation
- 输出 Knowledge Graph（JSON-LD 格式）

#### T203 — Citation Engine
- 所有知识增加 Source / Reference / Evidence / VerifiedAt / Confidence / Snapshot / ReplayLink
- 形成 AI 可引用的来源链

#### T204 — Fact Block
- 每篇文章自动生成 Key Facts / Definitions / Terminology / Metrics / Timeline
- 方便 LLM 结构化抽取

#### T205 — LLM Consumption Package
- 输出: Prompt Block / Tool Context / System Context / FAQ Context / Retrieval Context
- 统一的 LLM 消费格式

---

### P4 — Knowledge Intelligence Layer

**目标**: 分析 AI 是否引用、如何理解、哪些内容最有效。

#### T301 — AI Crawl Readiness Score
- 检测: Schema / Metadata / Internal Link / Canonical / Freshness / Citation / Entity Graph / Accessibility
- 自动化评分

#### T302 — Knowledge Freshness Monitor
- 检测: 多久没更新 / 没验证 / 没 Replay / 没引用
- 自动提醒

#### T303 — AI Consumption Analytics
- 基于 Replay 分析 AI 对知识的引用情况
- 哪些内容获得更高质量回答
- 不同 AI 模型对同一知识的理解差异

#### T304 — Knowledge Evolution
- Replay → Candidate → Review → Promotion → Version
- B2 已实现的基础能力继续扩展

---

## 工程纪律

1. **所有新能力必须通过 Knowledge Compiler 输出**，禁止各模块各自生成 JSON-LD / Prompt / Metadata
2. **Knowledge Hub 保持全局 Source of Truth**，GEO / Publishing / Monitoring 消费其数据，不重复维护
3. **所有页面统一 Design System**：Loading / Empty / Error / Success 四种状态 + 真实数据
4. **完成每个 Epic 后自动部署 + E2E 验收 + Gate 报告**
5. **每次发布自动触发**: compile → validate → publish → verify → snapshot → replay

---

## 时间线

| 阶段 | 内容 | 优先级 |
|------|------|--------|
| RC3 Foundation | ✅ 全部交付 | — |
| P1 | Public Publishing Platform | ⭐⭐⭐⭐⭐ |
| P2 | AI Discoverability Layer | ⭐⭐⭐⭐⭐ |
| P3 | Structured Knowledge Layer | ⭐⭐⭐⭐⭐ |
| P4 | Knowledge Intelligence Layer | ⭐⭐⭐⭐ |
| RC4 | 产品化 UX（待规划） | 待启动 |
