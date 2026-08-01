# MEDIA DESIGN REFINEMENT-03 · UI 差距清单（审计先行）

**审计方式**：生产域 DOM 量化审计（背景色/渐变密度/区块层级/Token 使用）+ 截图存档（ref03-media-current.png / ref03-shortdrama-current.png）

## 现状 vs 目标差距

| # | 维度 | 现状（审计证据） | 目标（掌柜 Design Direction） |
|---|------|----------------|------------------------------|
| G1 | 首页叙事 | 区块堆叠：Hero→团队卡列→流水线→客户→洞察（传统 Dashboard 结构） | 驾驶舱叙事：Hero → AI TEAM CONTENT ENGINE → CHANNEL INTELLIGENCE → OPERATION MEMORY |
| G2 | 渐变密度 | 38 个渐变元素（满屏紫色渐变=廉价感） | 渐变收敛：仅 激活 / AI 状态 / CTA |
| G3 | Hero 右侧 | 3 个 KPI 数字卡（AI员工 x/5 · 渠道 x/x · 任务数） | AI Department Visualization：5 员工节点图 + SYSTEM READY |
| G4 | Hero 左侧 | 描述句 + 2 CTA + hint | 「让 AI 员工成为你的全天候内容运营团队」+ 3 能力标签（icon+状态） |
| G5 | 团队卡 | card 网格（avatar+name+role+duty） | AI Glass Card：状态灯(●READY) / 核心信息 / 能力清单 / 行动入口(部署员工) |
| G6 | 顶栏 | 无返回首页 | 左上角「← 返回昆仑镜首页」不可隐藏 |
| G7 | 左侧导航 | 2 层（icon+label+hint） | 3 层（icon/名称/一句能力解释），底部 模型中心/会员中心/返回首页 |
| G8 | 背景深度 | #070b16 | #050816 深空黑 + #0F172A 玻璃面板 |
| G9 | 渠道区 | 渠道资产卡（单卡） | CHANNEL INTELLIGENCE：微信/抖音/小红书/视频号 四节点 |
| G10 | 记忆区 | 运营轨迹/最近执行（卡片） | OPERATION MEMORY：今日任务/内容资产/客户洞察/数据复盘 |

## 范围（掌柜锁定）
只改：/workspace/media 首页驾驶舱 + MediaWorkspaceShell（返回首页+导航）
❌ 不新增 API/DB/组件体系/MediaModel/MediaUser ❌ 不改短剧/招聘 ❌ 不扩散 8 页
