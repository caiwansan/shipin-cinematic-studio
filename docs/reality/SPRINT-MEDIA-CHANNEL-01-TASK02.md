# SPRINT-MEDIA-CHANNEL-01 — Task 02: Media Channel Runtime Architecture v1.0（冻结）

**Date:** 2026-08-02
**Gate:** 掌柜战略决策 A/B 批准（浏览器自动化扫码授权为第一阶段生产链路；SSOT 收敛至 Enterprise Domain）

---

## 掌柜决策记录

### 决策 A：授权方式
- ✅ **浏览器自动化扫码授权 = 第一阶段生产链路**（产品化命名：Media Channel Runtime Adapter，禁止叫「模拟登录」）
- ✅ **官方 OAuth = 未来企业增强通道**（资质/审核到位后只替换执行层）
- 架构预留：`EnterpriseChannelAdapter` 下 `DouyinBrowserAdapter`（浏览器）与未来 `DouyinOAuthAdapter`（官方）并行替换

### 决策 B：SSOT 收敛
- 唯一事实来源：**Enterprise Domain 链路** `EnterpriseChannelAccount → AgentChannelBinding → EnterpriseAgentInstance → Hermes Runtime`
- 废弃（deprecated 不删除，保留 30 天确认无引用后删除）：media 域独立账号体系 / media 域独立 credential（media_credential_vault）/ media-department 老页面

---

## 冻结：四层架构 v1.0

### Layer 1 — Channel Identity Layer（渠道账号身份）

**唯一模型：`EnterpriseChannelAccount`**（已存在，冻结）

| 字段 | 职责 |
|------|------|
| tenantId / organizationId | 企业归属（Organization = 唯一企业身份） |
| channelType / channelName | 平台 + 账号名 |
| externalAccountId | 平台侧账号 ID（unique） |
| connectionStatus | PENDING / connected / expired / error |
| connectedAt / lastSyncAt / lastError | 连接与同步状态 |
| ownerId / ownerType / manageRole | 归属与管理角色（CHANNEL_OWNER） |

**负责**：账号身份。**不负责**：登录。

### Layer 2 — Credential Layer（凭证层）

**唯一载体：`credentialEncrypted`**（EnterpriseChannelAccount 字段，冻结）

规则：
```
AES-256-GCM（crypto.service encryptKey，格式 iv:tag:ciphertext）
never plaintext
never frontend exposed（解密仅服务端适配器/运行时内部）
```

**本次漏洞修复（已执行）**：
- ❌ 修复前：`ChannelService.connectAccount` 明文 `JSON.stringify(credential)` 落库（TODO），且字段名与模型不匹配（`platform/encryptedCred/status` 在模型中不存在 → 该链路实际从未成功运行）
- ✅ 修复后：`encryptKey()` 加密写入 `credentialEncrypted`（`{cipher:'aes-256-gcm', payload}`），字段对齐模型（`channelType/channelName/connectionStatus/connectedAt`），新增 `getCredential(accountId)` 服务端解密方法（禁止暴露前端）

**deprecated（保留不删）**：`media_credential_vault`（media 域独立 base64 凭证体系，非 AES）→ 30 天后迁移/删除

### Layer 3 — Channel Runtime Layer（渠道执行层）

**唯一接口：`EnterpriseChannelAdapter`**（v1.0 冻结，backend/src/enterprise/channel/channel.adapter.ts）

```ts
interface EnterpriseChannelAdapter {
  readonly platform: string

  // v1.0 冻结方法
  connect(accountId?: string): Promise<ConnectResult>
  refreshCredential(accountId: string): Promise<{ ok: boolean; error?: string }>
  publish(content: ChannelContent): Promise<PublishResult>
  fetchMetrics(accountId: string): Promise<ChannelMetrics>
  fetchComments(accountId: string, postId?: string): Promise<ChannelComment[]>
  healthCheck(): Promise<ChannelHealth>

  // 兼容保留（历史实现不破坏）
  schedule(...) / fetchInteractions(...) / reply(...) / getAccountInfo(...)
}
```

新增类型冻结：`ConnectResult`（waiting_login/connected/expired/failed）、`ChannelMetrics`（followerCount/videoCount/totalViews/totalLikes/totalComments/totalShares/recentViews/interactionRate/collectedAt）、`ChannelComment`。

**实现规划**：
| Adapter | 状态 | 内部 |
|---------|------|------|
| `DouyinBrowserAdapter` | Task 03.1 实现 | Playwright → Chromium → Douyin Creator Center（吸收 media 域 browserRuntime/MediaPlatformService 能力） |
| `DouyinOAuthAdapter` | 未来增强 | 官方开放平台 API（资质到位后替换执行层） |
| `MockChannelAdapter` | deprecated（仅开发/测试） | 已适配 v1.0 stub |

**目标链路**：
```
旧：media routes → MediaPlatformService → Playwright
新：EnterpriseChannelService → DouyinBrowserAdapter → Playwright
```

### Layer 4 — AI Employee Permission Layer（AI 员工权限层）

**唯一模型：`AgentChannelBinding`**（已存在，冻结）

```
agentInstanceId + channelAccountId + permissions Json + status(active|paused)
@@unique([agentInstanceId, channelAccountId])
```

**默认权限冻结**（AI 员工不是管理员，必须授权）：
```json
{
  "read": true,
  "analyze": true,
  "createTask": true,
  "publish": false,
  "reply": false,
  "schedule": false
}
```

权限位全集：`read / analyze / createTask / publish / reply / schedule / execute / delete`。默认仅读 + 分析 + 建任务；发布/回复/排期必须老板显式授权。

---

## deprecated 清单（不删除，治理保留）

| 项 | 处置 | 时间线 |
|----|------|--------|
| `frontend/pages/media-department/*`（旧页面） | deprecated 标记 | 保留 30 天 → 确认无引用 → 删除 |
| media 域独立账号体系（`/media/accounts` 独立模型路径） | 下沉为执行层 | Task 03.1 吸收 |
| `media_credential_vault`（base64 非 AES） | deprecated | 30 天后迁移 |
| media 域 `PlatformAdapter`（playwright 接口） | deprecated → 由 EnterpriseChannelAdapter 取代 | Task 03.1 |
| `MockChannelAdapter` | deprecated（仅开发测试） | 永久保留但禁止生产 |

---

## 不做什么（边界冻结）

- ❌ 不开发 UI（Task 04 再接 accounts.vue）
- ❌ 不删除旧代码（deprecated 治理）
- ❌ 不破坏现有 media 链路（Task 03.1 之前保持运行）
- ❌ 不点亮首页 dashboardData（指标定义未定：内容影响=视频发布量/播放量/互动率；客户增长=私信/线索/评论/关注；销售转化=CRM/商品/咨询 —— 定义清楚前禁止假经营数据）

---

## 补充发现（Task 02 实测确认）

### media 域路由 = 已实现未注册的死路由层 ⚠️
- `registerMediaPlatformRoutes`（routes/media-platform.ts）**全仓零注册**（index.ts 未挂载）
- 实测：`GET 4002/api/enterprise/media-department/media/health` → 404；`/media-department/agents` → 401（已注册，正常）
- 结论：media 域浏览器自动化链路（accounts/connect/browser/publish）从未对外暴露，与审计「前端零接线」互为印证
- **处置**：Task 03.1 吸收 MediaPlatformService → DouyinBrowserAdapter 时一并注册（挂 EnterpriseChannelService），旧路由按 deprecated 处理不删除

### 编译/运行验证（Task 02 零回归）
- `channel.adapter.ts / mock.adapter.ts / extended.adapter.ts` 编译零错误；channel.service.ts 改动区（connectAccount/getCredential 39-80 行）零错误
- 全仓 tsc 错误数 1962（基线 1963，无新增；pre-existing 死代码错误与本 Sprint 无关）
- api-server 重启 online（restarts 694），/api/health 200，既有 enterprise 路由鉴权正常

---

## Reality Gate（Task 03.2 验收标准）

1. 企业 ID → 连接抖音 → credentialEncrypted 落库（AES，库中无明文）
2. 恢复 session → fetchHealth 返回 connected
3. fetchMetrics 返回真实粉丝/播放/互动（与创作者后台一致，非 mock）
4. 按 AgentChannelBinding 权限读取，无越权
5. 凭证过期/断连 → 状态正确降级（expired）
6. 现有 media 链路零回归（浏览器健康检查等原有功能正常）

---

## Sprint 路线（冻结）

```
SPRINT-MEDIA-CHANNEL-01
Task01 架构审计 ✅（5ec7590d）
Task02 Runtime Architecture Freeze ✅（本文档）
Task03 DouyinBrowserAdapter Reality（03.1 实现 / 03.2 Reality Test）
Task04 Account UI Connect（accounts.vue 接线）
Task05 AI Employee Permission Runtime
Task06 真实数据 Dashboard（指标定义先行）
Task07 复制渠道（小红书/视频号/B站）
```

**提交：本文档 + 接口冻结 + 凭证漏洞修复 → 见 git log**
