# 昆仑镜 V4 扩展规范

> **版本**: v1.0 · **状态**: 架构基线 (C0) · **日期**: 2026-07-18
> **范围**: 扩展系统架构、Manifest 格式、权限模型、生命周期管理

---

## 1. 扩展系统架构

扩展系统是昆仑镜平台的核心能力之一，旨在允许第三方开发者在不修改平台核心代码的情况下增强平台功能。

```
┌──────────────────────────────────────────────────────┐
│                    Platform Core                       │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Extension    │  │  Permission   │  │  Sandbox     │ │
│  │ Registry     │  │  Manager      │  │  Manager     │ │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                │                  │         │
└─────────┼────────────────┼──────────────────┼─────────┘
          │                │                  │
          ▼                ▼                  ▼
┌──────────────────────────────────────────────────────┐
│                   Extension Layer                      │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────┐ ┌──────┐ │
│  │ Plugin │ │Template│ │Prompt  │ │Prov- │ │Agent │ │
│  │        │ │        │ │Pack    │ │ider  │ │      │ │
│  └────────┘ └────────┘ └────────┘ └──────┘ └──────┘ │
│  ┌────────┐                                             │
│  │Sidebar│                                             │
│  └────────┘                                             │
└──────────────────────────────────────────────────────┘
```

---

## 2. 扩展类型

| 扩展类型 | 标识符 | 说明 | 示例 |
|---------|--------|------|------|
| **Plugin** | `plugin` | 增强平台功能的新能力 | 数据分析插件、SEO 检查插件 |
| **Template** | `template` | 可复用的项目模板 | GEO 分析模板、视频脚本模板 |
| **PromptPack** | `prompt-pack` | 提示词包和 Agent 模板 | 品牌分析提示词包 |
| **Provider** | `provider` | 新的 AI Provider 适配器 | Claude、Gemini 适配器 |
| **Agent** | `agent` | 独立 AI Agent | 竞争对手分析 Agent |
| **Sidebar** | `sidebar` | Workspace 侧边栏 UI 扩展 | 品牌监控面板 |

---

## 3. 扩展 Manifest 格式

### 3.1 JSON Schema

```json
{
  "$schema": "https://studio-platform/schemas/extension-manifest.json",
  "type": "object",
  "required": ["name", "version", "type", "entry"],
  "properties": {
    "name": {
      "type": "string",
      "description": "扩展唯一名称（反向域名格式）",
      "pattern": "^[a-z0-9]+(\\.[a-z0-9]+)+$"
    },
    "version": {
      "type": "string",
      "description": "SemVer 版本号",
      "pattern": "^\\d+\\.\\d+\\.\\d+$"
    },
    "type": {
      "type": "string",
      "enum": ["plugin", "template", "prompt-pack", "provider", "agent", "sidebar"],
      "description": "扩展类型"
    },
    "displayName": {
      "type": "string",
      "description": "显示名称"
    },
    "description": {
      "type": "string",
      "description": "功能描述"
    },
    "author": {
      "type": "string",
      "description": "作者/组织"
    },
    "icon": {
      "type": "string",
      "description": "图标 URL 或 base64"
    },
    "permissions": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": [
          "capability:llm",
          "capability:image",
          "capability:video",
          "capability:tts",
          "storage:read",
          "storage:write",
          "project:read",
          "project:write",
          "event:publish",
          "event:subscribe",
          "network:http",
          "ui:sidebar",
          "ui:modal"
        ]
      },
      "description": "请求的权限列表"
    },
    "hooks": {
      "type": "object",
      "description": "生命周期钩子",
      "properties": {
        "onActivate": { "type": "string" },
        "onDeactivate": { "type": "string" },
        "onUninstall": { "type": "string" },
        "onUpgrade": { "type": "string" }
      }
    },
    "entry": {
      "type": "string",
      "description": "入口文件路径"
    },
    "workspaces": {
      "type": "array",
      "items": { "type": "string" },
      "description": "适用的 Workspace 列表（空数组表示全局）"
    },
    "config": {
      "type": "object",
      "description": "扩展配置 Schema"
    }
  }
}
```

### 3.2 Manifest 示例

```json
{
  "name": "com.studio.plugins.brand-analyzer",
  "version": "1.2.0",
  "type": "plugin",
  "displayName": "品牌深度分析器",
  "description": "提供品牌可见性、竞争对手分析和关键词洞察",
  "author": "昆仑镜团队",
  "icon": "https://cdn.studio.com/icons/brand-analyzer.svg",
  "permissions": [
    "capability:llm",
    "project:read",
    "project:write",
    "event:publish",
    "event:subscribe"
  ],
  "hooks": {
    "onActivate": "dist/activate.js",
    "onDeactivate": "dist/deactivate.js",
    "onUpgrade": "dist/upgrade.js"
  },
  "entry": "dist/index.js",
  "workspaces": ["geo"],
  "config": {
    "type": "object",
    "properties": {
      "defaultIndustry": { "type": "string", "default": "technology" },
      "maxCompetitors": { "type": "number", "default": 5, "minimum": 1, "maximum": 20 }
    }
  }
}
```

### 3.3 TypeScript 类型

```typescript
// @studio/platform/extension
export type ExtensionType = 'plugin' | 'template' | 'prompt-pack' | 'provider' | 'agent' | 'sidebar'

export type ExtensionPermission =
  | 'capability:llm'
  | 'capability:image'
  | 'capability:video'
  | 'capability:tts'
  | 'storage:read'
  | 'storage:write'
  | 'project:read'
  | 'project:write'
  | 'event:publish'
  | 'event:subscribe'
  | 'network:http'
  | 'ui:sidebar'
  | 'ui:modal'

export interface ExtensionManifest {
  name: string
  version: string
  type: ExtensionType
  displayName?: string
  description?: string
  author?: string
  icon?: string
  permissions: ExtensionPermission[]
  hooks?: {
    onActivate?: string
    onDeactivate?: string
    onUninstall?: string
    onUpgrade?: string
  }
  entry: string
  workspaces?: string[]
  config?: Record<string, unknown>
}

export interface ExtensionInstance {
  manifest: ExtensionManifest
  /** 扩展实例状态 */
  status: 'installed' | 'activated' | 'deactivated'
  /** 安装时间 */
  installedAt: string
  /** 激活时间 */
  activatedAt?: string
  /** 扩展实例上下文 */
  context: ExtensionContext
}

export interface ExtensionContext {
  /** 扩展沙箱 API */
  api: ExtensionAPI
  /** 扩展专属存储 */
  storage: ExtensionStorage
  /** 扩展日志器 */
  logger: Logger
}
```

---

## 4. 扩展注册与管理接口

```typescript
// @studio/platform/extension
export interface ExtensionRegistry {
  /** 注册扩展（从 manifest 安装） */
  register(manifest: ExtensionManifest): Promise<ExtensionInstance>

  /** 注销扩展 */
  unregister(name: string): Promise<void>

  /** 列出所有已注册扩展 */
  list(filter?: {
    type?: ExtensionType
    status?: 'installed' | 'activated' | 'deactivated'
    workspace?: string
  }): Promise<ExtensionInstance[]>

  /** 获取扩展详情 */
  get(name: string): Promise<ExtensionInstance | null>

  /** 激活扩展 */
  activate(name: string): Promise<void>

  /** 停用扩展 */
  deactivate(name: string): Promise<void>

  /** 升级扩展 */
  upgrade(name: string, newManifest: ExtensionManifest): Promise<ExtensionInstance>

  /** 安装扩展（从市场下载） */
  install(packageName: string, version?: string): Promise<ExtensionInstance>

  /** 卸载扩展 */
  uninstall(name: string): Promise<void>

  /** 检查扩展兼容性 */
  checkCompatibility(
    manifest: ExtensionManifest
  ): Promise<CompatibilityReport>
}

export interface CompatibilityReport {
  compatible: boolean
  issues: {
    severity: 'error' | 'warning'
    message: string
    detail?: string
  }[]
}

export interface ExtensionAPI {
  /** 调用平台能力 */
  capability: {
    invoke: (id: string, input: unknown, options?: unknown) => Promise<unknown>
  }
  /** 访问项目数据 */
  project: {
    getById: (id: string) => Promise<unknown>
    list: (filter: unknown) => Promise<unknown[]>
  }
  /** 发布/订阅事件 */
  event: {
    publish: (event: StudioEvent) => Promise<void>
    subscribe: (type: string, handler: EventHandler) => Promise<UnsubscribeFn>
  }
  /** 存储 */
  storage: {
    get: (key: string) => Promise<unknown>
    set: (key: string, value: unknown) => Promise<void>
    delete: (key: string) => Promise<void>
  }
  /** 网络请求（受限） */
  http: {
    get: (url: string, options?: RequestOptions) => Promise<Response>
    post: (url: string, body: unknown, options?: RequestOptions) => Promise<Response>
  }
  /** UI 扩展点 */
  ui: {
    registerSidebarPanel: (config: SidebarPanelConfig) => void
    registerModal: (config: ModalConfig) => void
  }
}
```

---

## 5. 权限模型

### 5.1 权限分类

| 权限 | 影响范围 | 默认 | 说明 |
|------|---------|------|------|
| `capability:llm` | 调用 LLM 能力 | 拒绝 | 每次调用消耗配额 |
| `capability:image` | 调用图像生成能力 | 拒绝 | 每次调用消耗配额 |
| `capability:video` | 调用视频生成能力 | 拒绝 | 每次调用消耗配额 |
| `capability:tts` | 调用语音合成能力 | 拒绝 | 每次调用消耗配额 |
| `storage:read` | 读取扩展专属存储 | 允许 | 不能读取其他扩展数据 |
| `storage:write` | 写入扩展专属存储 | 允许 | 仅限扩展命名空间 |
| `project:read` | 读取项目数据 | 审核 | 需人工审核 |
| `project:write` | 修改项目数据 | 审核 | 需人工审核 |
| `event:publish` | 发布事件 | 允许 | 事件 type 必须加扩展名前缀 |
| `event:subscribe` | 订阅事件 | 允许 | 不能订阅系统内部事件 |
| `network:http` | 发起 HTTP 请求 | 审核 | 仅限 HTTPS，域名需白名单 |
| `ui:sidebar` | 注册侧边栏面板 | 允许 | 仅限当前激活 Workspace |
| `ui:modal` | 注册弹窗 | 允许 | 需用户操作触发 |

### 5.2 权限审批流程

```
Extension Manifest
  │
  ├─ permissions: ["capability:llm", "storage:read", "ui:sidebar"]
  │     │              │                    │              │
  │     │              ▼                    ▼              ▼
  │     │         [自动授权]            [自动授权]      [自动授权]
  │     │
  │     └─ permissions: ["project:read", "project:write", "network:http"]
  │                          │                    │              │
  │                          ▼                    ▼              ▼
  │                     [人工审核]           [人工审核]      [人工审核]
  │
  ▼
安装时提示用户确认
```

---

## 6. 扩展隔离与沙箱

### 6.1 沙箱约束

| 约束 | 说明 |
|------|------|
| **文件系统隔离** | 只能访问扩展专属目录 `extensions/<name>/` |
| **网络限制** | 仅允许 HTTPS 请求到白名单域名 |
| **存储隔离** | 每个扩展有自己的 KV 存储命名空间 |
| **DOM 隔离** | UI 扩展使用 Shadow DOM |
| **CPU 限制** | 单次操作最多 10 秒 CPU 时间 |
| **内存限制** | 单扩展最大 256MB |
| **调用配额** | 按会员等级限制 API 调用次数 |

### 6.2 沙箱实现

```typescript
// @studio/platform/extension/sandbox
export class ExtensionSandbox {
  async execute<T>(
    extension: ExtensionInstance,
    handlerName: string,
    args: unknown[]
  ): Promise<T> {
    const manifest = extension.manifest
    const sandbox = new Sandbox({
      permissions: manifest.permissions,
      timeout: 10_000,        // 10 秒 CPU 超时
      memory: 256 * 1024 * 1024,  // 256MB 内存限制
      allowedUrls: this.getAllowedUrls(manifest),
      storage: new ExtensionStorage(manifest.name),
      api: this.createRestrictedAPI(manifest)
    })

    return sandbox.run(handlerName, args)
  }

  private createRestrictedAPI(manifest: ExtensionManifest): ExtensionAPI {
    return {
      capability: {
        invoke: this.withPermissionCheck(
          'capability:llm',
          manifest.permissions,
          this.capabilityRuntime.invoke.bind(this.capabilityRuntime)
        )
      },
      http: {
        get: this.withPermissionCheck(
          'network:http',
          manifest.permissions,
          this.httpProxy.get.bind(this.httpProxy)
        ),
        post: this.withPermissionCheck(
          'network:http',
          manifest.permissions,
          this.httpProxy.post.bind(this.httpProxy)
        )
      },
      // ...
    }
  }
}
```

---

## 7. Marketplace 就绪结构

从第一天起，扩展规范支持市场发布：

```typescript
// @studio/platform/extension/marketplace
export interface MarketplaceExtension {
  /** 市场唯一 ID */
  marketplaceId: string

  /** 扩展元数据 */
  manifest: ExtensionManifest

  /** 安装统计 */
  stats: {
    totalInstalls: number
    activeInstalls: number
    rating: number  // 1-5
    reviews: number
  }

  /** 兼容性 */
  compatibility: {
    platformVersion: string    // 最低支持平台版本
    testedOn: string[]        // 已验证的平台版本
  }

  /** 发布信息 */
  publishing: {
    publisher: string
    publishedAt: string
    lastUpdatedAt: string
    changelog: string
    license: string
  }

  /** 分类 */
  category: string
  tags: string[]
}
```

---

## 8. 扩展版本生命周期

```
        安装                         激活
     ┌───────┐                 ┌──────────┐
     │       │   ──────────→   │          │
     │ 已安装 │                 │ 已激活   │
     │       │   ←──────────   │          │
     └───────┘    deactivate   └──────────┘
         │                         │
         │ uninstall                │
         ▼                         ▼
     ┌───────┐               ┌──────────┐
     │ 已卸载 │               │ 已停用   │
     └───────┘               └──────────┘
                                  │
                                  │ upgrade
                                  ▼
                             ┌──────────┐
                             │ 已升级   │  → 自动重新激活
                             └──────────┘
```

### 8.1 生命周期接口

```typescript
// @studio/platform/extension/lifecycle
export interface ExtensionLifecycle {
  /** 安装后执行 */
  onInstall?(ctx: ExtensionContext): Promise<void>

  /** 激活时执行 */
  onActivate?(ctx: ExtensionContext): Promise<void>

  /** 停用时执行 */
  onDeactivate?(ctx: ExtensionContext): Promise<void>

  /** 卸载前执行 */
  onUninstall?(ctx: ExtensionContext): Promise<void>

  /** 升级时执行 */
  onUpgrade?(
    ctx: ExtensionContext,
    fromVersion: string
  ): Promise<void>
}
```

### 8.2 版本升级流程

```typescript
async function upgradeExtension(
  name: string,
  newManifest: ExtensionManifest
): Promise<ExtensionInstance> {
  const current = await extensionRegistry.get(name)
  if (!current) throw new Error(`Extension ${name} not installed`)

  // 1. 检查兼容性
  const compatibility = await extensionRegistry.checkCompatibility(newManifest)
  if (!compatibility.compatible) {
    throw new Error(`Incompatible upgrade: ${compatibility.issues[0].message}`)
  }

  // 2. 运行 onUpgrade 钩子
  if (current.manifest.hooks?.onUpgrade) {
    await executeHook(current, 'onUpgrade', current.manifest.version)
  }

  // 3. 更新 manifest
  const updated = await extensionRegistry.upgrade(name, newManifest)

  // 4. 重新激活
  if (current.status === 'activated') {
    await extensionRegistry.deactivate(name)
    await extensionRegistry.activate(name)
  }

  return updated
}
```

---

## 9. 验证规则

```
□ Extension Manifest 是否符合 JSON Schema？
□ 扩展名是否使用反向域名格式？
□ 权限是否最小化原则（只申请需要的最小权限）？
□ 是否实现了生命周期钩子？（至少 onActivate/onDeactivate）
□ 扩展是否只能通过 ExtensionAPI 访问平台能力？
□ 是否存在硬编码的平台内部 import？
□ 扩展 UI 是否使用 Shadow DOM 隔离？
□ Manifest 中的 entry 文件是否存在？
```

---

*扩展规范确保昆仑镜平台的可扩展性和生态健康。从第一天起为 Marketplace 做好准备，同时保证平台核心的安全和稳定。*
*任何绕过扩展系统直接修改平台核心代码的"扩展"都不是扩展，而是 Fork。*
