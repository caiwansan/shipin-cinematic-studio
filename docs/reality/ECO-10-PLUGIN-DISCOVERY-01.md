# SPRINT-ECO-10 — Plugin Marketplace Discovery MVP — COMPLETE ✅

**Date:** 2026-08-04 02:30
**Gate:** 掌柜批准（Phase 0 → Phase 1 战略梳理：「ECO-10 是插件发现中心，不是商城」）
**范围：** ✅ 插件目录 ✅ 搜索 ✅ 分类 ✅ 详情 ✅ 安装 ✅ License ✅ 运行检查 ｜ ❌ 支付 ❌ 提现 ❌ 推广 ❌ 排行榜 ❌ 推荐算法 ❌ 新表 ❌ 工作台业务改动

## 核心交付（提交 `待填`）

### 1. 官方内置插件种子（builtin-plugins.ts）—— 掌柜商业模型落地
5 款官方 AI 员工插件（App Store 首批官方应用语义，非模拟数据），全部绑定 Kunlun Media 免费底包：
| pluginId | 名称 | 订阅登记价 | 权限 |
|---|---|---|---|
| ai-content-ops-manager | AI内容运营经理 | ¥599/月 | content, analytics, automation |
| ai-viral-analyst | AI爆款分析师 | ¥299/月 | analytics |
| ai-video-director | AI短视频导演 | ¥399/月 | content, browser |
| ai-comment-ops | AI评论运营 | ¥299/月 | content, automation |
| ai-matrix-ops | AI矩阵运营团队 | ¥999/月 | browser, content, automation |
- manifest 严格 ECO-02 schema（只存不执行）；author=官方开发者 kunlun-official（太昊子 VERIFIED）
- 幂等 seed：developer/plugin/version/marketplace item 全 upsert，启动时 ensureEcologySeed 追加
- price 仅登记展示值（ECO-06 语义：未接支付实收恒 0，页面诚实标注「支付接入中」）

### 2. 后端发现 API 增强（marketplace.service + routes）
- `GET /marketplace/items?q=&category=&type=` —— 服务端搜索/分类过滤（ECO-10 新增）
- `GET /marketplace/items/:pluginId` —— 详情结构化：manifest（权限/billing）+ 关联应用（需要应用）
- `resolvePluginEcologyId` —— 兼容 ecology UUID 与 manifest pluginId 双标识（前端友好，ECO-06 gate 兼容）
- 列表返回 price/latestVersion

### 3. 前端 /ecosystem/plugins 插件发现中心
- 搜索框（300ms debounce）+ 分类 tab（全部/AI员工/工具/Workflow）
- 卡片：图标、名称、作者、价格（¥xxx/月）、**「暂无评分」诚实占位**、安装按钮（已安装/安装中/卸载状态）
- 详情面板：能力（权限中文映射）、权限清单、需要应用（可跳转工作台）、订阅价格（标注支付接入中）、版本、KAOR 运行环境
- 安装 → License 联动 → INSTALLED；运行检查（allowed/NOT_INSTALLED/NO_LICENSE/EXPIRED）；卸载（保留历史）

### 4. 重大治理修复：ECO-06 gate 破坏性回滚 → 事务内演练
- **实锤**：ECO-06 gate 回滚验证 `DROP ecology_marketplace_items` → 按旧 migration 重建 → **丢掉 ECO-07 加的 price 列**（全部 marketplace 查询 500）+ **清空官方种子商品** + DROP license_id 列丢安装数据
- **修复**：回滚验证改为事务内演练（BEGIN → DROP → 重建 → 检查 → ROLLBACK），现场零破坏；新增「ROLLBACK 后官方商品完好/price 列/license_id 列」断言
- ECO-06 gate 恢复现场验证后自动下架测试商品（发现中心只保留官方商品）
- 表计数断言更新（16/18 → 25/27 生态增长基线）

## Reality Gate — 34/34 PASS

- **G1** 官方种子：5 插件 PUBLISHED/ACTIVE + manifest 标准 + 价格 599/299/399/299/999
- **G2** 发现列表仅 5 款官方 LISTED（测试商品不污染）；DB 一致
- **G3** 搜索「爆款」命中 1 / 无结果 0 / type 分类过滤生效
- **G4** 详情：manifest 权限 + billing + 需要应用（Kunlun Media /workspace/media）
- **G5** 安装 INSTALLED + License ACTIVE subscription + 幂等 + 落库
- **G6** 运行检查：已装 allowed / 未装 NOT_INSTALLED
- **G7** 页面：搜索/分类/安装/运行检查/暂无评分/支付接入中标注；无商城 UI（立即购买/购物车/去支付/钱包/排行榜）
- **G8** 零污染：25 表不变、ecology_plugins 12 列未变、无评分/推荐表

## 回归

- ECO-06 gate **51/0**（含事务回滚新验证）——升级后跑完 ECO-10 gate 仍 34/34（零污染闭环验证）
- 前端已构建部署，线上 /ecosystem/plugins 200 + bundle 验证

## 关键经验

- **历史 gate 的破坏性回滚会毁掉生态资产**：ECO-06 回滚「DROP 表验证重建」在只有测试数据时安全；官方种子入住后，每次跑 gate 就清空商品 + 丢列。教训：**验收 gate 的破坏性演练必须事务化**（BEGIN/ROLLBACK），或只针对隔离测试数据
- ECO-07 gate 自愈（重建 migration 含 ADD price 列），ECO-06 gate 不（旧 migration）→ 破坏性 gate 需跨 sprint 审计
- licenseId 列被 DROP 后行数据丢失且静默（幂等返回 license=null 不报错）→ 治理后需重装回填
- 空数组 `.every()` 恒真：gate 断言 `items?.every(...)` 在 API 500 时误绿——断言要先验证 total/length

## 掌柜验收标准对照

1. ✅ /ecosystem/plugins 插件发现中心（搜索/分类/卡片）
2. ✅ 详情（能力/权限/需要应用/订阅价格/版本）
3. ✅ 安装 = 申请 License（ACTIVE）→ INSTALLED；运行检查
4. ✅ 无支付/提现/推广/排行榜/推荐（gate 断言）
5. ✅ 数据复用（ecology_plugins/marketplace_items/licenses/installations 零新表）
6. ✅ 官方 5 款 AI 员工 = 掌柜商业模型（免费底包 + 付费插件）

## 下一步（掌柜路线）

ECO-11 Kunlun Media Local App Design Review → MEDIA 线上 Reality 修复 → Tauri Prototype → 第一个官方插件发布

报告：docs/reality/ECO-10-PLUGIN-DISCOVERY-01.md ｜ 脚本 scripts/reality-check-eco-10.mjs
