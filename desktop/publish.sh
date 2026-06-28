#!/bin/bash
# ========================================
# 昆仑镜桌面版 - 发布脚本
# 1. 构建前端 SPA
# 2. 复制到 desktop/web
# 3. Electron 打包三端
# 4. 上传到服务器 releases/desktop/
# ========================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/../frontend"
DESKTOP_DIR="$SCRIPT_DIR"
RELEASE_DIR="$BACKEND_DIR/releases/desktop"
BACKEND_DIR="$SCRIPT_DIR/../backend"
BUILD_TIME=$(date +%Y%m%d_%H%M%S)

# 解析参数
VERSION="${1:-1.0.0}"
PLATFORM="${2:-all}"  # win | mac | linux | all

echo "========================================"
echo "  昆仑镜桌面版发布 v${VERSION}"
echo "  构建时间: ${BUILD_TIME}"
echo "  平台: ${PLATFORM}"
echo "========================================"

# Step 1: 前端构建
echo ""
echo "[1/4] 构建前端 SPA..."
cd "$FRONTEND_DIR"
npx nuxi build 2>&1 | grep -E "(Build complete|error|ERROR)"
echo "  ✅ 前端构建完成"

# Step 2: 复制静态文件
echo ""
echo "[2/4] 复制前端静态文件..."
mkdir -p "$DESKTOP_DIR/web"
rm -rf "$DESKTOP_DIR/web/"*
cp -r "$FRONTEND_DIR/.output/public/"* "$DESKTOP_DIR/web/"
echo "  ✅ 已复制到 desktop/web/ ($(du -sh "$DESKTOP_DIR/web" | cut -f1))"

# Step 3: 更新版本号
echo ""
echo "[3/4] 更新版本号到 ${VERSION}..."
cd "$DESKTOP_DIR"
# 临时替换 package.json 版本
sed -i "s/\"version\": \".*\"/\"version\": \"${VERSION}\"/" package.json
echo "  ✅ 版本号已更新"

# Step 4: Electron 打包
echo ""
echo "[4/4] Electron 打包..."
case "$PLATFORM" in
  win)    npx electron-builder --win --x64 --publish=never ;;
  mac)    npx electron-builder --mac --x64 --publish=never ;;
  linux)  npx electron-builder --linux --x64 --publish=never ;;
  all)
    echo "  → Windows..."
    npx electron-builder --win --x64 --publish=never 2>&1 | tail -3
    echo "  → macOS..."
    npx electron-builder --mac --x64 --publish=never 2>&1 | tail -3
    echo "  → Linux..."
    npx electron-builder --linux --x64 --publish=never 2>&1 | tail -3
    ;;
esac

echo ""
echo "  ✅ 打包完成"
echo "  产物目录: $DESKTOP_DIR/dist/"
ls -lh "$DESKTOP_DIR/dist/"

# Step 5: 发布到服务器
echo ""
echo "[发布] 上传到服务器 ${BACKEND_DIR}/releases/desktop/..."
mkdir -p "$BACKEND_DIR/releases/desktop"
cp -v "$DESKTOP_DIR/dist/"* "$BACKEND_DIR/releases/desktop/" 2>/dev/null || true

# 复制 latest.yml 等元数据
for f in "$DESKTOP_DIR/dist/"latest*.yml; do
  [ -f "$f" ] && cp -v "$f" "$BACKEND_DIR/releases/desktop/"
done

echo ""
echo "========================================"
echo "  发布完成！"
echo "  版本: v${VERSION}"
echo "  产物: $DESKTOP_DIR/dist/"
echo "  线上: https://aigc.fushtn.com/desktop/"
echo "========================================"
