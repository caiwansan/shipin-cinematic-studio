# Phase D — FCV-1（First Customer Validation）

> **日期**: 2026-07-30 | **状态**: 📋 计划中  
> **标签**: Phase D | P3（Product Stage） | FCV-1  
> **前置**: Phase C — Product Assembly ✅  
> **后置**: Phase E — Customer Readiness

---

## 1. Phase D 定义

**FCV-1（First Customer Validation）** — 产品从一个"能够工作的产品"升级为"客户愿意用的产品"的唯一验证。

| 维度 | 说明 |
|------|------|
| 阶段编号 | Phase D |
| 名称 | First Customer Validation |
| 当前 Product Stage | **P3**（Product — 已完成 Product Assembly） |
| 核心问题 | 客户愿不愿意用？ |
| 最大风险 | 团队对产品太熟悉。开发者天然知道每个按钮什么意思，但真实用户不会。 |
| 目标 | 验证真实用户在无协助下能否独立完成完整用户旅程，并感受到 Moment of Value |

---

## 2. 核心理念

> **If users cannot discover the value by themselves, the product is not finished.**

这是一个**可执行的理念**——它意味着：
- 任何需要开发者在旁边解释才能理解价值的产品，都是未完成的产品
- 功能存在 ≠ 功能可被发现
- UI 设计的目标不是"美观"，而是"用户不需要学习就能做出下一步决策"
- 如果用户在 15 分钟内无法独立完成 Journey，则不是用户的问题，是产品的问题

---

## 3. 完整用户旅程（已就位）

```
Discover → Recommend → Mission → Verify → Publish → Learn → Knowledge
```

| 阶段 | 说明 | 状态 |
|------|------|------|
| **Discover** | 用户从 BrandOverview → "开始优化" → DiscoveryLab | ✅ Explain 就位 |
| **Recommend** | GEO 生成品牌优化推荐 | ✅ Explain 就位 |
| **Mission** | 用户选择推荐 → 执行优化任务 | ✅ Explain 就位 |
| **Verify** | 验证优化效果 | ✅ Explain 就位 |
| **Publish** | 发布优化结果 | ✅ Explain 就位 |
| **Learn** | 学习优化效果数据 | ✅ Explain 就位 |
| **Knowledge** | 积累品牌知识资产 | ✅ Explain 就位 |

**五个价值瞬间（Moment of Value）**：
1. 第一次看到品牌现状诊断 → *"原来 AI 是这样理解我的品牌"*
2. 第一个推荐出现 → *"这个建议确实有道理"*
3. 第一次验证通过 → *"优化真的有效"*
4. 第一次学习到新洞察 → *"我之前不知道这个"*
5. 完成完整 Journey → *"我知道下一步该做什么"*

---

## 4. 通过条件

### 5 项关键指标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 15 分钟内完成完整 Journey | ≥80% 用户 | 从点击"开始优化"到完成 Publish，记录时间戳 |
| 无任何帮助完成率 | ≥70% 用户 | 测试过程中不与用户交互，不提示操作步骤 |
| 能正确理解 Explain | ≥80% 用户 | 测试后 1on1 询问：GEO 给出的推荐理由是否能复述正确 |
| 能准确说出下一步操作 | ≥90% 用户 | 在每个 Journey 阶段结束时询问："接下来你会做什么？" |
| 愿意再次使用 | ≥70% 用户 | 测试后问卷："你会愿意再次使用这个产品吗？" |

### 判定逻辑

```
ALL(5 项指标 ≥ 目标值) → 通过 → 进入 Phase E（Customer Readiness）
ANY(1 项指标 < 目标值) → 不通过 → 进入修复 Sprint
```

---

## 5. 不通过后的修复 Sprint 流程

若未通过，根据 VOICE-OF-CUSTOMER.md 输出的 **Root Cause** 确定修复方向：

| 指标失败场景 | 常见 Root Cause | 修复策略 |
|-------------|-----------------|----------|
| 15 分钟未完成 Journey | 用户找不到入口 / 路径不清晰 | UI 重新设计引导路径 |
| 需要帮助才能完成 | Explain 不清晰 / 术语不熟悉 | Terminology 清洗 + Explain 增强 |
| 不理解 Explain | Explain 语言学术化 / 不够直白 | Explain 文案重写（以用户语言而非技术语言） |
| 说不清下一步 | 缺乏进度提示 / 缺乏行动召唤 | 增加 CTA 按钮 / 进度条 / 下一步提示 |
| 不愿再次使用 | 没有感受到价值 / 体验过慢 | 优化首屏加载 / 强化 Moment of Valor 感知 |

**修复 Sprint 规则**：
- 每次修复 Sprint 不超过 1 周
- 修复完成后**重新执行完整 FCV-1 测试**（不增量测试）
- 最多允许 2 次修复 Sprint
- 第 3 次不通过 → 产品架构重新 Review，进入架构评审

---

## 6. Phase D 产出物

| 产出 | 路径 | 说明 |
|------|------|------|
| **FCV-1 测试方案** | `reviews/FCV-1-TEST-PLAN.md` | 任务驱动的用户测试方案 |
| **VOICE-OF-CUSTOMER** | `reviews/VOICE-OF-CUSTOMER.md` | 真实行为记录，后续每次 CV 追加 |
| **Phase D 里程碑** | `releases/v1.1/PHASE-D-MILESTONE.md` | 本文档 |
| **FCV-1 结果报告** | `reviews/FCV-1-RESULT.md` | 测试完成后产出 |

---

## 7. 时间线

| 活动 | 预计时长 | 说明 |
|------|----------|------|
| 测试方案准备 | 1 天 | 确定任务模板、招募角色、准备环境 |
| 用户招募 | 3-5 天 | 联系目标用户，安排时间 |
| 执行测试 | 2-3 天 | 每个用户 30 分钟（15 分钟测试 + 15 分钟访谈） |
| 结果汇总 | 1 天 | 整理 VOICE-OF-CUSTOMER，统计指标 |
| 决策 | 0.5 天 | 通过 / 不通过判定 |
| 不通过修复 Sprint | ≤1 周 | 根据 Root Cause 修复 |

**预计总时长**: 1-2 周（含招募）

---

## 8. 通过后的下一阶段

Phase D 通过后，进入 **Phase E — Customer Readiness**。

Phase E 只围绕四个主题：
1. **Onboarding** — 3 分钟，第一次，必须成功
2. **Trust** — 持续加深 Explain + Evidence + Timeline
3. **ROI** — Dashboard 从 Score 转向结果
4. **Collaboration** — 企业入口（多成员 / 审批 / 权限）

---

## 9. 附录：FCV 迭代规划

| 版本 | 名称 | 目标 | 预计 |
|------|------|------|------|
| FCV-1 | First Customer Validation | 验证产品可用性与 Moment of Value | Phase D |
| FCV-2 | Retention Validation | 验证 7 天留存率 | Phase E |
| FCV-3 | ROI Validation | 验证客户实际收益 | Phase E |
| FCV-4 | Enterprise Validation | 验证企业多成员场景 | Phase F |
| FCV-5 | Commercial Validation | 验证付费意愿 | Phase G |

---

*Phase D 里程碑 — 如果用户不能自己发现价值，产品就没有完成。*
