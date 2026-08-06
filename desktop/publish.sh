#!/bin/bash
# ========================================
# 昆仑镜桌面版 - 发布脚本（Tauri v2, S6.2 对齐）
# 1. Tauri 构建（NSIS installer）
# 2. 上传 installer 到服务器 releases/desktop/
# 在 Windows 开发机执行
# ========================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DESKTOP_DIR="$SCRIPT_DIR"
BACKEND_DIR="$SCRIPT_DIR/../backend"
RELEASE_DIR="$BACKEND_DIR/releases/desktop"
BUILD_TIME=$(date +%Y%m%d_%H%M%S)

echo "========================================"
echo "  昆仑镜桌面版发布 v1.2.0 (Tauri v2)"
echo "  发布时间: $BUILD_TIME"
echo "========================================"

# Step 1: Tauri 构建（NSIS）
echo "[1/3] Tauri 构建..."
cd "$DESKTOP_DIR"
npm run build

# Step 2: 定位 installer
echo "[2/3] 定位 NSIS installer..."
INSTALLER=$(ls src-tauri/target/release/bundle/nsis/*setup*.exe 2>/dev/null | head -1 || true)
if [ -z "$INSTALLER" ]; then
  echo "  ❌ 未找到 NSIS installer（检查 tauri.conf bundle.targets=nsis）"
  exit 1
fi
echo "  ✅ $INSTALLER"

# Step 3: 上传到服务器 releases/desktop/ + 生成 latest.json（下载中心数据源, S91）
echo "[3/3] 上传 + 生成 latest.json..."
mkdir -p "$RELEASE_DIR"
cp "$INSTALLER" "$RELEASE_DIR/Kunlun-Desktop-1.2.0-${BUILD_TIME}.exe"
SIZE=$(stat -c%s "$INSTALLER" 2>/dev/null || stat -f%z "$INSTALLER" 2>/dev/null || echo 0)
SHA=$(sha256sum "$INSTALLER" | cut -d' ' -f1 2>/dev/null || shasum -a 256 "$INSTALLER" | cut -d' ' -f1 2>/dev/null || echo "")
cat > "$RELEASE_DIR/latest.json" << EOF
{
  "version": "1.2.0",
  "fileName": "Kunlun-Desktop-1.2.0-${BUILD_TIME}.exe",
  "url": "/releases/desktop/Kunlun-Desktop-1.2.0-${BUILD_TIME}.exe",
  "sizeBytes": ${SIZE:-0},
  "sha256": "${SHA}",
  "buildTime": "${BUILD_TIME}"
}
EOF
echo "  ✅ 上传完成: $RELEASE_DIR/"
cat "$RELEASE_DIR/latest.json"
echo "========================================"
echo "  发布完成！"
echo "========================================"
