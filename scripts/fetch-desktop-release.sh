#!/bin/bash
# Release-01 部署脚本：从 GitHub 公开 Release 拉取 exe → releases/desktop/ → 更新 latest.json
# 用法: bash /root/shipin-cinematic-studio/scripts/fetch-desktop-release.sh v1.0.0
set -euo pipefail

VERSION="${1:-v1.0.0}"
REPO="caiwansan/shipin-cinematic-studio"
DEST="/www/wwwroot/aigc.fushtn.com/releases/desktop"
mkdir -p "$DEST"

echo "==> 下载 Kunlun Media $VERSION 资产列表"
ASSETS=$(curl -s "https://api.github.com/repos/$REPO/releases/tags/$VERSION")
EXE_URL=$(echo "$ASSETS" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for a in d.get('assets',[]):
    if a['name'].endswith('.exe'):
        print(a['browser_download_url']); break
" 2>/dev/null || true)

if [ -z "$EXE_URL" ]; then
  echo "❌ Release $VERSION 无 exe 资产（检查 CI 是否完成）"
  exit 1
fi

echo "==> 下载: $EXE_URL"
EXE_NAME=$(basename "$EXE_URL")
curl -sL -o "$DEST/$EXE_NAME" "$EXE_URL"

SHA=$(sha256sum "$DEST/$EXE_NAME" | awk '{print $1}')
SIZE=$(stat -c%s "$DEST/$EXE_NAME")
echo "==> 落盘: $DEST/$EXE_NAME ($((SIZE/1024/1024))MB, sha256=$SHA)"

# 更新 latest.json（下载入口元数据）
cat > "$DEST/latest.json" << EOF
{
  "version": "${VERSION#v}",
  "notes": "昆仑镜首个公开桌面版 — Kunlun Media",
  "pub_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "platforms": {
    "windows-x86_64": {
      "signature": "",
      "url": "https://aigc.fushtn.com/releases/desktop/$EXE_NAME"
    }
  },
  "sha256": "$SHA",
  "size": $SIZE
}
EOF

echo "==> latest.json 已更新"
curl -s -o /dev/null -w "验证下载入口: HTTP %{http_code}\n" "https://aigc.fushtn.com/releases/desktop/$EXE_NAME" || true
