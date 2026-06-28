#!/bin/bash
# scripts/sync-db-schema.sh — 将 Prisma schema 中的新增字段同步到生产数据库
#
# 用法: bash scripts/sync-db-schema.sh
# 无需参数，自动从 .env 读取 DATABASE_URL
#
# 原理: Prisma schema 中所有 @map 映射的字段如果尚未在 DB 中存在，
#       通过 ALTER TABLE ADD COLUMN IF NOT EXISTS 安全新增。
#
# 安全: IF NOT EXISTS 保证幂等，不修改已有数据，不删除表或列

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR)"

# 从 .env 加载数据库连接
if [ -f "$PROJECT_DIR/.env" ]; then
  export $(grep -v '^\s*#' "$PROJECT_DIR/.env" | xargs)
fi

DB_URL="${DATABASE_URL}"
if [ -z "$DB_URL" ]; then
  echo "❌ DATABASE_URL not set and not found in .env"
  exit 1
fi

# 解析连接参数
DB_HOST=$(echo "$DB_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@\([^:]*\):\([0-9]*\)/\(.*\)|\2|p')
DB_PORT=$(echo "$DB_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@\([^:]*\):\([0-9]*\)/\(.*\)|\3|p')
DB_NAME=$(echo "$DB_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@\([^:]*\):\([0-9]*\)/\(.*\)|\4|p')
DB_USER=$(echo "$DB_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
DB_PASS=$(echo "$DB_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')

PSQL="PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"

echo "🔍 Syncing database schema for: $DB_NAME"

# --- Project 表新增字段 ---
echo "  → Project.runtime_checkpoint"
$PSQL -c "ALTER TABLE \"Project\" ADD COLUMN IF NOT EXISTS runtime_checkpoint JSON;" 2>/dev/null

echo "  → Project.failure_events"
$PSQL -c "ALTER TABLE \"Project\" ADD COLUMN IF NOT EXISTS failure_events JSON;" 2>/dev/null

# --- UserModelConfig 表（确保已创建） ---
echo "  → UserModelConfig table (if not exists)"
$PSQL -c "CREATE TABLE IF NOT EXISTS \"UserModelConfig\" (
  id TEXT PRIMARY KEY,
  \"userId\" TEXT NOT NULL,
  provider TEXT NOT NULL,
  \"apiKey\" TEXT,
  \"baseUrl\" TEXT,
  \"imageModel\" TEXT,
  \"videoModel\" TEXT,
  \"llmModel\" TEXT,
  \"ttsModel\" TEXT,
  \"imageEnabled\" BOOLEAN DEFAULT true,
  \"videoEnabled\" BOOLEAN DEFAULT true,
  \"llmEnabled\" BOOLEAN DEFAULT true,
  \"ttsEnabled\" BOOLEAN DEFAULT true,
  \"createdAt\" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  \"updatedAt\" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);" 2>/dev/null

echo ""
echo "✅ Schema sync complete"
