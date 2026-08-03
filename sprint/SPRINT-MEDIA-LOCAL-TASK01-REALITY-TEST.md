# SPRINT-MEDIA-LOCAL-TASK01-REALITY-TEST

> **Task01 真机验收操作手册**（掌柜 2026-08-04 批准 Phase A；类型：真机验收，**不开发**）
> 目标：证明「Kunlun Media.exe + 生态底座 + 设备授权 + 插件授权」在真实 Windows 用户环境成立
> 输出：`docs/.reality/MEDIA-LOCAL-TASK01-REALITY-REPORT.md`

---

## 0. 服务端静态预检（已由 OpenClaw 完成 ✅，2026-08-04）

| 检查项 | 结果 |
|---|---|
| tauri.conf.json（productName/NSIS/WebView2/identifier） | ✅ |
| src-tauri 源码（lib.rs/main.rs/Cargo.toml tauri2+store+shell） | ✅ |
| ui/index.html 桌面桥（`window.__TAURI__` invoke 模式） | ✅ 与 Tauri 壳匹配 |
| 前端端点 ↔ 后端路由逐项核对（auth/applications/register/me/heartbeat/authorized-plugins/start/stop/uninstall） | ✅ 13 端点全部对应 |
| icons（32x32.png / icon.png） | ✅ |
| 后端本地 4002 / 线上 aigc.fushtn.com | ✅ 200 / 200 |
| ECO-11.3 Reality Gate（G1 安装包静态 + G2-G7 全链路） | ✅ 36/36 |

**已知说明**：`desktop/preload.js` 是早期 Electron 时代的遗留文件，Tauri 2 壳不加载它（不影响运行），本轮冻结不动它。

---

## 1. 真机环境（掌柜 2026-08-04 细化：模拟真实用户）

> **开发机成功没有意义。** 目标 = 模拟普通用户：
> - 普通 Windows 电脑（非开发环境优先）
> - **非管理员账号优先测试**（管理员隐藏权限问题）
> - 若只有开发机：至少用非管理员账号完整跑一遍

**构建环境**（仅构建机需要，与验收机分离——验收机不应有 Node/Rust）：

| # | 依赖 | 说明 |
|---|---|---|
| 1 | Windows 10/11 x64 | 构建机 + 验收机（验收机无 Node/Rust） |
| 2 | Node.js ≥ 20 | 仅构建机：`node -v` 确认 |
| 3 | Rust 工具链 | 仅构建机：rustup default x86_64-pc-windows-msvc |
| 4 | VS Build Tools | 仅构建机：「使用 C++ 的桌面开发」工作负载 |
| 5 | WebView2 | 验收机缺失时 NSIS bootstrapper 自动装（记录提示） |

> 首次 `npm run tauri build` 会下载 NSIS 等依赖（几分钟），属正常。

---

## 2. 构建 & 安装

```bash
cd desktop
npm install
npm run tauri build
```

产物：`desktop/src-tauri/target/release/bundle/nsis/*.exe`（拷到验收机安装）

| 记录项 | 结果 |
|---|---|
| npm install 耗时 | ____ |
| tauri build 耗时（首次含依赖下载） | ____ |
| 构建错误（若有，贴日志） | ____ |

### 2.1 安装体验（掌柜 2026-08-04 细化）

**通过标准：**
- ✅ 双击安装（NSIS 向导）
- ✅ 无 Node 环境要求（验收机未装 Node 也能装）
- ✅ 无开发工具要求（无 Rust/VS Build Tools）
- ✅ 桌面快捷方式正常生成
- ✅ 开始菜单存在

**失败记录（如实）：**
- 安装阻塞 / WebView2 问题 / 权限问题（非管理员）/ 杀毒拦截（Defender/第三方）

| 检查项 | 结果 |
|---|---|
| 安装耗时 | ____ |
| 桌面快捷方式 | ✅/❌ |
| 开始菜单 | ✅/❌ |
| WebView2 提示 | ____ |
| 权限提示（非管理员） | ____ |
| 杀毒拦截 | 无/有（截图） |

---

## 3. 登录 & 设备注册

| 步骤 | 预期 | 结果 |
|---|---|---|
| 启动 Kunlun Desktop | 登录页 | ____ |
| 输入账号密码登录 | 进入「我的应用」 | ____ |
| 设备指纹生成 + 注册 | 设备 ACTIVE | ____ |
| 我的应用列表 | 9 个应用可见 | ____ |

**DB 链路核对**（掌柜 2026-08-04 细化：User → Organization → Device → LocalApp 全链路，OpenClaw 侧执行）：

```sql
-- 1. User（登录账号存在）
SELECT id, email FROM "User" WHERE email='<掌柜账号>';
-- 2. Organization（JWT org 映射）
SELECT id, name FROM "Organization" WHERE id IN (SELECT "organizationId" FROM "Membership" WHERE "userId"='<userId>');
-- 3. Device（注册成功 ACTIVE）
SELECT device_id, status, device_name, created_at FROM ecology_devices ORDER BY created_at DESC LIMIT 5;
-- 4. LocalApp（kunlun-media 绑定）
SELECT app_slug, device_id FROM ecology_local_apps WHERE device_id='<device_id>';
```

**核对结论**：User ✅ / Organization ✅ / Device ✅ / LocalApp ✅（全链路成立才 PASS）

---

## 4. 插件授权（AI内容运营经理）

**授权判定模型**（掌柜 2026-08-04 确认）：

```
ACTIVE License
+ ACTIVE Device
+ Organization Match
= Allowed（RUNNING）
```

| 步骤 | 预期 | 结果 |
|---|---|---|
| 进入插件授权页 | 看到 ai-content-ops-manager 卡片（runtimeLocal 徽标） | ____ |
| 点击启动 | 状态 → RUNNING（allowed:true） | ____ |
| 服务端核对 | ecology_local_plugin_runtime 有 RUNNING 行 + startedAt | ____ |

### 4.1 过期测试（生态核心原则：应用不受插件影响）

> 模拟 License EXPIRED：OpenClaw 侧将 license `expire_at` 置为过去时间 → 掌柜观察 → 恢复。

| 步骤 | 预期 | 结果 |
|---|---|---|
| OpenClaw 置 expire_at 过去 | 插件授权页状态变化 | ____ |
| 启动插件 | **DENIED**（license 不满足） | ____ |
| 打开应用列表 | **应用继续打开**（应用 ≠ 插件，互相独立） | ____ |
| OpenClaw 恢复 expire_at | 插件恢复可启动 | ____ |

**这条是生态核心原则的实证：应用是基座，插件是商品——商品过期不影响基座使用。**

---

## 5. 生命周期（重点：不产生脏数据）

| 步骤 | 预期 | 结果 |
|---|---|---|
| 停止 | 状态 → DISABLED + stoppedAt | ____ |
| 再启动 | 回到 RUNNING（同一条记录，不重复） | ____ |
| 卸载 | 状态 → UNINSTALLED（行保留，不删） | ____ |
| 重新安装/启动 | 新生命周期正常（版本一致） | ____ |
| 脏数据检查 | 无重复 runtime 行 / 无孤儿设备 | ____ |

---

## 6. 工作台打开（完整闭环验证）

> 掌柜 2026-08-04 细化：**不是打开一个孤立网页**，而是 Application + Plugin + License + KAOR + Workspace 完整闭环。

| 步骤 | 预期 | 结果 |
|---|---|---|
| 点「打开工作台」 | 浏览器打开 `/workspace/media?plugin=<id>`（带插件上下文） | ____ |
| 工作台加载 | 新媒体工作台可访问（登录态带入） | ____ |
| 闭环验证 | 工作台内可见 AI 内容运营经理入口（插件上下文生效） | ____ |

---

## 7. 问题清单（如实记录，不美化）

| # | 现象 | 严重度 | 截图/日志 |
|---|---|---|---|
| 1 | | | |
| 2 | | | |

---

## 8. Reality Decision（掌柜 2026-08-04 确认版）

### PASS（全部满足才通过）

```
普通用户 → 安装 → 登录 → 绑定设备 → 打开应用 → 启用插件 → 进入工作台
```

→ 进入 **Task02 账号闭环**（Channel Adapter + Browser Runtime + Platform Account 真实闭环）

### BLOCK（只允许修边界问题）

- 安装失败 / 权限错误 / token 异常 / UI 入口缺失 / License 误判

**禁止扩大范围：** ❌ 新功能 ❌ 新插件 ❌ 新平台 ❌ 自动发布 ❌ 商城支付

> 失败处理纪律：只修边界问题（构建/安装/授权/生命周期），**不碰**业务层/生态架构。
> 验收结果出来后，掌柜再决定 Task02。
