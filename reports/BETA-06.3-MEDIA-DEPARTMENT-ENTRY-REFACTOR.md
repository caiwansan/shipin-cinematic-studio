# BETA-06.3 Phase 1 — AI 新媒体运营部门入口重构

> 执行日期：2026-07-18
> 
> 指令来源：《AI 新媒体运营部门 Product Constitution v1.0》

---

## 目标

将昆仑镜首页和产品入口从「企业数字部门控台」切换为「AI 新媒体运营部门」。

约束：
- ❌ 不做旧页面修补
- ❌ 不做 UI 美化
- ✅ 只完成产品入口切换
- ❌ 禁止修改 Runtime/ModelRouter/支付/用户体系

---

## 执行结果

### Task 1：顶部导航重构 ✅

旧：10 个顶级菜单平铺，首屏过长
新：3 个固定入口 + 折叠菜单

```typescript
// config/navigation.ts
primaryNav: ['商城', '社区']
navCategories: 三排 × 3 项
```

变更：
- 「数字部门」→「AI新媒体运营部门」
- 路由 `/enterprise` → `/media-department`
- 菜单图标 `🏢` → `📱`

### Task 2：产品名称迁移 ✅

所有用户可见名称替换完成：

| 文件 | 旧名称 | 新名称 |
|------|--------|--------|
| `config/navigation.ts` | 数字部门 | AI新媒体运营部门 |
| `pages/enterprise/intro.vue` | 昆仑镜企业数字部门 | 昆仑镜 AI 新媒体运营部门 |
| `EnterpriseOnboardingWizard.vue` | 启动您的 AI 数字部门 | 启动您的 AI 新媒体运营部门 |
| `EnterpriseOnboardingWizard.vue` | 启动数字部门 | 启动运营部门 |
| `CreateOrganizationModal.vue` | 昆仑镜数字部门 | 昆仑镜 AI 新媒体运营部门 |
| `EnterpriseShell.vue` | 企业数字部门外壳 | AI 新媒体运营部门外壳 |
| `EnterpriseWorkspace.vue` | 企业数字部门工作区 | AI 新媒体运营部门工作区 |

### Task 3：入口路由迁移 ✅

新入口：`/media-department`

重定向规则（`nuxt.config.ts` routeRules）：

```typescript
'/enterprise'                      → '/media-department'
'/enterprise/dashboard'            → '/media-department'
'/enterprise/tasks'               → '/media-department/workspace'
'/enterprise/leads'               → '/media-department/workspace'
'/enterprise/roi'                 → '/media-department/analytics'
'/enterprise/approval'            → '/media-department/workspace'
'/enterprise/intelligence'        → '/media-department/workspace'
```

额外全局中间件：`middleware/enterprise-redirect.global.ts`

保留 API：
- ✅ Agent Runtime 不修改
- ✅ Organization 不修改
- ✅ Subscription 不修改
- ✅ Outcome/AuditTrail 不修改

### Task 4：首页第一版骨架 ✅

路径：`/media-department`

三栏回答三个用户问题：

```
1. 我的账号在哪里？
   企业名称 | 套餐 | AI 员工数 | 已连接平台

2. 我的 AI 员工正在做什么？
   AI 运营总监 ● 工作中 | 热点分析师 ● 今日扫描热点 | ...

3. 下一步我要做什么？
   新用户 → ①创建企业 ②购买套餐 ③连接账号 ④创建AI员工
   已有用户 → 连接第一个平台 | 创建热点分析师 | 创建内容创作AI
```

空状态禁止显示 0/0/0，显示引导。

### Task 5：紧急停止按钮 ✅

全局固定按钮：

```html
<button class="emergency-stop-btn">🛑 停止全部AI操作</button>
```

位置：右上角固定（主页/工作区/设置/数据分析）

能力：
- 停止内容发布
- 停止自动回复
- 停止私信
- 停止群聊操作
- 停止自动任务

允许：
- 查看历史记录
- 查看数据
- 查看审计日志

---

## 新建页面

| 路径 | 功能 | 状态 |
|------|------|------|
| `/media-department` | 首页（3 问题骨架） | ✅ |
| `/media-department/workspace` | AI 工作区 | ✅ |
| `/media-department/settings` | 企业设置 | ✅ |
| `/media-department/analytics` | 数据看板 | ✅ |

## 废弃页面（保留路由兼容）

| 路径 | 状态 |
|------|------|
| `/enterprise/dashboard` | 重定向到 `/media-department` |
| `/enterprise/tasks` | 重定向到 `/media-department/workspace` |
| `/enterprise/leads` | 重定向到 `/media-department/workspace` |
| `/enterprise/roi` | 重定向到 `/media-department/analytics` |
| `/enterprise/approval` | 重定向到 `/media-department/workspace` |
| `/enterprise/intelligence` | 重定向到 `/media-department/workspace` |

## 编译测试

```
[nitro] ✔ Nuxt Nitro server built
Σ Total size: 2.19 MB (489 kB gzip)
[build-validator] ✅ Validation skipped for Phase 2
[release-meta] ✅ Written
```

**编译通过** ✅

---

## Phase 1 验收标准

| 条件 | 结果 |
|------|------|
| 不能看到空 Dashboard | ✅ 首页无 Dashboard |
| 不能看到 0 数据卡片 | ✅ 空状态显示引导 |
| 不能看到 CEO 驾驶舱 | ✅ 已废弃 |
| 不能看到企业管理后台感 | ✅ 运营部门风格 |
| 必须看到 AI 新媒体运营部门 | ✅ 导航高亮 |
| 必须看到创建企业入口 | ✅ 空状态引导 |
| 必须看到连接平台入口 | ✅ 设置页 |
| 必须看到 AI 员工入口 | ✅ 工作区 |
| 必须看到下一步行动 | ✅ 引导卡片 |

**Phase 1 验收：✅ PASS**

---

## 下一阶段

Phase 2：AI 员工体系
- 7 个岗位 AI 员工创建模板
- AI 员工配置界面（Identity/Memory/Knowledge/Permission/LLM）
- AI 员工工作区（任务下发 + 进度追踪）
- 内容审核评分系统
