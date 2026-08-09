# Media Workspace Capability Map

> **Version**: 1.0
> **Date**: 2026-08-08
> **Status**: Design Phase
> **宪法依据**: KMKI-CONST-005 (Capability 唯一入口), CONST-011 (Adapter 层), CONST-024 (数据所有权)

---

## 1. 原则

```
┌─────────────────────────────────────────────────────┐
│                   Platform Layer                     │
│  "能做什么" — 原子能力，与业务无关                    │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Browser │ │ LLM      │ │ Search   │ │ Notif  │ │
│  │ Runtime │ │ Gateway  │ │ Engine   │ │ Center │ │
│  └─────────┘ └──────────┘ └──────────┘ └────────┘ │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │Credential│ │ Storage  │ │ Scheduler│ │ Audit  │ │
│  │Vault    │ │          │ │          │ │ Log    │ │
│  └─────────┘ └──────────┘ └──────────┘ └────────┘ │
└─────────────────────────────────────────────────────┘
                       ↑
                  Adapter 层 (翻译)
                       ↑
┌─────────────────────────────────────────────────────┐
│                  Media Workspace Layer               │
│  "做什么" — 业务编排，与场景相关                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ 热点分析  │ │ 内容生成  │ │ 客户画像  │           │
│  │ 竞品监控  │ │ 定时发布  │ │ 私信回复  │           │
│  │ 策略制定  │ │ 效果分析  │ │ 评论管理  │           │
│  └──────────┘ └──────────┘ └──────────┘            │
└─────────────────────────────────────────────────────┘
```

**宪法纪律**：
- Platform 不知道「热点」「竞品」「客户」等业务词
- Media Workspace 不知道 Browser/CDP/Provider 等技术词
- 一切通过 Capability 名称交流

---

## 2. Platform Capabilities（平台提供）

### 2.1 基础能力

| Capability ID | 名称 | 输入 | 输出 | 实现 |
|---------------|------|------|------|------|
| `platform.browser.navigate` | 浏览器导航 | URL, config | Page content | Playwright |
| `platform.browser.extract` | 页面数据提取 | Selector, page | Structured data | Playwright + DOM |
| `platform.browser.screenshot` | 截图 | Page, options | Image binary | Playwright |
| `platform.browser.act` | 浏览器操作 | Action (click/type/select) | Result | Playwright |
| `platform.credential.get` | 获取凭证 | Platform, accountId | Decrypted credential | Credential Vault |
| `platform.credential.rotate` | 轮换凭证 | Platform, newCredential | Status | Credential Vault |
| `platform.llm.generate` | AI 生成 | Prompt, model, params | Generated text | Hermes + Provider |
| `platform.search.web` | 网络搜索 | Query, filters | Search results | Search Engine |
| `platform.search.trends` | 趋势搜索 | Query, timeRange | Trend data | 外部数据源 |
| `platform.storage.put` | 存储写入 | Key, data, ttl | Status | Object Storage |
| `platform.storage.get` | 存储读取 | Key | Data | Object Storage |
| `platform.notification.push` | 推送通知 | Target, content | Status | Notification Center |
| `platform.schedule.create` | 创建定时任务 | Cron, taskRef | Schedule ID | Scheduler |
| `platform.schedule.cancel` | 取消定时任务 | Schedule ID | Status | Scheduler |
| `platform.audit.log` | 审计日志 | Actor, action, target | Log entry | Audit Center |

### 2.2 新媒体专用能力（Platform 层）

| Capability ID | 名称 | 说明 |
|---------------|------|------|
| `media.platform.auth` | 平台账号授权 | 统一扫码登录流程 |
| `media.platform.profile.read` | 读取账号信息 | 粉丝/作品/数据 |
| `media.platform.content.publish` | 发布内容 | 统一内容发布 |
| `media.platform.content.list` | 内容列表 | 历史发布记录 |
| `media.platform.comment.list` | 评论列表 | 读取评论 |
| `media.platform.comment.reply` | 回复评论 | 单条/批量 |
| `media.platform.message.send` | 发送私信 | 单条/批量 |
| `media.platform.message.list` | 私信列表 | 读取私信 |
| `media.platform.analytics.read` | 读取数据 | 阅读/互动/粉丝 |
| `media.platform.product.update` | 商品操作 | 上下架/改价 |

---

## 3. Workspace 编排（Media 业务逻辑）

### 3.1 热点分析

```
媒体域 Capability: media.trend.analysis
输入: 行业关键词, 时间范围, 平台列表
编排:
  1. platform.search.trends (各平台热搜)
  2. platform.search.web (行业新闻)
  3. platform.llm.generate (分析总结)
  4. platform.storage.put (缓存结果)
输出: 热点日报 + 选题建议
```

### 3.2 竞品分析

```
媒体域 Capability: media.competitor.analysis
输入: 竞品列表, 分析维度
编排:
  1. platform.browser.navigate (竞品主页)
  2. platform.browser.extract (作品/数据)
  3. platform.llm.generate (对比分析)
  4. platform.storage.put (历史对比)
输出: 竞品周报 + 策略建议
```

### 3.3 内容生成

```
媒体域 Capability: media.content.generate
输入: 选题, 平台, 风格
编排:
  1. platform.llm.generate (正文)
  2. platform.llm.generate (标题 3 选 1)
  3. platform.llm.generate (标签)
  4. platform.storage.put (草稿)
输出: 待审批内容列表
```

### 3.4 定时发布

```
媒体域 Capability: media.content.publish
输入: 内容, 平台列表, 时间
编排:
  1. platform.schedule.create (定时触发)
  2. [触发时] platform.credential.get (获取凭证)
  3. platform.browser.navigate (平台发布页)
  4. platform.browser.act (填写+发布)
  5. platform.audit.log (操作日志)
  6. platform.storage.put (发布记录)
  7. platform.notification.push (结果通知)
输出: 发布结果 + 链接
```

### 3.5 客户画像

```
媒体域 Capability: media.customer.profile
输入: 平台, 时间范围
编排:
  1. platform.browser.navigate (评论/私信)
  2. platform.browser.extract (互动数据)
  3. platform.llm.generate (画像分析)
  4. platform.storage.put (画像存储)
输出: 客户列表 + 画像标签 + 价值分级
```

### 3.6 自动回复

```
媒体域 Capability: media.message.reply
输入: 消息队列, 回复策略
编排:
  1. platform.llm.generate (判断消息类型)
  2. IF 普通: platform.llm.generate (温暖回复)
  3. IF 投诉: → 标记「需人工」
  4. IF 涉及金额: → 标记「紧急人工」
  5. platform.message.send (执行回复)
  6. platform.audit.log (操作日志)
输出: 回复结果 + 需人工列表
```

---

## 4. Capability 注册表示例

```typescript
// Platform Capability Registry 应注册
const MEDIA_PLATFORM_CAPABILITIES = [
  {
    id: 'media.platform.auth',
    name: 'Platform Authorization',
    category: 'media',
    version: '1.0.0',
    status: 'stable',
    input: { platform: 'string', accountId: 'string' },
    output: { qrCode: 'string', status: 'string' },
    lifecycle: 'stable'
  },
  {
    id: 'media.platform.content.publish',
    name: 'Content Publish',
    category: 'media',
    version: '1.0.0',
    status: 'experimental',
    input: { platform: 'string', content: 'object', media: 'array' },
    output: { publishId: 'string', url: 'string', status: 'string' },
    lifecycle: 'experimental'
  },
  // ... 其余 media.platform.* capabilities
]

// Media Workspace 业务 Capability
const MEDIA_WORKSPACE_CAPABILITIES = [
  {
    id: 'media.trend.analysis',
    name: 'Trend Analysis',
    category: 'media',
    version: '1.0.0',
    status: 'experimental',
    composition: ['platform.search.trends', 'platform.search.web', 'platform.llm.generate'],
    lifecycle: 'experimental'
  },
  // ... 其余 media.* workspace capabilities
]
```

---

## 5. 禁止清单

| 禁止 | 正确做法 |
|------|---------|
| Media Workspace 直接 `import playwright` | 通过 `media.platform.navigate` Capability |
| Media Workspace 直接读 `UserModelConfigV2` | 通过 `platform.llm.generate` Capability |
| Media Platform 出现「热点」「竞品」 | 只保留「搜索」「生成」「导航」等通用词 |
| Media Workspace 直接写 AgentOutcome | 通过 Platform Execution Service 写入 |
| Capability 绕过 Permission 检查 | 每个 Capability 执行前检查 Permission |

---

*Task 04 完成。进入 Task 05: Adapter 架构。*
