# Sprint-MEDIA-DESIGN-LOCALIZATION-04 · 中国企业用户产品语言重构 — COMPLETE ✅

**Date:** 2026-08-02 04:20
**Gate:** 掌柜战略纠偏（DESIGN-REFINEMENT-03 解决「像 AI 产品」，本 Sprint 解决「语言是工程师视角」——从 AI Dashboard 进入「中国企业老板愿意购买的 AI 新媒体部门产品」）

## 原则（掌柜指令逐字执行）
- 删除全部用户不可理解技术词（UI 禁词 15+：AI DEPARTMENT / AI TEAM / CONTENT ENGINE / CHANNEL INTELLIGENCE / OPERATION MEMORY / SYSTEM ACTIVE / READY / LOCKED / Digital Workforce / Growth Intelligence / AI CRM / API / Webhook / Token / OAuth / SDK / appid / secret）
- 映射表：AI TEAM→我的 AI 员工 / AI DEPARTMENT→AI 新媒体部门 / CONTENT ENGINE→内容生产中心 / CHANNEL INTELLIGENCE→渠道管理中心 / OPERATION MEMORY→运营数据中心 / SYSTEM ACTIVE→运行中 / READY→待启动 / LOCKED→未解锁 / Digital Workforce→AI 员工团队 / Growth Intelligence→增长分析
- 每张卡只回答三问：这是什么 / 能帮我什么 / 下一步
- 视觉方向保持不变（深色空间感 / 玻璃卡片 / AI 氛围 / 高级感）——只换语言不换皮

## 范围（严格 5 文件，零后端）
| 文件 | 变更 |
|------|------|
| `pages/workspace/media/index.vue` | 首页 = 「我的 AI 新媒体公司总部」全面重构 |
| `pages/workspace/media/team.vue` | 员工语言：AI运营总监 + 帮你✓清单 + 解锁这个员工 |
| `pages/workspace/media/accounts.vue` | 4 平台 → 9 大平台账号中心 |
| `components/media/MediaWorkspaceShell.vue` | 导航中文化（去英文副题）+ 底部操作区 |
| `config/navigation.ts` | 首页入口描述对齐产品语言 |

不动：后端 / API / 数据库 / 模型体系 / 微信接入 / Commerce ✅

## 首页：我的 AI 新媒体公司总部
```
AI 新媒体运营中心
让 AI 员工帮你持续做好内容、运营客户、提升品牌影响力
[连接新媒体账号] [解锁 AI 员工团队]
🤖 5 名智能员工 · 📱 9 大平台 · 📊 成果自动汇总
─────────────
我的 AI 员工（5 名智能员工，等待为你工作）
Alice AI运营总监 ✓制定内容计划 ✓安排发布节奏
Bob AI内容策划 ✓发现热门内容 ✓规划每日选题
Carol AI内容制作 ✓生成文章 ✓生成图片 ✓生成视频
David AI客户管家 ✓自动回复客户咨询 ✓发现销售机会
Eve AI数据分析师 ✓分析运营效果 ✓优化运营方向
[🔓 解锁这个员工] ×5
─────────────
我的新媒体渠道（9 平台：抖音/快手/小红书/视频号/微信公众号/微博/百家号/今日头条/企业微信）
─────────────
运营情况
今日内容 / 客户咨询 / 粉丝互动 / 数据报告（等待连接账号）
```
- 数据全复用 overview（零新 API）；粉丝互动诚实 0（无渠道数据源）；数据报告未连接→「等待连接账号」
- 渠道连接状态诚实：微信公众号真实接入后点亮，其余「即将开放」点击 toast 说明（不造假连接）

## 导航（Shell）
- 首页驾驶舱 / 我的 AI 员工 / 内容生产 / 客户运营 / 账号管理 / 数据分析 / 行业机会（英文副题全删）
- 底部：模型设置 / 会员中心 / 返回昆仑镜首页
- moduleMap 同步（顶栏模块名全中文）

## 团队页
- 员工：AI 运营总监 / AI 内容策划 / AI 内容制作 / AI 客户管家 / AI 数据分析师
- 详情「💡 帮你做什么」✓ 清单 + 「⚙️ 解锁后自动工作」+ 「🔓 解锁这个员工」
- 状态全中文：运行中 / 已暂停 / 已停止 / 紧急停止 / 恢复中
- 删英文来源标注（CapabilityContract / AgentSchedule / AgentOutcome）

## 账号管理
- 9 大平台网格（icon + 名称 + 定位 + 未连接/已连接 + 动作）
- 微信真实接入保留：4 步中文流程（授权绑定 → 勾选权限 → 授权 AI 员工 → 完成连接）
- 其他 8 平台「即将开放」（诚实）；AI 权限说明（发布内容/回复客户/读取数据）

## Reality Gate · 中国用户测试（生产域实测全 PASS）
| 问 | 回答 | 状态 |
|----|------|------|
| 这是干什么的？ | 我的 AI 新媒体运营团队 | ✅ |
| 我要连接什么？ | 抖音、快手、小红书、公众号等 9 大平台 | ✅ |
| AI 帮我什么？ | 做内容、运营客户、分析数据 | ✅ |
| 下一步？ | 连接账号 / 解锁 AI 员工 | ✅ |
| 禁词扫描（首页/团队/账号 3 页） | 0 命中 | ✅ |
| 导航英文残留 | 无 | ✅ |

截图：`audit-screenshots/LOCALIZATION-04-{cockpit,team,accounts}.png`
提交：`（见 git log）`
