# ECO-NAV-RETURN-01 — 应用中心 / 插件中心返回首页入口修复

**Date:** 2026-08-04 ｜ **类型:** 小步增量修复 ｜ **状态:** COMPLETE ✅

## 变更内容

| Task | 交付 | 文件 |
|---|---|---|
| Task 01 | 应用中心 `/ecosystem/applications` 页面 Header 顶部新增「← 返回首页」→ `/` | `frontend/pages/ecosystem/applications.vue` |
| Task 02 | 插件中心 `/ecosystem/plugins` 标题区新增「← 返回首页」→ `/` | `frontend/pages/ecosystem/plugins.vue` |
| Task 03 | 体验统一：轻量共用组件 `EcoBackHome`（仅 NuxtLink + Design Token，不重复造导航系统） | `frontend/components/ecosystem/EcoBackHome.vue` |
| Task 04 | Reality Gate（见下） | `scripts/reality-check-eco-nav-return-01.cjs` + `-g3.cjs` |

## Reality Gate — 15/15 PASS

### G1 页面访问（本地 3000 实测）
- ✅ `/ecosystem/applications` → 200 + 标题渲染
- ✅ `/ecosystem/plugins` → 200 + 标题渲染

### G2 返回行为（本地 3000 实测，无头浏览器点击）
- ✅ 应用中心存在返回首页入口，`href="/"`
- ✅ 点击后 URL 回到 `/`（SPA 路由）
- ✅ 插件中心存在返回首页入口
- ✅ 点击后 URL 回到 `/`

### G3 生态回归（线上 aigc.fushtn.com + 登录态实测）
- ✅ 应用中心展示 **9 张应用卡片**，中文类别齐全（短剧/小说/招聘/法律/GEO/商城/音乐/广告/新媒体）
- ✅ 插件中心展示 **5 个插件卡片**（marketplace items = 5，与掌柜验收基线一致）
- ✅ 数据态下两页返回入口仍正常渲染

### G4 工作台回归（线上实测，9 工作台入口逐一遍历）
- ✅ 短剧 `/studio/v2` ｜ 小说 `/hdz` ｜ 招聘 `/workspace/recruitment` ｜ 法律 `/workspace/legal` ｜ GEO `/workspace/geo/dashboard` ｜ 商城 `/mall` ｜ 音乐 `/workspace/music` ｜ 广告 `/workspace/ad-create` ｜ 新媒体 `/workspace/media` —— **9/9 可达且内容渲染正常**

## 关键经验（实现记录）

1. **Nuxt 自动导入命名坑**：`components/ecosystem/EcoBackHome.vue` 的注册名是 **`EcosystemEcoBackHome`**（目录前缀+文件名），页面里写 `<EcoBackHome />` 编译后 `resolveComponent("EcoBackHome")` 失败 → **静默不渲染**（无构建报错）。修复：按注册名引用。教训：多级 components 目录的组件引用必须带目录前缀（`components/media/MediaPageHeader.vue` → `MediaPageHeader` 是因文件名已含目录词去重）。
2. **本地 3000 无 /api 代理**（已知坑）：`/api/ecosystem/applications` 返回 SPA HTML 而非 JSON → 页面 error 态。G3/G4 数据验证必须走线上域。
3. **既有行为未越界**：生态页面 `fetch('/api/ecosystem/applications')` 不带 Authorization（原状，非本次改动）；浏览器注入 auth_token 后数据正常展示。本次未改任何生态 API / 数据逻辑。
4. 页面数据加载依赖登录态：无 token 时应用中心/插件中心显示 error 态——**既有状态**，已如实记录，不属本 Sprint 范围。

## 产品规范（掌柜拍板，已沉淀）

> 以后所有生态页面统一要求：
> ```
> 生态页面
>  ├ 返回首页
>  ├ 页面导航
>  └ 当前生态入口
> ```
> 避免用户进入应用中心、插件中心后形成「孤岛页面」。

落地：`EcoBackHome` 组件即「返回首页」标准件，生态页面直接复用；页面导航/当前生态入口按各页现状保留。

## 禁止清单确认（零命中）

❌ 未改生态数据模型 ✅ ❌ 未改 License ✅ ❌ 未改 Application / Plugin Runtime ✅
❌ 未改商城逻辑 ✅ ❌ 不影响现有工作台 ✅（9 工作台 9/9 可达实证）

## 提交

`ECO-NAV-RETURN-01`（独立提交，见 git log）
