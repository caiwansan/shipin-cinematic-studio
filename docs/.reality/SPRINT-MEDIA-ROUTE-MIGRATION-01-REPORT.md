# SPRINT-MEDIA-ROUTE-MIGRATION-01-REPORT

**Date:** 2026-08-02 07:00
**Gate:** 掌柜指令（产品入口治理：不删旧代码、不破坏历史、只统一用户路径到新 SaaS 工作台；完成后停止，不进入 01C/微信/AI员工部署）
**结论:** ✅ **入口收敛完成。旧 `/media-department/*` 全部 301 → 新 `/workspace/media/*`，导航唯一入口指向新工作台。**

---

## 一、路由审计

### 旧入口（6 路径，pages/media-department 6 文件保留）
```
/media-department
/media-department/workspace
/media-department/employees
/media-department/analytics
/media-department/settings
/media-department/settings/channels
```

### 新入口（8 页面）
```
/workspace/media                CEO 驾驶舱
/workspace/media/team           AI 员工团队
/workspace/media/content        内容生产车间
/workspace/media/messages       AI 客户运营中心
/workspace/media/accounts       新媒体资产
/workspace/media/customers      客户资产
/workspace/media/analytics      数据分析
/workspace/media/intelligence   行业智能
```

### 引用关系
| 位置 | 类型 | 处置 |
|------|------|------|
| `config/navigation.ts:43` | 导航菜单 → `/media-department` | ✅ 改为 `/workspace/media`，label 更新「AI新媒体运营中心」 |
| `config/workspaces.ts:116` | 工作台注册表 | ✅ 已是 `hidden`（07-28 冻结时处理，未动） |
| `composables/enterprise/useMediaApi.ts` 等 | 后端 API（非路由） | 不触碰（符合「不重构业务逻辑」） |
| `pages/media-department/*` | 旧页面文件 | ✅ 保留未删除 |

## 二、旧入口治理（实现方案）

**跟随项目 SSOT：`middleware/enterprise-redirect.global.ts`**（注释明确「all legacy path redirects consolidated into a single middleware」，Nuxt config routeRules 重定向已废弃）。

- 新增 Case 3：`/media-department/*` → `/workspace/media/*` 精确映射 + 兜底
- **保留 query + hash**：`navigateTo({ path: target, query: to.query, hash: to.hash }, { redirectCode: 301 })`
- 映射表：
  - `/media-department` → `/workspace/media`
  - `/media-department/workspace` → `/workspace/media`
  - `/media-department/employees` → `/workspace/media/team`
  - `/media-department/analytics` → `/workspace/media/analytics`
  - `/media-department/settings` → `/workspace/media/accounts`
  - `/media-department/settings/channels` → `/workspace/media/accounts`
  - 其他 `/media-department/*` → `/workspace/media`（兜底）

**踩坑记录**：先尝试 Nuxt `app/router.options.ts`（routes 原地改写 redirect）——Nuxt 3.16 约定位置是 `srcDir/app/router.options.ts`，且本项目 SPA 模式（ssr:false）+ 已有重定向 SSOT 中间件。**回归项目惯例**，移除 router.options 方案，全部收敛进 `enterprise-redirect.global.ts`。

## 三、导航检查

- `config/navigation.ts` 唯一导航项改为 `/workspace/media`
- 全仓终扫：无任何组件/页面链接指向 `/media-department`（仅剩 workspaces 注册表 hidden 记录 + composables 后端 API）
- 浏览器实测首页 mega menu：media 链接唯一 = `/workspace/media` ✅

## 四、浏览器生产验证（SPA 模式说明）

本项目 `ssr: false`（SPA），服务端不渲染路由 → HTTP 层恒 200（SPA fallback），重定向由**客户端 Nuxt middleware** 执行（navigateTo redirectCode 301），符合「301/302 或 Nuxt redirect」要求。

| 旧路径 | 最终 URL | 新 UI 渲染 |
|--------|---------|-----------|
| /media-department | /workspace/media | ✅ AI 新媒体运营中心/我的 AI 团队/渠道资产中心 |
| /media-department/workspace | /workspace/media | ✅ |
| /media-department/employees | /workspace/media/team | ✅ AI 员工团队 |
| /media-department/analytics | /workspace/media/analytics | ✅ 数据分析 |
| /media-department/settings | /workspace/media/accounts | ✅ 新媒体资产 |
| /media-department/settings/channels | /workspace/media/accounts | ✅ 新媒体资产 |
| query 保留 | /media-department/analytics?tab=traffic → /workspace/media/analytics?tab=traffic | ✅ |

## Reality Gate

| Gate | 要求 | 结果 |
|------|------|------|
| R1 | 旧入口全部收敛 | ✅ 6 旧路径全部 301 到新工作台 |
| R2 | 用户只能进入新工作台 | ✅ 导航唯一入口 /workspace/media；旧路径全部重定向 |
| R3 | 其他 Workspace 无影响 | ✅ /workspace/legal·recruitment·geo/dashboard·job 全 200；中间件仅新增 /media-department 分支 |
| R4 | 生产 build 通过 | ✅ Nuxt build PASS |
| R5 | 生产域验证 | ✅ 重定向矩阵 6/6 + 导航 + query 保留 |

## 修改文件列表

| 文件 | 改动 |
|------|------|
| `frontend/middleware/enterprise-redirect.global.ts` | +Case 3：/media-department/* → /workspace/media/*（保留 query/hash） |
| `frontend/config/navigation.ts` | 新媒体导航项 → /workspace/media + label 更新 |
| `frontend/pages/media-department/*` | **零改动（保留）** |
| `backend/*` | **零改动** |

## 冻结清单（持续）

❌ 删除 pages/media-department ❌ 微信接入 ❌ Commerce ❌ Model Settings ❌ MediaUser/MediaSubscription ❌ mock
⏸ 01C 商业订阅入口 ⏸ 微信真实接入 ⏸ AI 员工部署

**锚点**：`middleware/enterprise-redirect.global.ts`、`config/navigation.ts`、截图 `audit-screenshots/ROUTE-MIGRATION-01-{nav,team,root,employees}.png`
