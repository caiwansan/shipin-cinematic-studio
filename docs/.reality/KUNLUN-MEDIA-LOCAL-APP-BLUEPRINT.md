# KUNLUN-MEDIA-LOCAL-APP-BLUEPRINT.md

> **昆仑镜 AI 应用生态平台 — Phase 0.5 Task B：Kunlun Media 本地应用技术蓝图**
> 版本：V1.0 | 类型：技术蓝图（只读，不实施） | 日期：2026-08-03
> 技术总监拍板：**第一阶段 Windows 优先，技术栈 = Tauri + WebView2**（替代原 Electron 方案）

---

## 一、技术栈决策

| 方案 | 优点 | 缺点 | 裁决 |
|------|------|------|------|
| Electron | 成熟、生态大 | 包大（~150MB+）、内存高、Chromium 自带 | ❌ 备选（已有 desktop/ 壳可参考） |
| **Tauri + WebView2** | **包小（~10MB）、内存低、安全（Rust 核心）、原生能力强、适合本地 AI Runtime** | WebView2 需 Windows 10+ 系统自带（Win11 标配） | ✅ **首选** |

**Windows 优先**：目标用户（新媒体运营者/小微企业）Windows 占绝对主流；WebView2 在 Win10/11 已系统级预装。

```
Kunlun Media.exe
     │
Tauri Shell（Rust 核心：窗口/系统集成/自动更新/原生权限）
     │
Nuxt Application（现有前端 UI 复用，前端路由零重写）
     │
KAOR Runtime（本地 Agent 内核，Rust/Node 混合宿主）
     │
Local Browser（本地 Chromium 控制器）
     │
Cloud License Server（线上：身份/订阅/授权/更新）
```

---

## 二、组件架构（冻结版）

```
┌─────────────────────────────────────────────────────┐
│                  Kunlun Media.exe                    │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ Tauri Shell (Rust)                            │  │
│  │   ├─ Window / Tray / 自动更新                 │  │
│  │   ├─ 原生能力桥（文件/系统/通知/开机启动）      │  │
│  │   └─ WebView2 宿主（加载 Nuxt 前端）            │  │
│  └──────────────────┬────────────────────────────┘  │
│                     │ IPC (Tauri commands)          │
│  ┌──────────────────▼────────────────────────────┐  │
│  │ KAOR Runtime（本地）                           │  │
│  │   ├─ Agent Lifecycle（本地 Agent 实例）         │  │
│  │   ├─ Browser Controller（本地 Chromium）        │  │
│  │   ├─ Credential Vault（凭证保险库，AES 加密）    │  │
│  │   ├─ Plugin Loader（Manifest 解析 + 授权校验）   │  │
│  │   ├─ Permission Sandbox（本地执行时闸门）        │  │
│  │   └─ Device Bridge（→ 云端 WebSocket，主动出站） │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  本地数据（Workspace 命名空间）                      │
│   %LOCALAPPDATA%/kunlun-media/                      │
│    ├─ vault/       凭证（加密）                     │
│    ├─ profiles/    浏览器 profile（登录态）          │
│    ├─ data/        应用数据/插件数据                 │
│    └─ cache/       缓存（可清）                     │
└─────────────────────────────────────────────────────┘
            │ Device Bridge (WSS, 心跳+双向)
            ▼
┌─────────────────────────────────────────────────────┐
│ Cloud Platform（线上）                               │
│  Identity / Subscription / License Server /         │
│  Plugin Marketplace / Update / Audit                 │
└─────────────────────────────────────────────────────┘
```

---

## 三、免费 vs 付费能力边界（产品定义）

### 3.1 免费底包（Kunlun Media App 本体）

| 能力 | 说明 |
|------|------|
| 账号管理 | 多平台账号本地绑定、登录状态查看（本地浏览器扫码） |
| 内容管理 | 草稿/素材/内容日历（本地 + 云端同步） |
| 基础发布 | 手动发布（人工确认式） |
| 基础数据查看 | 核心指标看板（只读） |
| 本地安全 | Credential Vault、本地浏览器隔离 |

### 3.2 付费插件（订阅制，在线授权）

| 插件 | 定价 | 能力 |
|------|------|------|
| AI爆款分析师（tool） | ¥299/月 | 爆款拆解/趋势分析 |
| AI内容运营经理（agent） | ¥599/月 | 自动选题/标题/热点/计划 |
| AI短视频导演（agent） | ¥399/月 | 脚本/分镜/剪辑方案 |
| AI评论运营（agent） | ¥299/月 | 评论分析/画像/互动 |
| AI矩阵运营团队（agent 多实例） | ¥1,999/月 | 运营经理+数据分析师+文案+增长 |
| 自动发布引擎（tool，审核后） | ¥199/月 | 定时/多平台分发 |

---

## 四、核心子系统设计

### 4.1 Credential Vault（凭证保险库）

```
本地加密存储（AES-256-GCM，密钥来自 Tauri 系统 Keyring）
  ├─ 平台 cookies / tokens（登录态凭证）
  ├─ 不落盘明文、不随应用卸载删除（可迁移）
  ├─ 访问需 Permission Sandbox 授权（用户可查/可吊销）
  └─ 线上 SSOT 只存身份元数据（accountName/avatar/externalId），不存凭证
```

**核心价值**：凭证永远不出用户电脑——根治服务器 IP 风控（快手/小红书/视频号登录失败的架构根因）。

### 4.2 Browser Controller（本地浏览器）

```
本地 Chromium 实例（独立 user-data-dir，按平台隔离）
  ├─ 扫码登录（本地二维码 → 本地会话）
  ├─ 数据页读取（本地 IP = 用户真实网络环境）
  ├─ 探针/提取器按 KAOR 边界：浏览器抽象在 Runtime，平台适配在 Application
  └─ 与云端隔离：云端永不直接控制浏览器，只经 Device Bridge 下发指令
```

### 4.3 Device Bridge（本地 ↔ 云端）

```
主动出站 WebSocket（WSS，TLS 1.3）
  ├─ 心跳 + 重连（断网本地能力降级不崩溃）
  ├─ 上行：状态上报/指标回传/审计事件
  ├─ 下行：License 校验/插件指令/远程任务（用户确认后）
  └─ 所有云端→本地指令需 Permission Sandbox 闸门
```

### 4.4 License 授权链路（在线强制）

```
启动 → Tauri Shell → KAOR 启动
  → Device Bridge 连接 License Server
  → 校验：用户身份 + 订阅状态 + 插件授权（Active/Expired/Suspended）
  → 通过 → Plugin Loader 加载插件能力
  → Expired → 插件能力暂停（数据保留 30 天），App 基础功能继续
  → Suspended → 安全风控冻结，仅可申诉
```

---

## 五、与现有代码的复用策略

| 现有资产 | 去向 | 说明 |
|---------|------|------|
| Nuxt 前端（workspaces/media + accounts.vue 等） | **复用** | 前端路由零重写，Tauri 内嵌同一构建产物 |
| 身份 SSOT（EnterpriseChannelAccount） | **复用** | 线上身份元数据不动 |
| 平台适配器/登录状态机（enterprise/channel） | **迁移到 Application 层** | 保持领域语义，随应用包分发 |
| 浏览器抽象（BrowserRuntime） | **下沉 Runtime** | 通用抽象，本地/云端双实现 |
| 探针/指标提取器 | **迁移 Application** | 配置化插件私域 |
| prisma 数据层（账号/指标/内容） | **线上保留** | 云端 SSOT + 本地缓存双写 |
| desktop/ Electron 壳 | **弃用（参考）** | 代码不迁移，架构参考其 Device Bridge 思路 |

---

## 六、安全模型

1. **凭证最小暴露**：凭证仅存本地 Vault；网络传输只有加密后的授权令牌与身份元数据。
2. **WebView2 加固**：CSP 严格、禁远程脚本、IPC 白名单（Tauri commands 显式注册）。
3. **权限闸门双层**：本地 Permission Sandbox（执行时）+ 云端 License（订阅时）。
4. **浏览器隔离**：每平台独立 user-data-dir，跨平台 profile 不共享。
5. **审计上云**：本地关键操作（登录/发布/凭证访问）审计事件经 Device Bridge 上送。

---

## 七、里程碑拆分（进入开发后的执行路径）

```
M1  Tauri 壳 + Nuxt 嵌入 + Device Bridge 打通（可装可跑）
M2  Credential Vault + 本地浏览器扫码登录（Kunlun Media 账号闭环）
M3  KAOR 本地 Agent 宿主 + Plugin Loader（首个插件：AI内容运营经理）
M4  License Server 接入（在线授权全链路）
M5  免费底包功能完整（账号/内容/基础发布/数据查看）
M6  插件商城上架 + 付费闭环
```

---

## 八、风险与对策

| 风险 | 对策 |
|------|------|
| WebView2 兼容性（老 Win10） | 提供 WebView2 运行时引导安装（微软官方，静默装） |
| Tauri 团队技能缺口 | Rust 核心保持最小（仅壳/桥/保险库），业务全在 JS 层 |
| 本地凭证丢失 | Vault 加密迁移 + 导出导入 + 线上身份元数据可重新扫码 |
| 本地与云端数据一致性 | 云端 SSOT + 本地缓存 + 冲突以线上为准（明确同步策略） |
| 离线场景 | 本地能力降级运行，恢复后同步 |
