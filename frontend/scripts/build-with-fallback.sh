#!/bin/bash
# build-with-fallback.sh — 构建脚本，在 rebuild 后保持旧 buildId 可用
# 使用 backup 机制：保存旧 buildId 的 meta 文件，重建后恢复
set -euo pipefail

FRONTEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_META_DIR="${FRONTEND_DIR}/.buildid-backups"
mkdir -p "$BACKUP_META_DIR"

# Step 1: 保存当前 buildId meta 文件
META_DIR="${FRONTEND_DIR}/.output/public/_nuxt/builds/meta"
if [ -d "$META_DIR" ]; then
    for f in "$META_DIR"/*.json; do
        [ -f "$f" ] || continue
        basename "$f" | grep -q 'latest.json' && continue
        cp "$f" "$BACKUP_META_DIR/"
        echo "✅ Saved: $(basename "$f")"
    done
fi

# Step 2: 构建
echo "🏗️  Building..."
cd "$FRONTEND_DIR"
npx nuxt build 2>&1 | tail -5
BUILD_EXIT=$?
if [ $BUILD_EXIT -ne 0 ]; then
    echo "❌ Build failed"
    exit $BUILD_EXIT
fi

# Step 3: 恢复旧 buildId meta 文件（用当前 meta 内容填充）
NEW_META_DIR="${FRONTEND_DIR}/.output/public/_nuxt/builds/meta"
if [ -d "$NEW_META_DIR" ]; then
    # 读当前 buildId
    CURRENT_FILE=$(ls "$NEW_META_DIR"/*.json 2>/dev/null | grep -v latest.json | head -1)
    if [ -n "$CURRENT_FILE" ] && [ -f "$CURRENT_FILE" ]; then
        CURRENT_CONTENT=$(cat "$CURRENT_FILE")
        CURRENT_ID=$(basename "$CURRENT_FILE" .json)
        echo "📦 Current buildId: $CURRENT_ID"
        
        # 为每个旧 buildId 写入当前内容
        RESTORED=0
        for f in "$BACKUP_META_DIR"/*.json; do
            [ -f "$f" ] || continue
            OLD_ID=$(basename "$f" .json)
            [ "$OLD_ID" = "$CURRENT_ID" ] && continue
            OLD_PATH="${NEW_META_DIR}/${OLD_ID}.json"
            if [ ! -f "$OLD_PATH" ]; then
                echo "$CURRENT_CONTENT" > "$OLD_PATH"
                echo "🔄 Restored: $OLD_ID"
                RESTORED=$((RESTORED + 1))
            fi
        done
        
        # 也写 latest.json
        echo "$CURRENT_CONTENT" > "${NEW_META_DIR}/latest.json"
        echo "📝 Wrote latest.json"
        
        echo "✅ Build complete. Restored $RESTORED old buildId(s)"
    fi
fi
