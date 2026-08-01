# Sprint-AI-CENTER-04 AI模型商业入口完善 — COMPLETE ✅

**Date:** 2026-08-02 00:50
**Gate:** 掌柜指令（AI-CENTER-03 验收后）：「AI中心从模型展示页升级为 AI模型商城入口」——只做三个小模块，不扩大战线

## 掌柜战略确认
> AI中心 = 全球 AI 模型消费决策中心（稳定定位）
> 03 交付评价：性价比公式正确（60/40 合理，暂不扩展企业/个人分权重）；余额查询守住 BYOK 红线；价格中心有商业价值
> 未来用户看到「¥2/¥8 · 性价比 90.5 · 余额 ¥36」→ 自然产生「我要充值」

## 交付三模块

### 04A 官方充值入口 ✅
- 卡片「💳 官方充值」按钮（amber 渐变强化视觉）
- **不代付**：点击 → Mini Browser 内嵌打开官方充值页；厂商拒 iframe（DeepSeek 等 external_fallback）→ 新窗口官方充值页
- 实测：DeepSeek → 新窗口 `platform.deepseek.com/top_up` ✅
- billingUrl 字段复用（已有，无需新表）

### 04B 运营价格后台 ✅
- `AiProviderDirectory.pricingUpdatedAt DateTime?`：价格更新时间（保存自动刷新 = 维护时点，前台显示「更新 2026-08-01」增加可信度）
- 后台 /admin/ai-center/providers 编辑弹窗新增「💴 价格运营」区：
  - 输入价 / 输出价（¥/百万 tokens）
  - 价格优势分 0-100（性价比公式输入）
  - 价格更新时间（只读，保存自动刷新）
  - 支持模型（逗号分隔编辑）
- admin PUT 端点补 pricingInfo/costScore/supportedModels/pricingUpdatedAt/recommendTag

### 04C 模型卡片运营位 ✅
- `AiProviderDirectory.recommendTag String`：后台下拉维护（无算法）
- 预置 4 标签：🔥 新用户推荐 / 💰 最省钱 / 🚀 最强推理 / 🇨🇳 中文最佳
- seed 初值：DeepSeek🔥新用户推荐 · OpenAI🚀最强推理 · Volcengine💰最省钱 · Moonshot🇨🇳中文最佳
- 前台卡片名称旁橙色渐变徽标显示

## 冻结清单（继续遵守）
❌ 自动切模型 ❌ AI调度 ❌ Agent编排 ❌ Token预测消耗 ❌ 自动充值 ❌ 代理采购模型额度

## 验收（浏览器生产域实测全 PASS）
| 项 | 结果 |
|----|------|
| 前台：官方充值按钮 | ✅ |
| 前台：价格更新 2026-08-01 | ✅ |
| 前台：4 个运营标签显示 | ✅ |
| 充值行为：DeepSeek → platform.deepseek.com/top_up 新窗口 | ✅ |
| 后台：价格运营区（输入/输出/价格分/更新时间） | ✅ |
| 后台：运营标签下拉 4 选项 | ✅ |
| 后台：支持模型编辑 | ✅ |

截图：docs/reality/AI-CENTER-04-{cards,recharge,admin}.png
技术备注：ai_provider_directory 表列名为 camelCase（ALTER 用 snake_case 建错列 → RENAME 修正）；新字段需 prisma generate + api-server 重启

## 路线
```
AI-CENTER-01 全球入口 ✅ → 02A 能力评分 ✅ → 02B 场景推荐 ✅ → 02C ⏸
→ 03 消费决策中心 ✅ → 04 商业入口完善 ✅（官方充值/价格后台/标签运营）
```
AI中心 = 模型商城入口，与昆仑镜商业化（VIP/AI员工/企业订阅）匹配。
