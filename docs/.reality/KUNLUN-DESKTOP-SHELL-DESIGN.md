# ECO-11.2 — Kunlun Desktop Shell Design（桌面壳）

**Date:** 2026-08-04 ｜ **状态:** 只读设计 ｜ **类比:** Steam 客户端（登录 → 应用列表 → 启动工作台）

---

## 1. 定位

Kunlun Desktop Shell = 昆仑镜所有本地工作台的**统一容器**。不是新媒体专属，是平台级壳。

```
┌─────────────────────────────────────────────┐
│  Kunlun.exe（Tauri v2）                     │
│  ┌───────────┐  ┌────────────────────────┐  │
│  │ 登录窗     │→ │ 应用列表（Steam 模式）  │  │
│  │ JWT + 设备 │  │ Kunlun Media  ▶ 启动   │  │
│  │ 注册       │  │ Kunlun Drama (未来)    │  │
│  └───────────┘  │ Kunlun Recruit (未来)   │  │
│                 └───────────┬────────────┘  │
│                 ┌───────────▼────────────┐  │
│                 │ WebView 工作台          │  │
│                 │ Nuxt 本地静态产物        │  │
│                 │ (route: /workspace/media)│ │
│                 └────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## 2. 技术选型（审计 #5 结论：可行）

| 项 | 选择 | 依据 |
|---|---|---|
| 框架 | Tauri v2 (Rust) | 体积小（~10MB vs Electron ~100MB）、系统 WebView、Rust 安全边界 |
| 前端 | 现有 Nuxt 3（ssr:false） | `nuxt generate` → `dist/` 静态产物，Tauri 指向 `dist/index.html`，**业务零改造** |
| 状态 | 现有 stores/auth（localStorage + 内存双写） | Tauri WebView 原生支持，不改 auth 逻辑 |
| API | https://aigc.fushtn.com（生产）/ 本地 mock | 复用现有后端全部接口 |
| 自动更新 | tauri-plugin-updater | 官方方案，签名校验 |
| 设备凭据 | Tauri 安全存储（keychain/DPAPI） | deviceToken 不落明文 |

## 3. 目录结构（Tauri workspace 建议）

```
shipin-cinematic-studio/
├── frontend/               # 现有 Nuxt（不动）
├── desktop/                # 新增 Tauri 壳（ECO-11.2 才创建）
│   ├── src-tauri/
│   │   ├── src/
│   │   │   ├── main.rs           # 窗口/生命周期
│   │   │   ├── device.rs         # 设备指纹 + 注册
│   │   │   ├── license.rs        # launch-check 客户端
│   │   │   ├── session.rs        # 本地会话 heartbeat
│   │   │   └── updater.rs        # 更新检查
│   │   ├── capabilities/         # Tauri 权限白名单
│   │   └── tauri.conf.json       # WebView 指向 ../frontend/dist
│   └── package.json
└── docs/.reality/               # 设计文档
```

## 4. 启动流程（Boot Sequence）

```
双击 Kunlun.exe
  ├─ ① 检查本地设备凭据（keychain）
  │    无 → 生成 machineId（SHA-256(硬件指纹)）→ 注册窗口
  ├─ ② 注册：POST /api/ecosystem/devices/register { machineId, deviceName, os }
  │    → deviceId + deviceToken（存 keychain）
  ├─ ③ 登录：现有 /api/auth/login（WebView 内完成，token 存内存 + 会话）
  │    → GET /api/ecosystem/devices/me 确认设备归属 org
  ├─ ④ 应用列表：GET /api/ecosystem/apps（ecology_applications，含本地安装状态）
  │    → 已安装应用显示「启动」，未安装显示「安装」（免费底包一键装）
  ├─ ⑤ 启动工作台：WebView 加载本地 dist + 注入 token → 业务路由
  │    → 后台：本地会话 heartbeat（每 60s，维持 ecology_local_sessions ACTIVE）
  └─ 退出：注销本地会话（REVOKED）+ 清理内存 token
```

## 5. 设备绑定 UX（防复制 exe）

```
首次登录成功
  → 云端记录 deviceId ↔ organizationId 绑定
  → 同账号第二台设备登录：
      · 若 License 策略 B（设备级）→ 新设备可登录应用，但插件 launch-check denied（提示去云端解绑/加席位）
      · 若策略 A（组织级）→ 第二台直接可用（兼容现状，ECO-11.2 默认 B 但可配）
  → 云端「设备管理」页（未来）可 REVOKE 任意设备 → 该设备 heartbeat 403 → 强制登出
```

## 6. 更新流程

```
启动时（或每 4h）→ GET https://aigc.fushtn.com/desktop/updates/{os}/{currentVersion}
  → 有新版 → 下载签名包 → 校验 → 提示重启安装 → ecology_local_apps.version 更新
  → 更新失败 → 保持旧版运行（不回滚、不损坏本地数据）
```

## 7. 安全边界（Shell 专属）

| 风险 | 对策 |
|---|---|
| 伪造 exe | 代码签名（Windows Authenticode / macOS notarization）+ 更新签名校验 |
| 硬件指纹碰撞 | machineId 用多因子哈希（CPU+主板+磁盘序列号），不可逆，不存原始序列号 |
| WebView 注入 | 仅加载本地静态产物 + 白名单域；禁用 remote URL 导航（除 aigc.fushtn.com） |
| 会话劫持 | sessionToken 短时效 + heartbeat 续期 + 设备 IP 变化检测（可选） |
| 明文敏感数据 | keychain 存 deviceToken；插件配置 AES-GCM；浏览器 profile 沿用现有隔离 |

## 8. 与 ECO-11.3/11.4 的关系

- ECO-11.2 交付「壳」：登录/设备/应用列表/启动/更新 —— **不加载插件**
- ECO-11.3 在壳内加 Plugin Loader（独立模块，不污染壳）
- ECO-11.4 把 Kunlun Media 工作台接进来（复用现有 /workspace/media 全部能力）

## 9. 验收标准（ECO-11.2 Reality Gate 草案）

1. 安装 → 注册设备 → 登录 → 应用列表展示 9 内置应用
2. 启动 Kunlun Media 工作台 → 路由 /workspace/media 正常（本地产物）
3. 双设备：A/B 均注册；B 未绑定 License → B 插件启动 denied（设备隔离实证）
4. 设备 REVOKE → 本地 heartbeat 403 → 强制登出
5. 应用更新 → 版本号变更 + ecology_local_apps.version 同步
6. 退出登录 → 本地会话 REVOKED + token 清理

---

*设计稿，未实施。*
