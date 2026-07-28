# UX-02-COMPONENT-BOUNDARY.md

> Generated: 2026-07-28 18:15 CST
> Step 2+3 — Component Boundary Audit

---

## 1. RecruitmentModule.vue — 边界分析

**总行数: 734**
- Template: 199 行 ✅ (< 400, 暂不拆分)
- Script:   95 行
- Style:    425 行 ⚠️ (CSS-heavy, 将来考虑独立)

**内含 6 个内容区块:**

| 区块 | Template 行数 | 状态 |
|------|-------------|------|
| rec-identity (企业身份+KPI+操作) | ~50 | 稳定 |
| rec-state--loading (加载态) | ~10 | 稳定 |
| rec-state--empty (空态引导) | ~35 | 稳定 |
| rec-section AI团队 (Agent卡片网格) | ~45 | 稳定 |
| rec-section 驾驶舱 (Pipeline+AI建议) | ~30 | 稳定 |
| rec-section 岗位列表 (在招岗位) | ~15 | 稳定 |

**判定: ✅ 暂不拆分**

原因: Template 199行远低于400行阈值。内部已经有清晰区块边界(全部以 `rec-` 前缀组织)。将来再拆也不迟。

**未来拆分方案 (备用):**

```
RecruitmentModule.vue
├── RecruitmentHero.vue              ← rec-identity
├── RecruitmentOverview.vue          ← KPI summary (下放)
├── AiTeamDisplay.vue                ← rec-agent-grid (已有独立文件)
├── RecruitmentPipelinePreview.vue   ← rec-cockpit
├── RecruitmentJobsPreview.vue       ← rec-job-grid
└── RecruitmentEmptyGuide.vue        ← rec-state--empty
```

---

## 2. AgentWorkforceCard.vue — 1109行分析

**严重性: 🔴 高风险**

| 维度 | 数值 | 评估 |
|------|------|------|
| Template | 315 行 (28%) | 接近400阈值 |
| Script | 169 行 (15%) | 合理 |
| Style | 620 行 (56%) | 🔴 严重失衡 |
| v-if/v-else | 40 分支 | 🔴 过度分支 |
| v-for | 6 循环 | 偏高 |
| props/emits | 1 defineProps | ✅ 单接口 |
| composable | 1 (useAgentWorkforce) | ✅ 单源 |
| API | 1 call | ✅ 单点 |

**问题:** CSS 占 56%, 40个v-if分支导致难以阅读和维护。

**建议拆分方案 (保持 props/API 不变):**

```
AgentWorkforceCard.vue (容器: 200-300行)
├── AgentAvatar.vue          ← aw-agent-avatar + status-dot
├── AgentMetricsRow.vue      ← aw-metric (stats display)
├── AgentCapabilities.vue    ← aw-capabilities (badge list)
├── AgentStatusBadge.vue     ← aw-status-text + dot colors
└── AgentWorkforceCard.vue   ← 缩减至编排层
```

**优先级: P2** — 当前首页使用 RecruitmentModule, 非阻塞

---

## 3. All enterprise component sizes

| File | Lines | Risk |
|------|-------|------|
| AgentWorkforceCard.vue | 1109 | 🔴 |
| RecruitmentModule.vue | 734 | 🟡 (CSS重) |
| EmployeeCard.vue | ~300 | 🟢 |
| AiTeamDisplay.vue | ~250 | 🟢 (新建) |
| AgentCard.vue | ~200 | 🟢 |
| TodayTasks.vue | ~130 | 🟢 |
| AgentChannelCard.vue | ~120 | 🟢 |
| AgentHealthCard.vue | ~100 | 🟢 |
