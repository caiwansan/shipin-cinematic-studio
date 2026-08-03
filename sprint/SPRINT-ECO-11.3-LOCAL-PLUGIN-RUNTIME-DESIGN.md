# SPRINT-ECO-11.3-LOCAL-PLUGIN-RUNTIME-DESIGN.md

> **设计阶段（只读审计产物）** — 2026-08-04 ｜ 掌柜批准：设计 Gate 通过后再进入代码 Sprint
> 定位：昆仑镜生态从「目录系统」进入「运行系统」的分界点——Desktop + License + KAOR + Plugin + Application 首次完整连接。

---

## 0. 定位与战略背景

掌柜战略判断（2026-08-04）：

```
Kunlun Media App
  =
应用底座（免费）
  +
本地浏览器控制
  +
AI员工插件（付费，License 控制）
  +
KAOR
```

产品价值从「帮用户管理账号」升级为「**AI员工帮用户运营账号**」。账号只是能力之一，不再是核心风险。

ECO-11.2 已验证关键路线（**正确，继续**）：

```
本地App → 登录 → 设备授权 → 打开线上工作台
```

ECO-11.3 把这条路线推进一格：

```
Kunlun Media.exe → 读取本地插件 → 请求 License → KAOR 检查 → allowed → 显示插件能力
```

**命名语义（防误导）**：「Local Plugin Runtime」≠ 本地执行插件代码。插件本体永远是**云端 Agent**（KAOR Adapter → Hermes Agent Instance），本地只负责**入口 + 授权状态 + 心跳**。本地不出现任何可执行插件代码。

---

## 1. 现状审计结论（只读）

| 资产 | 状态 | 位置 |
|---|---|---|
| 设备注册/心跳/吊销/组织隔离 | ✅ ECO-11.2 | `EcologyDevice` + `DeviceService` + `ecology-device.routes.ts` |
| 设备↔应用安装记录（卸载不删行） | ✅ ECO-11.2 | `EcologyLocalApp` |
| 设备级启动校验（设备+License+插件三角） | ✅ ECO-11.2 | `POST /devices/:deviceId/launch-check`（NO_LICENSE/EXPIRED/SUSPENDED/DEVICE_ORG_MISMATCH） |
| 设备视角插件授权列表（实时计算） | ✅ ECO-11.2 | `GET /devices/:deviceId/authorized-plugins` |
| License 状态机（ACTIVE/EXPIRED/SUSPENDED + renew/expire/restore） | ✅ ECO-04 | `EcologyLicense` + `license.service.ts` |
| Plugin manifest 白名单校验（strict，只验证不执行） | ✅ ECO-02 | `plugin-manifest.schema.ts`（KNOWN_RUNTIME_KEYS=['kaor']） |
| Plugin↔KAOR Runtime 绑定 | ✅ ECO-03 | `EcologyPluginRuntimeBinding` + `runtime-registry.service.ts` |
| manifest 快照落库（只存不执行） | ✅ | `EcologyPlugin.manifest` Json 列 |
| Desktop Tauri 壳（登录/设备/应用/插件授权/工作台/心跳） | ✅ ECO-11.2 | `desktop/`（Windows 构建待掌柜真机） |
| 首个插件目标 | ✅ 已存在 | `ai-content-ops-manager`（AI内容运营经理）→ application `kunlun-media` |

**结论**：ECO-11.3 的 80% 基础设施已存在。本 Sprint 不是从零建设，而是**补三块缺件**：
1. 设备↔插件↔License 的**运行时状态表**（持久化实例 + 心跳，区别于 launch-check 的瞬时门禁）
2. manifest **local 白名单标志**（runtime.local: true，strict 不变）
3. Desktop **Plugin Loader 流程**（读授权 → 门禁 → 显示能力 → 心跳续命 → 吊销降级）

---

## 2. 范围与冻结清单（掌柜拍板，硬边界）

### 范围（只做）
- Task 01：`ecology_local_plugin_runtime` 运行时注册表（纯新增 ecology_* 表）
- Task 02：Plugin manifest `runtime.local` 白名单扩展
- Task 03：Desktop Plugin Loader（本地 UI 入口 + 云端 Agent 能力）
- Task 04：第一个真实插件绑定（AI内容运营经理 → kunlun-media 新媒体闭环）
- Reality Gate G1–G5

### 冻结清单（违反即退回原点）
```
❌ 本地执行第三方代码        （插件 = 云端 Agent，本地零执行）
❌ 本地运行模型              （无本地推理/模型加载）
❌ 改 Hermes 核心            （KAOR 契约只读使用）
❌ 改现有工作台              （新媒体工作台逻辑零改动）
❌ 碰 Commerce/Payment/Subscription/User/Organization/Agent/Hermes 表
❌ 支付 / 推广 / 开发者 SDK   （不在本 Sprint）
❌ 新增平台扩展 / 新插件      （只给 ai-content-ops-manager 加 local）
✅ 只新增 ecology_* 表
✅ 插件先云执行，本地只负责入口和授权
✅ License 支持未来本地应用（Kunlun Media.exe → KAOR → License Check → Plugin Load）
```

---

## 3. Task 01 — Local Plugin Runtime Registry

### 3.1 定位（与现有表的分工）

| 表 | 语义 | 生命周期 |
|---|---|---|
| `ecology_devices` | 设备本体（注册/心跳/吊销） | 设备级 |
| `ecology_local_apps` | 设备↔**应用**安装记录 | 应用级 |
| `ecology_licenses` | 组织↔**插件**许可（状态机权威） | 许可级 |
| **`ecology_local_plugin_runtime`** | **设备↔插件↔许可的运行时实例**（启动/心跳/降级） | 插件运行时级（本 Sprint 新增） |

- **瞬时门禁**（launch-check）与**持续状态**（runtime 表）分离：启动那一刻问门禁；启动之后用心跳维持运行声明。
- **授权永远实时算，状态表不存授权结论**——避免双写漂移。UI 灰态由 authorized-plugins 实时 join License 驱动（ECO-04 状态机单一来源原则）。

### 3.2 数据模型（迁移 SQL 草案）

```sql
-- SPRINT-ECO-11.3 迁移：ecology_local_plugin_runtime
CREATE TABLE IF NOT EXISTS ecology_local_plugin_runtime (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id   TEXT NOT NULL,            -- 组织隔离（与设备/许可同源）
  device_id         TEXT NOT NULL,            -- ecology_devices.id
  plugin_id         TEXT NOT NULL,            -- ecology_plugins.id
  version           TEXT NOT NULL,            -- 本地插件实例版本（semver，更新审计）
  status            TEXT NOT NULL DEFAULT 'INSTALLED',
                  -- INSTALLED | RUNNING | DISABLED | UNINSTALLED
                  -- 本地生命周期；授权状态永远实时 join ecology_licenses
  license_id        TEXT,                     -- ecology_licenses.id（快照引用，非判定依据）
  last_heartbeat    TIMESTAMPTZ,              -- 插件运行时心跳（吊销/失效判定依据）
  installed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (device_id, plugin_id)               -- 每设备每插件单实例
);
CREATE INDEX IF NOT EXISTS idx_lpr_org    ON ecology_local_plugin_runtime (organization_id);
CREATE INDEX IF NOT EXISTS idx_lpr_license ON ecology_local_plugin_runtime (license_id);
CREATE INDEX IF NOT EXISTS idx_lpr_heart  ON ecology_local_plugin_runtime (last_heartbeat);
```

### 3.3 行为约定
- **首次启动**：launch-check allowed → upsert runtime 行（INSTALLED → RUNNING，写 lastHeartbeat）
- **心跳**：随设备心跳节奏（60s），仅刷新 lastHeartbeat（RUNNING 续命）
- **吊销/失效**：设备 revoke → heartbeat 403 → 本地降级 UI（插件灰态），runtime 行保留（审计轨迹）；License EXPIRED → authorized-plugins 实时反映 → UI 灰态，**应用本体不受影响**（G3 原则）
- **卸载**：status → UNINSTALLED，**不删行**（同 ecology_local_apps 语义）
- **重装/升级**：同 device+plugin 唯一键 upsert，version 更新

---

## 4. Task 02 — Manifest `runtime.local` 白名单扩展

### 4.1 变更点（全部在 `plugin-manifest.schema.ts` + `builtin-plugins.ts`）

```ts
// 白名单：['kaor', 'local']（禁止任意运行时声明，未来扩展只改这一行）
export const KNOWN_RUNTIME_KEYS = ['kaor', 'local'] as const;

// schema（strict 保持，未知运行时字段仍拒绝）
runtime: z.object({
  kaor:  z.boolean(),
  local: z.boolean().optional(),   // true = 允许出现在桌面本地加载器（白名单）
}).strict().optional(),
```

### 4.2 校验规则（纯函数，零副作用）
- `local: true` **必须** `kaor: true`（本地插件必须是云端 Agent 型，纯本地插件不存在）
- `local` 缺省 = false（存量插件不自动暴露本地，默认安全）
- 校验失败 → manifest 拒绝，不落库

### 4.3 落库
`EcologyPlugin.manifest` Json 快照列天然承载（只存不执行，ECO-02 既有语义），**零 schema 变更**。

### 4.4 首个启用
仅 `ai-content-ops-manager` 加 `runtime: { kaor: true, local: true }`（Task04 唯一目标），其余 4 插件保持默认。

---

## 5. Task 03 — Desktop Plugin Loader

### 5.1 架构不变式
```
插件仍然不是本地代码：
  本地 = UI 入口 + 授权状态 + 心跳
  云端 = Agent 能力（KAOR Adapter → Hermes Agent Instance）
```

### 5.2 加载时序（Kunlun Media.exe 视角）

```
Kunlun Media.exe 启动
   │
   ├─ 1. 读取本地安装插件（服务端 ecology_local_plugin_runtime 同步结果，本地无业务状态）
   │
   ├─ 2. 请求 License：POST /devices/:deviceId/launch-check { pluginId }
   │       四重门禁：
   │         a) 设备 ACTIVE        （ecology_devices）
   │         b) License ACTIVE     （ecology_licenses，实时）
   │         c) KAOR Runtime 绑定  （ecology_plugin_runtime_bindings）
   │         d) manifest.local=true（ecology_plugins.manifest，白名单）
   │
   ├─ 3. allowed → 显示插件能力卡片（名称/能力/授权到期/进入工作台按钮）
   │
   ├─ 4. 60s 心跳轮询（设备心跳 + runtime lastHeartbeat 续命）
   │
   └─ 5. 任一门禁失败 → 灰态 + 原因（NO_LICENSE/EXPIRED/SUSPENDED/DEVICE_REVOKED/ORG_MISMATCH）
          应用窗口继续可用（ECO-04 原则），仅插件不可用
```

### 5.3 后端增量（复用优先，最小新增）
- **复用**：launch-check（门禁）、authorized-plugins（授权列表）、设备心跳（吊销信号）——ECO-11.2 全部已有
- **新增（小）**：
  - `POST /devices/:deviceId/plugins/:pluginId/start` → 门禁通过后 upsert runtime 行（RUNNING + heartbeat）＋ 审计
  - `POST /devices/:deviceId/plugins/:pluginId/heartbeat` → 刷新 lastHeartbeat（吊销/失效判定依据）
  - `POST /devices/:deviceId/plugins/:pluginId/stop`（卸载/停用 → UNINSTALLED/DISABLED，不删行）
  - authorized-plugins 返回项补 `runtimeLocal`（manifest.local）+ `runtimeStatus`（实时 join）
- **Desktop UI 增量**：Shell UI 新增「我的插件」卡片区（能力展示 + 状态 + 进入工作台），复用现有授权状态区扩展

### 5.4 「进入工作台」语义
打开线上新媒体工作台并携带插件上下文（如 `?plugin=ai-content-ops-manager`），云端 Agent 能力在工作台内呈现——**工作台逻辑零改动**（可选参数，无参时行为不变）。

---

## 6. Task 04 — 第一个真实插件绑定闭环

目标链路（掌柜验收路径）：

```
下载安装 Kunlun Media
   → 登录（JWT + 设备注册）
   → 安装 AI内容运营经理（manifest.local=true，白名单唯一启用）
   → License ACTIVE（grant ai-content-ops-manager）
   → 打开新媒体工作台（线上，?plugin=ai-content-ops-manager）
   → AI员工出现（KAOR Agent Instance，云端）
   → 执行任务（Hermes 既有能力，读取真实指标 / 如实 unavailable）
```

依赖说明：
- **后端许可链路**（Linux 全验）：设备 A 注册 → 安装 kunlun-media → grant license → launch-check allowed → runtime RUNNING + 心跳 → 全自动脚本可验
- **真机端到端**（掌柜真机）：Windows 安装包 + 新媒体账号扫码（线上账号状态）——本机仅能出打包脚本与安装包校验（NSIS 产物/版本号）

---

## 7. Reality Gate G1–G5（验收定义）

| Gate | 定义 | 验收方式 | 依赖 |
|---|---|---|---|
| **G1** | Windows 安装包：安装/卸载/升级正常 | NSIS 打包产物校验（本机）+ 真机安装/卸载/升级清单（掌柜） | 真机 |
| **G2** | 设备隔离：设备 A 有插件授权，设备 B 无 → B 拒绝（NO_LICENSE/ORG_MISMATCH） | Linux 后端脚本（双设备注册对比 launch-check） | 无 |
| **G3** | 订阅过期：**应用继续打开，插件不可用**（ECO-04 原则） | Linux 脚本：expire license → launch-check denied + authorized-plugins 灰态 + **kunlun-media 应用启动不受影响**（local_apps 启动断言） | 无 |
| **G4** | 插件恢复：续费 → License ACTIVE → launch-check allowed → runtime 恢复 RUNNING | Linux 脚本：renewLicense → 复验全链路 | 无 |
| **G5** | 线上工作台独立：新媒体账号登录/账号状态/任务执行不被 Desktop 影响 | Linux 脚本 + 线上回归（新媒体 API 正常 + desktop 心跳与线上会话解耦断言） | 线上登录态 |

验收脚本：`scripts/reality-check-eco-11-3.cjs`（设计 Gate 后代码 Sprint 落地）。

---

## 8. 设计决策记录（ADR）

| # | 决策 | 理由 |
|---|---|---|
| D1 | runtime 表**存生命周期，不存授权结论**；授权永远实时 join ecology_licenses | 状态单一来源，防双写漂移（ECO-04 状态机权威） |
| D2 | `local: true` 必须 `kaor: true`；缺省 false | 本地插件必须是云端 Agent 型；默认安全 |
| D3 | 卸载/停用不删行（UNINSTALLED 保留） | 审计轨迹（同 ecology_local_apps 语义） |
| D4 | 门禁复用 launch-check，**不新造校验链**；新增仅 start/heartbeat/stop 三个小端点 | 最小新增，ECO-11.2 已验证逻辑零重构 |
| D5 | manifest.local 走 `EcologyPlugin.manifest` Json 快照，零 schema 变更 | 只存不执行（ECO-02 既有语义） |
| D6 | Desktop 本地零业务状态，一切以服务端为准 | 无状态壳，吊销/降级即时生效 |
| D7 | 「Local Plugin Runtime」命名定位为**本地插件入口 + 云端 Agent 运行时** | 防误导：本地从不执行插件代码 |

---

## 9. 风险清单

| 风险 | 等级 | 缓解 |
|---|---|---|
| G1 依赖掌柜 Windows 真机（本机 Linux 无法构建 Tauri NSIS） | 中 | 后端链路全自动验收先行；真机清单明确步骤 |
| Task04 新媒体闭环依赖账号扫码（线上登录态） | 中 | 闭环拆两层：许可链路（自动）+ 端到端（掌柜扫码） |
| 心跳吊销时效（60s 窗口） | 低 | 沿用设备心跳节奏，UI 轮询即降级 |
| 命名误解导致越界（本地执行） | 高 | 本设计文档 + 冻结清单显式声明；代码评审红线 |

---

## 10. 设计 Gate 待掌柜确认点

1. ✅ 范围与冻结清单（Task01–04 + G1–G5）是否符合预期
2. ✅ D1：runtime 表不存授权结论、实时 join License —— 是否认可
3. ✅ D4：门禁复用 launch-check，仅新增 3 个轻端点 —— 是否认可
4. ✅ Task04 闭环拆两层（自动许可链路 + 掌柜真机端到端）—— 是否认可
5. ⏳ 代码 Sprint 启动顺序：后端（Task01/02 + 端点）→ 前端 Desktop UI → Reality Gate 脚本 → 真机清单

**批准后进入代码 Sprint（SPRINT-ECO-11.3）。**
