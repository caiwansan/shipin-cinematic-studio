#!/bin/bash
# Release-01.1 部署脚本：从 CI 构建产物拉取 exe → 昆仑镜 Artifact Repository
# 用法: bash /root/shipin-cinematic-studio/scripts/fetch-desktop-release.sh v1.0.0
#
# 架构原则（掌柜 2026-08-04 冻结）：
#   GitHub = 内部构建基础设施（中间产物仓，用户不可见）
#   用户下载入口 = Kunlun Mirror Artifact Repository (aigc.fushtn.com/releases/desktop)
set -euo pipefail

VERSION="${1:-v1.0.0}"
REPO="caiwansan/shipin-cinematic-studio"
BASE="/www/wwwroot/aigc.fushtn.com/releases/desktop"
EXE_DIR="$BASE/windows"
SIG_DIR="$BASE/signatures"
mkdir -p "$EXE_DIR" "$SIG_DIR"

echo "==> 查询 CI 产物（GitHub Release 中间仓）: $VERSION"
ASSETS=$(curl -s "https://api.github.com/repos/$REPO/releases/tags/$VERSION")
EXE_URL=$(echo "$ASSETS" | python3 -c "
import json,sys
d=json.load(sys.stdin)
ver='${VERSION#v}'
for a in d.get('assets',[]):
    if a['name'].endswith('.exe') and f'_{ver}_' in a['name']:
        print(a['browser_download_url']); break
" 2>/dev/null || true)

if [ -z "$EXE_URL" ]; then
  echo "❌ Release $VERSION 无 exe 资产（检查 CI 是否完成）"
  exit 1
fi

# 规范化命名：KunlunMedia-<version>-setup.exe
EXE_NAME="KunlunMedia-${VERSION#v}-setup.exe"
TARGET="$EXE_DIR/$EXE_NAME"

if [ -f "$TARGET" ] && [ -s "$TARGET" ]; then
  echo "==> 已存在，跳过下载: $TARGET"
else
  echo "==> 下载: $EXE_URL"
  curl -sL -o "$TARGET" "$EXE_URL"
fi

SHA=$(sha256sum "$TARGET" | awk '{print $1}')
SIZE=$(stat -c%s "$TARGET")
echo "==> 落盘: $TARGET ($((SIZE/1024/1024))MB, sha256=$SHA)"

# 签名/校验文件（完整性命名字节，供离线校验）
echo "$SHA  $EXE_NAME" > "$SIG_DIR/$EXE_NAME.sha256"

# latest.json：产品元数据（掌柜结构）+ Tauri updater 兼容字段
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
cat > "$BASE/latest.json" << EOF
{
  "product": "Kunlun Media",
  "version": "${VERSION#v}",
  "platform": "windows-x64",
  "downloadUrl": "/releases/desktop/windows/$EXE_NAME",
  "publishedAt": "$NOW",
  "signature": "",
  "sha256": "$SHA",
  "size": $SIZE,
  "notes": "昆仑镜首个公开桌面版 — Kunlun Media（AI 应用生态操作系统）",
  "platforms": {
    "windows-x86_64": {
      "signature": "",
      "url": "https://aigc.fushtn.com/releases/desktop/windows/$EXE_NAME"
    }
  }
}
EOF

echo "==> latest.json 已更新（版本 ${VERSION#v}，$((SIZE/1024/1024))MB）"
curl -s -o /dev/null -w "==> 验证下载入口: HTTP %{http_code}\n" "https://aigc.fushtn.com/releases/desktop/windows/$EXE_NAME" || true
echo "==> 完成 ✅"
