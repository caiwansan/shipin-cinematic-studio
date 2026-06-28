#!/bin/bash
# 从 .env 文件加载环境变量
set -a
source "$(dirname "$0")/.env"
set +a

TSX="/root/.npm/_npx/fd45a72a545557e9/node_modules/.bin/tsx"
exec "$TSX" /root/shipin-cinematic-studio/backend/src/index.ts
