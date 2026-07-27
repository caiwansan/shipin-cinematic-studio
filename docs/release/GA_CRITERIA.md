# GA Criteria

**用途**: 定义 General Availability（正式发布）的条件和流程  
**适用范围**: 所有产品线的正式发布

---

## 一、GA 进入条件（Entry Criteria）

| # | 条件 | 验证方式 |
|---|------|----------|
| 1 | Beta Sprint 退出条件全部满足 | Beta 指标追踪 |
| 2 | 至少 5 条真实用户反馈 | 用户访谈/反馈记录 |
| 3 | Beta Review 已通过 | Review Report |
| 4 | 连续 7 天四项核心指标达标 | 监控数据 |
| 5 | 无 Blocker/High 未修复 Bug | Bug 追踪系统 |
| 6 | 性能基线达标 | 性能测试 |
| 7 | 安全审查通过 | 安全扫描 |

---

## 二、GA 发布流程

```
Beta Review PASS
│
▼
Release Finalization
│  - 冻结所有代码变更
│  - 最终回归测试
│  - 准备 Release Note
│
▼
GA Tag & Build
│  - 打 Git Tag (vX.Y.Z)
│  - 构建生产包
│
▼
Deploy to Production
│
▼
Post-Deploy Verification
│  - 生产 Smoke Test
│  - 关键页面验证
│
▼
GA Announcement
   - 发布 Release Note
   - 更新文档站
```

---

## 三、GA 质量标准

### 3.1 功能质量

| 指标 | GA 标准 |
|------|---------|
| 核心流程成功率 | ≥98% |
| Onboarding 完成率 | ≥98% |
| Blocker Bug | 0 |
| High Bug | 0 |
| 跨租户数据问题 | 0 |

### 3.2 性能质量

| 指标 | GA 标准 |
|------|---------|
| API 平均响应 | <300ms |
| P99 响应 | <1s |
| 首屏加载 | <2s |
| 错误率 | <0.1% |

### 3.3 稳定性

| 指标 | GA 标准 |
|------|---------|
| 可用性 | ≥99.9% |
| 自动恢复时间 | <30s |
| 数据完整性 | 100% |

---

## 四、GA 回滚条件

出现以下任一情况，立即回滚：

| 条件 | 说明 |
|------|------|
| Blocker Bug | 核心流程不可用 |
| 数据丢失/损坏 | 任何数据异常 |
| 安全漏洞 | 安全事件 |
| 性能退化 >50% | 关键指标严重下降 |

---

## 五、GA 发布文档

| 文档 | 内容 |
|------|------|
| Release Note | 用户可见的变化 |
| CHANGELOG 更新 | 版本历史 |
| 发布回顾 | 过程记录 |
| 监控报告 | 发布后 24 小时 |

---

## 六、升级路径

```
Beta → (7天达标 + Beta Review) → GA
                                 ↘ (不达标) → 继续 Beta → Beta Review
```

---

*GA 是产品成熟的标志，不是开发结束的标志。*
