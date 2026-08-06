#!/bin/bash
# ========================================
# 昆仑镜桌面版 - 构建脚本（Tauri v2, S6.2 对齐）
# Windows 优先: NSIS installer（tauri.conf bundle.targets=nsis）
# 在 Windows 开发机执行: ./build.sh
# ========================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DESKTOP_DIR="$SCRIPT_DIR"
BUILD_TIME=$(date +%Y%m%d_%H%M%S)

echo "========================================"
echo "  昆仑镜桌面版构建 v1.2.0 (Tauri v2)"
echo "  构建时间: $BUILD_TIME"
echo "========================================"

# Step 1: 依赖安装（首次）
cd "$DESKTOP_DIR"
if [ ! -d node_modules ]; then
  echo "[0/2] 安装依赖..."
  npm install
fi

# Step 2: Tauri 构建（frontendDist=../ui 已指向 Shell UI; NSIS installer）
echo "[1/2] Tauri 构建..."
npm run build

echo "[2/2] 构建完成"
echo "  输出目录: $DESKTOP_DIR/src-tauri/target/release/bundle/"
echo "  NSIS 安装包: src-tauri/target/release/bundle/nsis/Kunlun Media_1.2.0_x64-setup.exe"
echo "========================================"
