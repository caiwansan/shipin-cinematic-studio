# UX-02-DARK-THEME-CHECK.md

> Generated: 2026-07-28 18:15 CST
> Step 6 — Dark Theme Reality

---

## 主题系统现状

| 文件 | Light | Dark | 说明 |
|------|-------|------|------|
| `assets/styles/recruitment-tokens.css` | ✅ 完整 (~50 tokens) | ❌ 无 | 仅 light 色值 |
| `assets/styles/enterprise-tokens.css` | ✅ 完整 | ❌ 无 | 仅 light 色值 |
| `layouts/enterprise.vue` | ✅ | ❌ 无切换逻辑 | 无 `dark` class 切换 |
| app theme switch | ❌ | ❌ | 全局无暗色切换机制 |

## 组件暗色一致性检查

### 新改文件 (TASK-UX-01)

| 文件 | 状态 | 说明 |
|------|------|------|
| `RecruitmentModule.vue` | ✅ 一致 | 全部 `var(--rec-*)`, light-only 统一 |
| `TodayTasks.vue` | ✅ 一致 | 全部 `var(--rec-)` + `var(--product-)` |
| `AiTeamDisplay.vue` | ✅ 一致 | 全部 `var(--rec-)` |
| `recruitment-tokens.css` | ✅ 一致 | 全部使用 token 变量 |

### 有遗留问题的文件

| 文件 | 问题 | 行号 |
|------|------|------|
| `AgentWorkforceCard.vue` | `background: #0d1220` (深色背景) | 523, 580 |
| `AgentWorkforceCard.vue` | `border: 1px solid #1a2240` (深色边框) | 524, 581 |

这是原来的暗色卡样式在 light 主题下保留。由于 AgentWorkforceCard 标记为不修改，问题停留在该文件中。
新的 RecruitmentModule.vue 无此问题。

## 结论

**当前状态: ⚠️ 有条件的 🌗**

- ✅ RecruitmentModule (用户首屏看到的) — 纯 light, 一致性良好
- ❌ AgentWorkforceCard — 残留深色背景, 仅在旧入口可见
- ❌ 全局无 dark 切换机制

**建议**: 统一暗色主题是独立 Sprint (需要先建立 CSS custom properties 的 dark 变体体系, 然后统一替换)
