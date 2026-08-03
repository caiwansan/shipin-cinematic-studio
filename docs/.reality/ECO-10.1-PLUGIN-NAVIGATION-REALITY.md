# ECO-10.1 Plugin Center Navigation — Reality Gate 报告

**Date:** 2026-08-04 02:50 ｜ **类型:** 增量 UI 接入（导航 + 入口展示）
**掌柜批准:** 「只做导航和入口展示」｜ **提交:** `待填`

## 范围

✅ 首页 primaryNav 增加「插件中心」 ｜ ✅ 页面标题/定位升级 ｜ ✅ Reality Gate 36/36
❌ 支付 ❌ 商城交易 ❌ 推广 ❌ 分佣 ❌ License 改造 ❌ 数据库修改 ❌ 插件系统改动

## 交付

### Task 01 — 首页导航（config/navigation.ts）
```
商城 → 社区 → 应用中心 → 🧩 插件中心 → AI中心
```
- 位置：应用中心之后、AI中心之前（应用=使用工具，插件=增强能力，两入口并列）
- 路由 /ecosystem/plugins 公开访问；KunlunNav 自动渲染 primaryNav，零组件改动

### Task 02 — 权限不变
- 页面公开访问；安装/授权/运行仍走 JWT → Organization → License → KAOR（G5 验证）

### Task 03 — SEO / 产品定位
- 页面标题：「昆仑镜 AI 插件中心」（useHead + h1）
- 副标题：「发现、安装和管理 AI 员工与智能工作流插件」
- 不叫「插件商城」；未来升级定位「AI应用生态市场」

### Task 04 — 首页卡片
- 首页为营销落地页（HeroScene 编排），无生态入口卡片区 → 条件不成立，由导航入口覆盖（已与掌柜约定：有生态入口区时再加卡片）

### Task 05 — Reality Gate 36/36 PASS

| 组 | 验证 | 结果 |
|---|---|---|
| G1 导航 | primaryNav 含插件中心；顺序 社区<应用中心<插件中心<AI中心；首页 200；/ecosystem/plugins 200 | ✅ 6/6 |
| G2 插件页 | 列表 API code=0；官方 LISTED=5；含价格字段 | ✅ 3/3 |
| G3 工作台回归 | 短剧/小说/招聘/法律/GEO/商城/音乐/广告/新媒体 9 路由全 200 | ✅ 9/9 |
| G4 商业边界 | 页面无 购买/立即购买/购物车/去支付/钱包/提现/推广/分佣/排行榜/推荐算法；标题/副标题正确；无「插件商城」 | ✅ 13/13 |
| G5 License | 登录 → 安装 INSTALLED → License ACTIVE subscription → 落库 → launch-check allowed:true | ✅ 5/5 |

## 关键经验

1. **禁止清单注释会误伤商业边界断言**：plugins.vue 头部注释「禁止：支付/提现/推广/排行榜/推荐算法」被 `includes()` 命中 → gate 需先剥离注释（`<!-- -->` / `/* */`）再断言
2. 登录接口返回平铺 `{accessToken}`（非 `{code,data}`）——gate 断言需兼容两种结构
3. `ssr: false` 全局 CSR：useHead 只在浏览器端生效，SSR title 为项目默认；验证 bundle 字符串 + 页面 200 双通道确认
4. 运行检查接口名 `launch-check`（非 run-check）——KAOR Load 前置语义

## 验证脚本

`backend/scripts/reality-check-eco-10-1.mjs` — 36/36 PASS

## 产品层判断（掌柜）

四层生态已成型：**应用中心**（用户选择AI应用）→ **插件中心**（用户购买AI能力）→ **KAOR**（运行AI员工）→ **License**（控制商业授权）。

下一阶段 ECO-11 建议：**线上新媒体工作台 Reality 修复 → 线上插件化运行验证 → 再封装 Kunlun Media.exe**（线上真实运营 → Reality Gate → 本地发行）。
