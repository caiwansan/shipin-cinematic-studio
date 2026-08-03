# SPRINT-MEDIA-LOCAL-RELEASE-01 Kunlun Media Desktop Release Build

> **状态：▶ 执行中**（2026-08-04 掌柜指令：暂停 Task01 Reality，先执行 Desktop Release Build Gate）
> **目标：** 只解决「生成第一个可交付 Windows 安装包」。禁止新增功能，只验证 Windows 发布链路。

---

## 0. 为什么必须先做（掌柜 Reality Gate 前置条件缺口）

之前的 Task01 设计假设：

```
Tauri工程 → 构建 → NSIS安装包 → 普通Windows安装 → Reality Test
```

但 Reality 审计（2026-08-04 00:40）实锤实际状态：

```
Tauri Desktop Shell 代码 ✅（ECO-11.2 验收）
构建能力 ❌（从未构建：无 target/bundle、无 exe 产物）
CI 发布链路 ❌（desktop-release.yml 仍是 Electron 时代：electron-builder 打 Tauri 工程 = 跑不通）
安装包产物 ❌（releases/desktop/ 只有 6-04 旧 yml 残留）
普通用户安装 ❌
Task01 Reality Test ⏸ 暂不能开始
```

> **结论：工程完成 ≠ 产品可交付。** 商业软件必须经过 开发版本 → 安装包 → 用户电脑 → 真实使用，才算产品。
> 缺的一环 = **Distribution**。Reality Gate 提前发现缺口，正在起作用。

---

## 1. Reality 路线更新

```
ECO-11.3 Local Plugin Runtime ✅
        ↓
Task01A Desktop Release Build ⏳（本 Sprint）
        ↓
Task01 普通用户真机 Reality ⏳（Release 通过后重启五轮）
        ↓
Task02 AI内容运营经理 Business Reality ⏳
```

**Task01 状态：** ~~真机验收进行中~~ → **PRE-GATE（Desktop Release Preparation，等待安装包生成）**

---

## 2. Task 01A：安装包生成（Tauri 正式构建）

**执行方式：** GitHub Actions `windows-latest`（本地 Linux 服务器无法构建 Windows NSIS；Tauri NSIS 打包仅 Windows 支持）

```bash
# windows-latest runner
npm install
npm run tauri build   # → src-tauri/target/release/bundle/nsis/Kunlun Media_1.0.0_x64-setup.exe
```

**产物：**
```
src-tauri/target/release/bundle/nsis/Kunlun Media_1.0.0_x64-setup.exe
```

---

## 3. Task 01B：安装包 Reality 检查（掌柜真机）

测试机：普通 Windows / 无 Node / 无 Rust / 无开发环境

| 检查项 | 预期 | 结果 |
|---|---|---|
| 安装 | ✅ 成功 | ____ |
| 开始菜单 | ✅ 存在 | ____ |
| 桌面快捷方式 | ✅ 生成 | ____ |
| 卸载入口 | ✅ 存在 | ____ |
| WebView2 | 缺失时自动引导安装（downloadBootstrapper, silent） | ____ |
| 权限 | currentUser 安装，无需管理员 | ____ |

---

## 4. Task 01C：版本管理

| 项 | 值 |
|---|---|
| ProductName | Kunlun Media（tauri.conf.json 原为 Kunlun Desktop → 改） |
| Version | 1.0.0（原 0.1.0 → 改） |
| identifier | com.kunlun.desktop（保留） |
| 未来映射 | ecology_local_apps.version |

---

## 5. Task 01D：签名问题记录（不阻塞，记录在案）

- 第一阶段：不签名，可交付内测
- 风险：Windows SmartScreen 可能提示「未知发布者」
- 未来商业发布需要：**Windows Code Signing Certificate**（EV 或 OV 代码签名证书）

---

## 6. 发布链路修复清单（2026-08-04 审计发现）

| # | 问题 | 修复 |
|---|---|---|
| 1 | desktop-release.yml 用 electron-builder 打 Tauri 工程（过时） | 重写为 Tauri v2：windows-latest 单 job，npm install + tauri build |
| 2 | productName=Kunlun Desktop / version=0.1.0 | → Kunlun Media / 1.0.0（tauri.conf.json + Cargo.toml + package.json 同步） |
| 3 | releases/desktop/ 无实际安装包 | CI 上传产物到服务器 releases/desktop/ |
| 4 | main.js/preload.js/build.sh/publish.sh = Electron 残留 | 不影响 Tauri 构建，本轮不动（范围纪律） |

---

## 7. 纪律

- ✅ 只验证 Windows 发布链路
- ❌ 禁止新增功能 / 新插件 / 新平台 / 业务代码改动
- ❌ 不碰 src-tauri/src（Tauri 壳逻辑，ECO-11.2 已验收）
- Release 通过后 → 重启 Task01 五轮真机 Reality

---

## 8. 验收结论（待掌柜）

- [ ] ✅ PASS → Task01 五轮真机 Reality 重启
- [ ] ❌ FAIL → 只修发布链路边界（构建/安装/签名/CI），不扩范围
