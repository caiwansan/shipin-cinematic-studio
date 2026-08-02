# Xiaohongshu Creator Skill — 小红书创作技能

**平台:** xiaohongshu (小红书)
**工作空间:** BrowserWorkspace (持久化 Chrome profile)
**适用:** AI 员工在授权范围内运营小红书账号
**状态:** 🚧 蓝图（渠道接入未完成，禁止臆造能力）

---

## 登录

### 确认登录
- 访问 `https://creator.xiaohongshu.com/`（创作者中心）
- 探针信号（多信号判定）：
  - A 页面特征：创作者中心菜单（内容管理/数据/互动/创作灵感）≥2 项
  - B Cookie：`web_session` / `a1` / `webId`
  - C 身份接口：hydration 数据含昵称 + user_id
- 任一强信号命中 = 已登录

### 新设备首次绑定
- 平台可能要求手机验证码确认（正常安全流程）
- 用户本人完成验证后固化可信环境，确认绑定 → `AUTH_SUCCESS`

---

## 数据查看（蓝图）

- 数据概览：`/creator-micro/data` 粉丝/笔记/互动
- 笔记列表：`/creator-micro/content/publish` 只读

---

## 内容发布

> ⚠️ **冻结**：自动发布禁止，直到 Reality Gate PASS。

---

## 风险限制

- ❌ 绕过风控 / 改指纹 / 破解验证码 / 模拟真人规避风控（第一原则）
- 读取间隔 ≥ 10 秒；每日读取 ≤ 30 次
- 只操作已授权账号；操作记 ChannelOperationLog
