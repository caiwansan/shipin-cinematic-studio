# build-win.ps1 — Windows 桌面端构建脚本
# 构建「火麒麟AI导演控制台」Windows 桌面端 (Tauri + DirectML)
#
# 依赖:
#   - Visual Studio 2022 (MSVC Build Tools)
#   - Rust 1.75+ (MSVC toolchain)
#   - Node.js 18+
#   - WebView2 (Windows 10自带, Win10+无需单独安装)
#
# 用法:
#   .\build-win.ps1             # 默认构建
#   .\build-win.ps1 -Release    # 发布构建
#   .\build-win.ps1 -Arch x86_64 # 指定架构

param(
    [switch]$Release = $false,
    [string]$Arch = "x86_64"
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  火麒麟AI导演控制台 — Windows 构建" -ForegroundColor Cyan
Write-Host "  目标: Tauri + DirectML" -ForegroundColor Cyan
Write-Host "  架构: $Arch" -ForegroundColor Cyan
if ($Release) { Write-Host "  模式: Release" -ForegroundColor Cyan }
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ─── 路径设置 ───────────────────────────────────
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$FrontendDir = Join-Path $ScriptDir ".." | Resolve-Path
$ProjectDir = Join-Path $FrontendDir ".." | Resolve-Path
$TauriDir = Join-Path $ProjectDir "src-tauri"

# ─── 1. 系统依赖检查 ────────────────────────────
Write-Host "🔍 检查系统依赖..." -ForegroundColor Yellow

# 检查 Node.js
try {
    $nodeVersion = node --version
    Write-Host "  ✅ Node.js: $nodeVersion"
} catch {
    Write-Host "  ❌ 需要 Node.js 18+" -ForegroundColor Red
    exit 1
}

# 检查 Rust
try {
    $rustVersion = rustc --version
    Write-Host "  ✅ Rust: $rustVersion"
} catch {
    Write-Host "  ❌ 需要 Rust 1.75+ (MSVC toolchain)" -ForegroundColor Red
    Write-Host "     安装: https://rustup.rs/" -ForegroundColor Yellow
    exit 1
}

# 检查 Visual Studio Build Tools
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vswhere) {
    $vsPath = & $vswhere -latest -property installationPath
    if ($vsPath) {
        Write-Host "  ✅ Visual Studio: $vsPath"
    } else {
        Write-Host "  ⚠️  Visual Studio 未找到，构建可能失败" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ⚠️  vswhere 未找到，跳过 Visual Studio 检查" -ForegroundColor Yellow
}

# 检查 Tauri CLI
try {
    $tauriVersion = cargo tauri --version 2>$null
    if (-not $tauriVersion) {
        Write-Host "  ⚠️  Tauri CLI 未安装，正在安装..." -ForegroundColor Yellow
        cargo install tauri-cli
    } else {
        Write-Host "  ✅ Tauri CLI: $tauriVersion"
    }
} catch {
    Write-Host "  ⚠️  Tauri CLI 未安装，正在安装..." -ForegroundColor Yellow
    cargo install tauri-cli
}

Write-Host ""

# ─── 2. 前端构建 ─────────────────────────────────
Write-Host "🏗️  构建前端 (Nuxt SPA)..." -ForegroundColor Yellow
Set-Location $FrontendDir

# 安装依赖
Write-Host "  📦 安装 npm 依赖..."
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ npm install 失败" -ForegroundColor Red
    exit 1
}

# 构建 Nuxt SPA
Write-Host "  🔨 执行 nuxi build..."
npx nuxi build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ Nuxt 构建失败" -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ 前端构建完成" -ForegroundColor Green
Write-Host ""

# ─── 3. Tauri 构建 ───────────────────────────────
if (-not (Test-Path $TauriDir)) {
    Write-Host "⚠️  Tauri 目录不存在，跳过桌面端打包" -ForegroundColor Yellow
    Write-Host "   请先初始化 Tauri: cargo tauri init" -ForegroundColor Yellow
    exit 0
}

Write-Host "🖥️  打包 Tauri 桌面端..." -ForegroundColor Yellow
Set-Location $ProjectDir

if ($Release) {
    # Release 构建 — MSI 安装包
    Write-Host "  📦 构建 Release 版本..."
    switch ($Arch) {
        "x86_64" {
            cargo tauri build --bundles msi --target x86_64-pc-windows-msvc
        }
        "i686" {
            cargo tauri build --bundles msi --target i686-pc-windows-msvc
        }
        "aarch64" {
            cargo tauri build --bundles msi --target aarch64-pc-windows-msvc
        }
        default {
            Write-Host "  ❌ 不支持的架构: $Arch" -ForegroundColor Red
            exit 1
        }
    }
} else {
    # Debug 构建 — NSIS 安装包 (更快)
    Write-Host "  🔧 构建 Debug 版本..."
    cargo tauri build --bundles nsis --target x86_64-pc-windows-msvc
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ Tauri 构建失败" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  ✅ Windows 构建完成！" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green

# 输出构建产物路径
$OutputDir = Join-Path $ProjectDir "src-tauri\target\release"
if (Test-Path $OutputDir) {
    Write-Host ""
    Write-Host "📁 构建产物:" -ForegroundColor Cyan
    Get-ChildItem $OutputDir -Filter "*.msi" -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "  📦 $($_.FullName) ($([math]::Round($_.Length / 1MB, 2)) MB)"
    }
    Get-ChildItem $OutputDir -Filter "*.exe" -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "  📦 $($_.FullName) ($([math]::Round($_.Length / 1MB, 2)) MB)"
    }
}
