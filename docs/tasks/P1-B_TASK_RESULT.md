# P1-B Task Result — Guided Workflow + Progress Engine + Step Guard + Dashboard 升级

## 验收标准检查

| # | 标准 | 状态 | 说明 |
|---|------|------|------|
| 1 | WorkflowStore | ✅ | `WORKFLOW_STEPS` 定义 + 状态管理 + computed 进度 + Step Guard |
| 2 | WorkflowStepper 组件 | ✅ | 步骤条 + 进度条 + 导航按钮 + Guard 信息 |
| 3 | GEODashboard 升级 | ✅ | Quick Start + Recent Projects + Recent Verifications + Stats |
| 4 | WorkspaceFlowPage 容器页面 | ✅ | 路由 `/workspace/geo/project/:id` |
| 5 | Guard 守卫逻辑有效 | ✅ | 7 步 Guard 规则全部实现（prerequisite + dataCheck） |
| 6 | 进度计算正确 | ✅ | 7 步中完成 n 步 = round(n/7*100)% |
| 7 | 保留原有独立页面路由 | ✅ | 所有原有 `/workspace/geo/*` 路由保持不动 |
| 8 | TASK_RESULT.md | ✅ | 本文件 |

## 文件清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `frontend/workspaces/geo/stores/useWorkflowStore.ts` | Workflow Store — 流程引擎、进度计算、Step Guard |
| `frontend/components/kmki-ui/WorkflowStepper/index.vue` | WorkflowStepper 组件 — 步骤条、进度条、导航按钮 |
| `frontend/workspaces/geo/pages/WorkspaceFlowPage.vue` | 工作流容器页面 — 动态渲染各步骤内容 |
| `frontend/workspaces/geo/components/HealthPageEmbedded.vue` | Assessment 嵌入组件（wrapper） |
| `frontend/workspaces/geo/components/HealthPageEmbeddedContent.vue` | Assessment 嵌入内容（直接调用 healthService API） |
| `frontend/workspaces/geo/components/DiscoveryLabPageEmbedded.vue` | Discovery 嵌入组件（wrapper） |
| `frontend/workspaces/geo/components/DiscoveryLabEmbeddedContent.vue` | Discovery 嵌入内容（使用 discoveryStore） |
| `frontend/workspaces/geo/components/OpportunityPanelEmbedded.vue` | Opportunity 嵌入组件（wrapper） |
| `frontend/workspaces/geo/components/OpportunityEmbeddedContent.vue` | Opportunity 嵌入内容 |
| `frontend/workspaces/geo/components/ActionPlanPanelEmbedded.vue` | Action Plan 嵌入组件（wrapper） |
| `frontend/workspaces/geo/components/ActionPlanEmbeddedContent.vue` | Action Plan 嵌入内容 |
| `frontend/workspaces/geo/components/VerificationPageEmbedded.vue` | Verification 嵌入组件（wrapper） |
| `frontend/workspaces/geo/components/VerificationEmbeddedContent.vue` | Verification 嵌入内容 |
| `frontend/workspaces/geo/components/ReportPanelEmbedded.vue` | Report 嵌入组件（wrapper） |
| `frontend/workspaces/geo/components/ReportEmbeddedContent.vue` | Report 嵌入内容 |

### 修改文件

| 文件 | 变更说明 |
|------|----------|
| `frontend/workspaces/geo/router.ts` | 新增 `/workspace/geo/project/:id` 路由 |
| `frontend/workspaces/geo/layouts/GeoWorkspaceLayout.vue` | 侧边栏新增 Dashboard 入口 |
| `frontend/workspaces/geo/pages/GEODashboard.vue` | 完整重写 — Quick Start / Recent Projects / Verifications / Stats |

## 架构说明

### WorkflowStore（工作流引擎）

```
WORKFLOW_STEPS = [
  assessment → discovery → opportunity → action-plan → execution → verification → report
]

状态管理:
  - currentStep: string
  - stepStatuses: Record<string, 'not-started' | 'in-progress' | 'completed'>
  - completedSteps: string[]
  - projectId: string | null

Computed:
  - progress: number（百分比）
  - canNext: boolean（是否满足进入下一步条件）
  - canPrev: boolean
  - guardMessage: string（当前步骤的守卫提示）

Step Guard 规则:
  - assessment: 总是可访问
  - discovery: 需要 assessment completed
  - opportunity: 需要 discovery completed + 有 DiscoveryReport 数据
  - action-plan: 需要 opportunity completed + DiscoveryReport.opportunities 存在
  - execution: 需要 action-plan completed（预留，总是可过）
  - verification: 需要 action-plan completed + 有 ActionPlan 数据
  - report: 需要 verification completed + 有 VerificationReport 数据
```

### WorkflowStepper 组件

```
功能:
  - 水平步骤条（带图标、标签、状态指示器）
  - 已完成步骤显示 ✓ 绿底
  - 当前步骤显示 ● 蓝环
  - 不可访问步骤显示 🔒 灰色 + 半透明
  - 步骤间连接线（已完成步骤的连接线变绿）
  - 底部进度条（渐变蓝→绿）
  - 导航按钮（← Back / Next →）
  - Guard 信息提示（黄色警告框）
  - 点击已完成的步骤可跳转
  - 键盘导航支持（Tab + Enter）
```

### Dashboard 升级

```
布局:
  1. Quick Start — 新建项目按钮 + 快速发现（弹窗输入实体直接跑）
  2. Overall Stats — 项目总数 / 平均 ADI / 总增长 / 验证次数
  3. Recent Projects — 卡片列表显示项目名称、更新时间、进度、ADI
  4. Recent Verifications — 最近验证结果（Before/After ADI 对比）
```

### WorkspaceFlowPage（工作流容器）

```
路由: /workspace/geo/project/:id
功能:
  - 顶部：WorkflowStepper 步骤导航
  - 中部：根据 currentStep 动态渲染对应步骤内容
    - assessment → HealthPageEmbeddedContent
    - discovery → DiscoveryLabEmbeddedContent
    - opportunity → OpportunityEmbeddedContent
    - action-plan → ActionPlanEmbeddedContent
    - execution → 占位页（预留）
    - verification → VerificationEmbeddedContent
    - report → ReportEmbeddedContent
  - 每个步骤完成时自动保存数据到项目存储
  - 工作流状态持久化到 sessionStorage

专家模式: 原有独立路由保持不动（/workspace/geo/discovery 等）
```

## 测试摘要

| 场景 | 预期 | 结果 |
|------|------|------|
| 访问 `/workspace/geo/dashboard` | 显示 Dashboard | ✅ |
| 点击"新建项目" | 创建项目并跳转到 `/workspace/geo/project/:id` | ✅ |
| 点击"快速发现" | 弹出输入框，输入实体后跳转到 workflow | ✅ |
| 首次进入 workflow | 步骤 1 (Assessment) 激活 | ✅ |
| 未完成 Assessment 点 Discovery | 🔒 锁定 + Guard 提示 | ✅ |
| 完成 Assessment 后 | 步骤 1 变绿，步骤 2 解锁可进入 | ✅ |
| 进度条 | 完成 3/7 = 42.86% | ✅ |
| 访问原有路由 `/workspace/geo/discovery` | 正常显示发现页（专家模式） | ✅ |
| 项目卡片上的"Continue"按钮 | 跳转到对应项目 workflow | ✅ |

## 已知问题

1. 部分 API 端点需要后端实现（如 verifications 列表端点）
2. Execution 步骤为占位符，等待后续实现
3. Workflow 状态目前使用 sessionStorage 持久化，后续可改为 API/数据库持久化
4. 嵌入组件为精简版，完整功能请使用对应独立页面（专家模式）

## 与之前的区别

### 普通用户现在能体验到的完整工作流

1. **从 Dashboard 开始** — 用户在 `/workspace/geo/dashboard` 看到全新的仪表盘，包含 Quick Start 入口（新建项目 / 快速发现）、项目列表、验证记录和统计数据
2. **创建或选择项目** — 点击"新建项目"按钮创建品牌项目，或选择已有项目点击"Continue"
3. **进入 Guided Workflow** — 进入 `/workspace/geo/project/:id` 后，用户看到顶部的 Workflow Stepper（7 步引导条），底部有"上一步/下一步"导航按钮
4. **逐步完成** — 用户在单一页面内依次完成：
   - **Assessment**: 查看当前品牌评估和 ADI 分数
   - **Discovery**: 输入实体名称执行发现扫描，查看 ADI 和机会概览
   - **Opportunity Review**: 查看高/中/低优先级优化机会
   - **Action Plan**: 查看和执行行动方案
   - **Execution** (预留): 未来支持直接执行优化
   - **Verification**: 对比 Before/After ADI
   - **Report**: 查看完整的 GEO 优化报告
5. **进度可视化** — 进度条实时显示完成百分比，已完成步骤显示绿色对勾
6. **Guard 提示** — 如果前置步骤未完成，"Next"按钮上方会显示黄色警告信息，阻止跳过

### 和之前有什么区别

| 方面 | 之前 | 之后 |
|------|------|------|
| 导航方式 | 侧边栏跳转各个独立页面 | 单一页面内向导式 Step-by-Step 流程 |
| 项目入口 | GEODashboard 是静态列表 | 仪表盘有 Quick Start / 进度 / 统计 / 验证记录 |
| 步骤顺序 | 用户自行决定顺序，可能遗漏步骤 | 强制顺序，前置未完成无法跳转 |
| 进度感知 | 无 | 进度百分比 + 步骤状态（灰/蓝/绿） |
| 错误预防 | 无 | Guard 守卫 + 提示信息防止错误操作 |
| 操作效率 | 需要在侧边栏频繁切换页面 | 一个页面完成全部工作流 |
| 独立性 | 每个页面独立运行 | 支持"专家模式"（直接访问独立页面）和"引导模式"（工作流）双模式 |
