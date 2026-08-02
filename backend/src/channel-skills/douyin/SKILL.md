# Douyin Creator Skill — 抖音创作者中心操作技能

**平台:** douyin (抖音)
**工作空间:** BrowserWorkspace (持久化 Chrome profile)
**适用:** AI 员工在授权范围内运营抖音账号

---

## 登录

### 确认登录
- 访问 `https://creator.douyin.com/`（创作者中心）
- 探针信号（多信号判定，禁止单一 URL 判断）：
  - A 页面特征：页面包含「内容管理/发布作品/创作灵感/作品管理/数据概览/创作者服务/我的主页」≥2 项
  - B Cookie：`sessionid` / `sid_guard` / `uid_tt` 至少 2 个存在
  - C 身份接口：hydration 数据含 `user_name` + `sec_uid`
- 任一强信号命中 = 已登录（`ChannelIdentity.authenticated`）

### 新设备首次绑定（平台安全验证）
- 扫码登录后抖音可能要求「身份验证」（新设备风控）：
  - 短信验证码 / 手机刷脸验证 / 抖音 App 确认
- 这是**正常安全流程**，不是错误：用户本人完成验证后，浏览器环境固化为可信设备
- 验证完成后确认绑定（人工授权确认事件）→ `AUTH_SUCCESS`

### 登录态失效处理
- 探针全信号失败 → 账号状态 `expired`（禁止假装在线）
- 重新打开登录页让用户扫码（不自动绕过验证）

---

## 数据查看

### 核心指标（数据概览）
- 路径：`https://creator.douyin.com/creator-micro/data/overview`
- 提取：粉丝数 / 获赞数 / 作品数（文本解析）
- 禁止 mock：解析失败必须明确报错，不得返回假数据

### 评论列表（只读）
- 路径：`https://creator.douyin.com/creator-micro/content/manage`
- 单条评论：`[class*="comment"]` 元素 innerText

---

## 内容发布

> ⚠️ **当前冻结**（掌柜 SPRINT-MEDIA-BROWSER-WORKSPACE-01 执行顺序冻结）：
> 自动发布、自动回复、自动评论 **一律禁止**，直到 Browser Workspace Reality Gate G1-G6 全部 PASS。

---

## 风险限制（平台合规红线）

### 绝对禁止（第一原则）
- ❌ 绕过平台安全机制（验证码/风控）
- ❌ 修改浏览器指纹欺骗平台
- ❌ 自动破解验证码
- ❌ 模拟真人规避风控（随机延迟≠模拟真人，但操作频率必须自然）

### 操作频率
- 每日最大操作次数：**发布 0 次（冻结期）**；读取类操作 ≤ 50 次/天
- 读取间隔 ≥ 8 秒（禁止高频轮询）

### 安全边界
- 只操作已授权账号（AgentChannelBinding 权限校验）
- 操作必须记录 ChannelOperationLog（防重复：workspaceId+action+target 唯一）
- 所有操作可审计（BrowserTrajectory）
