# Sprint-AI-CENTER-03 模型价格/余额/性价比中心（掌柜修正版）— COMPLETE ✅

**Date:** 2026-08-02 00:20
**Gate:** 掌柜战略纠偏（2026-08-01 23:13）：
> AI中心 = 全球 AI 模型消费决策中心，不是 AI 编排中心。用户来 AI中心只解决三件事：
> ① 哪个 AI 适合我？② 多少钱？③ 我的钱还剩多少？
> 像「京东模型商城 + GPU价格中心 + API管理台」

## 暂停清单（掌柜指令，全冻结）
❌ AI团队调度 ❌ Hermes自动选模型 ❌ 跨工作台推荐 ❌ 自动编排 ❌ 复杂Agent模型策略
- 02C「AI员工建议」暂停扩展（保留员工卡片静态展示）
- 03A「团队协作建议」区块加 **⏸ 已暂停扩展** 标记（观察层保留展示，03B/03C 不再推进）
- 原因（掌柜）：增加复杂度/消耗资源/增加 Token 成本/偏离用户真实需求

## 修正路线
01 全球AI入口 ✅ → 02A 能力评分 ✅ → 02B 场景推荐 ✅ → 02C 员工建议（暂停扩展）→ **03 价格/余额/性价比中心 ✅**

## T01 后台扩展（AiProviderDirectory +4 字段）
| 字段 | 说明 |
|------|------|
| pricingInfo Json | { inputPrice, outputPrice, currency } 元/百万 tokens（参考价，运营维护） |
| costScore Int | 价格优势分 0-100（运营维护） |
| officialBalanceApi String | 官方余额查询接口完整 URL（空=暂不支持） |
| supportedModels Json | 支持模型列表 |

seed 13 家厂商全填充（deepseek ¥2/8·90分、火山 ¥0.8/2·95分、kimi ¥4/16·72分、openai ¥18/72·35分、anthropic ¥22/108·28分…）
余额接口已接：DeepSeek / OpenAI / Moonshot（3 家）；其余暂不支持（诚实显示「可在官方控制台查看」）

## T02 性价比排行 API（纯计算，无 AI 零 Token）
`GET /api/ai/center/rankings`
- 公式：**性价比 = 能力综合×60% + 价格优势×40%**（响应带公式声明）
- 实测榜：🥇 DeepSeek 90.5（能力90.8×0.6+价格90×0.4）→ 🥈 火山方舟 89.6 → 🥉 阿里百炼 83.5 → 美团龙猫 82.7 → 智谱 81.9 → Kimi 79.8 …

## T03 我的AI余额（BYOK 即时查询，Key 不落库）
`POST /api/ai/center/balance-query { provider, apiKey }`
- 流程：用户 Key → 昆仑镜即时请求官方余额接口 → 返回官方余额/已用 → **不落库、不打日志、10s 超时、内存即弃**
- 实测：参数校验 400 ✅ / 暂不支持厂商（智谱）✅ / 无效 Key → 官方 401 透传 ✅
- 成功路径解析已实现（DeepSeek balance_infos、Moonshot data.available_balance、OpenAI total_available），待真实 Key 验收（企业演示 Key 为 sk-tes 假 Key，诚实标注）

## T04 前端三模块（AI中心）
1. **🔥 模型卡片升级**：💰性价比指数徽标 + 💴输入/输出价格（参考价）+ 支持模型标签 + 已配置/未连接状态
2. **💰 性价比排行**：🥇🥈🥉领奖台（前3大卡）+ 完整榜单进度条 + 公式标注
3. **🔑 我的AI余额**：厂商选择（仅列出有官方余额接口的）+ Key 输入（password 框）+ 查询按钮 + 官方余额大字展示 + BYOK 声明「Key 仅本次使用，不保存」

## 验收（浏览器生产域实测全 PASS）
性价比排行/公式/金银铜/我的AI余额/BYOK声明/卡片价格/模型标签/查询按钮 ✅ 无效Key→401提示 ✅
截图：docs/reality/AI-CENTER-03-{top,balance}.png

## 技术备注
- 表名 `ai_provider_directory`（有 @@map），db push 仍被历史 drift 挡 → 手工 SQL ALTER ADD COLUMN
- ProviderCredential 中演示 Key 为 sk-tes 假 Key → 余额成功路径待真实 Key 再验收（诚实原则）

提交：`（见 git log）`
