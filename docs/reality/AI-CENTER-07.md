# AI-CENTER-07 数据质量运营 — COMPLETE ✅

**Date:** 2026-08-02 00:50
**Gate:** 掌柜战略指令（AI 中心已产品可用，不再扩展能力 → 把数据准确性做到行业领先，数据过期是最大风险）
**原则：** 不重构、不扩展功能，补齐数据可信层

---

## 现状基线（审计时点）

- 25 厂商 / 40 模型，全部在册
- 31 verified（2026-08-01 验证，90 天内）· 9 pending（订阅制/无 token 计价类）
- 0 expired（全部 90 天内验证）· 0 deprecated

## T01 模型数据状态（四态语义）

`dataStatus` 字段已存在（verified/pending），本次扩展完整语义：

| 状态 | 含义 | 判定 |
|------|------|------|
| 🟢 verified | 价格已验证 | dataStatus=verified 且验证时间 ≤90 天 |
| ⚠️ expired | 价格可能过期 | **动态派生**：verified 但 lastVerifiedAt >90 天 |
| 🟡 pending | 待验证 | 无价格/未验证（订阅制等） |
| ⚫ deprecated | 已废弃/下架 | 后台显式标记 |

**设计决策：expired 不落库**（90 天是时间函数，静态标记会自己过期失效）——DB 存真值 verified，展示层由 `modelEffectiveStatus()` 派生，零迁移、不破坏现有数据。

## T02 价格过期提醒（90 天规则）

- 后端常量 `VERIFY_TTL_DAYS = 90` + 派生字段 `effectiveStatus` / `daysSinceVerified`（modelDto 统一输出）
- 前台卡片：`⚠️ 价格可能过期（N 天未验证），请以官方最新价格为准`
- 详情页提示条：`⚠️ 价格可能过期：最后验证于 X，已 N 天未更新。请以官方最新价格为准，或联系运营重新验证`
- 榜单/对比继续只取 verified（过期模型带警告展示，不删数据——诚实标注原则）

## T03 后台 AI 模型运营中心（升级 /admin/ai-center/models）

- 五卡统计：模型总数 / 🟢价格已验证 / ⚠️已过期（90天）/ 🟡待验证 / ⚫已废弃·厂商数
- 状态筛选：全部 / 🟢已验证 / ⚠️已过期 / 🟡待验证 / ⚫已废弃
- 表格状态列四态徽章（过期显示天数）、过期行橙色高亮
- 操作：标记已验证（原有）· **标记废弃**（前台下架数据保留）· **恢复待验证**
- 诚实规则（后端强制）：废弃模型不可直接置 verified，必须经 pending 重新验证
- **修复真实 bug**：models.vue 读 `admin_token` 而登录链路写 `auth_token` → 运营中心 API 恒 401（AI-CENTER-06 遗留，G8 规则下验收遗漏）→ 兼容读取

## T04 首批 TOP 30 模型盘点（掌柜清单全在册）

| 系列 | 模型 | 状态 |
|------|------|------|
| GPT | gpt-5.6-sol / terra / luna / 5.4-mini / 5.4-nano | 🟢×5 |
| Claude | opus-5 / sonnet-5 | 🟢×2 |
| Gemini | 3.6-flash / 3.5-flash / 3.5-flash-lite | 🟢×3 |
| DeepSeek | v4-flash / v4-pro | 🟢×2 |
| Qwen | 3.7-max / plus / flash | 🟢×3 |
| Kimi | k2.7-code / k3 / k2.6 | 🟢×3 |
| GLM | 5.2 / 5-turbo | 🟢×2 |
| DALL-E | gpt-image-2 | 🟢 |
| 即梦/万相/讯飞 | seedream-4.0 / wan-2.5 / spark-x1 | 🟡（订阅制/积分，待运营验证） |
| Midjourney | midjourney-v7 | 🟡（订阅制 $→¥72-¥864/月） |
| 可灵/Runway/Pika/Luma | kling-2.1 / runway-gen4 / pika-2.2 / luma-ray2 | 🟡（订阅制，待运营验证） |
| ElevenLabs | eleven-v3 | 🟡（订阅制） |

**结论：语言类 19 个 TOP 模型 100% 已验证；9 个 pending 均为订阅制/无 token 计价类，保持诚实「待运营验证」，不伪造价格。** 数量不是目标，TOP 30 数据准才是。

## 验收（生产域浏览器 + API 实测）

| 项 | 结果 |
|----|------|
| 前台 AI 中心 40 卡片渲染 | ✅ |
| 详情页（DeepSeek）价格/验证信息/人民币单位 | ✅ |
| 后台运营中心：标题/五卡/筛选/四态徽章/11 待验证行 | ✅ |
| 标记废弃 → 前台列表消失（40→39） | ✅ |
| 废弃模型详情 404 | ✅ |
| 废弃→verified 被拒（诚实规则） | ✅ |
| 恢复待验证 → 前台恢复（39→40） | ✅ |
| 过期提示条（临时改验证时间 100 天前）：详情页 banner + 首页卡片徽章 | ✅ |
| 恢复原验证时间 2026-08-01，状态分布回 31/9 | ✅ |

截图：AI-CENTER-07-admin-center.png / AI-CENTER-07-expired-detail.png / AI-CENTER-07-expired-home.png

## 附带修复

1. **部署链修复**：`rsync --delete` 会因宝塔 `.user.ini` 保护文件中断且删 Nginx 目录结构（memory 已有教训，本次仍踩）→ 改回 deploy.sh 逻辑（rm _nuxt → cp -a 静态 → pm2 restart nuxt-frontend；SSR 走本地 .output/server:3000，站点根只放静态）
2. **models.vue token key 不匹配 bug**（见 T03）

## 冻结清单（持续）

❌ AI 推荐 / Agent 联动 / 自动选择 / 智能助手（掌柜明令不再扩展功能）
❌ 伪造订阅制模型价格
⏸ DB-GOV-01 Prisma migration 历史链治理（掌柜建议单独 sprint，不与 AI 中心混做）
⏸ 9 个 pending 订阅制模型：待真实 API/定价商务验证后转 verified

提交：见 git log
