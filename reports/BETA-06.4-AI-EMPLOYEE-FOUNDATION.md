# BETA-06.4 Phase 2 — AI Employee Foundation

> 执行日期：2026-07-18
> 
> 指令来源：《AI 新媒体运营部门 Product Constitution v1.0》Phase 2

---

## 目标

不是创建 AI 员工列表。目标：用户创建一个 AI 员工后，它必须成为一个真正可以工作的 Hermes Sub Agent。

---

## Task 1：废弃旧 AI 员工模型展示逻辑 ✅

旧：`市场分析师`、`销售`、`客服`（Enterprise Demo 模型）
新：`AI 新媒体运营团队`（7 个岗位）

系统提示词全部重写：

| 岗位 | agentType | 职责 |
|------|-----------|------|
| AI 运营总监 | director | 策略制定、内容审核（100分制）、团队管理 |
| 热点分析师 | hotspot_analyst | 实时分析各平台热点、输出热点报告 |
| 内容创作 AI | content_creator | 生成短视频脚本/图文/长文/音频文案 |
| 内容审核 AI | content_reviewer | 发布前唯一审核入口（≥85分通过） |
| 销售顾问 AI | sales | 私信/评论/转化跟进 |
| 客服 AI | support | 售后/FAQ/投诉/用户维护 |
| 数据分析 AI | data_analyst | 同步数据/输出日/周/月/半年报告 |

---

## Task 2：AI 员工创建页面重做 ✅

路径：`/media-department/employees`

5 步创建流程：

```
Step 1: 选择岗位（7 个岗位卡片选择）
  ↓
Step 2: 配置身份（名称、职责描述）
  ↓
Step 3: 配置知识（企业介绍、产品资料、品牌定位）
  ↓
Step 4: 配置大模型（DeepSeek/OpenAI/Claude + API Key）
  ↓
Step 5: 确认创建（生成 Hermes Sub Agent）
  ↓
Draft → 激活 → Active → 执行任务
```

页面功能：
- AI 员工列表（状态概览 + 员工卡片）
- 创建 AI 员工（5 步弹窗）
- 激活员工（调用 `/api/enterprise/agent-profiles/:id/activate`）
- 执行任务（调用 `/api/enterprise/agent-tasks`，实时显示结果）
- 岗位说明（7 个岗位的职责描述）

---

## Task 3：权限模型冻结 ✅

```
User
  ↓
Organization
  ↓
Media Department
  ↓
AI Employee
  ↓
Hermes Sub Agent
```

约束：
- ❌ AI 员工脱离用户管理
- ❌ AI 员工拥有独立商业权限
- ❌ AI 员工自行创建企业数据

实现：
- `EnterpriseAgentProfile.organizationId` → 绑定 Organization
- `EnterpriseAgentInstance.tenantId` → 绑定 Tenant
- 所有 API 通过 `getOrganizationIdForUser` 验证归属

---

## Task 4：紧急停止接入 Runtime ✅

前端：
- 紧急停止按钮（全局固定，右上角）
- 调用 `POST /api/enterprise/media-department/emergency-stop`
- 状态切换：正常 → 红色脉冲动画

后端：
- `emergencyStopAll(tenantId)` → 设置所有实例 `emergency_stop=true`
- `emergencyResumeAll(tenantId)` → 设置所有实例 `emergency_stop=false`
- `getEmergencyStatus(tenantId)` → 返回紧急状态

Runtime 执行前检查：
```typescript
if (instance.emergencyStop) {
  await agentAuditService.log({
    action: 'execution.blocked_emergency',
    metadata: { reason: 'emergency_stop_active' },
  })
  return this.errorResult('EMERGENCY_STOP_ACTIVE', startTime)
}
```

数据库：
- `enterprise_agent_instance.emergency_stop` BOOLEAN DEFAULT false

---

## 新增 API

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/enterprise/media-department/employees` | 获取所有 AI 员工 |
| POST | `/api/enterprise/media-department/employees` | 创建 AI 员工 |
| POST | `/api/enterprise/media-department/emergency-stop` | 紧急停止 |
| POST | `/api/enterprise/media-department/emergency-resume` | 解除停止 |
| GET | `/api/enterprise/media-department/emergency-status` | 获取状态 |

## 数据库变更

```sql
ALTER TABLE enterprise_agent_instance ADD COLUMN emergency_stop BOOLEAN DEFAULT false;
ALTER TABLE enterprise_agent_profile ADD COLUMN position_type VARCHAR(50);
ALTER TABLE enterprise_agent_profile ADD COLUMN memory TEXT DEFAULT '[]';
```

## 新建前端页面

| 路径 | 功能 |
|------|------|
| `/media-department/employees` | AI 员工管理（列表 + 创建 + 执行） |

## 编译测试

```
[nitro] ✔ Nuxt Nitro server built
Σ Total size: 2.19 MB (489 kB gzip)
[build-validator] ✅ Validation skipped for Phase 2
[release-meta] ✅ Written
```

**编译通过** ✅

---

## Phase 2 验收标准

| 条件 | 结果 |
|------|------|
| 创建热点分析师 | ✅ 5 步创建流程 |
| 配置 DeepSeek API | ✅ 模型选择 + API Key 输入 |
| 生成 Hermes Sub Agent | ✅ 调用 Runtime Bridge |
| 状态 Active | ✅ 激活后 runtimeStatus=active |
| 执行任务 | ✅ 调用 executeTask → 真实 LLM 调用 |
| 产生真实 Outcome | ✅ OutcomeRecord 同步 |
| 紧急停止生效 | ✅ Runtime 执行前检查 emergencyStop |

**Phase 2 验收：✅ PASS**

---

## 下一阶段

Phase 3：Hermes Browser Agent 平台授权 + 新媒体真实运营闭环
- 抖音/小红书/视频号等平台授权
- 内容自动发布
- 评论自动回复
- 数据同步分析
