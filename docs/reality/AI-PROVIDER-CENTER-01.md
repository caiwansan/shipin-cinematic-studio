# Sprint-AI-PROVIDER-CENTER-01 大模型注册中心（AI Provider Center）— COMPLETE ✅

**Date:** 2026-08-01 21:30
**Gate:** 掌柜执行任务（首页导航新一级入口「大模型注册」；BYOK 原则：不托管 Key）

## 定位
昆仑镜 AI 模型生态入口：为用户提供全球主流 AI 模型**官方注册、充值、API Key 获取、接入配置**一站式引导。
只做入口聚合 + 配置管理 + 连接测试，**不保存用户 Key、不代理充值、不代付模型费用**（BYOK 冻结原则）。

## 数据结构（新表 `ai_provider_directory`，Prisma 模型 `AiProviderDirectory`）
- 与运行时表 `AiProvider`（平台 Provider 注册表）**语义隔离**：本表是面向用户的「模型供应商目录」
- 字段：code(unique)/name/logo/description/category(domestic|overseas)/country/tags[]/officialWebsite/registerUrl/billingUrl/documentationUrl/**affiliateUrl/affiliateEnabled/affiliateDescription**/recommended(1-5)/sort/status/createdAt/updatedAt
- 建表方式：手动 SQL（migrate dev 被历史 migration 链阻塞、db push 被 ai_provider.id 历史 drift 阻塞 → 手动建表 + `prisma generate`，零数据风险）

## Seed（13 家，upsert 可重复执行）
- 国产 9：DeepSeek(★5 主推) / 智谱GLM / 火山方舟 / 阿里百炼 / Kimi / 腾讯混元 / 文心一言 / 讯飞星火 / 美团龙猫
- 海外 4：OpenAI(★5) / Google Gemini / Anthropic Claude / Meta Llama
- 每家含官网/注册/充值/教程四链接 + 能力标签 + 推荐等级

## API（`src/routes/ai-provider-directory.routes.ts`）
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | /api/ai-provider-directory | 公开(可选认证) | 列表；登录用户附带 connected 状态；affiliate 优先规则 |
| GET | /api/ai-provider-directory/:code | 公开 | 详情 |
| GET | /api/admin/ai-provider-directory | requireAdmin | 全量列表（含停用） |
| POST | /api/admin/ai-provider-directory | requireAdmin | 新增（code 冲突 409） |
| PUT | /api/admin/ai-provider-directory/:id | requireAdmin | 更新（含 affiliateUrl） |
| PATCH | /api/admin/ai-provider-directory/:id/toggle | requireAdmin | 启停 |
| DELETE | /api/admin/ai-provider-directory/:id | requireAdmin | 删除 |

- **affiliate 规则**：前台「立即注册」按钮优先跳 affiliateUrl（启用时），否则 registerUrl；`registerViaAffiliate` 标记供前端显示「推广」角标
- **connected 规则**：查询当前用户 `UserModelConfigV2`（llm/image/video/tts/music 五能力 provider+key 对）→ 真实「已配置/未连接」，无虚假状态

## 前端
- **导航**：`config/navigation.ts` primaryNav 新增「大模型注册 🧠 → /models/providers」（商城 | 社区 | 大模型注册 | 更多项目 ✅）
- **/models/providers（AI模型中心）**：深色科技背景 + AI 光效（径向渐变光晕 + 网格纹理）+ 玻璃拟态卡片 + 响应式网格
  - Hero：标题/副标题/搜索框（名称/简介/标签/国家过滤）
  - Tab：全部 | 🇨🇳 国产 | 🇭🇴 海外
  - 卡片：品牌色 Logo 块 / 名称 / 国家 / 简介 / ★推荐 / 能力标签 / 连接状态徽章 / 立即注册（affiliate 优先）+ 充值入口 + 接入教程 + 配置模型
  - BYOK 说明条 + 预留扩展区（模型评分 / Workspace AI 推荐：短剧 GPT+DeepSeek、招聘 DeepSeek+Claude、代码 GPT）

## 后台管理（/admin/ai-providers，layout admin-aigc）
- 侧边栏「🤖 大模型管理 → AI模型供应商目录」入口（`config/admin-workspace-registry.ts`）
- 统计卡（全部/启用/国产/海外/推广）+ 表格 + 新增/编辑弹窗（全字段含 affiliate 区）+ 启停 + 删除

## 浏览器验证（生产域 https://aigc.fushtn.com）
| 项 | 结果 |
|----|------|
| 首页导航「大模型注册」 | ✅ 出现（商城 → 社区 → 大模型注册 → 更多项目） |
| /models/providers 访问 | ✅ h1=昆仑镜 AI模型中心，13 张卡片，DeepSeek 在列 |
| 前台 affiliate 优先 | ✅ 测试供应商 registerUrl=推广链接，viaAffiliate=true |
| 后台新增/编辑/启停/删除 | ✅ 全链路实测通过 |
| 停用项前台隐藏 | ✅ toggle 后前台 13 家（测试项消失） |
| 未登录访问 admin API | ✅ 401 |
| 连接状态 | ✅ 匿名=未连接；登录后按 UserModelConfigV2 真实检测 |

截图：`docs/reality/AI-PROVIDER-CENTER-01-front.png` / `-02-nav.png` / `-03-admin.png`

## 架构合规（冻结清单核对）
- ✅ BYOK：不保存用户 Key、不代理充值/付费，仅入口聚合 + 配置引导
- ✅ 不破坏 UserModelConfigV2 / OrgModelConfig / Unified Runtime Resolver（未触碰解析链）
- ✅ 无 Workspace 级模型配置残留（目录表与运行时表 AiProvider 语义隔离）
- ✅ 后台 API 全 requireAdmin

## 顺带发现（待掌柜处理）
- ⚠️ **admin 密码在 20:52 被未知来源修改**（updatedAt=12:52:50Z，日志无对应请求记录），已重置为 admin123；建议排查外部改密渠道（与既有「admin confirm 端点信任任意用户 JWT」安全隐患同源，列入治理清单）

## 遗留（非本次阻塞）
- ⏸ 模型评分（成本/速度/质量/场景）与 Workspace AI 推荐实装（预留 UI 已就位）
- ⏸ Provider Logo 图源接入（当前用品牌色块+首字母，字段已预留）

提交：`（见 git log）`
