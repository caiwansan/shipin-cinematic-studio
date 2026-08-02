#!/bin/bash
set -e
echo "=== 部署前端 ==="
BUILD_DIR="/root/shipin-cinematic-studio/frontend/.output/public"
DEPLOY_DIR="/www/wwwroot/aigc.fushtn.com"

# 0. 清理旧文件，防止旧 hash 残留
echo ">>> 清理旧文件..."
rm -rf "$DEPLOY_DIR"/_nuxt
rm -rf "$DEPLOY_DIR"/.output/server

# 1. 拷贝完整的静态资源
echo ">>> 拷贝静态资源..."
cp -a "$BUILD_DIR"/_nuxt "$DEPLOY_DIR"/_nuxt

# 2. 拷贝其他 public 文件
echo ">>> 拷贝 public 文件..."
cp -a "$BUILD_DIR"/* "$DEPLOY_DIR"/ 2>/dev/null || true

# 3. SSR 服务端（静态 SPA 部署时跳过；目录存在则同步）
if [ -d "/root/shipin-cinematic-studio/frontend/.output/server" ]; then
  mkdir -p "$DEPLOY_DIR/.output"
  echo ">>> 部署 SSR..."
  cp -a /root/shipin-cinematic-studio/frontend/.output/server "$DEPLOY_DIR/.output/server"
fi

# 4. 重启前端（⚠️ pm2 进程名是 nuxt-frontend，不是 frontend——重启错进程会导致
#    Nitro 返回旧 index.html 引用已删 hash → _nuxt 全 500）
echo ">>> 重启前端 (nuxt-frontend)..."
pm2 restart nuxt-frontend > /dev/null 2>&1 || pm2 restart frontend > /dev/null 2>&1 || true
echo "✅ 部署完成"
