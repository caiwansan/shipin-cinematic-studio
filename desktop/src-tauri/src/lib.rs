// SPDX-License-Identifier: MIT
// ═══════════════════════════════════════════════════════════
// SPRINT-ECO-11.2 — Kunlun Desktop Shell（Rust 主入口）
// 掌柜冻结（2026-08-04）：
//   - Windows 优先（Tauri v2 + WebView2）
//   - 只建设 Shell 基础能力：登录桥 / 设备注册 / 应用列表 / 插件授权状态 / 启动线上工作台
//   - ❌ 本地插件代码执行 / 第三方代码加载 / 本地 AI 推理 / 支付修改 / 工作台重构
//   - 设备指纹 = 随机 device_id + 签名 token + 用户确认（Steam/Adobe 模式，禁硬件序列号）
//
// SPRINT-RELEASE-WINDOWS-WHITE-SCREEN-ROOT-CAUSE-01（2026-08-04 掌柜 P0 指令）：
//   - 停止猜测 CSP/资源/WebView2 → 建立 Desktop Runtime Diagnostic Mode
//   - KunlunMedia.exe --debug / --diag：四日志（startup/webview/api/error）落盘
//   - 启动时间线 + 页面加载事件 + 前端错误/网络上报（详见 diag.rs）
//
// 安全存储：tauri-plugin-store 持久化 { deviceId, deviceToken, accessToken }
//   - accessToken 仅存内存 + store（用户可清除），deviceToken 用于 heartbeat
// ═══════════════════════════════════════════════════════════
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod diag;

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::webview::PageLoadEvent;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_store::StoreExt;
use uuid::Uuid;

/// 本地凭据（安全存储载荷；token 由服务端校验，本地不落明文日志）
#[derive(Serialize, Deserialize, Clone, Default)]
struct LocalCredentials {
    device_id: Option<String>,
    device_token: Option<String>,
    device_fingerprint: Option<String>,
    access_token: Option<String>,
    user_name: Option<String>,
    organization_id: Option<String>,
}

/// 全局状态：内存 accessToken（避免每次读盘）
struct AppState {
    session: Mutex<LocalCredentials>,
}

const CRED_STORE: &str = "credentials.json";

/// 生成随机设备指纹（uuid v4；掌柜冻结：禁 CPU/硬盘/MAC 序列号）
#[tauri::command]
fn generate_device_fingerprint() -> String {
    Uuid::new_v4().to_string()
}

/// 保存凭据（登录成功 / 设备注册成功后由 UI 调用）
#[tauri::command]
fn save_credentials(
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
    device_id: Option<String>,
    device_token: Option<String>,
    device_fingerprint: Option<String>,
    access_token: Option<String>,
    user_name: Option<String>,
    organization_id: Option<String>,
) -> Result<(), String> {
    let store = app.store(CRED_STORE).map_err(|e| e.to_string())?;
    let mut creds = load_from_store(&app).unwrap_or_default();
    if let Some(v) = device_id { creds.device_id = Some(v); }
    if let Some(v) = device_token { creds.device_token = Some(v); }
    if let Some(v) = device_fingerprint { creds.device_fingerprint = Some(v); }
    if let Some(v) = access_token { creds.access_token = Some(v); }
    if let Some(v) = user_name { creds.user_name = Some(v); }
    if let Some(v) = organization_id { creds.organization_id = Some(v); }
    store.set("credentials", serde_json::to_value(&creds).map_err(|e| e.to_string())?);
    store.save().map_err(|e| e.to_string())?;
    *state.session.lock().unwrap() = creds;
    Ok(())
}

/// 读取凭据（UI 启动时判断登录态 / 设备态）
#[tauri::command]
fn get_credentials(app: tauri::AppHandle, state: tauri::State<AppState>) -> Result<LocalCredentials, String> {
    let session = state.session.lock().unwrap().clone();
    if session.access_token.is_some() || session.device_id.is_some() {
        return Ok(session);
    }
    Ok(load_from_store(&app).unwrap_or_default())
}

/// 退出登录：清空凭据（本地会话 REVOKED 语义由服务端 heartbeat 判定）
#[tauri::command]
fn clear_credentials(app: tauri::AppHandle, state: tauri::State<AppState>) -> Result<(), String> {
    let store = app.store(CRED_STORE).map_err(|e| e.to_string())?;
    store.delete("credentials");
    store.save().map_err(|e| e.to_string())?;
    *state.session.lock().unwrap() = LocalCredentials::default();
    Ok(())
}

/// 启动线上工作台（新 WebView 窗口；加载完成后注入 token 到 localStorage）
/// 安全：仅允许 aigc.fushtn.com 域；token 注入后 UI 自持，Rust 不参与业务
/// RCA-02（2026-08-04 掌柜指令）：补全 open_workspace 全链路可观测性（诊断埋点，零业务行为变更）
#[tauri::command]
fn open_workspace(
    app: tauri::AppHandle,
    diag: tauri::State<diag::Diag>,
    url: String,
) -> Result<(), String> {
    // 域名白名单：只允许昆仑镜线上域（本地调试可放行 127.0.0.1:3000）
    let allowed = ["https://aigc.fushtn.com", "http://127.0.0.1:3000", "http://localhost:3000"];
    if !allowed.iter().any(|a| url.starts_with(a)) {
        diag.log("webview", &format!("open_workspace REJECTED (not whitelisted): {}", url));
        return Err(format!("拒绝打开非白名单域: {}", url));
    }
    diag.log("webview", &format!("open_workspace -> {}", url));
    let workspace_app = app.clone();
    let _webview = WebviewWindowBuilder::new(
        &app,
        "workspace",
        WebviewUrl::External(url.parse::<tauri::Url>().map_err(|e| e.to_string())?),
    )
    .title("昆仑镜工作台")
    .inner_size(1440.0, 900.0)
    // ── RCA-02 可观测性埋点（只记录，不拦截/不改变导航行为）──
    .on_navigation(move |nav_url| {
        // 每次导航/重定向的 URL 链：可判定 401 跳登录 / 404 / 外链
        let _ = workspace_app
            .state::<diag::Diag>()
            .log("webview", &format!("workspace NAVIGATE: {}", nav_url));
        true // 不取消导航
    })
    .on_page_load(|window, payload| {
        let url = payload.url().to_string();
        let diag = window.app_handle().state::<diag::Diag>();
        match payload.event() {
            PageLoadEvent::Started => {
                let _ = diag.log("webview", &format!("workspace page STARTED: {}", url));
            }
            PageLoadEvent::Finished => {
                let _ = diag.log("webview", &format!("workspace page FINISHED: {}", url));
            }
        }
    })
    .on_document_title_changed(|window, title| {
        // 页面身份信号：Nuxt 工作台渲染后 title 变化；白屏时 title 保持默认
        let _ = window
            .app_handle()
            .state::<diag::Diag>()
            .log("webview", &format!("workspace DOCUMENT_TITLE: {}", title));
    })
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

// ── Diagnostic Mode 命令（SPRINT-RELEASE-WINDOWS-WHITE-SCREEN-ROOT-CAUSE-01）──

/// 诊断状态：前端判断是否 --debug/--diag + 展示环境信息
#[tauri::command]
fn diag_status(app: tauri::AppHandle, diag: tauri::State<diag::Diag>) -> diag::DiagStatus {
    diag.status(&app)
}

/// 前端上报日志行（window.onerror / unhandledrejection / console / fetch 拦截 / BOOT 步骤）
/// section 白名单在 Diag::log 内强制（startup/webview/api/error）
#[tauri::command]
fn diag_write(diag: tauri::State<diag::Diag>, section: String, line: String) -> Result<(), String> {
    // 防滥用：单行上限 2000 字符
    let line: String = line.chars().take(2000).collect();
    diag.log(&section, &line);
    Ok(())
}

/// 读取某分区日志（诊断视图展示）
#[tauri::command]
fn diag_read(diag: tauri::State<diag::Diag>, section: String) -> String {
    diag.read(&section)
}

fn load_from_store(app: &tauri::AppHandle) -> Option<LocalCredentials> {
    let store = app.store(CRED_STORE).ok()?;
    let val = store.get("credentials")?;
    serde_json::from_value(val).ok()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // RCA-01 Task01：崩溃堆栈也落盘（不依赖 app 状态）
    diag::install_panic_hook();

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_deep_link::init())
        .manage(AppState {
            session: Mutex::new(LocalCredentials::default()),
        })
        .setup(|app| {
            // ── 诊断器初始化（日志目录 + 启动时间线）──
            let diag = diag::Diag::init(app.handle());
            diag.log("startup", "tauri builder setup enter");
            app.manage(diag);

            // ── 主窗口显式创建（挂 on_page_load 记录页面加载事件）──
            // 注：tauri.conf.json windows[0].create=false，避免与自动创建重复
            let windows = app.config().app.windows.clone();
            let main_cfg = windows
                .first()
                .cloned()
                .ok_or_else(|| "no window config".to_string())?;
            app.state::<diag::Diag>().log(
                "startup",
                &format!(
                    "creating main window label={} size={}x{}",
                    main_cfg.label, main_cfg.width, main_cfg.height
                ),
            );
            let win = WebviewWindowBuilder::from_config(app.handle(), &main_cfg)?
                .on_page_load(|window, payload| {
                    let url = payload.url().to_string();
                    match payload.event() {
                        PageLoadEvent::Started => {
                            let _ = window.app_handle().state::<diag::Diag>().log(
                                "webview",
                                &format!("page load STARTED: {}", url),
                            );
                        }
                        PageLoadEvent::Finished => {
                            let _ = window.app_handle().state::<diag::Diag>().log(
                                "webview",
                                &format!("page load FINISHED: {}", url),
                            );
                        }
                    }
                })
                .build()?;
            app.state::<diag::Diag>().log(
                "startup",
                &format!("main window created label={} title={}", win.label(), win.title().unwrap_or_default()),
            );
            // ── S1.2-B B3: 注册 kunlun:// 协议（Windows, 幂等）──
            // register_all 读取 tauri.conf.json plugins.deepLink.desktop.schemes
            #[cfg(target_os = "windows")]
            if let Err(e) = app.deep_link().register_all() {
                app.state::<diag::Diag>()
                    .log("startup", &format!("deep-link register_all failed: {}", e));
            } else {
                app.state::<diag::Diag>()
                    .log("startup", "deep-link register_all OK (kunlun://)");
            }

            app.state::<diag::Diag>().log("startup", "setup done — waiting for frontend BOOT handshake");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            generate_device_fingerprint,
            save_credentials,
            get_credentials,
            clear_credentials,
            open_workspace,
            diag_status,
            diag_write,
            diag_read,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Kunlun Desktop");
}
