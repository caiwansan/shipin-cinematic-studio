# Enterprise Recruitment Workspace v0.2.0 Baseline

**日期**: 2026-07-23  
**状态**: Established  
**版本**: Beta 0.2.0 Release Candidate

---

## 一、产品基线（Product Baseline）

### 1.1 已交付功能模块

| 模块 | 状态 | 说明 |
|------|------|------|
| 企业 Onboarding | ✅ | 注册→配置→激活全流程 |
| CEO Dashboard | ✅ | 核心指标可视化 |
| Pipeline MVP | ✅ | 招聘管线管理 |
| AI 招聘操作 | ✅ | AI 评分、推荐 |
| Beta RC | ✅ | 发布候选版本 |

### 1.2 核心业务链

| 场景 | 结果 |
|------|------|
| 新企业 Happy Path | ✅ PASS |
| 已有企业 | ✅ PASS |
| 异常流程 | ✅ PASS |

---

## 二、技术基线（Technical Baseline）

### 2.1 质量门禁

| 门禁 | 状态 | 说明 |
|------|------|------|
| Build Health Gate | ✅ | 构建成功 + 基础检查 |
| Reality Gate | ✅ | 技术验收（API/DB/路由） |
| Product Gate | ✅ | 业务验收（流程/UX/数据） |
| Tenant Isolation | ✅ | 跨租户数据隔离 |
| API Smoke Test | ✅ | 全量 API 200 验证 |

### 2.2 数据库基线

| 表 | 记录数 | 健康状态 |
|------|--------|----------|
| User | 72 | ✅ |
| Enterprise | — | ✅ |
| PipelineEvent | 8 | ✅ |
| TalentRecommendation | 2 | ✅ |
| JobPosting | 4 | ✅ |
| 其他 6 张表 | — | ✅ |

### 2.3 运行时基线

| 指标 | 值 |
|------|------|
| PM2 进程 | api-server-aigc |
| 内存 | ~60MB |
| CPU | ~2-5% |
| 路由数 | 189 |
| Route Module | 11 |

---

## 三、工程基线（Engineering Baseline）

### 3.1 发布流程

```
需求(PRD) → 开发 → Build → Deploy → Reality Gate → Product Gate → Stabilization → RC → Beta → Review
```

### 3.2 文档规范

| 文档 | 内容 | 目的 |
|------|------|------|
| PRD | 为什么做 | 产品意图 |
| Implementation Report | 做了什么 | 技术实现 |
| Reality/Product Gate Report | 是否可用 | 质量保证 |
| CHANGELOG | 用户看到什么变化 | 产品轨迹 |

### 3.3 回归测试

| 测试 | 状态 |
|------|------|
| API Smoke Test | ✅ 全量 200 |
| 业务链端到端 | ✅ 三条全通 |
| 异常流程 | ✅ 400 正确返回 |

### 3.4 冻结规则

| 规则 | 说明 |
|------|------|
| Phase Frozen | 功能范围冻结 |
| 仅 Blocker/High | 仅接受高优先级缺陷修复 |
| 新需求 → Backlog | 新需求进入产品 Backlog |

---

## 四、运营指标基线（Operations Baseline）

### 4.1 四项核心指标

| 指标 | 目标 |
|------|------|
| Onboarding 完成率 | ≥95% |
| Pipeline 主流程成功率 | ≥95% |
| Blocker Bug | 0 |
| 跨租户数据问题 | 0 |

### 4.2 性能基线

| 指标 | 基线 | 目标 |
|------|------|------|
| API 平均响应 | <200ms | <500ms |
| Dashboard 首屏 | <2s | <3s |
| Pipeline 首屏 | <2s | <3s |

---

## 五、后续迭代规则

### 5.1 维护优先（Maintenance First）

- 新需求进入产品 Backlog
- 只有 Blocker/High 缺陷进入当前 RC
- 其余优化排入后续版本

### 5.2 A4 启动条件

- Beta Sprint 退出条件全部满足
- 至少 5 条真实用户反馈
- Beta Review 确认 A4 优先级

### 5.3 Beta Review 讨论议题

- 用户实际点击了哪些功能？
- 哪些 AI 员工最常用？
- BYOK 是否真的有需求？
- 成本中心是不是企业最关心的信息？

---

## 六、可复制性

本 Baseline 可直接复制到：

- AI 新媒体运营部门
- AI 音乐工作台
- AI 小说工作台
- AI 广告工作台
- 其他企业 AI 部门

---

*本 Baseline 是所有后续迭代的比较基准，不与历史 Commit 比较。*
