# Sprint-AI-CENTER-02A AI模型能力评分系统（字段 + 后台维护）— COMPLETE ✅

**Date:** 2026-08-01 22:50
**Gate:** 掌柜指令（02A 只做评分字段 + 后台维护，不接推荐；小步快跑，为 02B Workspace 推荐打数据基础）

## 交付边界（严格按指令）
- ✅ `capabilityScore` 六维字段 + 13 家初始评分 + 后台维护 UI
- ❌ 不接推荐 API / Workspace 推荐 / 前台卡片升级（02B 再做）

## Schema 扩展（ai_provider_directory +1 字段 = 27 字段）
```sql
capabilityScore JSONB  -- { cost, speed, quality, chinese, coding, reasoning } 0-100
```
- migrate 走 SQL 直加（migrate dev / db push 均被历史 drift 阻塞：agent_execution.executionId 缺失 + ai_provider.id 类型漂移——无关本次变更，不触碰）
- Prisma client 已 generate，读写正常

## 六维评分定义（0-100，高分=优；cost=成本优势）
| 维度 | 含义 |
|------|------|
| cost | 成本优势（越高越便宜） |
| speed | 响应速度 |
| quality | 生成质量 |
| chinese | 中文能力 |
| coding | 代码能力 |
| reasoning | 推理能力 |

## 13 家初始评分（运营维护，基于公开基准/定价/社区反馈，后台可调）
| 供应商 | cost | speed | quality | chinese | coding | reasoning | 综合 |
|--------|-----|-------|---------|---------|--------|-----------|------|
| DeepSeek | 95 | 85 | 88 | 95 | 90 | 92 | **91** |
| 智谱 GLM | 88 | 82 | 85 | 93 | 85 | 86 | 87 |
| 火山方舟 | 90 | 88 | 84 | 92 | 80 | 82 | 86 |
| 阿里百炼 | 85 | 82 | 85 | 93 | 86 | 84 | 86 |
| Kimi | 80 | 76 | 87 | 94 | 85 | 88 | 85 |
| 腾讯混元 | 84 | 80 | 82 | 90 | 78 | 80 | 82 |
| 文心一言 | 82 | 78 | 82 | 92 | 76 | 80 | 82 |
| 讯飞星火 | 83 | 80 | 80 | 90 | 74 | 78 | 81 |
| 美团龙猫 | 86 | 78 | 78 | 85 | 72 | 76 | 79 |
| OpenAI | 62 | 88 | 95 | 88 | 93 | 94 | **87** |
| Gemini | 70 | 90 | 91 | 82 | 90 | 90 | 86 |
| Claude | 68 | 82 | 94 | 84 | 94 | 95 | **86** |
| Meta Llama(停用) | 75 | 80 | 82 | 70 | 84 | 82 | 79 |

## API
- GET /api/ai-provider-directory → 自动带 capabilityScore（前端 02B 消费）
- POST/PUT /api/admin/ai-provider-directory → `sanitizeCapabilityScore()` 清洗：仅保留六维、数值钳制 0-100、非法输入丢弃

## 后台（/admin/ai-center/providers「AI供应商管理」）
- 表格新增「能力评分」列：星级（综合分/20）+ 综合分进度条 + 六维明细一行
- 编辑弹窗新增「⭐ AI能力评分」区：六维滑块（range 0-100）+ 实时综合分
- seed 文件同步 13 家评分（幂等）

## 浏览器验收（生产域全 PASS）
1. 列表评分列（星级 + 综合分 + 六维明细）✅
2. 编辑弹窗六维滑块 ×6 + 综合分实时 ✅
3. 修改 deepseek 推理 92→90 保存 ✅
4. API 新值生效（reasoning: 90）✅ —— 后台维护 → DB → API 全链路闭环

截图：docs/reality/AI-CENTER-02A-{01-admin-list,02-admin-dialog}.png

## 遗留
⏸ 02B：/api/ai/recommendations Workspace 推荐（读 capabilityScore + 场景权重）
⏸ 02C：AI员工最佳模型组合推荐（Hermes）

提交：`（见 git log）`
