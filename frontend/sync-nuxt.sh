#!/bin/bash
# 构建后将 _nuxt 静态文件同步到 nginx webroot
SRC="/root/shipin-cinematic-studio/frontend/.output/public/_nuxt"
DST="/www/wwwroot/aigc.fushtn.com/_nuxt"
if [ -d "$SRC" ]; then
  mkdir -p "$DST"
  rsync -a --delete "$SRC/" "$DST/"
  chown -R www:www "$DST" 2>/dev/null || true
  chmod -R 755 "$DST" 2>/dev/null || true
  echo "[sync-nuxt] ✅ Synced $SRC → $DST"
else
  echo "[sync-nuxt] ⚠️ Source $SRC not found"
fi
