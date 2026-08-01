# Sprint-09B-1 Reality Report: 镜心品牌接入

> 掌柜验收准备就绪
> 验证日期：2026-07-30 16:45 CST

---

## 范围确认

本 Sprint 仅做身份层接入，未改变：

- ✅ Runtime（Hermes）
- ✅ Task 系统
- ✅ 模型配置（UserModelConfigV2）
- ✅ API 数据结构
- ✅ Agent 类型

---

## 验收条件逐项确认

### ✅ 页面品牌更新完成

| 位置 | 旧文案 | 新文案 | 状态 |
|------|--------|--------|------|
| 导航栏标题 | `🎯 求职管家` | `🪞 镜心 · AI 职业伙伴` | ✅ |
| Agent 身份卡（未创建） | `我的AI职业助理` | `镜心 · AI 职业伙伴` | ✅ |
| Agent 身份卡（已创建） | `AI 职业助理` | `镜心 · AI 职业伙伴` | ✅ |
| 聊天头部标题 | `🤖 AI 求职顾问` | `🪞 镜心 · AI 职业伙伴` | ✅ |
| 欢迎消息（前/后） | `你好！我是你的 AI 职业顾问` | `你好！我是镜心，你的 AI 职业伙伴 🪞` | ✅ |

### ✅ 镜心身份可见

- 浏览器 snapshot 确认：所有用户可见位置均显示「镜心」
- 页面主题与「镜心·职业伙伴」定位一致

### ✅ 对话人格正确

后端更新 3 处 Persona：

| 位置 | 变更 |
|------|------|
| `getExtractionSystemPrompt()` | `专业的 AI 职业顾问` → `镜心，用户的 AI 职业伙伴` |
| `getReplySystemPrompt()` | `资深 AI 职业顾问` → `镜心，用户的 AI 职业伙伴` |
| `generateFallbackReply()` | 所有问候/完成文本更新为镜心身份 |
| `STAGE_QUESTIONS.GREETING` | 问候语改为镜心身份 |
| `/api/job/welcome` | API 返回调整为镜心身份 |

### ✅ Runtime 无回退

- CareerConversationOrchestrator 保持主路径
- JobCareerEngine 保留为降级路径（仅无 BYOK 用户时走）
- 降级路径中也使用镜心 Persona

### ✅ 模型链路不变

接续 Sprint-09A-R 验证结果：
```
UserModelConfigV2 (volcengine / doubao-seed-2-0-plus-260428)
  ↓
resolveRuntimeConfig
  ↓
Hermes Runtime
  ↓
Career Agent (镜心)
```

### ✅ 无新增 Schema

- 无新数据表
- 无新 API 路由
- 无新 Agent 类型
- 无新模型配置

### ✅ 浏览器验证通过

- 页面加载正常
- 欢迎消息正确
- 聊天功能正常
- 推荐工作台正常

---

## 修改文件清单

### 前端

| 文件 | 改动 |
|------|------|
| `frontend/pages/workspace/job/index.vue` | 导航栏标题更新 |
| `frontend/studio-v2/layout/JobWorkspaceLayout.vue` | Agent 卡/聊天头/欢迎消息 3处更新 |

### 后端

| 文件 | 改动 |
|------|------|
| `backend/src/services/career/career-conversation-orchestrator.ts` | Persona 4处更新（extraction/reply/fallback） |
| `backend/src/agents/job/job-career-engine.ts` | 降级路径问候语 2处更新 |
| `backend/src/routes/job.routes.ts` | Welcome API 硬编码更新 |

---

## 验收总表

| 条件 | 状态 |
|------|------|
| ✅ 页面品牌更新完成 | PASS |
| ✅ 镜心身份可见 | PASS |
| ✅ 对话人格正确 | PASS |
| ✅ Runtime 无回退 | PASS |
| ✅ 模型链路不变 | PASS |
| ✅ 无新增 Schema | PASS |
| ✅ 浏览器验证通过 | PASS |

**7/7 全部通过。**

---

## 下一步

掌柜验收后，进入 Sprint-09B-2 Platform AI Gateway。

```
Sprint-09B-1 镜心身份落地 ← 现在（完成）
  ↓
Build / Deploy / Verify ← 现在（完成）
  ↓
Sprint-09B-2 Platform AI Gateway（免费用户模型兜底）
  ↓
Sprint-09C 商业化验证
```
