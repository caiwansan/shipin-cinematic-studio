#!/bin/bash
# build-macos.sh — macOS 桌面端构建脚本
# 构建「火麒麟AI导演控制台」macOS 桌面端 (Tauri + Metal)
#
# 依赖:
#   - Xcode 15+
#   - Rust 1.75+
#   - Node.js 18+

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_DIR="$(cd "$FRONTEND_DIR/.." && pwd)"

echo "============================================"
echo "  火麒麟AI导演控制台 — macOS 构建"
echo "  目标: Tauri + Metal/MPS"
echo "============================================"

# 检查 Xcode
if ! xcode-select -p &>/dev/null; then
  echo "❌ 需要 Xcode"
  exit 1
fi

# 构建
cd "$FRONTEND_DIR"
npm install
npx nuxi build

cd "$PROJECT_DIR/src-tauri" 2>/dev/null || { echo "⚠️  Tauri 目录不存在，跳过"; exit 0; }
cargo tauri build --bundles dmg --target universal-apple-darwin

echo "✅ macOS 构建完成"
