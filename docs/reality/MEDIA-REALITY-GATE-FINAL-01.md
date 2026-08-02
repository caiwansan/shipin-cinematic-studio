# SPRINT-MEDIA-REALITY-GATE-FINAL-01 — AI 员工第一台数字电脑 Reality Gate 收口

**Date:** 2026-08-03 04:35
**Gate:** 掌柜战略指令（不扩平台、不做发布、不做自动运营；只完成抖音黄金样板：登录一次→永久恢复→读取真实数据→生成真实分析→老板看到真实状态；通过后复制到快手/小红书/视频号）

## 当前版本定位（掌柜定义，已锁定）
> **AI 员工已经拥有数字电脑，并具备进入真实账号工作的基础能力** —— 不是「AI 员工已经运营账号」

架构（掌柜验收正确）：企业 → AI员工 Alice → BrowserWorkspace → 真实 Chrome Profile → 新媒体账号 → 读取数据 → AI 分析
账号资产模型（长期遵守）：ChannelAccount=身份资产 → BrowserWorkspace=数字电脑 → 多个 AI 员工按权限使用（员工不拥有电脑，员工使用公司的电脑）

---

## Task01 — 抖音 G6 真人闭环 ⏸ 待掌柜人工
验收链：connect → 扫码 → 身份验证 → creator workspace → accountName 写入 → externalAccountId 写入 → BrowserWorkspace READY → 刷新网页 → Owner View 显示
等待掌柜真机扫码后全链路验证（数据 fresh + available + AI 分析分支自然走通）

## Task02 — 服务器重启恢复 ✅ 验证通过
- 实测：pm2 restart api-server → BrowserWorkspaceRecoveryService 启动扫描 3 个 workspace
- 南坡万：**快照验证 fresh（12h TTL 内，不启动浏览器）→ 保持 CONNECTED**（fast 路径）
- 快手/视频号（EXPIRED）→ 诚实跳过，不误报
- 恢复后 owner-view：workspace READY + account CONNECTED + identity verified ✅
- 日志证据：`[BrowserWorkspaceRecovery] ✅ 完成：扫描 3 / 保持连接 1 / 降级 0 / 跳过 2 / 失败 0`
- 完整「登录→重启→恢复」探针路径需 G6 真机登录后终验

## Task03 — 历史假数据清理 ✅（原则：真实 或 不存在）
### 审计发现
| 类型 | 位置 | 处理 |
|------|------|------|
| demo-token 后门 | backend/src/routes/media-platform.ts（Bearer demo-token → 注入 demo 组织） | ✅ 移除，401 |
| 模拟授权路由 | backend/src/routes/channels.ts（fakeToken + simulated:true「已连接（模拟授权）」） | ✅ 下线 → 410（改名 _deprecated-channels-mock-auth.ts） |
| demo-token 降级 | 前端 media-department/settings.vue + settings/channels.vue | ✅ 清除 |
| 假身份账号 | 0d91d712「Reality Test 抖音号」CONNECTED + reality-test-001（最严重：模拟成功） | ✅ 删除 |
| 假身份账号 | 752abe3d「PhaseA 真实连接测试号」phase-a-1785626358067 | ✅ 删除 |
| 测试残留 | bb872c1f xiaohongshu WAITING_LOGIN | ✅ 删除 |
| 无身份种子 | 26 个 PENDING 平台占位账号（weibo/toutiao/bilibili/wechat_* 等） | ✅ 删除 |
| 无身份 workspace | 71641df4(wecom) / 0bc2bd64(bilibili) | ✅ 删除 |
| 脏操作日志 | channelOperationLog type=undefined | 保留（真实读取失败记录，诚实） |

### 清理后 DB（纯净）
- 3 个真实账号：南坡万(douyin CONNECTED 88130666815) / 骏霄数字科技(kuaishou EXPIRED) / 郑州骏霄数字科技有限公司(视频号 EXPIRED)
- 3 个真实 workspace（对应账号，profile 路径真实）
- 1 个绑定（Alice → 南坡万）
- 4 条 unavailable 指标快照（真实读取尝试失败记录，非假数据）
- 20 条验证会话（真实扫码历史 AUTH_SUCCESS）
- **全库 8 表扫描 0 模拟标记** ✅
- 备份：data/backups/reality-gate-final-01/fake-data-removal-backup.sql（可回滚）

## Task04 — Owner View 真实化 ✅（老板语言三态）
- 状态从技术态 → **老板三态**：🟢 在线 / ⚪ 等待授权 / 🟡 需要重新登录 / 🔴 账号保护中 / ⚫ 电脑离线
- 状态点颜色语义化：绿(working) / 黄(expired) / 红(attention/error) / 灰(offline)
- 最近动作：无真实记录 → **「暂无真实动作记录」**（不再显示「等待任务」暗示任务存在）
- 数据更新时间：unavailable 时显示「最近尝试 <相对时间>」（诚实展示采集尝试）
- 已有（前置 Sprint）：真实指标（无数据不显示 0）/ AI 判断置信度徽章 / 账号健康 + 人工恢复

---

## Reality Gate 汇总
| Gate | 覆盖 | 结果 |
|------|------|------|
| REALITY-GATE-FINAL-01（Task02/03/04） | C1-C5 假数据 / V1-V5 三态 / R1-R4 重启恢复 | 18/18 ✅ |
| AI-EMPLOYEE-01 Task01 | Health Guard 状态机/熔断/人工恢复 | 30/30 ✅ |
| AI-EMPLOYEE-01 Task02+03 | 权限/真实读取/诚实性/置信度 | 32/32 ✅ |
| AI-EMPLOYEE-01 Task04 | Owner View 字段/健康联动/构建 | 21/21 ✅ |

脚本：scripts/reality-check-reality-gate-final-01.ts

## 冻结清单（持续）
❌ 微信/淘宝真实接入 ❌ 渠道 API ❌ 商品/订单表 ❌ 假经营指标 ❌ 新平台扩展 ❌ 自动发布 ❌ 自动运营
⏸ Task01 G6 真机扫码（掌柜人工）→ 登录→重启→恢复→读数据→AI分析 终验
⏸ 安全项（明文 Key / IDOR）单独进 Security Sprint

## 下一步
掌柜真机扫码抖音 → 验证完整闭环 → 通过后复制到快手/小红书/视频号
