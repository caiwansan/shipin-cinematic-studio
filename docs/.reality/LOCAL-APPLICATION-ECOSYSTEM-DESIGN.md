# ECO-11 — Kunlun Local Application Ecosystem Design（Phase 0 设计稿）

**Date:** 2026-08-04 ｜ **状态:** 只读设计（ECO-11 Phase 0 Design Review）｜ **纪律:** 不写代码 / 不加表 / 不迁移 / 不构建
**掌柜定调:** 昆仑镜从 SaaS 网站升级为 AI 应用操作系统入口；新媒体只是第一个本地试点，不是唯一目标

---

## 0. Phase 0 现状审计（只读，基于当前代码）

### 0.1 云端生态已就绪（Phase 0/1 地基）

| 层 | 现状 | 代码证据 |
|---|---|---|
| 应用身份 | ✅ 9 内置应用注册（media/drama/novel/recruit/legal/mall/music/ad/geo） | `builtin-applications.ts` + `ecology_applications` |
| 插件身份 | ✅ ECO-02 manifest 校验（zod strict） | `plugin-manifest.schema.ts` |
| 运行边界 | ✅ KAOR 契约层（4 delegated + 2 contract） | `kaor-runtime.interface.ts` |
| 商业授权 | ✅ License 状态机 + 审计 | `license.service.ts` + `ecology_licenses` |
| 开发者生产链 | ✅ 开发者身份 + 发布请求 + 协议 | `ecology_developers` |
| 插件发现中心 | ✅ Marketplace LISTED + 安装 + launch-check | `ecology_marketplace_items` + `ecology_plugin_installations` |

### 0.2 五个审计问题的结论

| # | 问题 | 结论 | 依据 |
|---|---|---|---|
| 1 | 当前 Application 是否支持本地发行？ | ❌ **不支持** | ApplicationAdapter 只有身份/能力/入口/权限/健康声明，无 desktop 维度（安装包、更新通道、本地入口映射）。但 `workspaceEntry` + `backendModule` 已具备映射本地路由的种子 |
| 2 | 当前 License 是否支持设备授权？ | ⚠️ **半支持** | `ecology_licenses.machineId` 已预留、`license_check_logs.source='local_app'` + `machineId` 已预留、`LicenseCheckParams` 已接受 machineId。但 `checkLicense()` **未校验** machineId 绑定关系，无设备注册/限额/撤销逻辑。`@@unique([organizationId, pluginId])` 一组织一许可，多设备需决策 |
| 3 | 当前 Plugin Manifest 是否支持本地加载？ | ❌ **不支持** | manifest 仅 `runtime: { kaor: boolean }`，无 local loader 声明（入口文件/本地权限/沙箱/资源）。且 zod `.strict()` 拒绝未知字段 → 扩展必须显式改 schema（这是防线，不是缺陷） |
| 4 | KAOR 是否需要 Local Runtime Adapter？ | ✅ **需要** | `kaor-capabilities.ts` 明确 `memory`/`tool` 为 `contract` 状态（注释：执行待 Kunlun Media Local App Sprint）。本地需实现契约接口的 local 版本：License 校验走云，执行走本地 |
| 5 | Tauri 如何接入现有 Nuxt？ | ✅ **可行（低风险）** | Nuxt `ssr:false` + `nitro preset: node-server` → 本地用 `nuxt generate` 输出静态产物，Tauri WebView 指向 `dist/index.html`；API 走 `https://aigc.fushtn.com`（或本地反代）；auth token 沿用现有 localStorage + token-cache（`stores/auth.ts` 双写机制），Tauri 侧注入 `window.__TAURI__` 桥 |

### 0.3 结论

**本地化不是「把 SaaS 打包」，而是补四块桥：**
1. `ecology_devices` 设备身份与绑定（License 按设备生效）
2. `local_apps` 本地应用安装记录（谁在哪个设备装了 Kunlun Media.exe）
3. `local_plugin_runtime` 本地插件运行时状态（本地加载了什么、License 是否 ACTIVE、状态 RUNNING/STOPPED）
4. `local_sessions` 本地会话（设备 ↔ 用户 ↔ 应用的活跃会话，支持退出/吊销）

KAOR 契约接口**不需要重写**，只需新增 `local-runtime-adapter` 实现同一接口，云端 Hermes 委托与本地执行并存。

---

## 1. 总体架构（云端 ↔ 本地）

```
┌─────────────────────────────────────────────────────────────┐
│                    昆仑镜 Cloud (不变)                        │
│  Application Center │ Plugin Center │ License Server        │
│  Developer Center   │ Commerce      │ Identity (JWT)        │
└───────────────┬─────────────────────────────────────────────┘
                │ HTTPS (JSON) — License Check / Plugin Config
                │ Device Register / Session Heartbeat
┌───────────────▼─────────────────────────────────────────────┐
│              Kunlun Desktop Shell (Tauri)                    │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  Nuxt Workspace (本地静态产物, ssr:false)              │   │
│  │  → 登录 → 应用列表 → 启动工作台（Steam 模式）           │   │
│  └───────────────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  KAOR Local Runtime Adapter（实现 KAORRuntime 接口）   │   │
│  │  agent.lifecycle: 委托云 Hermes（远程执行）             │   │
│  │  memory:          本地加密存储 + 云同步（可选）          │   │
│  │  tool:            本地工具（浏览器/文件）+ 权限校验      │   │
│  │  workflow/scheduler: 委托云                          │   │
│  └───────────────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  Plugin Loader（本地插件加载）                          │   │
│  │  请求 License → 校验 → 下载插件配置 → 加载 AI 员工 → 运行 │   │
│  └───────────────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  Local Resources（本地浏览器 / 本地文件 / 本地缓存）     │   │
│  └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 2. 设备与授权模型（Device Entitlement Model）

### 2.1 设备注册流程

```
首次启动 Kunlun.exe
  → 生成设备指纹 (machineId: SHA-256(CPU+主板+磁盘序列号) 不可逆)
  → POST /api/ecosystem/devices/register  { machineId, deviceName, osVersion }
  → 返回 deviceId + deviceToken（设备凭据，本地安全存储）
  → 绑定当前登录用户（JWT organizationId）
```

### 2.2 License 设备绑定策略（三选一，掌柜定）

| 策略 | 语义 | 适合 |
|---|---|---|
| A. 组织级（现状） | License 绑定 organizationId，任意设备可用 | 当前无设备概念，兼容线上 |
| B. 设备级（推荐 MVP） | License 绑定 organizationId + deviceId，一台设备一个许可 | 防「一个账号无限复制 exe」 |
| C. 席位级 | License 允许 N 台设备（并发 N） | 未来团队版 |

**ECO-11.2 建议先做 B 设备级**（掌柜「防止一个账号无限复制 exe」的原话），schema 兼容 A（deviceId 可空 = 组织级）。

### 2.3 新增 4 表设计（纯设计，ECO-11.2 才落地）

```prisma
// ECO-11 — Local Application Ecosystem（设计稿，未实施）
// 纪律：只新增 ecology_* 表；不碰 PaymentOrder/Subscription/User/Organization/Agent/Hermes

model EcologyDevice {
  id            String   @id @default(dbgenerated("gen_random_uuid()::text")) @db.Text
  organizationId String  @map("organization_id") @db.Text  // 归属组织（设备不能跨组织）
  machineId     String   @unique @map("machine_id") @db.VarChar(120)  // 设备指纹（不可逆哈希）
  deviceName    String?  @map("device_name") @db.VarChar(120)
  osVersion     String?  @map("os_version") @db.VarChar(60)
  status        String   @default("ACTIVE") @db.VarChar(20)  // ACTIVE | DISABLED | REVOKED
  lastSeenAt    DateTime? @map("last_seen_at")
  createdAt     DateTime @default(now()) @map("created_at")
  @@index([organizationId])
  @@map("ecology_devices")
}

model EcologyLocalApp {
  id            String   @id @default(dbgenerated("gen_random_uuid()::text")) @db.Text
  organizationId String  @map("organization_id") @db.Text
  deviceId      String   @map("device_id") @db.Text  // EcologyDevice.id
  applicationId String   @map("application_id") @db.Text  // ecology_applications.id (kunlun-media)
  version       String   @db.VarChar(30)  // 本地安装的应用版本（semver）
  installPath   String?  @map("install_path") @db.Text
  status        String   @default("INSTALLED") @db.VarChar(20)  // INSTALLED | UNINSTALLED | UPDATING
  installedAt   DateTime @default(now()) @map("installed_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  @@unique([deviceId, applicationId])
  @@map("ecology_local_apps")
}

model EcologyLocalPluginRuntime {
  id            String   @id @default(dbgenerated("gen_random_uuid()::text")) @db.Text
  organizationId String  @map("organization_id") @db.Text
  deviceId      String   @map("device_id") @db.Text
  pluginId      String   @map("plugin_id") @db.Text  // ecology_plugins.id
  licenseId     String?  @map("license_id") @db.Text  // ecology_licenses.id（校验快照）
  status        String   @default("LOADED") @db.VarChar(20)  // LOADED | RUNNING | STOPPED | LICENSE_EXPIRED | ERROR
  configVersion String?  @map("config_version") @db.VarChar(30)  // 插件配置版本（本地缓存一致性）
  startedAt     DateTime? @map("started_at")
  stoppedAt     DateTime? @map("stopped_at")
  lastHeartbeatAt DateTime? @map("last_heartbeat_at")
  @@unique([deviceId, pluginId])
  @@map("ecology_local_plugin_runtime")
}

model EcologyLocalSession {
  id            String   @id @default(dbgenerated("gen_random_uuid()::text")) @db.Text
  organizationId String  @map("organization_id") @db.Text
  userId        String   @map("user_id") @db.Text  // User.id（登录用户）
  deviceId      String   @map("device_id") @db.Text
  appId         String?  @map("app_id") @db.Text  // 可选：应用级会话
  sessionToken  String   @unique @map("session_token") @db.Text  // 设备本地会话凭据
  status        String   @default("ACTIVE") @db.VarChar(20)  // ACTIVE | EXPIRED | REVOKED
  expiresAt     DateTime @map("expires_at")
  createdAt     DateTime @default(now()) @map("created_at")
  @@index([organizationId, deviceId])
  @@map("ecology_local_sessions")
}
```

### 2.4 License Check 本地语义（复用现有接口）

```
本地启动插件
  → POST /api/ecosystem/marketplace/launch-check
      body: { pluginId, machineId, source: 'local_app' }
  → 云：校验 License ACTIVE + expireAt + 设备绑定（ECO-11.2 加 deviceId 匹配）
  → allowed:true → 返回插件配置 + entitlements → 本地加载
  → allowed:false → 插件停止，应用继续运行（掌柜 G7 语义：插件过期应用不退出）
```

**现有 `license.service.ts` 已验证 source/machineId 参数贯通，唯一缺口 = checkLicense 未校验「license.machineId === params.machineId」。**

## 3. 安全边界（Security Boundary）

| 风险 | 对策 |
|---|---|
| exe 无限复制 | 设备指纹 + 设备级 License（B 策略） |
| 本地存储泄露 | Tauri 安全存储（keychain/DPAPI）存 deviceToken；插件配置 AES-GCM 加密落盘 |
| 插件代码执行 | **Phase 0 不执行第三方代码**；ECO-11.3 只加载 manifest 配置 + 声明能力，AI 员工执行走云端 Hermes（本地仅 UI 壳） |
| 本地浏览器越权 | 复用媒体工作台 CDP 权限边界；插件声明的 permissions 白名单校验（manifest 已有） |
| token 窃取 | 现有 auth 双写机制（内存闭包 + localStorage）延续；Tauri 侧 token 存 webview 内存，不落盘 |
| 吊销 | 设备 REVOKED → 本地 heartbeat 403 → 强制登出 |

## 4. 更新机制（Update Mechanism）

```
Tauri updater（官方 tauri-plugin-updater）
  → 启动时检查 https://aigc.fushtn.com/desktop/updates/{platform}/{currentVersion}
  → 云端 manifest: { version, notes, signature, url }
  → 下载 NSIS(Windows) / DMG(macOS) 增量包 → 校验签名 → 静默安装 → 重启
  → 应用版本记录在 ecology_local_apps.version（可回滚审计）
```

## 5. 与现有工作台的关系（零影响承诺）

```
线上工作台（现状）              本地应用（ECO-11.2+）
/workspace/media      →     Kunlun Media.exe（同一 Nuxt 产物，路由不变）
/studio/v2            →     Kunlun Drama.exe（未来）
/workspace/recruitment→     Kunlun Recruit.exe（未来）

原则：线上验证 → Application Adapter → Local Shell → 发行
本地壳只是「容器」，业务路由/API/插件全部复用现有实现，不改业务代码。
```

## 6. Sprint 拆分与验收

| Sprint | 内容 | 验收 |
|---|---|---|
| ECO-11.1 | 本设计文档定稿（掌柜评审） | 掌柜批准设计 |
| ECO-11.2 | 4 表落地 + devices 注册 + License 设备绑定 + Tauri Shell（登录→应用列表→启动工作台） | Reality Gate：设备注册/绑定/吊销 + 双设备隔离 |
| ECO-11.3 | Plugin Loader（launch-check 本地化 + 配置下载 + 插件状态机） | Reality Gate：License 过期插件停、应用不停 |
| ECO-11.4 | Kunlun Media Local App（免费底包 + AI 员工插件订阅） | 真机验收：安装→登录→设备绑定→插件订阅→运行→到期停止 |

**商业模型（掌柜已定）：免费下载安装 + 基础功能免费 + AI 员工插件订阅（599/月等）→ License Server → ACTIVE → 插件启动 → 到期 → 插件停止应用继续。**

---

*本文档为设计稿，未实施任何代码变更。落地前需掌柜评审。*
