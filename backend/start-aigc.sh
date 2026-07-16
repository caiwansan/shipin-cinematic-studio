#!/bin/bash
# 从 .env 文件加载环境变量
DIR="$(dirname "$0")"
set -a
source "$DIR/.env"
set +a

# Ensure we're in the backend directory for tsconfig resolution
cd "$DIR"

# tsconfig-paths 使 tsx 能够解析 tsconfig.json 中的 paths 别名（如 @platform/*）
TSX="/root/shipin-cinematic-studio/backend/node_modules/.bin/tsx"
exec "$TSX" -r tsconfig-paths/register /root/shipin-cinematic-studio/backend/src/index.ts
