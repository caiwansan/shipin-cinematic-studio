# Sprint-AI-CENTER-06 全球AI模型数据库与UI重构 — COMPLETE ✅

**Date:** 2026-08-02 03:20
**Gate:** 掌柜技术总监+产品经理视角审查（05 是「功能闭环」，06 升级为「可信的全球 AI 模型数据库」）

## 掌柜审查核心结论（本次执行依据）
> AI中心最核心资产不是页面，是 **AI 模型数据库**。模型名称、价格错误 → 整个中心失去价值。
> 下一阶段核心：**从一个漂亮页面，升级成可信的全球 AI 模型数据库。**

## 一、数据源不可信问题确认（T01 官方价格校验）
**抓取 2026-08-02 实时官方数据，证实 05 seed 严重过时：**
- DeepSeek 官方定价页：已发布 **V4 系列**（v4-flash $0.14/$0.28、v4-pro $0.435/$0.87，1M 上下文）——05 数据还是 V3 ¥2/¥8
- Kimi 官方定价页：已发布 **K3**（¥20/¥100，1M ctx）、K2.6、K2.7 Code
- OpenRouter 官方聚合 API（336 模型）：**GPT-5.6 系列 / Claude Opus 5 / Gemini 3.6 / GLM 5.2 / Qwen3.7 / Grok 4.5 / MiniMax M3** 等全部 2026 新代际
- 数据源标注：DeepSeek/Kimi = 官方定价页；其余 = OpenRouter 官方聚合（源头=厂商官方定价）

## 二、数据层重构（T02/T03）：AIProvider / AIModel 分离
```prisma
AiProviderDirectory（厂商，保留）
  └─ AiModelDirectory（模型粒度，新增）
      ├─ providerId / code / name / modelVersion / modelTypes / contextWindow / maxOutput
      ├─ inputPrice / inputCacheHit / outputPrice / currency / priceModel
      ├─ capabilityScore / capabilitySource
      ├─ lastVerifiedAt / dataSource / verifiedBy / dataStatus ← 真实性三要素
      └─ AiModelPriceHistory（价格快照历史，每次验证留痕）
```
- **40 个模型**：语言 31 / Agent 17 / 多模态 9 / 图片 4 / 视频 5 / 音频 1
- **31 个价格已验证（verified）**，9 个待验证（pending：订阅制/按量计费，前端显示「价格待验证」不展示数字）
- 40 条价格历史快照；能力评分标注来源（昆仑镜基于公开评测综合），非凭空捏造

## 三、前端 V2（T05/T06）：严格按掌柜布局
```
AI模型中心
  ├─ 顶部：搜索 + 分类 pills（全部/💬语言/🎨图片/🎬视频/🎙语音/🌐多模态/🤖Agent，带计数）
  ├─ 今日 AI 排名（三榜并排）：🏆综合性价比 / 🧠最强能力·推理 / 💸最低成本·输入价
  ├─ 模型对比（汽车之家风格对比表）：价格(输入/输出) + 六维能力 + 上下文 + 性价比
  │    默认 3 模型，可增删（下拉添加，上限 5），最低价标绿
  ├─ 模型市场（高密度卡片）：品牌块+模型名+类型+上下文+能力条+价格+性价比+已验证徽章
  └─ 价格趋势：输入价横向对比条（对数轴）+ 📋 官方价格验证记录（时间线）
```
- 详情页改模型级 `/ai-center/model/:code`：雷达图 / 价格+验证三要素（最后验证/验证人/数据来源）/ 适合场景（本地规则）/ 价格验证记录表 / 同厂商其他模型
- 信息密度优先：紧凑卡片，非大玻璃卡；亮暗自适应保留

## 四、后台模型运营管理（/admin/ai-center/models）
- 四统计卡（总数/已验证/待验证/覆盖厂商）+ 搜索/状态/类型过滤
- 表格：模型/厂商/类型/价格/上下文/性价比/数据状态/最后验证/验证人
- **「标记已验证」**：一键写入三要素 + 价格快照（PriceHistory）——可信度核心操作
- 新增/编辑/删除；侧边栏「大模型管理 → AI模型数据库」

## 五、验收（浏览器生产域全 PASS）
| 项 | 结果 |
|----|------|
| 首页五段式布局（头/榜/比/市/势） | ✅ |
| 排行榜三榜真实数据（性价比 Qwen3.7 Flash 93.2 居首） | ✅ |
| 对比表增删模型（3→4） | ✅ |
| 模型市场 40 卡 + 图片分类过滤（4 卡正确） | ✅ |
| 搜索 Kimi → 过滤正确 | ✅ |
| 价格修复：¥20/¥100/$0.14/$5/$30 精确显示 | ✅ |
| 详情页：雷达图/场景/验证三要素(2026-08-02)/价格历史/同厂商 | ✅ |
| 价格待验证 9 个不展示数字 | ✅ |
| 后台模型数据库（统计卡/表格/验证按钮） | ✅ |
| 亮暗自适应 | ✅ |

截图：docs/reality/AI-CENTER-06-{home,detail,admin,light}.png
提交：`（见 git log）`

## 修复的 05 遗留 Bug
1. **fmtPrice 尾零正则砍整数**：¥20→¥2、¥100→¥1（所有以 0 结尾的价格全错）→ 只去小数尾零
2. **日期 UTC 显示**：lastVerifiedAt 显示 08-01 实为 08-02 → 本地时区格式化

## 冻结清单（持续）
❌ 展示未验证价格 ❌ 保存用户 Key ❌ 代理/浏览器容器 ❌ 自动选模型/调度/编排
⏸ 图片/视频/语音 9 模型价格待运营验证（订阅制/按量，需商务确认后标记已验证）
⏸ 价格趋势线（PriceHistory 积累足够数据点后自动成图）

## 路线
05 厂商级性价比中心 → **06 模型粒度可信数据库**（AIProvider/AIModel 分离 + 真实价格 + 验证留痕 + 专业 Marketplace UI）
> AI中心 = AI 时代的「显卡性能榜 + 云服务价格中心 + API 管理台」，数据可信、价格可追溯

---

# 修正版对齐补丁（掌柜技术总监级修正，2026-08-02）

## 掌柜修正核心
> 不要直接大规模重构数据库和页面。先建立 AIModel 数据层，再逐步迁移展示。
> 禁止一次性删除 AIProviderDirectory；禁止破坏 API接入/BYOK/余额查询/推荐评分。

## 执行方式：增量对齐（零删除、零破坏）
基础架构（Provider/Model 分离）已在 378ceab0 落地。本轮按掌柜修正版 schema 做**对齐补丁**：

### 数据层增量（ALTER TABLE 只加列，不删任何现有结构）
| 新列 | 用途 | 回填 |
|------|------|------|
| officialPricingUrl | 官方定价页（三链接之一） | ← dataSource（40/40） |
| pricingUnit | 计价单位（/1M tokens） | 默认值（40/40） |
| costScore | 独立成本评分 0-100 | ← capabilityScore.cost（40/40） |
| verificationSource | 价格来源类型（官方公开价格/待验证） | ← dataStatus 推导（40/40） |

> 运维注意：prisma migrate shadow DB 历史链断裂（20260531_add_event_ledger_fields 在 shadow 上失败）+ ai_provider.id 类型漂移 → 改用原生 ALTER 加列，schema.prisma 与 DB 已一致。后续迁移需先修复 shadow DB 历史链（非本 Sprint 范围）。

### 性价比公式（掌柜指定：能力60% + 价格40%）
```
valueScore = round(能力均分 × 0.6 + 价格评分 × 0.4)
- 能力均分 = quality/speed/chinese/coding/reasoning 均值（排除 cost 防双重计费）
- 价格评分 = 对数归一化（输入+输出合计；CNY/7.2 折算 USD；全库 min→max 映射 100→0）
- 验证：Qwen3.7 Flash 93 = 87.8×0.6 + 100×0.4 ✅
```
- 后端 leaderboards 公式化（返回 formula 标注 + ability/priceScore 明细）
- 前端卡片/对比表/详情同公式（前端独立实现，与后端一致）

### 前端对齐（掌柜单卡示例逐项落实）
- 市场卡片补「📚 官方公开价格 · 2026-08」更新时间行
- 排行榜标题标注「性价比 = 能力 60% + 价格 40%（币种归一 USD）」
- 详情页 8 项补齐：模型介绍/雷达图/价格/官方来源（三链接+来源类型）/适用场景/API注册/充值/**余额查询（BYOK 弹窗，复用 /api/ai/center/balance-query，Key 不落库）**
- 后台模型管理：编辑表单加官方定价/API/文档三链接 + 定价单位 + 成本评分 + 验证来源类型

### 回归验收（不破坏清单全过）
| 项 | 结果 |
|----|------|
| balance-query 接口（BYOK 余额查询） | ✅ 活着；假 key → 官方 401 → 前端错误提示（真实链路） |
| recommend 接口（推荐评分） | ✅ 活着 |
| 旧厂商级详情页 /ai-center/deepseek（含余额查询） | ✅ 仍可访问 |
| AIProviderDirectory 表 | ✅ 未删未动 |
| BYOK / Runtime | ✅ 零改动 |
| 40 模型价格验证记录 | ✅ 快照留痕完整 |

截图：docs/reality/AI-CENTER-06-fix-{home,detail,balance}.png
提交：`（见 git log）`

---

# 掌柜增量指令二（2026-08-02）：人民币计价 + 返回首页按钮

## 掌柜指令
> AI 的计价单位用人民币；AI 中心顶部需要增加返回首页按钮。

## 交付
1. **计价单位统一人民币（展示层按 7.2 折算，数据权威保留 USD 不破坏）**
   - fmtPrice 统一改造：USD×7.2 → ¥，人民币习惯 2 位小数去尾零（¥36.00 → ¥36）
   - 覆盖：市场卡片 / 排行榜价格列 / 对比表（单位标 ¥/1M tokens）/ 价格趋势 / 历史价格 / 详情页价格区
   - 详情页规格「计价」行：`¥ 人民币 / 1M tokens`
   - 排行榜标注：「统一人民币计价，USD×7.2 折算」
   - 订阅制模型（Runway $12-$76 → ¥86-¥547 / Midjourney $10-$120 → ¥72-¥864）：ai_model_directory.dataSource + ai_model_price_history.dataSource + seed 脚本三处同步
2. **AI 中心顶部「← 返回首页」按钮**（NuxtLink /，浅色/深色主题 hover 态），点击回首页 ✅

## 验收（生产域浏览器实测）
- AI中心：返回首页按钮 ✅ / ¥0.22·¥0.94（Qwen 输入输出）✅ / 全页无 $ 残留 ✅ / 订阅 ¥86-¥547 ✅ / note 标注 ✅
- 详情页：¥1.01（DeepSeek）✅ / ¥ 人民币 / 1M tokens ✅ / 订阅 ¥ ✅ / 无 $ 残留 ✅
- 返回首页按钮点击 → 跳转首页 ✅

提交：`（见 git log）`
