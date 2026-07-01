# P2-T001 Phase 0 — Brand Domain Freeze

> **冻结声明**: 本文档定义了 GEO 平台"Brand"（品牌）领域的数据模型、生命周期、完成度评分规则及其与 Workflow 的关系。冻结后，所有后续的 Prisma 模型、API、Wizard 开发必须基于此文档，不得偏离。

**生效日期**: 2026-07-01  
**状态**: FROZEN (v2 — 含熊大九条评审意见)  
**设计者**: 熊大 (产品/技术决策) / 熊二 (OpenClaw)

---

## 1. Core Principle

> **A GEO Project is not a task. It is a Brand Digital Identity.**
>
> **Every GEO Workflow is an optimization cycle for a Brand Digital Identity.**

Brand 是 GEO 平台的**核心资产**。Brand 永远存在，Project 是一次优化周期，Workflow 在该周期内执行。

Brand Wizard：**一次性建立品牌数字身份**（可持续补充，version +1）。  
GEO Workflow：**围绕这个品牌持续进行 GEO 优化**（无限循环）。

---

## 2. Brand Data Model

### 2.1 独立列（直接查询频率高）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | UUID | ✅ | 主键 |
| `name` | string | ✅ | 品牌名称 |
| `website` | string | ✅ | 官网域名 |
| `description` | text | ✅ | 品牌描述，支持 AI 分析 |
| `industry` | string | ✅ | 行业分类 |
| `region` | string | ❌ | 所在国家/地区 |
| `companyType` | string | ❌ | 品牌类型：brand / saas / ecommerce / local / other |
| `primaryLanguage` | string | ❌ | 主要语言，默认 `zh` |
| `status` | enum | ✅ | draft / active / monitoring / archived |
| `version` | int | ✅ | 品牌版本号，初始 1，每次关键信息变更 +1 |
| `createdAt` | datetime | ✅ |  |
| `updatedAt` | datetime | ✅ |  |

### 2.2 JSON 字段（结构灵活，现阶段不拆表）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `targetMarkets` | `string[]` | ❌ | 目标市场，如 `["china", "global", "southeast-asia"]` |
| `competitors` | `Competitor[]` | ❌ | 竞争品牌列表，含 name / website / industry / notes |
| `goals` | `BrandGoal[]` | ❌ | 优化目标枚举值列表，含优先级 |
| `aiTargets` | `AITarget[]` | ❌ | AI 平台及优先级，含预留 version |

### 2.3 AI Target 类型（JSON 子结构，预留 Priority + Version）

```typescript
interface AITarget {
  id: string            // 如 "chatgpt", "doubao", "deepseek"
  label: string         // 显示名，如 "ChatGPT", "豆包"
  version?: string      // 模型版本，预留（如 "GPT-5.5", "V4"）
  priority: 'high' | 'medium' | 'low' | 'none'
}
```

预定义 AI 平台列表：
- `chatgpt` — ChatGPT / OpenAI
- `doubao` — 豆包
- `deepseek` — DeepSeek
- `qwen` — 通义千问
- `ernie` — 文心一言
- `spark` — 讯飞星火
- `moonshot` — Kimi
- `yuanbao` — 腾讯元宝
- `yi` — 零一万物
- `glm` — 智谱 GLM
- `baichuan` — 百川
- `other` — 其他

### 2.4 Goal 枚举 + 数据结构

```typescript
type GoalEnum =
  | 'increase_visibility'       // 提高 AI 推荐率
  | 'increase_citation'         // 增加引用
  | 'increase_authority'        // 提高权威性 (E-E-A-T)
  | 'increase_chinese_ai'       // 提高中文 AI 可见度
  | 'increase_english_ai'       // 提高英文 AI 可见度
  | 'increase_traffic'          // 增加官网流量
  | 'increase_coverage'         // 提高知识覆盖
  | 'increase_mention'          // 增加品牌提及
```

Goal 数据结构（JSON 中存储时）：

```typescript
interface BrandGoal {
  id: GoalEnum
  priority: 'high' | 'medium' | 'low'  // 用户可设定优先级，默认 medium
}
```

### 2.5 Knowledge Source 独立表

Knowledge Sources 是扫描器直接消费的数据，独立表设计有利于后续扩展。

```prisma
model GEOKnowledgeSource {
  id            String   @id @default(uuid())
  brandId       String
  type          String   // official_site | blog | docs | github | wikipedia | news | social | forum | video | custom
  url           String   // 知识源 URL
  label         String?  // 显示名称（可选）
  crawlStrategy String   @default("manual") // manual | rss | sitemap | api | github | youtube | crawler
  isActive      Boolean  @default(true)
  lastScanned   DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  brand         GEOBrand @relation(fields: [brandId], references: [id], onDelete: Cascade)
}
```

类型枚举说明：

| 类型值 | 显示名 | 说明 |
|--------|--------|------|
| `official_site` | 官网 | 品牌官方网站 |
| `blog` | 博客 | 官方博客 |
| `docs` | 文档 | 产品文档/帮助中心 |
| `github` | GitHub | 开源仓库 |
| `wikipedia` | Wikipedia | 维基百科条目 |
| `news` | 新闻 | 媒体报道/新闻稿 |
| `social` | 社交媒体 | 如微信公众号、LinkedIn、X |
| `forum` | 论坛 | 社区/问答平台 |
| `video` | 视频 | 如 YouTube、Bilibili 频道 |
| `custom` | 自定义 | 其他类型知识源 |

**Crawl Strategy 枚举说明**：

| 策略值 | 说明 |
|--------|------|
| `manual` | 手动配置，无自动扫描 |
| `rss` | RSS/Atom 订阅 |
| `sitemap` | Sitemap 自动发现 |
| `api` | 平台 API 接入 |
| `github` | GitHub API 扫描 |
| `youtube` | YouTube Data API |
| `crawler` | 通用网页爬虫 |

### 2.6 补充数据结构

**Competitor 类型**（JSON 子结构，Phase 1 存 JSON，预留独立表能力）：

```typescript
interface BrandCompetitor {
  name: string
  website?: string
  industry?: string
  notes?: string
}
```

### 2.7 Prisma 模型变更概要

- **新建表**: `GEOBrand`（品牌核心信息，`version` + `status`(含 monitoring)）
- **新建表**: `GEOKnowledgeSource`（独立表，含 `crawlStrategy`）
- **修改表**: `GEOProject` 增加 `brandId` 外键 + `brandVersion` 字段
- **考虑**: 保持 `GEOProject` 现有字段不删除，通过 `brandId` 关联到 `GEOBrand`。品牌信息迁移由后续 Phase 处理。

---

## 3. Brand Lifecycle

### 3.1 生命周期总览

```
┌─────────────────────────────────────────────────────────────┐
│                      Brand Lifecycle                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Quick Create] ──→ Brand (draft, 35%~)                    │
│       │                                                     │
│       ├──→ 完善 Profile                                     │
│       │     (Wizard / 设置补全)                              │
│       │                                                     │
│       v                                                     │
│  Brand (active, 100%)                                       │
│       │                                                     │
│       ├──→ Project #1 ──→ Workflow (Assessment→...→Report)  │
│       ├──→ Project #2 ──→ Workflow (Assessment→...→Report)  │
│       ├──→ Project #3 ──→ Workflow (Assessment→...→Report)  │
│       │       (品牌长期存在，Project 是每次优化周期)           │
│       │                                                     │
│       ├──→ 更新资料 → version +1                            │
│       │     (知识源 / AI Target / Goal / 描述等)              │
│       │                                                     │
│       ├──→ Monitoring (active + 持续监控)                   │
│       │     (RC4 功能：自动扫描、自动告警)                     │
│       │                                                     │
│       └──→ 归档 (archived)                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 创建

- **方式 A — Quick Create**: Brand Name + Website + Industry 必填。创建后状态 `draft`，Brand Profile 实时计算完成率
- **方式 B — Wizard**: 6 步完整引导。创建后状态 `active`

### 3.3 完善资料

- 所有非必填字段均可后续补充
- Wizard 步骤不锁，用户可随时回来补充
- 补充后完成率实时重算

### 3.4 被 Project / Workflow 消费

- **Brand 与 Project 的关系是一对多**。Brand 是长期存在的数字身份，Project 是一次优化周期。
- 一个 Brand 可以有多个 Project（月度/季度/大版本上线时各一次）。
- 每次 Assessment / Discovery / Opportunity / Verification / Report 都基于创建时的 Brand Profile 版本。
- 如果 Brand Profile 发生变化（version +1），Workflow 应能检测到差异并提示是否需要重新评估。

### 3.5 状态流转

```
draft → active → monitoring → archived
         ↑           │
         └───────────┘ (从 monitoring 回到 active = 停止自动监控)
```

- **draft**：Quick Create 后的初始状态，Brand Profile 未补全
- **active**：Brand Profile 已完善，可创建 Project 执行 Workflow
- **monitoring**：RC4 功能，Brand 接入持续监控（自动扫描知识源、自动告警）。处于 monitoring 的品牌仍可创建新 Project
- **archived**：归档后关联的 Project 及 Report 仍可查看，但不能创建新 Project 或启用监控

---

## 4. Brand Completeness 评分规则

### 4.1 三维度结构

Completeness 拆分为 **Identity / Knowledge / Optimization** 三个子维度，让用户一眼知道问题在哪。

#### Identity（品牌身份 — 权重 45%）

| 字段 | 权重 | 说明 |
|------|------|------|
| `name` | 10 | 品牌名称 |
| `website` | 15 | 官网，GEO 扫描核心入口 |
| `description` | 15 | 品牌描述，直接影响 AI 理解 |
| `industry` | 5 | 行业 |

**小计**: 45

#### Knowledge（知识覆盖 — 权重 30%）

| 字段 | 权重 | 说明 |
|------|------|------|
| `knowledgeSources` | 15 | 至少 1 条有效知识源 |
| `region` | 5 | 地区 |
| `companyType` | 5 | 公司类型 |
| `primaryLanguage` | 5 | 主要语言 |

**小计**: 30

#### Optimization（优化目标 — 权重 25%）

| 字段 | 权重 | 说明 |
|------|------|------|
| `targetMarkets` | 8 | 目标市场，至少 1 个 |
| `aiTargets` | 8 | 至少 1 个，priority != none |
| `goals` | 4 | 至少 1 个 |
| `competitors` | 5 | 竞争力分析基础 |

**小计**: 25

**总分**: 100

### 4.2 计算规则

- 每个字段**非空/非 null/非空数组**即得满分
- `aiTargets`: 至少 1 个 target 的 priority != 'none' 即为非空
- `knowledgeSources`: 至少 1 条有效记录且 `isActive = true` 即为非空
- 三维度各自计算得分百分比 + 显示等级

### 4.3 显示等级

| 完成率 | 等级 | 颜色 |
|--------|------|------|
| 80-100 | Excellent | 🟢 绿 |
| 60-79 | Good | 🔵 蓝 |
| 40-59 | Needs Work | 🟡 黄 |
| 0-39 | Incomplete | 🔴 红 |

### 4.4 Dashboard 展示

```
Brand Profile (BrandName v3)
┌──────────────────────────────────────────────┐
│  Identity    ████████████████░░░  85%  Good  │
│  Knowledge   ██████░░░░░░░░░░░░  40%  Needs  │
│  Optimization ██████░░░░░░░░░░░░  40%  Needs │
│  ─────────────────────────────────────────── │
│  Overall     ██████████░░░░░░░░  55%  Needs  │
└──────────────────────────────────────────────┘

Quick Actions:
  [✅ Add Knowledge Sources]  [🎯 Set Goals]  [🏁 Start Assessment]
```

---

## 5. Wizard 与 Workflow 的关系

### 5.1 一对多关系

**Brand 与 Project 的关系是 1:N**，不是 1:1。

```
Brand (永远存在)
  │
  ├── Project #1 (2026 Q3 优化)
  │     └── Workflow (v3 → Assessment → Discovery → ... → Report)
  │
  ├── Project #2 (2026 Q4 优化)
  │     └── Workflow (v4 → Assessment → Discovery → ... → Report)
  │
  └── Project #3 (2027 Q1 优化)
        └── Workflow (v5 → ...)
```

每次 Project 创建时记录当时的 Brand `version`，确保评估结果可追溯。

### 5.2 生命周期差异

| 维度 | Brand Wizard | GEO Workflow |
|------|-------------|--------------|
| **执行次数** | 一次（可补充） | 无限循环 |
| **目的** | 建立品牌数字身份 | 持续优化品牌在 AI 中的表现 |
| **拥有者** | Brand | Project |
| **数据消费** | 创建 Brand Profile | 基于 Brand Profile 执行评估 |
| **变更影响** | 品牌信息变更后 version +1 | 每次 Workflow 基于创建时的 Brand version |

### 5.3 产品导航

```
Brand Dashboard (Overview + Completeness)
    │
    ├── [Start GEO Assessment] → 创建 Project → Workflow
    ├── [View History] → 项目列表（Brand v1/v2/v3 各期评估）
    └── [Edit Brand Profile] → Wizard（可补充，version +1）
```

### 5.4 Brand Version 的使用

每次 Brand 关键信息变更（description / website / knowledgeSources / aiTargets / goals 等）时，`version` 自增 +1：

- Project 创建时记录 `brandVersion`，锁定评估基准
- Report 上显示 "基于 Brand v7 的评估报告"
- Verification 可对比 Brand v7 → v8 的优化效果
- RC4 的持续监控以 `version` 为变更检测单位

### 5.5 Goals 分阶段策略

**Phase 1 (P2-T001)**:
- Goals 数据存入 Brand Profile（暂不影响 Scoring）
- Dashboard 根据 Goals 排序显示相关 Opportunity
- Report 根据 Goals 调整 Recommendation 优先级

**Phase 2 (RC4 / 真实 Scanner 接入后)**:
- Goals 进入 Scoring 权重
- Discovery 引擎根据 AI Targets 调整匹配策略
- Verification 针对 Goals 维度验证优化效果

---

## 6. 后续开发建议

| Phase | 内容 | 依赖 |
|-------|------|------|
| Phase 0 | ✅ 本文档冻结 (v2) | 无 |
| Phase 1 | Prisma 模型（GEOBrand + GEOKnowledgeSource + GEOProject.brandId + brandVersion）+ 数据迁移 | Phase 0 |
| Phase 2 | Quick Create Modal + Dashboard 三维度 Completeness 展示 + 版本号 | Phase 1 |
| Phase 3 | Wizard 6 步 UI（Step 5 Competitor 用预留类型） | Phase 1 |
| Phase 4 | Brand Health 页面（含 brandVersion / monitoring 状态 / 三个 CTA） | Phase 1+2 |
| Phase 5 | Goals 影响 Dashboard/Report 排序 + AiTarget 影响 Opportunity | Phase 1 |
| RC4 | Goals 进入 Scoring + 真实扫描器接入 + monitoring 状态 + crawlStrategy 正式使用 | Phase 5 |

---

*本文件是 GEO 产品文档体系的一部分，与 [GEO_PRODUCT_WHITEPAPER_V1.md](./GEO_PRODUCT_WHITEPAPER_V1.md) 一并生效。*
