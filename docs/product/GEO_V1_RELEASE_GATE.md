# GEO v1.0 Release Gate — 产品冻结标准

版本: v1.0
状态: FINAL
生效日期: 2026-07-02
冻结人: 熊大

## 宪法条款

**任何新功能必须证明它提升了以下三者中至少一项，否则不进入 GEO v1.0：**
- **AI Visibility**（AI 可见度）
- **AI Understandability**（AI 可理解性）
- **AI Citability**（AI 可引用性）

---

## Gate A — AI Knowledge Hub Product MVP（P0）

**目标：从空页面变成可用产品。**

### 验收标准
- [ ] 一级导航独立入口（✅ 已完成）
- [ ] Brand Center — 品牌资料 CRUD
- [ ] Product Center — 产品/功能管理
- [ ] Knowledge Center — AI 可消费知识内容
- [ ] Entity Center — 实体关系管理
- [ ] Publishing Center — 发布状态管理
- [ ] Dashboard 使用真实数据，非硬编码 0
- [ ] Repository 完整实现（Prisma 或内存）
- [ ] API 完整（10 端点全部返回有效数据）
- [ ] Store/Service 完整
- [ ] 与 GEO 双向同步（GEO 创建品牌→Knowledge Hub 自动显示）
- [ ] 新用户可直接创建 AI Resource，而不是看到空状态

### 范围
- frontend/pages/workspace/knowledge-hub/*
- frontend/modules/knowledge-hub/*
- backend/src/services/knowledge/*
- KunlunNav 导航入口

### 阻塞状态
❌ NOT READY — 5/6 子页面为空壳，Repository 返回空数组，Dashboard 全部硬编码 0

---

## Gate B — AI-first Knowledge Model（P0）

**目标：Knowledge Hub 不是 CMS，而是 AI Native Knowledge Repository。**

### 验收标准
- [ ] 数据模型支持层级：Organization → Brand → Product/Service → Feature → FAQ → Knowledge Block
- [ ] 每个节点默认支持 JSON-LD / Schema.org
- [ ] 每个节点支持 FAQ Schema
- [ ] 每个节点支持 Citation + Canonical URL
- [ ] 每个节点支持 Entity ID
- [ ] 每个节点支持 LLM Prompt Block
- [ ] 每个节点支持 Structured Metadata
- [ ] 用户录入一次资料，系统自动生成：Website 内容、AI Package、JSON-LD、FAQ、Entity Graph、Publishing Package
- [ ] Prisma Schema 扩展
- [ ] API 兼容层

### 阻塞状态
❌ NOT STARTED

---

## Gate C — Discovery Real Runtime（P0）

**目标：Discovery 页面上的每一个数字都能追溯到真实执行过程。**

### 验收标准
- [ ] Provider Runtime 完整
- [ ] Scenario Registry 完整（28 条场景全部定义）
- [ ] Golden Dataset v1 冻结
- [ ] Golden Validator 通过
- [ ] Replay 机制完整
- [ ] Evaluation Engine 完整
- [ ] Discovery Report 使用真实数据
- [ ] MockScanner 完全移除
- [ ] Discovery 页面不再显示假 KPI

### 阻塞状态
❌ NOT READY — 全部依赖 MockScanner

### 注意
- Presence Engine 的 12 个 Provider Adapter 不要求官方 API
- 通过 Prompt → Query → Response → Evidence → Score 流程实现
- 这是行业可行方案，非阻塞项

---

## Gate D — AI Publishing Pipeline（P0）

**目标：形成完整的知识资产→发布→验证闭环。**

### 验收标准
- [ ] Knowledge Hub → Knowledge Package → JSON-LD 发布
- [ ] Schema.org (Organization/Product/FAQ) 结构化数据
- [ ] FAQ 内容自动发布
- [ ] Markdown / llms.txt 格式
- [ ] Entity Graph 输出
- [ ] Website 适配器（✅ 已有）
- [ ] CMS 适配器（✅ 已有）
- [ ] Provider Package 生成
- [ ] Publishing → Verification → Monitoring → Replay → Knowledge Hub 完整闭环
- [ ] 发布状态机完整

### 阻塞状态
❌ NOT STARTED

---

## Gate E — GEO × Knowledge Hub Integration（P0）

**目标：Knowledge Hub 成为 GEO 的唯一知识来源（Source of Truth）。**

### 验收标准
- [ ] Discovery 使用 Brand / Product / Entity（非独立数据）
- [ ] Optimization 使用 Knowledge / Evidence
- [ ] Verification 使用 Claim / Citation
- [ ] Publishing 使用 Publishing Package
- [ ] Monitoring 回写 AI Mention、Citation、Visibility
- [ ] GEO Dashboard 显示 Knowledge Hub 数据

### 阻塞状态
❌ NOT STARTED

---

## 工程收敛（P2 — 上线后可继续）

**这些不阻塞发布，但需在 RC 过程中持续清理。**
- Route → Service 逻辑抽取
- Repository 模式收敛
- 删除 20+ `.bak` 文件
- 删除 `_deprecated/` 目录
- 重构超长组件（GEODashboard.vue 等）
- 去重逻辑合并
- Benchmark UI（如需要）
- Golden Validator UI（不需要——CI 工具）
- .bak 文件清理

---

## 执行路线

| Epic | Gate | 优先级 | 状态 |
|------|------|--------|------|
| KH-RC1 | A — Knowledge Hub Product MVP | ⭐⭐⭐⭐⭐ | 进行中 |
| KH-RC2 | B — AI-native Knowledge Model | ⭐⭐⭐⭐⭐ | 未开始 |
| GEO-RC2 | C — Discovery Real Runtime | ⭐⭐⭐⭐⭐ | 未开始 |
| PUB-RC1 | D — AI Publishing Pipeline | ⭐⭐⭐⭐⭐ | 未开始 |
| GEO-RC3 | E — GEO × KH Integration | ⭐⭐⭐⭐ | 未开始 |
| ENG-RC1 | 工程收敛 | ⭐⭐⭐ | 未开始 |

## 发布原则

1. **Gate A~E 全部完成后，GEO Workspace 进入 Release Candidate**
2. **任何新增功能必须满足宪法条款（AI Visibility / Understandability / Citability）**
3. **P0 无 Mock/Fake 数据、无断链页面、无未接通的关键流程**
4. **Knowledge Hub 不附属 GEO，而是作为独立一级产品平行存在**
5. **AI Knowledge Hub 的 RC 作为 RC3 独立推进**
