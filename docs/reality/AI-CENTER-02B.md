# Sprint-AI-CENTER-02B Workspace AI 推荐引擎 + 浏览器能力状态层 — COMPLETE ✅

**Date:** 2026-08-01 23:30
**Gate:** 掌柜指令（02A 验收 PASS → 02B：规则+评分权重推荐引擎；不堆复杂算法；browserMode 状态层先行）

## 战略意义（掌柜点题）
昆仑镜第一次具备「**根据任务推荐 AI 大脑**」能力。后续接 Hermes AI员工时自然演化：
AI员工角色 + 工作场景 + 模型能力评分 → 自动选择最佳 AI 大脑。这是区别于普通 AI 聚合站的核心能力。

## T00 浏览器能力状态层（browserMode）
> 不是 Bug，是浏览器安全策略。不修复成「绕过」，加状态层。

```ts
enum browserMode { iframe | external_fallback | desktop_webview | disabled }
```

| Provider | browserMode | 行为 |
|----------|------------|------|
| Kimi/智谱/文心/讯飞/火山/腾讯/阿里 | iframe | 昆仑镜内嵌（现状） |
| DeepSeek/ChatGPT/Claude/Gemini | external_fallback | 🟡 官方安全限制 → 打开官方窗口（新 tab） |
| Meta Llama | disabled | 不显示浏览器入口 |

- schema：ai_provider_directory +browserMode VARCHAR(30) default 'iframe'；admin sanitize 白名单 4 值
- AI中心前端：卡片/列表按 browserMode 分支（🟡 徽标 + 打开官方窗口按钮），Kimi 等 iframe 类不受影响
- 后台编辑弹窗：浏览器模式下拉（运营可维护）

## T01 WorkspaceAIWeight 规则表（后台预留）
- 新表 workspace_ai_weight（workspace unique / weightConfig JSONB / enabled）
- 掌柜定稿 4 组权重：job(中文35 推理30 质量20 成本15) / shortdrama(质量35 中文25 推理20 成本20) / novel(中文35 质量30 成本20 推理15) / coding(代码40 推理30 速度15 成本15)
- admin API：GET /api/admin/ai-recommendation-rules（含 default source 标注）/ PUT /:workspace（六维白名单+0-100 钳制）
- 内置默认权重常量 fallback（表空时引擎不空转）

## T02 推荐引擎（第一版：规则+权重）
```
GET /api/ai/recommendations?workspace=job|shortdrama|novel|coding
recommendScore = Σ(capabilityScore × workspaceWeight%)
```
- 只推荐 status=active + apiEnabled=true + 有 capabilityScore 的供应商
- reasons 可解释：权重 top3 维度按得分段（≥90 优秀/≥85 强/≥80 良好）+ 相对优势维度（全体排名 top3 →「中文能力领先」）
- 非法 workspace → 400；推荐不自动切换（建议层，不动 Runtime）

### 实测（生产域）
| 场景 | Top3 | 分数 |
|------|------|------|
| job 求职招聘 | DeepSeek 92.7 / Kimi 88.7 / 智谱 88.6 | 中文能力优秀·推理能力优秀 |
| shortdrama AI短剧 | DeepSeek 92 / 智谱 87.8 / Kimi 87.6 | 生成质量强·中文能力优秀 |
| novel 小说 | DeepSeek 92.5 / 智谱 88.6 / Kimi 88.2 | 中文能力优秀·成本优势优秀 |
| coding 代码开发 | DeepSeek 90.6 / Claude 88.6 / ChatGPT 87.9 | 代码能力优秀·推理能力优秀 |

（coding 场景 Claude 代码94 但成本68 → 排第二，权重效果符合预期）

## T03 招聘驾驶舱 AI 建议条（无新页面）
Carol 状态条下方：🧠 AI建议 | 当前AI配置（BYOK 真实读取）→ 🔥 最适合招聘分析 DeepSeek 92.7分 | 中文能力优秀·推理能力优秀·生成质量强 | [切换模型]→model-settings

## 验收（浏览器生产域实测全 PASS）
1. AI中心：DeepSeek 🟡 打开官方窗口（external_fallback）+ Kimi 🖥️ 内嵌共存 ✅
2. 招聘驾驶舱：建议条渲染（demo 账号真实登录态，当前AI配置=DeepSeek BYOK）✅
3. 四场景 API 推荐 + reasons 可解释 ✅
4. 非法 workspace 400 ✅
5. admin 规则 API：4 条规则 + db/default 来源标注 ✅

截图：docs/reality/AI-CENTER-02B-{01-ai-center,02-enterprise-suggest}.png

## 边界（掌柜红线全守住）
✅ 不修改 Runtime ✅ 不修改 UserModelConfigV2 ✅ 不影响现有模型调用 ✅ 不自动切换模型（只建议）

## 技术教训
- PostgreSQL 未加引号标识符折叠小写：`browserMode`→`browsermode`，Prisma 查询失败 → 建表/加列必须 `"camelCase"` 引号
- 前端登录 token 字段是 `accessToken` 非 `token`；demo 账号密码被改过，重置为 seed 的 demo123

提交：`（见 git log）`
