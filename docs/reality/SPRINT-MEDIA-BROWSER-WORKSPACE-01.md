# SPRINT-MEDIA-BROWSER-WORKSPACE-01 — Reality Gate 报告（Task 00-08）

**Date:** 2026-08-02 21:00 CST
**提交:** `b8f9d1e`（Task 00-08 合并）
**Gate:** 掌柜战略指令「AI 员工数字办公环境」——昆仑镜不是做抖音自动化工具，而是建设 AI 员工浏览器基础设施

---

## 交付总览

| Task | 交付 | 状态 |
|------|------|------|
| 00 架构审计 | `docs/reality/SPRINT-MEDIA-BROWSER-WORKSPACE-01-AUDIT.md`（5 大审计结论 + 差距矩阵） | ✅ |
| 01 BrowserWorkspace SSOT | Prisma 模型 + 表 `browser_workspace`（org 分层 profile） | ✅ |
| 02 Runtime 升级 | BrowserWorkspaceService（生命周期状态机）+ BrowserRuntimeService 语义方法 + **navigate/withPage 持久化实例感知修复** | ✅ |
| 03 BrowserAuthSession | 状态机 INIT→OPEN_BROWSER→WAIT_USER_LOGIN→PLATFORM_VERIFY→AUTH_SUCCESS（非法迁移拦截 + 幂等） | ✅ |
| 04 探针系统 | identityProbeRegistry + DouyinIdentityProbe 三信号（既有，审计确认 80% 已就绪） | ✅ |
| 05 AI 绑定升级 | AgentChannelBinding.browserWorkspaceId（自动创建/关联 workspace） | ✅ |
| 06 Platform Skill | channel-skills/{douyin,xiaohongshu,wechat}/SKILL.md（含合规红线） | ✅ |
| 07 OperationLog | `channel_operation_log`（workspace+action+target 唯一约束） | ✅ |
| 08 Trajectory | `browser_trajectory`（AI 操作步骤实时） | ✅ |
| 09 Reality Gate | G1/G5/G6/G7/G8 PASS；G2/G3 就绪待掌柜扫码 | ⏳ |

## Reality Gate 明细

### G1 企业创建 BrowserWorkspace ✅ PASS
```
POST /api/enterprise/workspaces → { id, status: CREATED, profilePath: /data/browser-workspaces/<org>/<account>/profile }
POST /:id/start → RUNNING + lastStartedAt（浏览器拉起 + 自动导航抖音创作者中心）
POST /:id/stop → READY
GET /:id/health → { status, runtime: { ok, running, profilePath } }
```

### G2 用户登录抖音 ✅ 就绪（待掌柜扫码）
- workspace 浏览器已导航到 `https://creator.douyin.com/`，二维码正常
- 探针三信号全链路工作（workspace: 前缀会话已适配）
- **掌柜扫码后自动走新流程**：安全验证卡片 → 确认绑定 → AUTH_SUCCESS → 🛡设备可信

### G3 重启保留登录态 ⏳ 待 G2 完成后验证
- 机制就绪：launchPersistentContext(profilePath) 持久化真实 Chrome profile
- 重启后 `start` 复用同 profile → 登录态保留（需实测）

### G4 AI 员工读取账号数据 ⏳ 冻结（掌柜执行顺序：Reality Gate 全 PASS 前禁止）

### G5 操作记录完整 ✅ PASS
```
begin(publish, video_123) → created
begin(publish, video_123) 再次 → ✅ duplicate 拦截（唯一约束生效）
begin(reply, comment_456) → created（不同 action 不冲突）
listByWorkspace → 2 条完整记录
```

### G6 多企业账号隔离 ✅ PASS
```
org-A(2adf...) workspace profile: /data/browser-workspaces/2adf.../8b1cb.../profile
org-B(affc...) workspace profile: /data/browser-workspaces/affc.../af65.../profile
listByOrganization('org-A') → 只见 org-A 的 workspace
```

### G7 防重复操作 ✅ PASS（同 G5 duplicate 拦截）
### G8 AI 操作轨迹 ✅ PASS
```
step(open_page, 正在打开数据中心) → step 1
step(read_data, 正在读取粉丝/获赞指标) → step 2
listByWorkspace → 2 条（倒序，实时可见）
```

## 关键修复（Task 02 顺带发现）

**navigate/withPage/restoreCookies 的 getOrCreate 重启回归**：
- 问题：workspace 启动（launchPersistentContext）后，navigate 调用 getOrCreate（临时模式）会把持久化实例**重启为临时实例** → 登录态丢失
- 修复：navigate 优先复用 persistent 实例；withPage/restoreCookies 走 ensureContext（persistent 优先）
- 影响：既有抖音连接流程（douyin: 前缀）行为不变，持久化实例不再被误重启

## 授权状态机验证（Task 03）
```
begin → INIT
transition → OPEN_BROWSER
transition → WAIT_USER_LOGIN
transition → PLATFORM_VERIFY（verificationType: sms）
transition → AUTH_SUCCESS（completedAt + verifiedIdentity 快照）
AUTH_SUCCESS → FAILED ❌ 非法迁移已拦截 ✅
hasVerified → true
```

## 冻结清单（持续）
❌ fetchMetrics 接入 AI 建议 ❌ AI 运营建议 ❌ 多渠道复制 ❌ 自动发布/回复（SKILL.md 明确标注冻结）
❌ 绕过平台安全机制 ❌ 修改浏览器指纹欺骗 ❌ 自动破解验证码 ❌ 模拟真人规避风控（第一原则）

## 下一步（掌柜指令后）
1. **掌柜扫码完成 G2** → G3 重启保留验证 → G4 解锁
2. AI 员工执行入口（agent → workspace → skill → runtime）——审计确认当前不存在，是最大缺口
3. 前端 workspace 管理页（生命周期卡片 + 轨迹实时面板 + 操作日志）
