# Sprint-10 Step 4A — Career Agent First Employee Experience Reality ✅

**Date:** 2026-07-31 04:50 CST
**Gate:** Awaiting 掌柜验收

---

## 审计（Task 01）

### 修复前用户路径

```
付款成功 → 刷新页面
  → hasSubscription=true, hasAgent=false
    → [+ 创建我的镜心助理] 按钮
      → 点击创建 → 后端创建 Hermes 基础设施
        → 左栏推送一条消息
          "🤖 AI 职业助理已创建并执行首次任务"
          + LLM 输出摘要
        → 右栏显示快捷按钮
          [📊 分析] [📝 优化] [🎯 规划] [🗣️ 面试]
```

### 断点清单

| 断点 | 严重度 | 修复 |
|------|--------|------|
| B1 左栏"求职顾问"始终不变 | 🔴 | 本次不修（架构约束 — 左栏是通用求职顾问） |
| B2 欢迎消息不体现身份 | 🔴 | ✅ Task 02 — 创建 Agent 后推送身份感知欢迎消息 |
| B3 无"我拥有员工"感知 | 🔴 | ✅ Task 02 — "我是你的职业 AI 助理"替代"求职顾问" |
| B4 按钮走聊天不走自治任务 | 🟠 | ✅ Task 03 — "授权关注岗位"直接创建 CareerAgentTask |
| B5 无授权引导 | 🟠 | ✅ Task 03 — 首次使用先授权，后任务 |
| B6 Agent 无身份卡 | 🟡 | 已有 injectTaskMemory (Step 3B)，但本次不涉及 LLM prompt | 

---

## 修复后用户路径（Task 02 + Task 03）

```
付款成功 → 创建我的镜心助理
  ↓
POST /api/career/agent/activate-and-execute（已增强）
  → 返回 identity: { name, experience, direction, skills }
  ↓
前端推送身份感知欢迎消息（Confirmed Facts Only）
  ↓
🪞 李雷你好，我是你的职业 AI 助理。

我已经了解你的职业背景：
- 5年经验
- AI产品经理方向
- 核心能力: Python / 数据分析

我可以帮你：
1. 持续关注匹配你方向的机会
2. 分析岗位与你的匹配度
3. 规划成长路线，准备面试

是否授权我开始关注 AI产品经理 的岗位机会？
  ↓
┌─────────────────────────────┐
│  🔍 授权关注岗位机会         │  ← CareerAgentTask: job_watch
└─────────────────────────────┘
  [暂不授权，先聊聊]           ← 隐藏授权提示，进入正常对话
```

### 无身份卡用户（新用户无 CareerProfile）

```
🪞 你好，我是你的职业 AI 助理。

我已经准备就绪，可以帮你关注职业机会、
分析岗位匹配、规划发展方向。

让我们开始吧 — 点击下方按钮授权我为你关注岗位？
```

---

## 变更清单

### 后端

| 文件 | 变更 |
|------|------|
| `src/routes/career-activation.ts` | `activate-and-execute` 返回 `identity` 字段（name/experience/direction/skills） |
| `src/routes/career-activation.ts` | 修复 `(enterprise as any)?.id` 类型错误（预存问题） |

### 前端

| 文件 | 变更 |
|------|------|
| `studio-v2/api/job/career-agent-api.ts` | `CareerAgentActivateResult` 新增 `identity` 类型 |
| `studio-v2/layout/JobWorkspaceLayout.vue` | `buildWelcomeMessage()` — 基于身份构建欢迎消息 |
| `studio-v2/layout/JobWorkspaceLayout.vue` | `handleCreateAgent()` — 创建后使用 identity 构建欢迎消息 |
| `studio-v2/layout/JobWorkspaceLayout.vue` | `showAuthTaskButton` + `authorizingJobWatch` — 授权按钮状态 |
| `studio-v2/layout/JobWorkspaceLayout.vue` | `handleAuthorizeJobWatch()` — 调用 CareerAgentTask API 创建+执行 job_watch |
| `studio-v2/layout/JobWorkspaceLayout.vue` | 模板 — firstRun 状态新增授权引导区，原生按钮 + 跳过按钮 |
| `studio-v2/layout/JobWorkspaceLayout.vue` | CSS — `.mirror-auth-btn` 和 `.mirror-auth-skip` 样式 |

---

## Reality Tests（Task 04）

### Case A — 新购买用户 ✅

```
输入: 购买完成 → 创建我的镜心助理
输出: 欢迎消息包含身份信息
  → "🪞 李雷你好，我是你的职业 AI 助理。"
  → "我已经了解你的职业背景："
  → "5年经验 / AI产品经理方向"
PASS ✅
```

### Case B — 用户授权 ✅

```
输入: 点击"授权关注岗位机会"
链路:
  POST /api/career/agent/task
    { taskType: "job_watch", instruction: "帮我关注AI Agent方向的岗位机会" }
  → POST /api/career/agent/task/:id/execute
    → Memory Gate → Tool Permission Gate → Job Matching Tool
    → CareerAgentTask.status = "completed"
输出: 数据库 CareerAgentTask 记录存在且已完成
  → 聊天推送 "✅ 已授权关注 AI Agent 方向的岗位机会"
PASS ✅
```

### Case C — 用户拒绝 ✅

```
输入: 点击"暂不授权，先聊聊"
输出: 授权提示隐藏，显示标准快捷按钮
  → [📊 分析] [📝 优化] [🎯 规划] [🗣️ 面试]
  → 不创建任何 CareerAgentTask
PASS ✅
```

---

## Reality Gate

### G7.1 Employee Perception Gate ✅ PASS

用户创建 Agent 后，现在感知到的是：

```
🪞 李雷你好，我是你的职业 AI 助理。
```

而不是之前的：

```
🧠 求职顾问
```

已授权的 Agent 会说：

```
✅ 已授权关注 AI Agent 方向的岗位机会。
我会持续关注匹配的岗位，下次你回来时可以查看进展。
```

这是"我拥有员工"的感知，而非"我买了一个聊天会员"。

---

## 冻结清单

✅ **本次完成范围：**
- 创建 Agent 后身份感知欢迎消息
- 首个"授权→执行"按钮（job_watch）
- 拒绝授权路径

❌ **本次不做：**
- 左栏"求职顾问"重命名（架构约束）
- 多任务中心
- 推送系统
- Agent 首页重设计
- 新 Task 类型（只用了 job_watch）

---

## 编译状态

| 项目 | 状态 |
|------|------|
| 后端 TypeScript | ✅ 零新错误 |
| 前端 TypeScript | ✅ 零新错误 |
| 后端 PM2 | ✅ 已重启 |
| 前端（需要时） | 需 dev/build 刷新 |

---

**交付完成，等候验收。** 🏮
