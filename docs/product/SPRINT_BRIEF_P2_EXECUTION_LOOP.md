# Sprint Brief：P2 — Brand Health Execution Loop

---

## 1. 对应白皮书章节

**第四章第五阶段（Execute）** — 执行优化
**第四章第六阶段（Publish）** — 发布
**第四章第七阶段（Verify）** — 验证
**第四章第八阶段（Monitor）** — 长期监测
**第五章（核心能力）** — 优化执行与发布

---

## 2. 对应路线图阶段

Phase 1: MVP — 第 5/6/7/8 项：执行 → 发布 → 验证 → 监测

---

## 3. 对应页面蓝图

- **Overview Tab（已有）** — Brand Health Report 底部嵌入执行状态追踪
- **Insights Tab（已有）** — 每条 Action 增加状态机（未开始/优化中/等待验证/已完成）
- **Evidence Tab（已有）** — 验证结果嵌入 Action 状态流
- **Publish Tab（已有）** — 发布状态嵌入 Action 完成流程
- **右侧 InsightsPanel（已有）** — 显示活跃执行项
- **本次不新增 Tab**

---

## 4. 用户价值

> 用户在 Brand Health Report 中发现需要优化的问题 → 点击"立即修复" → 进入优化流程 → 等待验证 → 看到结果 → 确认发布。全过程不需离开工作台，每一步都有状态回显。

---

## 5. 影响页面

| 页面 | 变更 |
|------|------|
| `brand-geo-v2/GeoOverview.vue` | 报告底部增加"正在执行"区域，显示当前活跃优化项 |
| `brand-geo-v2/GeoInsights.vue` | 每条建议增加状态指示 + 一键执行 + 执行状态回显 |
| `brand-geo-v2/GeoEvidence.vue` | 验证记录与 Action 关联，显示验证结果 |
| `brand-geo-v2/GeoInsightsPanel.vue` | 显示当前执行项进度 |
| `brand-geo-v2/GeoWorkspaceV1.vue` | 无模板变更 |

---

## 6. 影响 API

全部使用已有端点：

| 端点 | 用途 |
|------|------|
| `POST /api/geo/verification/run` | 触发优化验证 |
| `GET /api/geo/verification/job/:executionId` | 查询执行状态 |
| `GET /api/geo/verification/history/:projectId` | 获取验证历史 |
| `GET /api/geo/learning/signals?projectId=` | 获取建议列表 |
| `POST /api/geo/monitor/check/published` | 发布后检查 |
| `POST /api/geo/monitor/check/indexed` | 检查收录 |

---

## 7. 验收标准

引用《GEO_ACCEPTANCE_STANDARD_V1.md》第五~八章：

| 条目 | 标准 |
|------|------|
| 执行触发 | 用户点击"立即修复"后立即反馈"任务已提交" |
| 执行进度 | 用户能实时看到执行状态（提交 → 优化中 → 验证中 → 完成） |
| 执行完成 | 执行完成后自动显示结果（成功/改善分数/未改善） |
| 执行重试 | 执行失败后可一键重新执行 |
| 执行中防重复 | 执行中按钮不可重复提交 |
| 验证可追溯 | 每次验证可追溯到对应的优化 Action |
| 发布关联 | 验证通过后可引导用户进入发布流程 |
| 更新能力矩阵 | 完成闭环后报告分数应更新 |

---

## 8. 风险

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| Verification Engine 是 InMemory（重启丢失） | 中 | 执行状态可能断掉 | UI 端展示乐观状态 + 失败回退 |
| 后端无统一 Action 状态表 | 高 | Action 状态无法跨会话持久 | 使用 VerificationJob 表作为状态追踪（已有） |
| 单次验证耗时较长 | 中 | 用户等待体验差 | 轮询 + 加载指示 + 后台通知预留 |

---

## 9. 回滚方案

| 场景 | 操作 |
|------|------|
| 编译失败 | `git stash`，回退 |
| 执行流程导致页面崩溃 | `pm2 restart 43` |
| 状态机 UI 不合适 | 恢复为单按钮触发，移除进度展示 |

---

## 10. Scope Lock（冻结条款）

以下条款在 P2 执行期间必须遵守，不得超出：

### 10.1 执行流不是项目管理系统

Action 状态仅限以下四种，**禁止引入**负责人、截止日期、评论、提醒、多人协作等功能：

| 状态 | 含义 |
|------|------|
| Not Started | 建议已列出，用户尚未操作 |
| In Progress | 用户已点击执行，系统正在运行 |
| Pending Verification | 优化完成，等待 Verification Engine 确认 |
| Verified | Verification Engine 返回结果（成功/改善/未改善） |

### 10.2 一屏可理解

用户首次进入 GEO 工作台，必须能在 Overview 页面看清楚当前所处的阶段：

```
Report → Optimize → Verify → Publish（Coming Soon）→ Monitor（Coming Soon）
```

### 10.3 唯一状态来源

所有组件（Overview / Insights / Evidence / InsightsPanel）读取**同一份状态对象**。

禁止各组件各自维护独立状态变量。状态定义：

```ts
interface ActionState {
  id: string
  status: 'not_started' | 'in_progress' | 'pending_verification' | 'verified'
  updatedAt: string
  verificationState?: {
    executionId: string
    jobStatus: 'pending' | 'running' | 'completed' | 'failed'
    delta?: number
    beforeScore?: number
    afterScore?: number
  }
}
```

### 10.4 Verify 必须是真实验证

状态流转规则：

```
Not Started → In Progress → Pending Verification → Verified（Engine 返回）
```

**禁止**纯 UI 切换（用户点击直接变成 Verified）。每个状态变更必须对应真实的 Verification Engine 执行。

### 10.5 Publish / Monitor 允许占位

Publish 按钮显示"即将开放"，Monitor 显示"即将开放"。**禁止模拟成功状态**。

### 10.6 状态贯穿所有页面

Overview、Insights、Evidence、InsightsPanel 四个组件必须展示同一 Action 的当前状态。一个 Action 在任何页面看到的状态必须一致。

### 10.7 增加整体进度指示

Overview 顶部增加：

```
Brand Improvement Progress  2 / 8 Actions Completed  25%
```

### 10.8 为 Agent 自动化预留接口

Action 按钮使用下拉菜单设计：

```
立即修复 ▼
├── 手动修复（当前）
└── Agent 自动修复（即将开放）
```

后续接入智能体时不需修改交互层。

---

## 11. Definition of Done（P2 成功标准）

P2 完成后必须满足：

1. 每个 Action 在 Overview / Insights / Evidence / InsightsPanel 中状态一致
2. 用户能沿 Report → Optimize → Verify 完整走通一次流程，无需理解 GEO 内部架构
3. 所有状态来源统一，为真实 Verification Engine 和 Publishing 流程保留扩展点
4. 不新增 API、不改 Engine、不改变现有架构
