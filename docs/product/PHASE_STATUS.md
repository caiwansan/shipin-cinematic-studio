# Phase Status Dashboard

**更新**: 2026-07-02
**依据**: 熊大 2026-07-02 产品评审
**状态说明**: P1 链路已打通，进入 Renderer 阶段

---

## 当前路线图

| Phase | 名称 | 状态 | 备注 |
|-------|------|------|------|
| P1-001 | Architecture Audit | ✅ Complete | 7 模块审计 / 9 风险清单 |
| P1-002 | Public Publishing Foundation | ✅ Complete | Brand 页面链路打通 / SSR / SEO / JSON-LD |
| P1.5 | AI Readiness Audit | ⬜ Queue | 发布时自动检查 AI Ready 评分 |
|---|---|---|---|
| **TD-001** | **Nitro Chinese Slug RCA** | **🟡 Tech Debt** | **compiled patch 临时方案，需根因分析** |
|---|---|---|---|
| P1-003 | Public Renderer | ✅ **Complete** | 组件注册表驱动的通用知识页面渲染器 / 8 个组件 / 通用路由 |
| P2 | AI Discoverability | ⬜ Queue | robots.txt / sitemap / llms.txt / AI Feed |
| P3 | Structured Knowledge | ⬜ Queue | Entity / Claim / Evidence 结构化 |
| P4 | AI Visibility | ⬜ Queue | 可见度监测 |
| P5 | Recommendation Monitor | ⬜ Queue | 推荐效果监测 |
| P6 | GEO Intelligence | ⬜ Queue | 知识智能闭环 |

---

## P1-003 Public Renderer — 设计目标

> 不要只有 Brand 页面，而是建立 Manifest → Renderer → Component Registry → Knowledge Page 的通用架构。

### 核心原则
- 一套 Renderer，多个 Manifest 类型（Brand / Entity / FAQ / Claim / Topic）
- Brand 只是 Renderer 的一种配置（renderer: 'brand'）
- 新增类型只需：定义 Manifest Schema → 注册 Renderer Config
- 不复制 Vue 页面

### Renderer 组件架构

```
Renderer
├── Hero          — 标题 / 标识 / 摘要
├── Summary       — 关键信息摘要
├── Metadata      — 时间 / 版本 / 来源
├── FAQ           — 常见问答（结构化可引用）
├── Citation      — 引用数据 / 证据
├── Claim         — 事实性断言及可信度
├── Related       — 相关实体 / 内容
├── JSONLD        — Schema.org 结构化数据
└── Footer        — 版权 / 归属
```

### 实现路径
1. 定义 `RendererConfig` 接口（manifestType → component mapping）
2. 创建 `ComponentRegistry`（register / resolve）
3. 重构 `_slug_.vue` 为通用 `[type]/[slug].vue`（路由支持多类型）
4. Manifest 增加 `renderer` 字段指定渲染配置

---

## TD-001: Nitro Chinese Slug 404 RCA

**文档**: `docs/architecture/tech-debt/TD-001-NITRO-404-ROOT-CAUSE.md`

### 当前措施
- `nuxt.config.ts` compiled hook 中 patch nitro.mjs（PATCH: Knowledge pages with valid SSR content should be 200）
- 仅对 `/knowledge/` 路径生效
- build 时自动应用

### 目标
- 定位根因：Nuxt Bug / Router Unicode / Nitro 内部逻辑
- 如果是 Nuxt Bug：记录版本号 + 提交 issue
- 如果是实现问题：真正修掉，移除 compiled patch

### 推荐解决方向
1. 中文 slug 改为 base64 或数字 ID（最优）
2. routeRules 自定义 handler（有效）
3. 保留 patch（临时）

---

## P1.5: AI Readiness Audit

> 每生成一个公开页面，自动检查 AI 可消费程度。

### 检查维度
- ✅ Entity 信息完整性
- ✅ 可引用事实（Claim）及对应 Evidence
- ✅ 清晰的 FAQ 结构
- ✅ JSON-LD + Canonical 规范
- ✅ AI Ready 评分（平台定义标准）

### 用户可见价值
发布后不只看"发布成功"，还能看到：
> **AI Readiness: 92/100（已达到推荐发布标准）**

### 与 GEO Score 的关系
GEO Score = 品牌在 AI 中的可见度/可理解性/可引用性
AI Readiness = 当前发布内容的质量评分
两者互补：Readiness 面向内容编辑，GEO 面向外部表现。
