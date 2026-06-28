#!/bin/bash
# build-linux.sh — Linux 桌面端构建脚本
# 构建「火麒麟AI导演控制台」Linux 桌面端 (Tauri + CUDA)
#
# 依赖:
#   - Rust 1.75+
#   - Node.js 18+
#   - libwebkit2gtk-4.1-dev
#   - libgtk-3-dev

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_DIR="$(cd "$FRONTEND_DIR/.." && pwd)"

echo "============================================"
echo "  火麒麟AI导演控制台 — Linux 构建"
echo "  目标: Tauri + CUDA/ROCm"
echo "============================================"

# 检查系统依赖
echo "检查系统依赖..."
dpkg -l libwebkit2gtk-4.1-dev libgtk-3-dev &>/dev/null || {
  echo "⚠️  建议安装: sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev"
}

# 构建
cd "$FRONTEND_DIR"
npm install
npx nuxi build

cd "$PROJECT_DIR/src-tauri" 2>/dev/null || { echo "⚠️  Tauri 目录不存在，跳过"; exit 0; }
cargo tauri build --bundles deb,appimage --target x86_64-unknown-linux-gnu

echo "✅ Linux 构建完成"
