# TASK03.2.2 Channel Runtime Identity System — Reality Report

**Date:** 2026-08-02 20:15 CST
**Gate:** 掌柜战略升级（不是补登录状态判断，而是把浏览器授权 Runtime 升级为可产品化/稳定/低摩擦的**渠道运行身份系统**；不绕风控，建可信 Runtime——让平台看到正常用户授权后的长期浏览环境）

## 掌柜蓝图落地

```
用户授权 → 可信浏览环境建立 → 账号身份确认 → 长期会话维护 → AI员工受控操作
   ↓            ↓                    ↓               ↓              ↓
扫码       Persistent Profile   人工确认绑定    健康Agent     三级权限(L1)
```

## 交付 1 — ChannelIdentityProbe（多平台统一探针）

`src/enterprise/channel/identity-probe.ts`

```typescript
interface ChannelIdentity {
  authenticated: boolean
  accountId?: string      // 抖音 sec_uid
  accountName?: string
  avatar?: string         // 新增：头像提取
  permissions: string[]   // read:metrics / read:comments / analyze
  expiresAt?: string
  checkedAt: string
  signals?: { page, cookie, identity }
}
```

- `identityProbeRegistry` 注册表：**小红书/视频号/B站/微博 全部实现同一接口，上层零改动**（护城河）
- `DouyinIdentityProbe`：三信号（A 页面特征 / B Cookie sessionid·sid_guard·uid_tt / C hydration 身份）+ avatar
- 删除 adapter 私有 detectLoginState（升级为正式探针，零死代码）

## 交付 2 — 人工授权确认事件（SaaS 授权确认，不猜）

```
扫码 → 系统检测 → 显示「已检测到：张三抖音号 确认绑定？」→ 用户点确认 → connected
```

- `ConnectResult.status` 新增 `awaiting_confirmation`
- `confirmChannelBinding(accountId)`：探针复核 → 回写 DB（connected + externalAccountId + channelName + avatar + permissionLevel=1）→ 保存凭证（AES）→ 浏览器会话健康记录
- **已绑定账号 → 维持登录直接 connected**（G2：重启后仍 connected）
- **未登录 confirm → 拒绝且不写 DB**（安全门，实测通过）

## 交付 3 — Runtime Health Agent（G3）

`GET /api/enterprise/channels/runtime/:id/runtime-health`

```json
{
  "browser": "degraded",        // online / offline / degraded
  "session": "degraded",        // valid / invalid / degraded / unknown
  "account": "none",            // connected / expired / none
  "permission": "read/analyze", // L1 观察员工
  "lastCheck": "3分钟前"         // 人类可读
}
```

老板看到「我的 AI 员工办公室正常」，不是「cookie 有没有」。

## 交付 4 — 三级权限（不马上开放 AI 操作）

| 等级 | 角色 | 能力 | 状态 |
|------|------|------|------|
| L1 | 观察员工 | 读取数据 / 分析 / 建议 | ✅ 默认（当前） |
| L2 | 运营助理 | 生成内容/回复/排期（需批准） | ⏸ 预留 |
| L3 | 运营经理 | 发布/回复/互动（明确授权+日志+回滚） | ⏸ 预留 |

- `PERMISSION_MATRIX` + `requirePermissionLevel` Gate（fetchMetrics 需 L1，publish 需 L3）
- `GET/POST /api/enterprise/channels/runtime/:id/permission`

## 交付 5 — 前端 G4（老板视角）

- **确认绑定弹窗**：头像 + 账号名 + 「确认这是你要绑定的账号吗？」+ L1 说明（不会自动发布）+ 确认/拒绝按钮
- **已连接卡片**：🟢 已连接 + 账号名 + 头像 + 🤖 AI 员工 Alice + L1 观察权限标签 + 查看账号
- `GET /runtime/douyin/account-status` 驱动卡片真实状态（onMounted 加载，未连接不误显）

## Reality Test（浏览器生产域 10/10 PASS）

| Gate | 断言 | 结果 |
|------|------|------|
| G3 | health 五断言（browser/session/account/permission/lastCheck） | ✅ |
| G4 | 卡片存在/未连接默认态/二维码显示/未登录不误显确认卡/不误显已连接 | ✅ |
| G1 安全门 | 未登录 confirm-binding → 拒绝 + DB 不污染（PENDING 保持） | ✅ |
| G4 已连接 | 模拟 connected → 卡片完整渲染（账号/头像/AI员工/L1 标签） | ✅ |

## Gates

| Gate | 要求 | 状态 |
|------|------|------|
| G1 Identity | 扫码后 DB 出现 externalAccountId/channelName/avatar/connected | ✅ 代码闭环（真实扫码待掌柜验收） |
| G2 Session | 重启后仍 connected | ✅ 持久化 profile + 已绑定维持（代码就绪） |
| G3 Health | runtime-health 三态 | ✅ 实测 |
| G4 Frontend | 已连接账号/头像/AI员工/权限 | ✅ 实测 |

## 遗留（需掌柜真实扫码验收）

- [ ] 真实扫码 → 确认绑定弹窗 → 点确认 → DB 回写 + 卡片点亮
- [ ] 重启 api-server 后二次打开 → 维持 connected（G2 实测）
- [ ] L2/L3 权限开放（掌柜批准后）

**提交:** `347ee945`
