# SPRINT-ECO-09 — Application Center Navigation — COMPLETE ✅

**Date:** 2026-08-04 00:45
**Gate:** 掌柜批准（ECO-08 验收 PASS 后：「下一步 ECO-09 是第一次让用户看到这个生态形态」）
**范围：** ✅ 首页导航入口 ✅ 9 应用展示 ✅ 点击进入对应工作台 ｜ ❌ 插件商城 UI ❌ 支付 ❌ 推荐算法 ❌ 搜索排名 ❌ 运营位 ❌ 工作台业务逻辑改动

## 核心交付（提交 `待填`）

### 1. 修复：workspace_entry 全部指向 404 路由（ECO-01 潜伏 bug）
- **根因**：ECO-01 种子 9 应用 workspaceEntry 全为 `/workspaces/*`（复数），实际路由是 `/workspace/*`（单数）且个别应用入口不同 → 一旦做跳转必 404。ECO-01 只做身份目录（不跳转）所以未暴露
- **修复**：builtin-applications.ts 种子 spec 9 处修正 + DB 双表同步（ecology_applications.workspace_entry + ecology_application_versions.frontend_entry）
- 正确映射：media→/workspace/media ｜ drama→/studio/v2 ｜ novel→/hdz ｜ recruit→/workspace/recruitment ｜ legal→/workspace/legal ｜ mall→/mall ｜ music→/workspace/music ｜ ads→/workspace/ad-create ｜ geo→/workspace/geo/dashboard

### 2. 首页导航「应用中心」入口
- config/navigation.ts primaryNav：商城 → 社区 → **应用中心**（🧩 /ecosystem/applications）→ AI中心
- 位置在社区后（掌柜指定）

### 3. 应用中心页升级（pages/ecosystem/applications.vue）
- 卡片整体可点击（hover 浮起）→ 跳转 workspaceEntry
- 主 CTA「进入工作台 →」（@click.stop 防冒泡）
- 保留 ECO-01 能力声明/权限清单/组织安装状态（不删既有验收功能）
- 副标题改为「9 大应用，点击进入对应工作台」

## Reality Gate — 14/14 PASS

- **G1** 导航 primaryNav 含应用中心（社区后位置断言）
- **G2** API 返回 9 应用，全部 BUILT_IN/ACTIVE，slug 齐全
- **G3** 9 应用 workspaceEntry 全部指向真实前端路由（逐路由文件存在性断言，防再 404）+ DB 同步
- **G4** JWT：无 token 401 / 带 token 200
- **G5** 页面含进入工作台 CTA + 卡片点击跳转逻辑
- **G6** 零污染：ecology 表 25 张不变；ecology_applications 15 列结构未变；页面无 price/购买/¥ 商城元素

## 回归

- ECO-01 gate 19/20（唯一 FAIL = 「ecology 表恰 4 张」计数断言过期，25 张 = 生态增长证据，非回归）
- 前端已构建部署（nuxt-frontend 3000 / aigc.fushtn.com），线上 bundle 验证 btn-enter/workspaceEntry/进入工作台 全部生效

## 关键经验

- **种子数据错误会潜伏到「点击那一刻」才爆炸**：ECO-01 只展示不跳转，/workspaces/*（复数）错误入口静默存活两轮 sprint。ECO-09 做入口必须先做路由真实性断言（gate G3 逐路由文件检查），否则「入口」交付 = 404 交付
- workspaceEntry 是应用与工作台的**唯一契约**：seed spec 与 DB 双表（applications + versions.frontend_entry）必须同源同步，gate 断言一致性
- Nuxt 路由级 chunk 懒加载：线上验证页面改动不能只看 entry bundle，要 grep 路由 chunk（.output/public/_nuxt/ 下含 btn-enter 的 chunk）
- gate 自身 bug：split(']') 被 TS 类型标注 NavItem[] 截断 → 用 '= [' 切；ecology_applications 实际 15 列非 16

## 掌柜验收标准对照

1. ✅ 首页出现应用中心入口（导航社区后 🧩）
2. ✅ 9 应用全部展示（API 9/9 + 页面卡片）
3. ✅ 点击进入原工作台（workspaceEntry 全部真实路由）
4. ✅ JWT/权限正常（401/200）
5. ✅ 现有工作台 Reality Gate 保持通过（ECO-01 19/20 仅计数断言过期）

## 下一步（掌柜路线）

ECO-10 Plugin Marketplace Discovery MVP → ECO-11 Kunlun Media Local App

报告：docs/reality/ECO-09-APPLICATION-CENTER-NAVIGATION-01.md ｜ 脚本 scripts/reality-check-eco-09.mjs
