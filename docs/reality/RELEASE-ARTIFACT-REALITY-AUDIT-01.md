# RELEASE-ARTIFACT-REALITY-AUDIT-01 — 发行产物可信度审计

**Date:** 2026-08-04 06:45
**Gate:** 掌柜 P0 裁定（「证明不了 exe 是哪次构建，任何代码修改都是赌博」→ 冻结代码，先审发行物）
**结论:** ✅ **1.1.2 发行包 = 当前源码构建（内容级证明）**；P0-3 排除；白屏回到 WebView2/CSP 执行层

---

## Task 01 — 用户安装包身份（待掌柜执行）

服务器侧 sha256 已备好，掌柜电脑上对比命令：

```powershell
# 已下载安装包
Get-FileHash "下载路径\KunlunMedia-1.1.2-setup.exe" -Algorithm SHA256
# 已安装程序（安装目录 %LOCALAPPDATA%\Programs\Kunlun Media\）
Get-FileHash "$env:LOCALAPPDATA\Programs\Kunlun Media\kunlun-desktop.exe" -Algorithm SHA256
# 文件属性
(Get-Item "$env:LOCALAPPDATA\Programs\Kunlun Media\kunlun-desktop.exe").VersionInfo | Format-List
```

期望值：安装包 `b04f5efaee784985fafbfe73a3627db38018a7d3ddf96fd96ffb790ec538f549`

## Task 02 — 服务器下载物一致性 ✅

`/www/wwwroot/aigc.fushtn.com/releases/desktop/`（生产服务器文件系统直查）：

| 项 | 结果 |
|---|---|
| `windows/KunlunMedia-1.1.2-setup.exe` sha256 | `b04f5efa...` = **latest.json 声明一致** ✅ |
| latest.json version | 1.1.2，publishedAt 2026-08-04T05:30:00Z ✅ |
| latest.json signature | **空字符串** ⚠️ |
| `signatures/` 目录 | 只有 1.0.0-1.0.4 签名，**1.1.2 缺失** ⚠️ |
| diagnostics/ | DiagA/DiagB 1.1.0（RCA-01 构建矩阵）✅ |

发布流程瑕疵：签名缺失 + latest.json signature 空（README 声明「signature 由 tauri signer 私钥生成」未落实）→ 后续单独修发布链。

## Task 03 — 安装包反向解包 ✅（核心证据）

NSIS 解包 → `kunlun-desktop.exe`（7.9MB，05:19 构建）→ brotli 解压 Tauri asset 表：

1. **Rust 壳**：含 RCA-02 全部埋点（`workspace NAVIGATE`/`workspace token inject`/`on_document_title_changed`/`windows_version`）+ 全部 8 个命令（get_credentials/save_credentials/clear_credentials/open_workspace/diag_status/diag_write/diag_read/generate_device_fingerprint）
2. **内嵌 asset（@5827147 解压）**：31631B index.html，含 ✅ 登录昆仑镜账号 ✅ `__probe` 探针×5 ✅ `[BOOT]`×2 ✅ `#0e0f1a` ✅ `login-wrap` ✅ `diag_status` → **Shell 完整，RCA-01 诊断管线在**
3. **内容级对比**：1.1.2 asset vs git HEAD (14d7e8e3) `ui/index.html`——diff 仅 HTML 格式差异（`/>` vs `>`、换行），**代码完全等价**（格式差异 = tauri-codegen `map_core_assets` 的 parse+serialize，`context.rs` 源码确认）

## Task 04 — 构建溯源 ✅（内容级闭环）

```
Source Commit:  HEAD @ 08-04 05:16 (daffa354)
                 desktop 代码 = 14d7e8e3 RCA-01 (index.html)
                             + 01b9fdbd RCA-02 (lib.rs 埋点)
                             + 8b35349a (Cargo.lock 同步 1.1.0)
     ↓  GitHub Actions desktop-release.yml (windows-latest, push main)
CI Build:       08-04 05:19 kunlun-desktop.exe（内嵌 version 1.1.0 = Cargo/tauri.conf）
     ↓  NSIS 打包
Artifact:       KunlunMedia-1.1.2-setup.exe（05:30）
     ↓  上传（push main 不发 GitHub Release → 人工/脚本 scp，README 流程）
官网:            /releases/desktop/windows/ （sha256 b04f5efa... ✅）
     ↓  掌柜下载安装
User:           掌柜电脑
```

断点（不影响内容结论）：CI run ID 不可溯（无 tag v1.1.2、push main 仅构建不发版、服务器无上传日志）；发布命名 1.1.2 ≠ 程序内嵌版本 1.1.0（Cargo.toml/tauri.conf.json 恒为 1.1.0）——版本管理瑕疵，非代码漂移。

## 判定

- ✅ **P0-3 构建产物漂移：排除**（内容级证明 1.1.2 = 当前源码）
- ✅ **P0-1/P0-2 保留**：1.1.2 的 Shell asset 完整且含探针，掌柜截图 = 该页面加载后 **JS 未执行**（CSS 背景 #0e0f1a 渲染 + 探针零出现 + 内容区零文字）→ 进入 WebView2 环境/CSP 执行层/页面加载中断排查
- ⏳ 下一证据：掌柜 logs（`%LOCALAPPDATA%\com.kunlun.desktop\logs\` 四文件）+ Task 01 的 sha256 回传
- 冻结保持：不改代码 / 不发版本 / SESSION-EXCHANGE-01 不启动
