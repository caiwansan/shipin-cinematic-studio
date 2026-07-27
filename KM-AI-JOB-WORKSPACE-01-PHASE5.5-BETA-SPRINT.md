# KM-AI-JOB-WORKSPACE-01 Phase 5.5 Beta Sprint

**日期**: 2026-07-23  
**状态**: Active — Phase 5 Frozen  
**版本**: Beta 0.2.0 Release Candidate (RC)

---

## 一、Phase 5 Frozen 声明

**Phase 5 功能范围已冻结。** 这意味着：

- ❌ 不再新增功能
- ❌ 除 Blocker/High Bug 外，不修改 Phase 5 范围内代码
- ❌ 所有新增需求进入 A4 或后续版本规划
- ✅ 仅接受缺陷修复（Blocker > High > Medium > Low）

---

## 二、版本定义

### Beta 0.2.0 标记状态：**Release Candidate (RC)**

> 不是 GA，也不是"开发完成"。是具备 RC 条件的候选版本。

已验证三条业务链：

| 场景 | 结果 | 说明 |
|------|------|------|
| 场景一：新企业 Happy Path | ✅ PASS | 注册→Onboarding→Dashboard→Pipeline→Offer 全链路通过 |
| 场景二：已有企业 | ✅ PASS | 登录→Dashboard→历史数据加载正常 |
| 场景三：异常流程 | ✅ PASS | 无效UUID返回400，空参数返回400，不再500 |

**标记为 Public Beta 的条件**：
- 上述三条链路连续 3 天无故障
- 无新增 Blocker Bug

---

## Beta 0.3 Roadmap 调整（基于 Product Reality Audit v2.0）

> **2026-07-23 决策：冻结 A4 原计划，按业务价值闭环重排。**

### 审计结论

Product Reality Audit v2.0 显示：
- 代码完成度约 55%，但 **Business Completion 仅 22%**
- 核心瓶颈：**无候选人来源、AI 不真正工作、计费缺失**
- 企业老板今天不能真正用它招聘

### 版本重排

| 版本 | 目标 | 核心交付 |
|------|------|---------|
| **Beta 0.3** | Candidate Source | 简历上传+解析+候选人入库 |
| **Beta 0.4** | Real AI Runtime | LLM 简历分析+面试+Agent Runtime |
| **Beta 0.5** | Commerce | 支付+计费+订阅 |

详细计划见 `docs/release/BETA_ROADMAP_V2.md`。

---

## 三、退出条件（Exit Criteria）

### 3.1 四项核心指标（聚焦）

Beta Sprint 不以固定时间结束，以下四项**全部满足**时退出：

| # | 指标 | 目标 | 权重 | 当前值 |
|---|------|------|------|--------|
| 1 | **Onboarding 完成率** | ≥95% | 🔴 关键 | 待观察 |
| 2 | **Pipeline 主流程成功率** | ≥95% | 🔴 关键 | 待观察 |
| 3 | **Blocker Bug** | 0 | 🔴 关键 | 0 ✅ |
| 4 | **跨租户数据问题** | 0 | 🔴 关键 | 0 ✅ |

### 3.2 辅助观察指标

| 指标 | 基线 | 目标 |
|------|------|------|
| Dashboard 可正常打开 | 100% | ≥99% |
| API 平均响应 | <200ms | <500ms |
| Dashboard 首屏 | <2s | <3s |
| Pipeline 首屏 | <2s | <3s |
| 数据丢失 | 0 | 0 |

### 3.3 Beta Sprint 期间只做以下事

#### 3.3.1 收集真实反馈
- 新企业第一次使用时卡在哪一步？
- 哪一步最慢？
- 哪一步最困惑？

#### 3.3.2 统计真实数据
```
漏斗数据：
访问 /workspace/enterprise → 完成 Onboarding → 进入 Pipeline → 创建 Offer
```

#### 3.3.3 异常监控
- JWT 过期处理
- 浏览器刷新后状态
- 网络中断恢复
- Token 不足提示

### 3.4 不在 Beta Sprint 范围内

- ❌ 新页面
- ❌ 新 API（除非修复 Bug 必须）
- ❌ 新数据库表（除非修复 Bug 必须）
- ❌ 性能优化（除非影响核心流程）
- ❌ 代码重构（除非影响稳定性）

---

## 四、A4 AI Runtime Center 原则

### 4.1 核心理念

> **管理 AI 员工，而不是管理 AI 模型。**

### 4.2 A4 设计原则

> **AI Runtime Center 不负责"配置"，负责"运营"。**

首页应该回答企业老板最关心的问题：
- 哪些 AI 员工在运行？
- 今天完成了多少工作？
- 花了多少钱？
- 有没有失败任务？
- 哪个 AI 员工最忙？

模型参数、Temperature、Top-P、Provider 等配置放到**二级页面**，不是首页。

### 4.3 A4 启动条件

- Beta Sprint 退出条件全部满足
- 至少收集到 5 条真实用户反馈
- 确认 A4 核心功能优先级是否需要调整

---

## 五、推荐开发序列

```
Beta 0.2.0 RC
│
▼
连续运行（观察期 ≥3 天）
│
▼
满足 Beta Sprint 退出条件
│
▼
正式发布 Beta 0.2.0
│
▼
Review Beta 数据与用户反馈
│
▼
确认 Beta 0.3 优先级（Candidate Source）
│
▼
Beta 0.3 — 简历上传 + 解析 + 候选人入库
│
▼
Beta 0.4 — Real AI Runtime（LLM 分析 + 面试）
│
▼
Beta 0.5 — Commerce（支付 + 计费 + 订阅）
│
▼
RC → GA
```

> **A4 AI Runtime Center 已正式冻结。** 原 A4 需求拆分到 Beta 0.4/0.5。

---

## 六、Business Completion 指标

> 替代"代码完成度"，衡量企业招聘真实业务流的打通程度。

| # | 业务能力 | 状态 |
|---|---------|------|
| 1 | 企业注册 | ✅ |
| 2 | 企业 Onboarding | ✅ |
| 3 | 创建 JD | ⚠️ |
| 4 | 收到候选人 | ❌ |
| 5 | AI 分析简历 | ❌ |
| 6 | AI 面试 | ❌ |
| 7 | 发送 Offer | ⚠️ |
| 8 | 入职 | ❌ |
| 9 | 支付/订阅 | ❌ |

**Business Completion: 2/9 = 22%**

---

## 七、版本管理规范

### 6.1 每个版本固定四份文档

| 文档 | 内容 | 目的 |
|------|------|------|
| **PRD** | 为什么做 | 产品意图 |
| **Implementation Report** | 做了什么 | 技术实现 |
| **Reality/Product Gate Report** | 是否可用 | 质量保证 |
| **CHANGELOG** | 用户看到什么变化 | 产品轨迹 |

### 6.2 当前已有文档

| 文档 | 状态 |
|------|------|
| CHANGELOG.md | ✅ Beta 0.2.0 RC |
| Phase 5 Stabilization Report | ✅ PASS |
| Phase 5.5 Beta Sprint Plan | ✅ 本文档 |
| Product Reality Audit v2.0 | ✅ 2026-07-23 |
| Beta Roadmap v2.0 | ✅ 2026-07-23 |
| A4 AI Runtime Center PRD | ⚠️ 已冻结，拆分到 Beta 0.4/0.5 |
| Beta 0.2.0 Release Note | ✅ 在 CHANGELOG 中 |

---

## 七、当前状态

### 前端 SPA 修复记录（2026-07-23）

| 错误 | 根因 | 修复 |
|------|------|------|
| `Cannot read properties of undefined (reading 'baseURL')` | `index.html` 缺少 `window.__NUXT__` payload | 已注入 `__NUXT__` 配置对象 |
| `builds/meta/7d568ebe....json 404` | `buildId` 硬编码与实际构建不符 | 改为从 `latest.json` 动态读取 |
| `Cannot destructure 'getToken' of 'window.__tc'` | `index.html` 缺少 `__tc-bridge.js` | 已添加脚本引用 |

---

*Beta Sprint 启动后，每日更新退出条件追踪表。*
