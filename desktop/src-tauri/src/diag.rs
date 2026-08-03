// SPDX-License-Identifier: MIT
// ═══════════════════════════════════════════════════════════
// SPRINT-RELEASE-WINDOWS-WHITE-SCREEN-ROOT-CAUSE-01 — Task 01
// Desktop Runtime Diagnostic Mode
//
// 掌柜指令（2026-08-04）：
//   停止猜测 CSP/资源/WebView2 → 先建立诊断证据链。
//   KunlunMedia.exe --debug 输出 logs/：
//     startup.log   —— Tauri 层启动时间线
//     webview.log   —— WebView2/页面加载事件
//     api.log       —— 前端网络请求记录（前端上报）
//     error.log     —— panic / 前端 JS 错误（前端上报）
//
// 设计原则：
//   - 日志目录 = %LOCALAPPDATA%\com.kunlun.desktop\logs（app_log_dir）
//   - 默认总是写 startup/webview（白屏时用户未必记得加 --debug）
//   - --debug 开启详细级别（api.log 前端记录网络）
//   - --diag  强制诊断 Shell（不加载登录/API/License/Device/Plugin）
//   - 所有写入同步 flush，进程崩溃前留痕
// ═══════════════════════════════════════════════════════════

use serde::Serialize;
use std::collections::HashMap;
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

/// 日志分区（= 落盘文件名）
pub const SECTIONS: [&str; 4] = ["startup", "webview", "api", "error"];

/// 诊断状态（前端 diag_status 命令返回）
#[derive(Serialize, Clone)]
pub struct DiagStatus {
    pub enabled: bool,
    pub diag_shell: bool,
    pub log_dir: String,
    pub app_version: String,
    pub os: String,
    pub arch: String,
    pub webview_version: String,
}

/// 诊断器：进程级单例，由 tauri manage() 托管
pub struct Diag {
    pub enabled: bool,
    pub diag_shell: bool,
    pub log_dir: PathBuf,
    files: Mutex<HashMap<String, File>>,
}

/// UTC ISO8601 时间戳（无 chrono 依赖，Howard Hinnant civil_from_days）
fn timestamp() -> String {
    let d = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = d.as_secs();
    let millis = d.subsec_millis();
    let days = secs / 86400;
    let rem = secs % 86400;
    let (h, m, s) = (rem / 3600, (rem % 3600) / 60, rem % 60);
    let z = days as i64 + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let dd = doy - (153 * mp + 2) / 5 + 1;
    let mm = if mp < 10 { mp + 3 } else { mp - 9 };
    let yy = if mm <= 2 { y + 1 } else { y };
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        yy, mm, dd, h, m, s, millis
    )
}

/// 读取 Windows 注册表中的 WebView2 Runtime 版本（失败返回 unknown）
#[cfg(target_os = "windows")]
fn webview2_version() -> String {
    use std::process::Command;
    let keys = [
        r"HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
        r"HKLM\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
        r"HKCU\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
    ];
    for key in keys {
        if let Ok(out) = Command::new("reg").args(["query", key, "/v", "pv"]).output() {
            let text = String::from_utf8_lossy(&out.stdout);
            // 形如:    pv    REG_SZ    124.0.2478.105
            if let Some(tok) = text.split_whitespace().last() {
                if tok.chars().next().map_or(false, |c| c.is_ascii_digit()) {
                    return tok.to_string();
                }
            }
        }
    }
    "not-found".into()
}

#[cfg(not(target_os = "windows"))]
fn webview2_version() -> String {
    // Linux/macOS 无 WebView2（Linux 用 WebKitGTK）；诊断对象是 Windows 白屏
    std::env::consts::OS.to_string()
}

impl Diag {
    /// 初始化：解析命令行参数、创建日志目录、写入启动时间线
    pub fn init(app: &tauri::AppHandle) -> Self {
        let args: Vec<String> = std::env::args().collect();
        let enabled = args.iter().any(|a| a == "--debug");
        let diag_shell = args.iter().any(|a| a == "--diag");
        let log_dir = app
            .path()
            .app_log_dir()
            .unwrap_or_else(|_| PathBuf::from("."));
        let _ = fs::create_dir_all(&log_dir);

        let diag = Diag {
            enabled,
            diag_shell,
            log_dir: log_dir.clone(),
            files: Mutex::new(HashMap::new()),
        };
        diag.log(
            "startup",
            &format!(
                "=== Kunlun Media startup === version={} os={} arch={} args={:?} debug={} diag={}",
                app.package_info().version,
                std::env::consts::OS,
                std::env::consts::ARCH,
                args,
                enabled,
                diag_shell
            ),
        );
        diag.log(
            "startup",
            &format!("log_dir={}", log_dir.display()),
        );
        diag
    }

    /// 追加一行日志（section 白名单；自动建文件；同步 flush）
    pub fn log(&self, section: &str, line: &str) {
        if !SECTIONS.contains(&section) {
            return;
        }
        let entry = format!("[{}][{}] {}", timestamp(), section, line);
        let mut files = self.files.lock().unwrap();
        let file = files.entry(section.to_string()).or_insert_with(|| {
            OpenOptions::new()
                .create(true)
                .append(true)
                .open(self.log_dir.join(format!("{}.log", section)))
                .unwrap_or_else(|_| {
                    // 日志目录不可写时退化为内存丢弃（不 panic，避免影响启动）
                    OpenOptions::new()
                        .create(true)
                        .append(true)
                        .open(std::env::temp_dir().join(format!("kunlun-{}.log", section)))
                        .unwrap()
                })
        });
        let _ = writeln!(file, "{}", entry);
        let _ = file.flush();
    }

    /// 读取某个分区的日志内容（诊断视图展示；限制长度防卡 UI）
    pub fn read(&self, section: &str) -> String {
        if !SECTIONS.contains(&section) {
            return String::new();
        }
        fs::read_to_string(self.log_dir.join(format!("{}.log", section)))
            .unwrap_or_default()
            .chars()
            .take(16_000)
            .collect()
    }

    /// 组装诊断状态（diag_status 命令）
    pub fn status(&self, app: &tauri::AppHandle) -> DiagStatus {
        DiagStatus {
            enabled: self.enabled,
            diag_shell: self.diag_shell,
            log_dir: self.log_dir.display().to_string(),
            app_version: app.package_info().version.to_string(),
            os: std::env::consts::OS.to_string(),
            arch: std::env::consts::ARCH.to_string(),
            webview_version: webview2_version(),
        }
    }
}

/// 全局 panic hook：进程崩溃前把堆栈写入 error.log（不依赖 app state）
pub fn install_panic_hook() {
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let payload = info.payload();
        let msg = if let Some(s) = payload.downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = payload.downcast_ref::<String>() {
            s.clone()
        } else {
            "unknown panic".to_string()
        };
        let loc = info
            .location()
            .map(|l| format!("{}:{}", l.file(), l.line()))
            .unwrap_or_else(|| "?".into());
        let line = format!("PANIC {} @ {}\n{:?}", msg, loc, info);
        // 尽力写日志：panic 时 app 状态可能已不可用，直接拼 LOCALAPPDATA 路径
        #[cfg(target_os = "windows")]
        let base = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| ".".into());
        #[cfg(not(target_os = "windows"))]
        let base = std::env::var("HOME").unwrap_or_else(|_| ".".into());
        let dir = PathBuf::from(base).join("com.kunlun.desktop").join("logs");
        let _ = fs::create_dir_all(&dir);
        if let Ok(mut f) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(dir.join("error.log"))
        {
            let _ = writeln!(f, "[{}][error] {}", timestamp(), line);
        }
        default_hook(info);
    }));
}
