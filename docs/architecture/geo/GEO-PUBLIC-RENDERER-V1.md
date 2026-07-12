# GEO-PUBLIC-RENDERER-V1 — Universal Knowledge Page Rendering Engine

**版本**: v1.0.0  
**状态**: ✅ 实现完成  
**日期**: 2026-07-02  
**作者**: 熊大  
**关联**: P1-003 Public Renderer  

---

## 1. 概述

将昆仑镜短剧工作台中的公开知识页面从"单一 Brand 页面"重构为**类型驱动的通用渲染架构**。

### 核心设计原则

1. **不写 if/else 判断 pageType** — Renderer 通过 section 配置驱动
2. **Manifest 是唯一数据来源** — 组件只读 manifest prop
3. **不复制 Vue 页面** — 所有公开知识页面走同一个渲染器
4. **不破坏 Workspace SPA** — workspace 路由不受影响
5. **SSR 保持** — `/knowledge/**` 继续 SSR
6. **保留 404 patch** — TD-001 追踪中，patch 继续生效

---

## 2. RendererConfig 接口

RendererConfig 是 Manifest 的 consumer 配置，决定单个 Manifest 如何渲染。

```typescript
interface RendererConfig {
  /** 页面类型标识（当前支持 'brand'，未来扩展 'entity'/'topic'/'faq'/'claim'） */
  pageType: string;

  /** 页面布局模板 */
  layout: 'default' | 'minimal' | 'full';

  /** 渲染的区块名称列表（顺序即渲染顺序） */
  sections: string[];

  /** SEO 元数据配置 */
  seo: {
    title?: string;
    description?: string;
    og?: { title?: string; description?: string; image?: string; type?: string };
    twitter?: { card?: string; title?: string; description?: string };
    canonical?: string;
    robots?: string;
  };

  /** 结构化数据配置 */
  structuredData: {
    jsonld?: Record<string, any>[];
    schemaTypes?: string[];
  };

  /** 导航相关 */
  navigation?: {
    breadcrumbs?: { label: string; url: string }[];
    relatedLinks?: { label: string; url: string }[];
    backLink?: { label: string; url: string };
  };

  /** AI 扩展（预留） */
  aiExtensions?: {
    summary?: boolean;        // AI 自动摘要
    keyFacts?: boolean;       // AI 提取关键事实
    structuredFAQ?: boolean;  // AI 从内容提取 FAQ
    knowledgeGraph?: boolean; // AI 生成知识图谱
  };

  /** 功能开关 */
  featureFlags: Record<string, boolean>;
}
```

### Manifest 扩展

`PublishManifest` 新增 `renderer` 字段（可选）：

```typescript
interface PublishManifest {
  // ... existing fields ...
  renderer?: RendererConfig;  // 覆盖或注入渲染配置
}
```

---

## 3. Component Registry 架构

### Register / Resolve 模式

```
register(name: string, component: VueComponent, description?: string) → void
resolveComponent(name: string) → VueComponent | undefined
getRegisteredComponents() → string[]
```

注册表使用 `shallowRef` 保证服务端 + 客户端通用且响应式。

### 内置组件列表

| 注册名 | 组件文件 | 用途 | AI Context |
|--------|---------|------|------------|
| `knowledge-jsonld` | KnowledgeJSONLD.vue | JSON-LD 结构化数据 | ❌ |
| `knowledge-hero` | KnowledgeHero.vue | 标题/标识/摘要 | ✅ |
| `knowledge-summary` | KnowledgeSummary.vue | 内容摘要 | ✅ |
| `knowledge-body-renderer` | KnowledgeBodyRenderer.vue | 正文渲染（text/markdown/html/list） | ❌ |
| `knowledge-faq` | KnowledgeFAQ.vue | FAQ 区块 | ✅ |
| `knowledge-related` | KnowledgeRelated.vue | 相关链接（预留） | ❌ |
| `knowledge-metadata` | KnowledgeMetadata.vue | 版本/更新时间 | ❌ |
| `knowledge-footer` | KnowledgeFooter.vue | 版权/归属 | ❌ |
| `knowledge-claims` | — (预留) | 事实性断言及可信度 | ✅ |
| `knowledge-evidence` | — (预留) | 证据/引用数据 | ✅ |
| `knowledge-timeline` | — (预留) | 时间线 | ❌ |
| `knowledge-citation` | — (预留) | 引用/来源 | ✅ |
| `knowledge-ai-summary` | — (预留) | AI 自动摘要 | ✅ |

### 渲染器组合方式

Renderer 通过 `sections` 配置组合组件。不写 if/else：

```typescript
// Brand 页面的 sections 配置
const sections = [
  'knowledge-jsonld',       // 先 JSON-LD（head 中）
  'knowledge-hero',         // Hero 区域
  'knowledge-summary',      // 摘要
  'knowledge-body-renderer',// 正文
  'knowledge-related',      // 相关链接
  'knowledge-faq',          // FAQ
  'knowledge-metadata',     // 元信息
  'knowledge-footer',       // 页脚
]

// 未来的 Entity 页面
const entitySections = [
  'knowledge-jsonld',
  'knowledge-hero',
  'knowledge-summary',
  'knowledge-claims',
  'knowledge-evidence',
  'knowledge-body-renderer',
  'knowledge-timeline',
  'knowledge-citation',
  'knowledge-footer',
]
```

---

## 4. Universal Route 设计

### 路由格式

```
/knowledge/[type]/[slug]
```

- `type`: 知识类型（brand / entity / topic / faq / claim）
- `slug`: 永久 URL slug（中文等 Unicode 字符）

### 页面文件

单一 Vue 页面：`pages/knowledge/[type]/[slug].vue`

```
/knowledge/brand/昆仑镜       → 渲染 Brand 类型
/knowledge/entity/chatgpt    → 渲染 Entity 类型（未来）
/knowledge/topic/ai          → 渲染 Topic 类型（未来）
```

### API 端点

`server/api/knowledge/[type]/[slug].ts` — 提供 Manifest 数据

---

## 5. 数据流

```
PublishManifest (seed data / API)
      │
      ▼
RendererConfigAdapter (内部映射 sections)
      │
      ▼
ComponentRegistry.resolveComponent(name)
      │
      ▼
各 Knowledge* 组件 (只读 manifest prop)
      │
      ├──→ SSR HTML (renderToString)
      ├──→ useHead (SEO meta + link tags)
      └──→ <script type="application/ld+json"> (JSON-LD)
```

### 渲染流程

1. 客户端/服务端请求 `/knowledge/[type]/[slug]`
2. 通用页面捕获路由，提取 `type` 和 `slug` 参数
3. 获取 Manifest（当前 seed data，未来 API）
4. 根据 sections 配置循环渲染组件
5. `knowledge-jsonld` 注入 JSON-LD 结构化数据
6. `useHead` 设置 SEO meta / title / canonical
7. 返回 SSR HTML

---

## 6. AI Ready Hooks 接口（预留）

### 每个组件暴露 `getAIContext(): AIContext` 方法

```typescript
interface AIContext {
  summary?: string;                    // 摘要
  keyFacts?: { fact: string; confidence: number }[];    // 关键事实
  faqItems?: { question: string; answer: string }[];    // FAQ
  claims?: { claim: string; evidence: string }[];       // 断言
  entities?: { name: string; type: string }[];          // 实体
  citations?: { source: string; url: string }[];        // 引用
}
```

### Renderer 收集 AIContext

Renderer 在渲染完成后可收集所有组件的 AIContext，用于：

- **AI Feed** — 提供结构化数据给 AI 爬虫
- **Knowledge API** — 对外提供 AI-ready 数据
- **GEO Score** — 计算 AI Readiness 评分

---

## 7. 实现状态

| 阶段 | 内容 | 状态 |
|------|------|------|
| ✅ | 架构文档 | ✅ |
| ✅ | Component Registry (`registry.ts`) | ✅ |
| ✅ | KnowledgeHero.vue | ✅ |
| ✅ | KnowledgeSummary.vue | ✅ |
| ✅ | KnowledgeBodyRenderer.vue | ✅ |
| ✅ | KnowledgeJSONLD.vue | ✅ |
| ✅ | KnowledgeMetadata.vue | ✅ |
| ✅ | KnowledgeFooter.vue | ✅ |
| ✅ | KnowledgeRelated.vue | ✅ |
| ✅ | KnowledgeFAQ.vue | ✅ |
| ✅ | KnowledgeRenderer.vue | ✅ |
| ✅ | 通用路由 `pages/knowledge/[type]/[slug].vue` | ✅ |
| ✅ | API handler `server/api/knowledge/[type]/[slug].ts` | ✅ |
| ✅ | 删除旧 Brand 页面 | ✅ |
| ✅ | Build & Deploy | ✅ |

### 已知限制

- Manifest 数据目前使用 inline seed data，尚未接入后端 API
- `knowledge-claims`, `knowledge-evidence`, `knowledge-timeline`, `knowledge-citation`, `knowledge-ai-summary` 为预留组件，尚未实现
- AI Context 收集接口（`getAIContext`）尚未实现，预留为未来扩展
