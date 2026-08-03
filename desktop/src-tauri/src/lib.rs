// SPDX-License-Identifier: MIT
// ═══════════════════════════════════════════════════════════
// SPRINT-ECO-11.2 — Kunlun Desktop Shell（Rust 主入口）
// 掌柜冻结（2026-08-04）：
//   - Windows 优先（Tauri v2 + WebView2）
//   - 只建设 Shell 基础能力：登录桥 / 设备注册 / 应用列表 / 插件授权状态 / 启动线上工作台
//   - ❌ 本地插件代码执行 / 第三方代码加载 / 本地 AI 推理 / 支付修改 / 工作台重构
//   - 设备指纹 = 随机 device_id + 签名 token + 用户确认（Steam/Adobe 模式，禁硬件序列号）
//
// 安全存储：tauri-plugin-store 持久化 { deviceId, deviceToken, accessToken }
//   - accessToken 仅存内存 + store（用户可清除），deviceToken 用于 heartbeat
// ═══════════════════════════════════════════════════════════
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
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
#[tauri::command]
fn open_workspace(
    app: tauri::AppHandle,
    url: String,
    access_token: Option<String>,
) -> Result<(), String> {
    // 域名白名单：只允许昆仑镜线上域（本地调试可放行 127.0.0.1:3000）
    let allowed = ["https://aigc.fushtn.com", "http://127.0.0.1:3000", "http://localhost:3000"];
    if !allowed.iter().any(|a| url.starts_with(a)) {
        return Err(format!("拒绝打开非白名单域: {}", url));
    }
    let webview = WebviewWindowBuilder::new(
        &app,
        "workspace",
        WebviewUrl::External(url.parse().map_err(|e| e.to_string())?),
    )
    .title("昆仑镜工作台")
    .inner_size(1440.0, 900.0)
    .build()
    .map_err(|e| e.to_string())?;

    // 页面加载完成后注入 token（线上工作台复用现有 auth 双写机制）
    if let Some(token) = access_token {
        let js = format!(
            "window.__KUNLUN_DESKTOP__={{}}; localStorage.setItem('auth_token','{}');",
            token
        );
        let wv = webview.webview();
        wv.eval(&js).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn load_from_store(app: &tauri::AppHandle) -> Option<LocalCredentials> {
    let store = app.store(CRED_STORE).ok()?;
    let val = store.get("credentials")?;
    serde_json::from_value(val).ok()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            session: Mutex::new(LocalCredentials::default()),
        })
        .invoke_handler(tauri::generate_handler![
            generate_device_fingerprint,
            save_credentials,
            get_credentials,
            clear_credentials,
            open_workspace,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Kunlun Desktop");
}
