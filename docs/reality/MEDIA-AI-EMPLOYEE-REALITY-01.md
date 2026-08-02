# SPRINT-MEDIA-AI-EMPLOYEE-REALITY-01 — AI 员工真实工作闭环 — COMPLETE ✅

**Date:** 2026-08-03 04:45
**Gate:** 掌柜战略指令（MatrixFlow 学习后：批准 FailureCoordinator→Channel Health Guard、暂缓 MCP、AI 置信度进下一阶段；目标 = 让 Alice 真正读取账号，不是发布）

## 掌柜蓝图链路（已打通）
```
Alice (7e0b486f)
  → BrowserWorkspace（数字电脑 b27a2e1e）
  → 已登录抖音电脑（持久化 profile）
  → 读取：粉丝/播放/点赞/作品（真实提取器）
  → ChannelMetricSnapshot（持久化）
  → 运营报告（AI 判断 + 置信度）
  → Owner View 展示（老板视角）
```
禁止红线未破：❌ 自动发布 ❌ 自动评论 ❌ 自动私信 ❌ 涨粉机器人

## 架构分层（掌柜验收确认）
```
ChannelAccount   → 身份资产（是谁）
BrowserWorkspace → 数字电脑（在哪里工作）
ChannelRuntime   → 执行能力（怎么操作）
AI Employee      → 谁使用这台电脑完成任务
```

## Task01 — Channel Health Guard（吸收 MatrixFlow FailureCoordinator）✅
- 新表 `channel_health_state`：HEALTHY / DEGRADED / NEEDS_ATTENTION + 30min 滑动窗口 + 失败计数 + 致命信号 + 暂停记录
- 服务 `channel-health-guard.service.ts`：recordFailure / recordSuccess / assertHealthy / recover / listAttention
- **掌柜语义**：不是防任务失败，是保护企业账号资产健康；失败不重试，先保护；恢复必须人工
- 致命信号（一次即保护）：验证码/安全验证/风控/封禁/平台错误/验证失败/账号异常/操作频繁
- 登录失效类**不算致命**（防死锁：失效→暂停→扫码恢复后仍需人工解绑；连续 3 次仍无法读取→阈值熔断）
- 触发 NEEDS_ATTENTION → 自动暂停 AgentChannelBinding（AI 员工对该账号一切操作被权限层拒绝）
- 挂接：collectForAgent 执行前守卫 + unavailable 失败上报 + available 成功恢复
- 路由：GET /channels/:id/health · GET /channels/health/attention · POST record-failure/record-success/recover
- **Owner View 联动**：被保护（paused 绑定）账号仍展示（workerStatus=attention「账号保护中」）+ 老板「人工确认恢复」按钮

## Task02 — 真实 Metrics Reality Gate ✅
- 链路已存在（前置 Sprint 提取器），本次验收真实跑通：Alice → 浏览器（DISPLAY=:99）→ 抖音数据概览 → 提取 → 快照落库
- 实测：数据中心 IP 登录态失效 → **诚实 unavailable + reason（工作台特征缺失 1/2）+ 指标全 null（绝不返回 0）**
- 权限三连：未绑定 403 / 无 read 权限 403 / 无数字电脑 403 / 业务域不匹配 403
- 追溯链完整：snapshot 含 workspaceId/agentId/source/rawData

## Task03 — AI 分析置信度系统（Analysis Confidence）✅
- 四级：**strong**（30天+ 且 作品≥10 且 核心指标完整）/ **medium**（7天+）/ **weak**（有数据<7天）/ **warning**（无数据/异常）
- `computeAnalysisConfidence` 纯函数 + 边界防虚报（30 天但作品 <10 → 不标 strong）
- **规则兜底**（MatrixFlow ruleBased 思想）：LLM 挂 → 可解释规则建议（掉粉/低互动/作品少/粉丝少），不阻塞、不编造
- analyze 返回 confidence + analysisSource(llm/rules) + executeRequired=false（只读红线，两个分支一致）
- 无数据 → unavailable + warning + analysis null（绝不编造结论）

## Task04 — Owner View 产品化 ✅
老板最终看到的卡片：
```
Alice（新媒体运营部门）
🖥 工作电脑: 抖音运营空间
账号身份: 南坡万（ID 88130666815）
状态: 🟢 工作中 / 🔴 账号保护中
今日状态: 粉丝 5,000 · 作品 15 · 近7天播放 · 互动率（真实快照，无数据不显示 0）
AI 判断: 【AI 判断 · 高置信】粉丝 5,000 · 作品 15 个 · …（置信度徽章 + 摘要）
账号健康: 🔴 需要关注 + 原因 + [✓ 人工确认恢复]
```

## Reality Gate 全绿（83 断言）
| Gate | 覆盖 | 结果 |
|------|------|------|
| Task01 H1-H7 | 状态机/致命信号/熔断/守卫/人工恢复/API | 30/30 ✅ |
| Task02+03 G1-G7+C1-C5 | 权限/真实读取/诚实性/置信度/规则兜底/只读红线 | 32/32 ✅ |
| Task04 V1-V6 | 字段完整/健康透传/置信度联动/前端构建 | 21/21 ✅ |

脚本：scripts/reality-check-ai-employee-reality-01-{task01,task02-03,task04}.ts

## 关键设计决策
1. **登录失效 ≠ 致命信号**：常态失效走连接状态机降级（EXPIRED/NEEDS_REAUTH），避免保护死锁；危险信号（验证码/风控/封禁）一次即保护
2. **保护必须可见**：NEEDS_ATTENTION 暂停绑定后，owner-view 必须仍展示（老板要看到「需要关注」），普通 paused 隐藏
3. **置信度不虚报**：数据不足 → weak/warning 如实展示，AI 不编造「趋势明显」
4. **owner-view 零 LLM 成本**：AI 判断用置信度纯函数 + 规则摘要；完整 LLM 分析走 POST /metrics/analyze 单独触发

## 冻结清单（持续）
❌ 微信/淘宝真实接入 ❌ 渠道 API ❌ 商品/订单表 ❌ 假经营指标 ❌ 新平台扩展 ❌ 自动发布
⏸ MCP Server 只读版（掌柜：等 G6 Reality Gate PASS + metrics 真实读取 + AI 分析闭环后）
⏸ 安全项（明文 Key / demo-token）单独进 Security Sprint
⏸ G6 真机扫码（抖音/快手/小红书/视频号）待掌柜人工验收 → 登录后 metrics available 快照 + LLM 分析分支自然走通

## 下一步（掌柜路线）
完成第一个「AI 员工真实工作闭环」：G6 真机登录 → available 指标 → LLM 运营分析（strong/medium）→ 老板查看 → 人工确认执行（发布仍冻结）
