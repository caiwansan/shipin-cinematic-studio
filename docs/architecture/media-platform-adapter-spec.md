# 外部平台 Adapter 架构

> **Version**: 1.0
> **Date**: 2026-08-08
> **Status**: Design Phase
> **宪法依据**: KMKI-CONST-002 (核心不依赖第三方 SDK), CONST-005 (Capability 唯一入口)

---

## 1. 设计原则

```
┌───────────────────────────────────────────────────────────┐
│                    Media Workspace                         │
│                                                            │
│   media.trend.analysis  ──→  TrendAnalysisAdapter          │
│   media.content.publish ──→  ContentPublishAdapter         │
│   media.comment.list    ──→  CommentAdapter                │
│                                                            │
└────────────────────────┬──────────────────────────────────┘
                         │
                         ▼
┌───────────────────────────────────────────────────────────┐
│              External Platform Adapter Interface            │
│                                                            │
│   interface IPlatformAdapter {                             │
│     authorize(): Promise<AuthResult>                        │
│     getProfile(): Promise<Profile>                          │
│     publishContent(content): Promise<PublishResult>         │
│     getComments(since): Promise<Comment[]>                  │
│     replyComment(id, text): Promise<Result>                 │
│     sendUserIdMessage(userId, text): Promise<Result>        │
│     getAnalytics(metrics): Promise<Analytics>               │
│   }                                                        │
│                                                            │
└────────┬──────────────┬──────────────┬─────────────────────┘
         │              │              │
    ┌────┴────┐   ┌─────┴────┐  ┌─────┴────┐
    │ Browser │   │ Official │  │  Hybrid  │
    │Automation│   │   API    │  │ (Both)   │
    └─────────┘   └──────────┘  └──────────┘
```

### 核心原则

1. **不写「如果抖音就...」** — 所有平台通过统一接口
2. **每个平台一个 Adapter 文件** — 不互相依赖
3. **Adapter 不包含业务逻辑** — 只做翻译和调用
4. **新增平台 = 新增文件，零修改已有代码**

---

## 2. 统一 ChannelAccount 模型

```typescript
/**
 * ChannelAccount — 所有外部平台的统一身份模型
 * 宪法依据: CONST-024 (此数据所有权归 Credential Vault + Identity Center)
 */
interface ChannelAccount {
  id: string
  platform: PlatformType       // douyin | kuaishou | xiaohongshu | wechat_video | taobao | jd | meituan | wechat_shop
  accountType: 'media' | 'ecommerce' | 'messaging'
  accountName: string          // 平台真实账号名（只读，来自平台）
  avatarUrl: string            // 平台真实头像
  externalAccountId: string    // 平台用户ID
  connectionStatus: ConnectionStatus
  credentialRef: string        // → Credential Vault 引用（不存储明文）
  sessionRef: string           // → Browser Session 引用（如适用）
  grantedScopes: string[]      // 已授权权限列表
  connectedAt: Date
  lastSyncAt: Date
  health: 'healthy' | 'expired' | 'revoked' | 'error'
  metadata: Record<string, any> // 平台特定数据（只读透传）
}

type PlatformType = 
  | 'douyin'        // 抖音
  | 'kuaishou'      // 快手
  | 'xiaohongshu'   // 小红书
  | 'wechat_video'  // 视频号
  | 'weibo'         // 微博
  | 'bilibili'      // B站
  | 'taobao'        // 淘宝
  | 'jd'            // 京东
  | 'meituan'       // 美团
  | 'pinduoduo'     // 拼多多
  | 'wechat_shop'   // 微信小店

type ConnectionStatus = 
  | 'PENDING'       // 初始
  | 'WAITING_LOGIN' // 等待扫码
  | 'AUTHENTICATING'// 授权中
  | 'CONNECTED'     // 已连接
  | 'EXPIRED'       // 过期
  | 'ERROR'         // 错误
```

---

## 3. Adapter 分类

### 3.1 浏览器自动化 Adapter（新媒体平台）

```
适用: 抖音、快手、小红书、视频号、微博、B站
原理: Playwright + 持久化 Profile + Cookie/Session
优势: 无需平台 API 权限，行为更像真人
劣势: 速度较慢，依赖页面结构不变

┌──────────────────────────────────────────┐
│           BrowserAdapter (基类)           │
│  ┌────────────────────────────────────┐  │
│  │ navigate(url)                      │  │
│  │ extract(config) → structured data  │  │
│  │ act(action) → result               │  │
│  │ screenshot() → image               │  │
│  │ getCookies() → cookie list         │  │
│  │ saveSession() → session token      │  │
│  │ restoreSession(token) → status      │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │  Douyin  │ │ Kuaishou │ │   XHS    │ │
│  │ Adapter  │ │ Adapter  │ │ Adapter  │ │
│  └──────────┘ └──────────┘ └──────────┘ │
│  ┌──────────┐ ┌──────────┐              │
│  │ Shipinhao│ │  Weibo   │              │
│  │ Adapter  │ │ Adapter  │              │
│  └──────────┘ └──────────┘              │
└──────────────────────────────────────────┘
```

### 3.2 官方 API Adapter（电商平台）

```
适用: 淘宝、京东、美团、拼多多、微信小店
原理: 平台开放 API + OAuth 2.0 + Webhook
优势: 速度快、稳定、支持实时事件
劣势: 需要平台审核、API 权限、可能有费用

┌──────────────────────────────────────────┐
│           ApiAdapter (基类)               │
│  ┌────────────────────────────────────┐  │
│  │ authenticate() → OAuth token       │  │
│  │ refreshToken() → new token         │  │
│  │ callApi(endpoint, params) → result │  │
│  │ registerWebhook(events) → hook     │  │
│  │ handleWebhook(payload) → event     │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │  Taobao  │ │    JD    │ │ Meituan  │ │
│  │ Adapter  │ │ Adapter  │ │ Adapter  │ │
│  └──────────┘ └──────────┘ └──────────┘ │
│  ┌──────────┐ ┌──────────┐              │
│  │ Pinduoduo│ │WeChatShop│              │
│  │ Adapter  │ │ Adapter  │              │
│  └──────────┘ └──────────┘              │
└──────────────────────────────────────────┘
```

---

## 4. 各平台 Adapter 规格

### 4.1 抖音 Adapter

```
实现方式: Browser Automation (Playwright)
特有功能:
  - publishVideo(video, cover, description, tags)
  - getCreatorData() → 创作者中心数据
  - getVideoMetrics(videoId) → 视频表现
  - replyComment(commentId, text)
  - sendDM(userId, text)
页面路径:
  - 创作中心: creator.douyin.com
  - 数据看板: creator.douyin.com/data
  - 评论管理: creator.douyin.com/comment
  - 私信: creator.douyin.com/message
权限需求:
  - 读取: 作品、数据、评论、私信
  - 写入: 发布视频、回复评论、发私信
风险等级: 高（风控严格，需模拟真人操作节奏）
```

### 4.2 快手 Adapter

```
实现方式: Browser Automation (Playwright)
特有功能:
  - publishVideo(video, cover, description)
  - getCreatorData() → 快手创作者数据
  - getVideoMetrics(videoId)
页面路径:
  - 创作者中心: creator.kuaishou.com
  - 数据: creator.kuaishou.com/data
权限需求: 同抖音
风险等级: 中（风控较抖音宽松）
```

### 4.3 小红书 Adapter

```
实现方式: Browser Automation (Playwright)
特有功能:
  - publishNote(images, title, body, tags)
  - getCreatorData()
  - getNoteMetrics(noteId)
页面路径:
  - 创作者中心: creator.xiaohongshu.com
权限需求: 发布、评论、私信
风险等级: 高（反爬严格）
```

### 4.4 视频号 Adapter

```
实现方式: Browser Automation (Playwright)
特有功能:
  - publishVideo(video, description)
  - getCreatorData()
页面路径:
  - 视频号助手: channels.weixin.qq.com
权限需求: 发布、评论
风险等级: 中
注意: 微信生态，需同时处理登录态共享
```

### 4.5 淘宝 Adapter

```
实现方式: 官方 API (Hybrid)
API: 淘宝开放平台 taobao.open.taobao.com
OAuth: 2.0 (需商家授权)
特有功能:
  - getShopInfo() → 店铺信息
  - listProducts() → 商品列表
  - updateProduct(productId, fields)
  - getOrders(status, timeRange) → 订单列表
  - getCustomerMessages() → 客户消息
  - replyMessage(msgId, text)
Webhook: 订单状态变更、客户消息
风险等级: 低（官方 API 稳定）
限制: 需企业店铺、API 调用频次限制
```

### 4.6 京东/美团 Adapter

```
实现方式: 官方 API
类似淘宝，各自接入对应开放平台
```

---

## 5. Adapter 工厂

```typescript
/**
 * Adapter 工厂 — 根据 platform 类型返回对应 Adapter
 * 宪法: CONST-005 — Capability 路由到 Adapter
 */
class PlatformAdapterFactory {
  static create(platform: PlatformType, config: AdapterConfig): IPlatformAdapter {
    switch (platform) {
      case 'douyin':       return new DouyinBrowserAdapter(config)
      case 'kuaishou':     return new KuaishouBrowserAdapter(config)
      case 'xiaohongshu':  return new XhsBrowserAdapter(config)
      case 'wechat_video': return new WeChatVideoBrowserAdapter(config)
      case 'weibo':        return new WeiboBrowserAdapter(config)
      case 'bilibili':     return new BiliBrowserAdapter(config)
      case 'taobao':       return new TaobaoApiAdapter(config)
      case 'jd':           return new JdApiAdapter(config)
      case 'meituan':      return new MeituanApiAdapter(config)
      case 'pinduoduo':    return new PddApiAdapter(config)
      case 'wechat_shop':  return new WeChatShopApiAdapter(config)
      default:
        // 不写 if-else 分支 — 返回 NullAdapter（诚实报错）
        return new NullAdapter(platform)
    }
  }
}

/**
 * NullAdapter — 未接入平台返回「未接入」而非 mock
 * 宪法: Reality Gate — 真实或不存在
 */
class NullAdapter implements IPlatformAdapter {
  authorize() { return { ok: false, error: 'PLATFORM_NOT_SUPPORTED' } }
  // ... 所有方法返回「未接入」
}
```

---

## 6. Adapter 注册发现

```typescript
/**
 * Adapter 注册表 — 运行时发现可用 Adapter
 */
interface AdapterRegistryEntry {
  platform: PlatformType
  adapterName: string
  authMethod: 'browser_qr' | 'oauth2' | 'api_key'
  supportedActions: string[]
  status: 'available' | 'beta' | 'coming_soon'
  requiredScopes: string[]
}

/**
 * GET /api/enterprise/channels/registry
 * 返回可用 Adapter 列表（前端据此渲染「可连接平台」）
 */
const ADAPTER_REGISTRY: AdapterRegistryEntry[] = [
  { platform: 'douyin', authMethod: 'browser_qr', supportedActions: ['publish', 'read', 'comment', 'message'], status: 'available', requiredScopes: ['creator.read', 'creator.write'] },
  { platform: 'kuaishou', authMethod: 'browser_qr', supportedActions: ['publish', 'read', 'comment'], status: 'available', requiredScopes: ['creator.read', 'creator.write'] },
  { platform: 'xiaohongshu', authMethod: 'browser_qr', supportedActions: ['publish', 'read', 'comment'], status: 'beta', requiredScopes: ['creator.read', 'creator.write'] },
  { platform: 'wechat_video', authMethod: 'browser_qr', supportedActions: ['publish', 'read', 'comment'], status: 'beta', requiredScopes: ['video.read', 'video.write'] },
  { platform: 'weibo', authMethod: 'browser_qr', supportedActions: ['publish', 'read', 'comment'], status: 'coming_soon' },
  { platform: 'bilibili', authMethod: 'browser_qr', supportedActions: ['publish', 'read'], status: 'coming_soon' },
  { platform: 'taobao', authMethod: 'oauth2', supportedActions: ['shop.read', 'product.read', 'order.read', 'message.read'], status: 'coming_soon' },
  { platform: 'jd', authMethod: 'oauth2', supportedActions: ['shop.read', 'product.read', 'order.read'], status: 'coming_soon' },
  { platform: 'meituan', authMethod: 'oauth2', supportedActions: ['shop.read', 'order.read'], status: 'coming_soon' },
]
```

---

## 7. 禁止清单

| 禁止 | 正确做法 |
|------|---------|
| Platform 核心代码 `import 抖音 SDK` | Adapter 层封装，Platform 只认 Interface |
| Workspace 直接 `new DouyinAdapter()` | 通过 Capability 路由 → Adapter Factory |
| 业务逻辑写在 Adapter 里 | Adapter 只做翻译，业务在 Workspace 层 |
| 未接入平台返回 mock | 返回 `supported:false` + 诚实说明 |
| 各 Adapter 互相依赖 | 所有 Adapter 只依赖基类 Interface |

---

*Task 05 完成。进入 Task 06: AI Agent 权限系统。*
