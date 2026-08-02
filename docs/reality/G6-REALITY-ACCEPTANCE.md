# G6 Reality Acceptance — AI 员工第一台数字电脑黄金验收脚本

**Date:** 2026-08-03
**Gate:** 掌柜战略指令（架构 Gate 已通过，G6 升级为「黄金验收脚本」——抖音 PASS 后作为快手/小红书/视频号的平台接入模板）

## 定位
> 完成第一台 AI 员工数字电脑的真人闭环证明。G6 一旦通过，昆仑镜新媒体工作台从「开发中的功能」进入「可以作为 SaaS 产品展示的 AI 员工基础设施」。

## 验收六步（冻结，所有平台通用）

### Step 1 — 登录（用户扫码）
**操作：** 用户扫码 → 完成平台验证
**验收断言（数据库 ChannelAccount）：**
- status = CONNECTED
- accountName = 真实账号名（南坡万）
- externalAccountId = 真实平台 ID（88130666815）
- identity.verifiedBy = probe（真实探针，非 fast/none）

### Step 2 — 数字电脑确认
**验收断言（BrowserWorkspace）：**
- status = READY
- profile 目录存在（/data/browser-profiles/<platform>/<accountId>）
- 与 ChannelAccount 绑定同一账号

### Step 3 — 浏览器关闭恢复
**操作：** 关闭浏览器（kill profile 进程）→ 重新启动
**验收断言：**
- same profile（路径不变）
- same identity（externalAccountId 不变，身份不丢）
- same account（ChannelAccount 状态保持，不误降级）

### Step 4 — 服务重启恢复
**操作：** `pm2 restart api-server`
**验收断言（RecoveryService 日志）：**
- scan workspace → probe identity → restore connected
- 快照 fresh → fast 保持 CONNECTED（不启动浏览器）
- 快照过期 → 真实探针验证登录态

### Step 5 — AI 员工读取
**操作：** Alice 读取 metrics
**验收断言：**
- 有真实登录态 → 返回真实数据（followers/works/likes/views 真实值）
- 无登录态 → 返回 unavailable + reason（**绝不返回 0**）

### Step 6 — Owner View 截图
**输出：** docs/reality/G6-ACCEPTANCE-01-owner-view.png
**老板看到：**
```
Alice
🖥 抖音运营电脑
账号: 南坡万
🟢 在线
今日数据: 粉丝 xxx / 作品 xxx
AI分析: 置信度 medium/strong
```

## 执行方式
```bash
cd backend
# 掌柜扫码登录（交互式，等待扫码）
npx tsx scripts/reality-acceptance-g6.ts --step 1
# 完成后一键跑完剩余步骤
npx tsx scripts/reality-acceptance-g6.ts --step 2-6
```

## 平台复制模板（抖音 PASS 后）
同一脚本，仅替换 platform 参数：
- 快手：`--platform kuaishou`
- 小红书：`--platform xiaohongshu`
- 视频号：`--platform shipinhao`

冻结项：快手/小红书/视频号**不再单独修**（它们的问题是平台登录差异 + 真实账号验证，非架构问题），复制抖音标准即可。

## 预跑记录（2026-08-03 04:39，未扫码状态）
Step 2-6 全绿（S2 数字电脑 / S3 浏览器关闭恢复 / S4 服务重启恢复 / S5 诚实 unavailable / S6 截图完成）
截图：docs/reality/G6-ACCEPTANCE-01-owner-view.png

### 预跑中发现并修复
- **ensure-account 假 ID 占位（REALITY-GATE 违例）**：`/channels/runtime/:platform/ensure-account` 在账号不存在时生成 `externalAccountId=platform-时间戳` + 空 cookie 凭证——「模拟成功」变种。已修复：只建 WAITING_LOGIN 空壳（accountName=未连接 / credential={} / externalAccountId=null），真实身份由登录成功写入。并删除预跑时前端误建的 6cbca838 假 ID 账号。
- G6 脚本字段修正：channelType/connectionStatus/agentInstanceId/unavailableReason（Prisma 模型名）。

### 真实系统行为记录（预跑意外收获）
预跑 Step 5 触发真实链路：浏览器启动 → creator.douyin.com → 数据中心 IP 登录态失效（页面特征缺失 1/2）→ HealthGuard 3/3 失败 → **Alice 🔴 账号保护中**（暂停任务，等待老板确认恢复）→ Owner View 如实展示保护原因。系统绝不假装在线 ✅
恢复路径：掌柜扫码登录后 `POST /api/enterprise/channels/:id/health/recover` 解除保护。
