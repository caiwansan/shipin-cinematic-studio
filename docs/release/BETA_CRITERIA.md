# Beta Criteria

**用途**: 定义 Beta 阶段的进入条件、退出条件和运行规则  
**适用范围**: 所有产品线的 Beta Sprint

---

## 一、Beta 进入条件（Entry Criteria）

| # | 条件 | 验证方式 |
|---|------|----------|
| 1 | Reality Gate PASS | 技术验收报告 |
| 2 | Product Gate PASS | 业务验收报告 |
| 3 | API Smoke Test 全量通过 | 自动化测试 |
| 4 | 三条业务链端到端通过 | 手工验证 |
| 5 | 无 Blocker Bug | Bug 追踪系统 |
| 6 | CHANGELOG 已更新 | 文档检查 |

---

## 二、Beta Sprint 退出条件（Exit Criteria）

### 2.1 核心指标（全部满足方可退出）

| # | 指标 | 目标 | 权重 |
|---|------|------|------|
| 1 | Onboarding 完成率 | ≥95% | 🔴 关键 |
| 2 | Pipeline 主流程成功率 | ≥95% | 🔴 关键 |
| 3 | Blocker Bug | 0 | 🔴 关键 |
| 4 | 跨租户数据问题 | 0 | 🔴 关键 |

### 2.2 辅助指标

| 指标 | 目标 |
|------|------|
| Dashboard 可正常打开 | ≥99% |
| API 平均响应 | <500ms |
| 数据丢失 | 0 |

### 2.3 最低观察期

- **RC → Public Beta**: 连续 3 天无故障
- **Beta → GA**: 连续 7 天四项核心指标达标

---

## 三、Beta Sprint 运行规则

### 3.1 Phase Frozen

- ❌ 不新增功能
- ❌ 除 Blocker/High Bug 外不修改代码
- ❌ 新需求进入产品 Backlog
- ✅ 仅接受缺陷修复

### 3.2 缺陷优先级处理

| 优先级 | 处理方式 |
|--------|----------|
| Blocker | 立即修复，Hotfix 发布 |
| High | 当前 Beta 版本修复 |
| Medium | 排入下一版本 |
| Low | 排入后续版本 |

### 3.3 每日追踪

- 四项核心指标状态
- 新增 Bug 数量与优先级
- 用户反馈摘要

---

## 四、Beta Review

### 4.1 触发条件

- Beta Sprint 退出条件全部满足
- 或观察期超过 14 天仍有未达标项

### 4.2 讨论议题

- 用户实际点击了哪些功能？
- 哪些 AI 员工最常用？
- BYOK 是否真的有需求？
- 成本中心是不是企业最关心的信息？
- 下一阶段优先级是否需要调整？

### 4.3 输出

- Beta Review Report
- 下一版本 PRD 优先级确认
- 是否需要调整 Baseline

---

## 五、升级路径

```
RC → (3天无故障) → Public Beta → (7天达标) → GA
                  ↘ (不达标) → 继续 Beta Sprint → Beta Review
```

---

*Beta Sprint 以退出条件驱动，不以固定时间结束。*
