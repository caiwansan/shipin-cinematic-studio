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

## 1. 掌柜 Windows 机前置环境（一次性）

| # | 依赖 | 说明 |
|---|---|---|
| 1 | Windows 10/11 x64 | 真机验收目标环境 |
| 2 | Node.js ≥ 20 | `node -v` 确认 |
| 3 | Rust 工具链 | `rustup-init.exe`（https://rustup.rs）→ 选 default x86_64-pc-windows-msvc |
| 4 | VS Build Tools | 「使用 C++ 的桌面开发」工作负载（tauri 2 编译必需） |
| 5 | WebView2 | Win10/11 一般自带；缺失时安装包 bootstrapper 自动装 |

> 首次 `npm run tauri build` 会下载 NSIS 等依赖（几分钟），属正常。

---

## 2. 构建 & 安装

```bash
cd desktop
npm install
npm run tauri build
```

产物：`desktop/src-tauri/target/release/bundle/nsis/*.exe`

| 记录项 | 结果 |
|---|---|
| npm install 耗时 | ____ |
| tauri build 耗时（首次含依赖下载） | ____ |
| 构建错误（若有，贴日志） | ____ |
| NSIS 安装包路径确认 | ____ |
| 安装耗时 | ____ |
| 桌面快捷方式生成 | ✅/❌ |
| 首次启动（WebView2 提示？权限提示？） | ____ |

---

## 3. 登录 & 设备注册

| 步骤 | 预期 | 结果 |
|---|---|---|
| 启动 Kunlun Desktop | 登录页 | ____ |
| 输入账号密码登录 | 进入「我的应用」 | ____ |
| 设备指纹生成 + 注册 | 设备 ACTIVE | ____ |
| 我的应用列表 | 9 个应用可见 | ____ |

**服务端核对命令**（OpenClaw 侧执行，掌柜报 device_id 或账号即可）：

```bash
# 设备状态
# SELECT device_id,status,device_name FROM ecology_devices ORDER BY created_at DESC LIMIT 5;
# 授权
# SELECT plugin_id,status,expire_at FROM ecology_licenses WHERE organization_id='<org>';
```

---

## 4. 插件启动（AI内容运营经理）

| 步骤 | 预期 | 结果 |
|---|---|---|
| 进入插件授权页 | 看到 ai-content-ops-manager 卡片（runtimeLocal 徽标） | ____ |
| 点击启动 | 状态 → RUNNING（allowed:true） | ____ |
| 服务端核对 | ecology_local_plugin_runtime 有 RUNNING 行 + startedAt | ____ |

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

## 6. 新媒体入口

| 步骤 | 预期 | 结果 |
|---|---|---|
| 点「打开工作台」 | 浏览器打开线上 `/workspace/media?plugin=<id>` | ____ |
| 工作台加载 | 新媒体工作台可访问（登录态已带入） | ____ |

---

## 7. 问题清单（如实记录，不美化）

| # | 现象 | 严重度 | 截图/日志 |
|---|---|---|---|
| 1 | | | |
| 2 | | | |

---

## 8. 决策

- [ ] ✅ **通过** → 进入 Task02 Media Application Reality（Channel Adapter + Browser Runtime + Platform Account 真实闭环）
- [ ] ❌ **失败** → 只修 Desktop/Application/Runtime 边界问题，不扩大范围，再验一轮

> 失败处理纪律：只修边界问题（构建/安装/授权/生命周期），**不碰**业务层/生态架构。
