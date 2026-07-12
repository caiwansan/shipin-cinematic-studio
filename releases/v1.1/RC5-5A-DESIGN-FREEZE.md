# RC5-5A Design Freeze Manifest

> **冻结日期:** 2026-07-26
> **冻结范围:** GEO v1 产品体验架构
> **下一阶段:** RC5-5B Component Library

---

## Frozen

以下规范已冻结，任何修改须经 RFC → Review → Approval → Version → Implementation：

| # | 文档 | 冻结内容 |
|---|------|----------|
| 1 | First 15 Minutes Blueprint | 新用户 15 分钟 5 阶段的旅程路径 |
| 2 | Navigation Architecture | 任务语言导航（Home → 开始优化 → 执行建议 → 验证效果 → 发布成果 → 持续增长） |
| 3 | Interaction Architecture | 7 步交互节奏 + 7 状态系统 + 错误处理协议 |
| 4 | Global Product Pattern | 布局/信息层级/Card/AI Result/Explain/Action/Empty/Loading/Error 模式 |
| 5 | AI Interaction Guideline | AI Persona + 输出结构 + Tone + Explain Rules + Confidence + Copy Dictionary |

---

## Engineering Target

所有 PR 必须通过以下检查：

```
□ Pattern — 符合 Global Product Pattern
□ Interaction — 符合 Interaction Architecture
□ AI Communication — 符合 AI Interaction Guideline
□ Navigation — 符合 Navigation Architecture
□ Journey — 符合 First 15 Minutes Blueprint
```

---

## Out of Scope（以后再做）

- Design System Theme / Dark Mode
- i18n / Accessibility
- Plugin System / Mobile / Native
- Animation Fine-tuning
- Enterprise SSO / Team Management

---

## RC5-5B 工作方向

下一阶段优先级：Component Contract > 页面

1. **Foundation Components:** PageShell / PageHeader / SummaryPanel / EmptyState / LoadingState / ErrorState
2. **AI Components:** ExplainDrawer / AIResult / ConfidenceBadge / EvidencePanel / NextActionPanel
3. **Business Components:** HealthCard / RecommendationCard / MissionCard / VerificationCard / PublishingCard / KnowledgeCard
4. **Workspace Refactor:** 按组件装配替换现有页面
5. **Mission Control (Home):** 新增回访入口，组合已有组件
