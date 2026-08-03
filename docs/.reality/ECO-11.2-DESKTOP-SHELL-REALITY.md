# SPRINT-ECO-11.2 — Kunlun Desktop Shell Reality Report

**Date:** 2026-08-04 ｜ **状态:** COMPLETE ✅（Windows 真机构建验收待掌柜） ｜ **提交:** 见 git log
**掌柜冻结（2026-08-04 拍板）：** B 设备级授权 MVP + Windows 优先（Tauri + WebView2）+ 只建 Shell 基础能力

---

## 一、掌柜决策落地

| 决策 | 冻结内容 | 落地 |
|---|---|---|
| 设备授权 | **B 设备级授权 MVP**：Organization → Device → Local App → Plugin Runtime | `ecology_devices` + `ecology_local_apps` 两表落地（Plugin Runtime 表留 ECO-11.3） |
| 设备指纹 | 随机 device_id + 签名 token + 用户确认（Steam/Adobe 模式） | 注册响应一次性返回 token，服务端只存 SHA-256 哈希；登录 JWT = 用户确认 |
| 硬件绑定 | ❌ 禁 CPU 序列号 / 硬盘序列号 / MAC 唯一绑定 | 客户端生成随机 uuid v4 指纹（`generate_device_fingerprint`），Reality Gate 断言无硬件字段 |
| 平台 | **Windows 优先** | `tauri.conf.json` bundle.targets=nsis + WebView2 downloadBootstrapper |
| Sprint 边界 | 只建 Shell：登录桥/设备注册/应用列表/插件授权/启动线上工作台 | 全部交付；❌ 插件执行/第三方代码/本地 AI/支付/工作台重构 均未触碰 |
| 数据隔离 | 只新增 ecology_* 表 | 新增 `ecology_devices` + `ecology_local_apps`，零改动现有业务表 |

## 二、交付清单

### 后端（Linux 已实测）
- **schema.prisma**：`EcologyDevice`（deviceId 唯一 / organizationId / userId / deviceName / deviceFingerprint / os / status / deviceTokenHash / lastHeartbeat）+ `EcologyLocalApp`（deviceId+applicationId 唯一，卸载不删行）
- **迁移**：`prisma/migrations/sprint-eco-11-2-desktop-shell/migration.sql`（手写 SQL 已执行）
- **device.service.ts**：registerDevice / heartbeat / revokeDevice / getDevice / listDevicesByOrganization / installLocalApp / uninstallLocalApp / listAuthorizedPluginsForDevice；token 仅哈希存储；设备-组织匹配校验
- **ecology-device.routes.ts**（prefix `/api/ecosystem`）：
  - `POST /devices/register` — G3 设备注册（JWT=用户确认）
  - `POST /devices/:deviceId/heartbeat` — 设备凭据心跳；REVOKED → allowed:false
  - `GET /devices` / `GET /devices/me` — G4 重启恢复；跨组织查询 403
  - `POST /devices/:deviceId/revoke` — 吊销（组织内）
  - `POST /devices/:deviceId/apps/install|uninstall` — G1 本地应用安装记录
  - `GET /devices/:deviceId/authorized-plugins` — G5 设备授权状态读取
  - `POST /devices/:deviceId/launch-check` — G5 设备级启动校验（写 ecology_license_check_logs，source=local_app）
- **index.ts** 注册（ECO-11.2 区块）

### 桌面壳（Tauri v2，Windows 构建待真机）
- `desktop/` 工程：Cargo.toml / tauri.conf.json / capabilities / main.rs / lib.rs
- **lib.rs 命令**：`generate_device_fingerprint`（随机 uuid）/ `save_credentials`（store 持久化）/ `get_credentials` / `clear_credentials` / `open_workspace`（**域名白名单**：仅 aigc.fushtn.com + 本地调试域；新 WebView 窗口加载线上工作台 + 注入 auth_token）
- **ui/index.html**：Shell UI（登录 → 我的应用 → 插件授权 → 设备信息 → 启动工作台）；60s 心跳轮询吊销信号
- **desktop/README.md**：Windows 构建说明（npm install → npx tauri icon → npm run build）

## 三、Reality Gate（`node scripts/reality-check-eco-11-2.cjs`）

### 25/25 PASS

| Gate | 验证点 | 结果 |
|---|---|---|
| G2 | 登录 JWT（组织 A/B 双账号） | ✅ |
| G3 | 设备注册：deviceId + 一次性 token + 无硬件字段 | ✅ 4 项 |
| G4 | 重启恢复：/devices/me 状态保持 + 心跳 allowed + 错误 token 403 + 跨组织 403 | ✅ 4 项 |
| G1 | 本地应用安装：kunlun-media INSTALLED + 幂等升级 + 9 应用目录 | ✅ 3 项 |
| G5 | License 预演：设备 A allowed / 设备 B（他组织）NO_LICENSE denied / 授权列表 / 跨组织 403 | ✅ 5 项 |
| 吊销 | REVOKED → 心跳 allowed:false（本地强制登出信号） | ✅ 2 项 |
| G6 | 回归：9 工作台应用全注册 + 企业工作台 API 200 + 前端 3000 + 线上入口 | ✅ 4 项 |

**实测铁证：**
- 设备 A（org 11111111-2222-4333-8444-555555555555）launch-check → `allowed:true, reason:OK`，审计落 `ecology_license_check_logs(source=local_app)`
- 设备 B（tenant_iso_test 其他组织）同插件 → `allowed:false, reason:NO_LICENSE`（组织隔离实证）
- 吊销后心跳 → `allowed:false, status:REVOKED`（本地 60s 内强制登出）

## 四、关键设计决策（实现记录）

1. **heartbeat 双鉴权**：JWT（会话身份）+ deviceToken（设备凭据）——吊销后即使 token 泄露仍需 JWT
2. **launch-check 保持向后兼容**：新增设备级路由，未改 ECO-06 marketplace launch-check 语义
3. **LocalApp 无 application 外键**：手动 enrich 应用身份（避免 schema 膨胀；卸载保留历史）
4. **指纹服务端脱敏**：register 响应不含 deviceFingerprint/deviceTokenHash

## 五、待掌柜（Windows 真机验收）

1. Windows 开发机拉代码 → `cd desktop && npm install && npx tauri icon src-tauri/icons/icon.png && npm run dev`
2. 真机流程：安装/开发运行 → 登录 → 设备注册（随机指纹）→ 应用列表 9 应用 → 启动新媒体工作台（WebView 打开 aigc.fushtn.com/workspace/media）→ 插件授权状态读取
3. 真机验证吊销：云端 revoke → 60s 内弹窗强制登出

## 六、冻结边界确认（未越界）

✅ 未执行插件代码 ✅ 未加载第三方代码 ✅ 无本地 AI 推理 ✅ 未碰支付 ✅ 未改工作台 ✅ 仅新增 ecology_* 表 ✅ 未动 Hermes/Agent/Organization 模型

---

*报告完毕。下一步：ECO-11.3 Local Plugin Runtime（掌柜另行排期）。*
