# Sprint-AI-CENTER-01 昆仑镜 AI中心（AI Center）— COMPLETE ✅

**Date:** 2026-08-01 22:15
**Gate:** 掌柜战略定义（AI中心 = 昆仑镜 AI 生态入口层，取代「大模型注册」定位）

## 产品定位
> 在昆仑镜内部，通过 AI迷你浏览器访问全球主流 AI 官方服务，用户使用自己的官方账号完成注册、登录、充值、聊天；昆仑镜提供统一入口和 AI 工作空间体验。

首页导航：**商城 | 社区 | AI中心 | 更多项目**（AI中心 = 全球AI入口层）

## 三大区域（/ai-center）
| 区域 | 内容 |
|------|------|
| 🖥️ AI浏览器 | 热门 AI 大卡（DeepSeek/OpenAI）+ 全部可浏览器打开的服务；点击 → MiniAIBrowser 在昆仑镜内打开官方页面 |
| 🔌 API模型接入 | 全部 AI 网格（官方注册 → 获取 API Key → BYOK 配置 → 充值/教程），connected 状态真实检测 |
| 🔐 我的模型配置 | 登录用户 UserModelConfigV2 已配能力徽章（llm/image/video/tts/music）+ 去配置（/settings/ai-models）+ BYOK 说明 |

## MiniAIBrowser.vue（新组件）
- **浏览器 UI**：返回/前进/刷新/地址栏（可编辑跳转）/新标签打开/关闭 + 站点标识 + 加载指示
- **iframe 内嵌**：sandbox 白名单（scripts/forms/popups）+ 功能权限（剪贴板/全屏/麦克风/摄像头）
- **iframe 预检**：后端探测目标站 X-Frame-Options / CSP frame-ancestors → allow/deny
  - allow/unknown → iframe 内嵌（直连第三方，不经过昆仑镜服务器）
  - deny → **诚实兜底页**：显示厂商拒绝原因 + 「在新标签页打开」+ 返回按钮（不绕过安全策略）
- **安全提示条常驻**：您正在访问第三方 AI 服务。账号、密码、余额和聊天数据由对应 AI 服务商管理，昆仑镜不会保存您的第三方账号信息。

## 实测：12 家厂商 iframe 支持矩阵（真实探测）
| 状态 | 厂商 |
|------|------|
| ✅ 支持内嵌 | Kimi / 智谱GLM(chatglm) / 文心一言 / 讯飞星火 / 火山方舟 / 腾讯混元 / 阿里百炼（无 frame 限制头） |
| ❌ 拒绝内嵌（兜底） | DeepSeek 聊天（CSP frame-ancestors 'none'）/ Claude（'self'）/ ChatGPT / Gemini（安全策略禁止） |

> 拒绝内嵌是厂商浏览器安全策略，无法也不应绕过（绕过即违反安全边界）。兜底页保持昆仑镜 UI 不跳走。

## 数据模型（ai_provider_directory 升级，23 字段）
新增：`loginUrl`（AI浏览器打开目标）/ `browserEnabled`（支持浏览器打开）/ `apiEnabled`（提供 API）
其余保留：officialWebsite/registerUrl/billingUrl/documentationUrl/affiliateUrl/affiliateEnabled/affiliateDescription/recommended/sort/status/tags/category/country
- Seed 更新：**首批 12 家激活**（国产 9：DeepSeek/GLM/火山/百炼/Kimi/混元/文心/星火/龙猫；海外 3：OpenAI/Gemini/Claude），Meta Llama 停用保留

## API
| 端点 | 说明 |
|------|------|
| GET /api/ai-center/iframe-check?url= | iframe 预检；**SSRF 白名单**：仅允许已收录供应商域名（403 拒绝外部域名）；10min 缓存 |
| GET /api/ai-provider-directory | 公开列表（connected + 新字段） |
| /api/admin/ai-provider-directory* | admin CRUD（新字段支持） |

## 后台（/admin/ai-center/providers「AI供应商管理」）
- 侧边栏「大模型管理 → AI供应商管理」
- 表格加「能力」列（🖥️ 浏览器 / 🔌 API）
- 编辑弹窗：AI浏览器打开地址（loginUrl）+ 能力开关（browserEnabled/apiEnabled）+ 推广链接区
- 旧路由 /admin/ai-providers 重定向

## 安全边界（冻结核对）
- ✅ 不保存第三方账号密码 / 不保存第三方 Cookie 到服务器（iframe 直连，登录态在用户本地浏览器）
- ✅ 不代理用户聊天内容（页面不经昆仑镜服务器）
- ✅ 不托管第三方账号
- ✅ SSRF 白名单（iframe 预检仅限收录域名）
- ✅ 前台目录 API 未登录可读、admin API requireAdmin

## 浏览器验证（生产域全 PASS）
| 项 | 结果 |
|----|------|
| 首页导航「AI中心」 | ✅ |
| /ai-center 三区域 + 热门卡（DeepSeek/OpenAI）+ 搜索/Tab | ✅ |
| MiniAIBrowser 打开 Kimi | ✅ iframe 内嵌 + 安全提示条 |
| MiniAIBrowser 打开 DeepSeek | ✅ 诚实兜底（拒绝原因 + 新标签按钮 + iframe=0） |
| /models/providers 重定向 | ✅ → /ai-center |
| 后台 13 行 + 编辑弹窗新字段 | ✅ |
| iframe 预检 allow/deny/SSRF 403 | ✅ |
| 目录 API 12 家激活 + 新字段 | ✅ |

截图：`docs/reality/AI-CENTER-01-{nav,page,mini-browser-kimi,mini-browser-deepseek-deny,admin}.png`

## 遗留（非本次阻塞）
- ⏸ 模型评分（成本/速度/质量/场景）与 Workspace AI 推荐实装（预留 UI 就位）
- ⏸ Provider Logo 图源接入
- ⏸ route-guard.ts 为死 middleware（未激活），已加 /ai-center 前缀防御

提交：`（见 git log）`
