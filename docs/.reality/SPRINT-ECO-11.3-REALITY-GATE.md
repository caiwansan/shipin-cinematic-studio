# SPRINT-ECO-11.3-REALITY-GATE.md — Local Plugin Runtime

> **SPRINT-ECO-11.3 完成报告** | 日期：2026-08-04 | 状态：✅ **PASS（36/36）** + ECO-11.2 回归 25/25
> 掌柜批准（2026-08-04）：D1/D4/D7 冻结；本地 = 入口 + 状态管理，云端 = AI 执行真相

---

## 1. 目标达成

第一次打通完整链路：

```
Kunlun Desktop（Tauri 壳）
   ↓
Local Plugin Runtime（ecology_local_plugin_runtime 生命周期）
   ↓
License（ecology_licenses 实时授权判定，唯一真源）
   ↓
KAOR（ecology_plugin_runtime_bindings 能力检查）
   ↓
AI员工插件（ai-content-ops-manager，manifest.local 白名单唯一启用）
   ↓
新媒体工作台（线上，?plugin= 上下文入口）
```

**核心不变式（D7 冻结）**：本地 = 入口 + 状态管理；云端 = AI 执行真相。本地零代码执行（G6 实证）。

---

## 2. 数据变更清单（纯新增 ecology_* 表）

### 2.1 新表 `ecology_local_plugin_runtime`（迁移 `sprint-eco-11-3-local-plugin-runtime/migration.sql`）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | gen_random_uuid |
| organization_id | TEXT | 组织隔离（与设备/许可同源） |
| device_id | TEXT FK→ecology_devices.id | 级联删除 |
| plugin_id | TEXT FK→ecology_plugins.id | 级联删除 |
| version | VARCHAR(30) | 本地插件实例版本（semver） |
| status | VARCHAR(20) | INSTALLED \| RUNNING \| DISABLED \| UNINSTALLED |
| installed_at | TIMESTAMP | 安装时间 |
| started_at | TIMESTAMP NULL | 最近进入 RUNNING |
| last_heartbeat | TIMESTAMP NULL | 插件运行时心跳 |
| stopped_at | TIMESTAMP NULL | 最近退出 RUNNING |
| created_at / updated_at | TIMESTAMP | 审计 |

**唯一约束**：`UNIQUE(device_id, plugin_id)`（每设备每插件单实例；重装/升级 = upsert）
**索引**：organization_id / plugin_id / last_heartbeat

**D1 冻结遵守**：表内**无** licenseStatus / allowed / permissionResult —— 授权结论永远实时 join `ecology_licenses`（单一授权源）。

### 2.2 既有表变更（零结构变更）
- `ecology_plugins.manifest` Json 快照列承载 `runtime.local`（ECO-02 只存不执行语义，无新列）
- `ecology_devices` / `ecology_local_apps` / `ecology_licenses` / `ecology_plugin_runtime_bindings` 均未改结构

---

## 3. API 清单

### 3.1 新增（3 个轻端点 + 1 个卸载端点）

| 端点 | 语义 | 鉴权 |
|---|---|---|
| `POST /api/ecosystem/devices/:deviceId/plugins/:pluginId/start` | 桌面插件启动：唯一授权判定 + local 白名单 + KAOR 绑定 → upsert runtime RUNNING | JWT + 组织匹配 |
| `POST /api/ecosystem/devices/:deviceId/plugins/:pluginId/heartbeat` | 插件运行时心跳续命（吊销/禁用 → allowed:false 降级信号） | 设备凭据 token |
| `POST /api/ecosystem/devices/:deviceId/plugins/:pluginId/stop` | 停用 → DISABLED + stoppedAt（不删行） | JWT + 组织匹配 |
| `POST /api/ecosystem/devices/:deviceId/plugins/:pluginId/uninstall` | 卸载 → UNINSTALLED + stoppedAt（不删行，保留审计轨迹） | JWT + 组织匹配 |

### 3.2 扩展
- `POST /devices/:deviceId/launch-check`：重构为调用 `DeviceService.checkPluginLaunch`（授权判定唯一实现，D4）——响应格式不变（ECO-11.2 回归 25/25 证明零破坏）
- `GET /devices/:deviceId/authorized-plugins`：返回项新增 `runtimeLocal` / `kaorBound` / `runtimeStatus` / `runtimeVersion` / `lastHeartbeat`（G7 双端一致性 Desktop 侧来源）

### 3.3 门禁链（start 端点，四重）
```
1. 设备 ACTIVE（ecology_devices）
2. License ACTIVE（ecology_licenses 实时 join）          ← checkPluginLaunch（唯一授权判定）
3. manifest.runtime.local === true（白名单）              ← NOT_LOCAL_CAPABLE
4. KAOR runtime 绑定存在（ecology_plugin_runtime_bindings）← NO_KAOR_BINDING
全部通过 → 审计（ecology_license_check_logs source=local_app）→ runtime RUNNING
```

---

## 4. Desktop 变更清单

- `desktop/ui/index.html`：
  - 插件授权页升级为「授权 + 本地运行时」卡片区：runtimeLocal 徽标（本地/仅云端）、runtimeStatus（未启动/本地:RUNNING）、KAOR 绑定状态、本地版本
  - 操作按钮：启动 / 停止 / 卸载 / 打开工作台（`/workspace/media?plugin=<pluginId>` 上下文入口）
  - 心跳循环扩展：对 RUNNING 的 local 插件补发插件心跳（60s）
  - 零本地代码执行：无任何 dll/exe/node/python 动态加载路径（G6 静态检查实证）
- `desktop/src-tauri/`：零改动（能力边界已足够：登录/凭据/域名白名单 open_workspace）

---

## 5. 插件闭环证据（Task04 — AI内容运营经理）

```
设备 A（org A）注册 → 安装 kunlun-media → grant ai-content-ops-manager License（365d）
  → bind KAOR（ECO-03 语义：插件必须先绑定 runtime）
  → start → allowed:true + runtime RUNNING（startedAt 记录）
  → heartbeat 续命（错误凭据 403 拒绝）
  → stop → DISABLED + stoppedAt → uninstall → UNINSTALLED（不删行）
```

---

## 6. Reality Gate 结果（G1–G7）

### 脚本
- `scripts/reality-check-eco-11-3.cjs` → **36/36 PASS**
- `scripts/reality-check-eco-11-3-manifest.ts` → **7/7 PASS**（manifest 强约束单测）
- 回归：`scripts/reality-check-eco-11-2.cjs` → **25/25 PASS**（launch-check 重构零破坏）

### G1 Windows 安装包 ✅（本机静态 + 真机清单）
- NSIS 配置 ✅ / WebView2 bootstrapper ✅ / tauri build 脚本 ✅ / productName=Kunlun Desktop ✅
- **真机清单（掌柜 Windows 机）**：`cd desktop && npm install && npm run tauri build` → 安装/启动/登录/插件授权/启动工作台 → 卸载重装数据保留

### G2 设备隔离 ✅
- 设备 A（有授权）start → allowed:true + RUNNING
- 设备 B（无授权，org B）start → **NO_LICENSE 拒绝**
- 组织 B 操作组织 A 设备插件 → **403 DEVICE_ORG_MISMATCH**

### G3 订阅过期 ✅（ECO-04 原则实证）
- expire → 插件 start → **EXPIRED 拒绝**
- **应用继续打开**：9 应用目录可读 + kunlun-media 应用信息可读（应用本体与 License 解耦）
- authorized-plugins 不再返回目标插件（灰态）

### G4 插件恢复 ✅
- renew → ACTIVE → start → allowed:true + runtime 恢复 RUNNING
- 心跳续命 ✅ / 错误凭据 403 ✅ / stop → DISABLED ✅ / uninstall → UNINSTALLED 不删行 ✅

### G5 线上工作台独立 ✅
- 线上新媒体工作台可达（200）
- Desktop 心跳走本地 API，不依赖线上会话（解耦实证）

### G6 插件执行边界 ✅（本地零代码执行证明）
- Desktop UI 无 dlopen/LoadLibrary/child_process/spawn 等动态加载（静态检查）
- Rust 壳无 Command::new/std::process 插件执行通道
- 后端 start 仅写运行时记录，无进程/代码执行
- manifest strict 白名单：`runtime{kaor:false, local:true}` **拒绝**、未知字段拒绝、`local` 缺省 false
- **Local Plugin Runtime ≠ Plugin Runtime Engine**（定位 = 本地应用生命周期管理器）

### G7 双端一致性 ✅
- Web `/license/mine` ACTIVE == Desktop authorized-plugins ACTIVE（同一授权源）
- 过期后 Web EXPIRED == Desktop 不再提供插件（双端同步降级）
- Desktop 能力信息完整（runtimeLocal=true + kaorBound=true）

---

## 7. 设计决策落地确认

| ADR | 落地 |
|---|---|
| D1 runtime 表不存授权结论 | ✅ 字段清单无任何授权字段；授权实时 join |
| D2 local 必须 kaor | ✅ schema superRefine 强约束 + 单测 7/7 |
| D3 卸载不删行 | ✅ UNINSTALLED 保留 |
| D4 复用 launch-check 唯一授权入口 | ✅ checkPluginLaunch 唯一实现，launch-check/start 共用 |
| D5 manifest.local 走 Json 快照零 schema 变更 | ✅ |
| D6 桌面零业务状态 | ✅ UI 全部实时拉取 |
| D7 本地入口 + 云端 Agent 运行时 | ✅ G6 实证 |

---

## 8. 回滚方案

| 层级 | 操作 | 影响 |
|---|---|---|
| 数据 | `DROP TABLE ecology_local_plugin_runtime`（删除迁移文件即可） | 仅本表数据 |
| 后端 | 回滚 `device.service.ts` / `ecology-device.routes.ts` / `plugin-manifest.schema.ts` / `builtin-plugins.ts` 至上一提交 | launch-check 恢复内联实现（行为等价） |
| Desktop | 回滚 `ui/index.html` | 插件卡片恢复静态展示 |
| 业务表 | **零接触**（PaymentOrder/Subscription/User/Organization/Agent/Hermes 全未改动） | 无 |

---

## 9. 冻结纪律确认

```
✅ 新增 ecology 表（1 张）     ✅ 新增 API（4 端点）      ✅ Desktop loader（UI 增量）
❌ 改 Hermes 核心             ❌ 改 AgentInstance 链路   ❌ 改 Commerce/Subscription
❌ 改现有工作台业务            ❌ 插件本地代码执行         ❌ 支付/推广
```

## 10. 待掌柜验收

1. **真机（Windows）**：G1 安装/卸载/升级 + 桌面插件卡片启动/停止/打开工作台
2. **真机端到端**：新媒体账号扫码（快手/抖音/小红书/视频号——Media Application Layer，不阻塞 ECO-11.3）
3. 后续路线：ECO-11.4 Kunlun Media 真实插件闭环 → ECO-12 Tauri 正式发行版 → Developer SDK

**ECO-11.3 完成后，昆仑镜正式拥有：Application Layer ✅ / Plugin Identity ✅ / License Economy ✅ / Developer System ✅ / Desktop Shell ✅ / Local Runtime ✅ —— 第一个真实生态产品「Kunlun Media.exe + AI内容运营经理」成立。**
