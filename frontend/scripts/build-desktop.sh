#!/bin/bash
# build-desktop.sh — 通用桌面端构建脚本
# 构建「火麒麟AI导演控制台」桌面端应用
# 支持: Tauri (通用), Electron (备选)
#
# 用法:
#   ./build-desktop.sh [--target win|mac|linux|all] [--bundle tauri|electron]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_DIR="$(cd "$FRONTEND_DIR/.." && pwd)"
BUILD_MODE="${1:-tauri}"
TARGET="${2:-all}"

echo "============================================"
echo "  火麒麟AI导演控制台 — 桌面端构建"
echo "============================================"
echo "工作目录: $PROJECT_DIR"
echo "构建模式: $BUILD_MODE"
echo "目标平台: $TARGET"
echo ""

# 1. 环境检查
echo "[1/4] 检查环境..."
command -v node >/dev/null 2>&1 || { echo "❌ 需要 Node.js"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ 需要 npm"; exit 1; }

NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)
echo "   Node.js: $NODE_VERSION"
echo "   npm: $NPM_VERSION"
echo ""

# 2. 安装依赖
echo "[2/4] 安装依赖..."
cd "$FRONTEND_DIR"
npm install || { echo "❌ npm install 失败"; exit 1; }
echo ""

# 3. 构建前端
echo "[3/4] 构建前端 (Nuxt3 SPA)..."
cd "$FRONTEND_DIR"
npx nuxi build || { echo "❌ Nuxt 构建失败"; exit 1; }
echo "   前端构建完成"
echo ""

# 4. 打包桌面应用
echo "[4/4] 打包桌面应用..."
case "$BUILD_MODE" in
  tauri)
    echo "   构建 Tauri 应用..."
    command -v cargo >/dev/null 2>&1 || { echo "❌ 需要 Rust/Cargo"; exit 1; }
    cd "$PROJECT_DIR/src-tauri" 2>/dev/null || { echo "⚠️  Tauri 目录不存在，跳过"; exit 0; }

    case "$TARGET" in
      win)    cargo tauri build --target x86_64-pc-windows-msvc ;;
      mac)    cargo tauri build --target x86_64-apple-darwin ;;
      linux)  cargo tauri build --target x86_64-unknown-linux-gnu ;;
      all|*)  cargo tauri build ;;
    esac
    ;;

  electron)
    echo "   构建 Electron 应用..."
    npx electron-builder build --publish=never
    ;;

  *)
    echo "❌ 未知构建模式: $BUILD_MODE"
    echo "   支持: tauri, electron"
    exit 1
    ;;
esac

echo ""
echo "============================================"
echo "  ✅  桌面端构建完成!"
echo "============================================"
