# LOCAL-APPLICATION-ARCHITECTURE.md

> **昆仑镜 AI 应用生态平台 — Task 03 本地应用架构设计**
> 版本：V1.1（技术总监拍板：**技术栈从 Electron 改为 Tauri + WebView2，Windows 优先**） | 类型：架构设计（只读，不实施） | 日期：2026-08-03

---

## 一、目标

```
Kunlun Media.exe / Kunlun Drama.exe / Kunlun Recruit.exe
```

本地客户端 = 线上工作台的**发行形态**，不是第二套产品。

**最高原则（掌柜定调）**：
1. **Online First**：线上是唯一真相源，本地只是封装。
2. **Local 不是真相源**：禁止线上一套逻辑、本地一套逻辑。
3. **插件必须线上验证后发行**：本地客户端只运行已审核发行的插件。

---

## 二、技术选型比较（Electron / Tauri / WebView2）

| 维度 | Electron | Tauri (v2) + WebView2 |
|------|----------|------------------------|
| 现有基础 | ✅ `desktop/` 已有 Electron 壳（仅作架构参考） | ⚠️ 需新建壳（Rust） |
| 前端复用 | Nuxt SPA 直接加载 | Nuxt SPA 直接加载（WebView2 内核） |
| Node 生态 | ✅ 完整（Playwright 原生支持） | ⚠️ Node 侧需 sidecar（KAOR Runtime 即 sidecar） |
| **浏览器自动化**（新媒体刚需） | ✅✅ 内嵌 Chromium 最成熟 | ⚠️ 本地浏览器控制器独立进程（系统 Chrome/独立 Chromium） |
| 打包体积 | 大（~150MB+） | **小（~10MB）** |
| 内存占用 | 高 | **低** |
| 安全性 | 一般 | **高（Rust 核心 + WebView2 隔离）** |
| 自动升级 | ✅ electron-updater | ✅ tauri updater |
| 系统要求 | 全平台 | Windows 10+（WebView2 系统预装） |

### 2.1 结论：**Tauri + WebView2（Windows 优先）** —— 技术总监拍板 2026-08-03

理由：
1. **包小（~10MB vs ~150MB）**：新媒体目标用户（运营者/小微企业）对安装包体感敏感。
2. **内存低、安全强**：Rust 核心 + WebView2 隔离，适合承载本地 AI Runtime（KAOR）。
3. **原生能力强**：系统集成/自动更新/密钥环（Keyring）更可靠——**Credential Vault 直接吃系统级加密**。
4. 浏览器自动化路径调整：本地浏览器控制器作为独立进程（本地 Chromium），经 KAOR 抽象统一控制，不再依赖 Electron 内嵌 Chromium。
5. **第一阶段 Windows 优先**：WebView2 在 Win10/11 系统级预装，覆盖目标用户绝大多数。

> 架构细节见 **KUNLUN-MEDIA-LOCAL-APP-BLUEPRINT.md**（Phase 0.5 Task B）。
> 原有 `desktop/` Electron 壳保留作参考，不迁移代码。

---

## 三、本地应用架构（如何封装现有 Nuxt 应用）

### 3.1 分层结构

```
┌─────────────────────────────────────────────────┐
│  Tauri Shell (Rust 核心)                         │
│   ├─ 窗口管理（多应用窗口/单窗口多路由）          │
│   ├─ 自动升级（tauri updater + 升级源）           │
│   ├─ 本地服务代理（http://127.0.0.1 内嵌后端?）   │
│   └─ 系统集成（托盘/开机自启/协议唤起/Keyring）   │
├─────────────────────────────────────────────────┤
│  Preload / Tauri Commands — 白名单安全桥         │
│   ├─ kunlunAPI.platform（版本/升级/系统信息）      │
│   ├─ kunlunAPI.device（本地浏览器控制授权入口）    │
│   ├─ kunlunAPI.auth（获取线上 token 的安全通道）   │
│   ├─ kunlunAPI.license（本地授权校验）            │
│   └─ kunlunAPI.vault（Credential Vault 加密访问）  │
├─────────────────────────────────────────────────┤
│  Renderer = Nuxt SPA（现有前端，按应用路由挂载）   │
│   ├─ 线上模式：加载 https://aigc.fushtn.com/...   │
│   └─ 离线能力：Service Worker 缓存的应用壳         │
└─────────────────────────────────────────────────┘
```

> 注：浏览器控制由独立本地 Chromium 进程提供（KAOR Browser Controller），不依赖壳内嵌浏览器。

### 3.2 两种渲染模式

| 模式 | 说明 | 使用场景 |
|------|------|---------|
| **在线模式（默认）** | 加载线上 URL（带 token），与 Web 版完全一致 | 绝大多数场景，符合 Online First |
| **混合模式** | 线上 UI + 本地能力注入（浏览器控制/本地文件） | 新媒体等需要本地设备能力的应用 |

**关键决策**：本地客户端**不重新实现业务逻辑**，业务逻辑 100% 在线上。本地只提供「设备能力桥」（浏览器、文件、系统）——设备能力由线上应用通过受控 API 调用。

### 3.3 设备能力桥（Device Bridge）设计

```
线上应用（如新媒体工作台）
   │  HTTPS + token
   ▼
线上后端 /api/device/bridge/*
   │  （校验 license + 权限）
   ▼
WebSocket / 轮询  ←→  本地客户端 Device Bridge Service
   │
   ├─ browser.control: 启动本地 Chromium、扫码、读取登录态
   ├─ file.access: 本地素材读写（受目录白名单约束）
   ├─ system.info: 机器信息（用于授权绑定）
   └─ clipboard/notification: 系统能力
```

- **桥接协议**：本地客户端主动连接线上（WebSocket，带设备指纹 + license），线上下发指令——**避免本地开端口被攻击**。
- **安全**：每指令校验 license + 应用权限（ApplicationPermission）+ 设备绑定。

---

## 四、如何共享 Hermes（本地 Agent 运行时）

### 4.1 云端 vs 本地运行边界

| 能力 | 云端（默认） | 本地（可选） |
|------|-------------|-------------|
| Agent 推理/编排 | ✅ Hermes Runtime（云） | 复用同一 Hermes Runtime 内核 |
| 模型调用 | 平台 Model Gateway | 本地模型（Ollama/兼容 API）或仍走云端网关 |
| 记忆 | 平台 Memory Service | 本地加密缓存 + 云端同步 |
| 浏览器控制 | 云端 BrowserRuntime（服务器） | **本地 Chromium（Device Bridge）** |
| 文件 | 平台存储 | 本地白名单目录 |

### 4.2 统一运行时内核（避免两套逻辑）

- **Hermes Runtime 内核设计为可移植**：`agent-runtime/` 的核心编排（lifecycle/orchestrator/workflow/gates）与传输层解耦。
- 云端部署 = 内核 + 云端适配器；本地部署 = 同一内核 + 本地适配器（KAOR 本地宿主，Node sidecar 进程）。
- **本地运行的不是「另一套 Hermes」**，是同一内核的本地进程实例；状态经线上同步（符合「Local 不是真相源」）。

### 4.3 运行位置决策（Runtime Placement）

```
Agent 任务 → 线上检查策略：
  需要本地设备（浏览器/文件）→ 派发本地 Hermes 实例
  纯云端能力 → 云端 Hermes 实例
  混合 → 云端编排 + 本地执行叶子任务（browser/file）
```

---

## 五、自动升级设计

1. **应用壳升级**（Tauri 本体）：tauri updater，升级源 = 平台发布通道（stable/beta），校验签名。
2. **前端应用升级**（Nuxt SPA）：无需客户端升级——线上发布即生效（Online First 的自然红利）。
3. **本地 Hermes 内核升级**：随应用壳版本捆绑，版本号进 `ApplicationVersion`。
4. **升级策略**：强制升级窗口（安全修复）+ 温和升级（功能）；升级前检查本地运行中任务，优雅暂停/恢复。

---

## 六、授权控制设计

| 层 | 机制 |
|----|------|
| 应用安装 | 线上 `ApplicationInstall` 记录 + 本地设备绑定（设备指纹） |
| License | `License` 表：licenseKey + 设备数限制 + 过期时间 + 应用/插件范围 |
| 本地校验 | 启动时本地缓存 license 快照 + 线上心跳校验（离线宽限期） |
| 设备数量 | 单 license 最多 N 台设备，激活/停用设备管理 |
| 权限强制 | 设备能力桥按 ApplicationPermission 强制（browser 权限未授予 → 桥拒绝） |
| 吊销 | 线上吊销 → 心跳周期内本地失效 |

---

## 七、新媒体作为第一个本地应用的契合度评估

| 需求 | 本地化价值 | 技术路径 |
|------|-----------|---------|
| 浏览器扫码/登录稳定性 | ✅✅ 本地 Chromium 远离服务器 IP 风控（数据中心 IP 是快手/抖音登录失效主因之一） | Device Bridge browser.control |
| 凭证安全 | ✅ 凭证可存本地加密（TPM/系统钥匙串）而非服务器 | preload 安全通道 |
| 账号矩阵 | ✅ 本地多 profile 管理天然隔离 | 本地 BrowserRuntime 多 profile |
| 素材处理 | ✅ 本地大文件不上传 | file.access |
| 离线兜底 | ⚠️ 核心逻辑在线，离线仅缓存壳 | SW 缓存 |

**结论：新媒体是本地化的最佳试点**——它既有线上 SaaS 逻辑（账号/订阅/插件），又有本地硬需求（浏览器/凭证/文件），能把整个 Device Bridge + 授权链路完整打穿。

---

## 八、风险清单

| # | 风险 | 缓解 |
|---|------|------|
| 1 | 本地客户端成为第二套逻辑 | 强制：业务逻辑 100% 线上，本地仅设备桥 + 壳；Reality Gate 校验「同一操作线上/本地结果一致」 |
| 2 | Device Bridge 安全漏洞 | 本地不开监听端口，主动出站 WebSocket；指令级权限校验；设备绑定 |
| 3 | Tauri/WebView2 兼容性 | WebView2 运行时引导安装（Win10 老版本）；Rust 核心保持最小 |
| 4 | 本地浏览器被平台风控 | 本地 IP 优势反而降低风控；保持单账号单 profile 纪律 |
