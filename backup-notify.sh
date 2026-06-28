#!/bin/bash
# ===== 昆仑镜备份通知脚本 =====
# 由 backup-code.sh 在备份完成后调用
# 写入状态文件供 OpenClaw cron job 读取后通过 QQ 通知

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
STATUS_DIR="/root/shipin-cinematic-studio/backups/notify"
mkdir -p "${STATUS_DIR}"

MODE="${1:-auto}"

case "$MODE" in
  db-only)
    TYPE="数据库"
    ;;
  full)
    TYPE="数据库+代码"
    ;;
  *)
    TYPE="自动"
    ;;
esac

# 找最新的备份文件
LATEST_DB=$(ls -t /root/shipin-cinematic-studio/backups/kunlunjing_db_*.sql.gz 2>/dev/null | head -1)
LATEST_CODE=$(ls -t /root/shipin-cinematic-studio/backups/kunlunjing_code_*.tar.gz 2>/dev/null | head -1)

DB_SIZE=""
CODE_SIZE=""
DB_TIME=""
CODE_TIME=""
STATUS="✅ 成功"

if [ -n "$LATEST_DB" ]; then
  DB_SIZE=$(du -h "$LATEST_DB" 2>/dev/null | cut -f1)
  DB_TIME=$(stat -c %Y "$LATEST_DB" 2>/dev/null)
fi

if [ -n "$LATEST_CODE" ]; then
  CODE_SIZE=$(du -h "$LATEST_CODE" 2>/dev/null | cut -f1)
  CODE_TIME=$(stat -c %Y "$LATEST_CODE" 2>/dev/null)
fi

# 计算总备份数和总大小
TOTAL_DB=$(ls /root/shipin-cinematic-studio/backups/kunlunjing_db_*.sql.gz 2>/dev/null | wc -l)
TOTAL_CODE=$(ls /root/shipin-cinematic-studio/backups/kunlunjing_code_*.tar.gz 2>/dev/null | wc -l)

# 如果数据库备份为空或 0 字节，标记失败
if [ -z "$DB_SIZE" ] || [ "$DB_SIZE" = "0" ]; then
  STATUS="⚠️ 数据库备份可能失败"
fi

# 写 JSON 状态文件（保留最近 1 份）
cat > "${STATUS_DIR}/latest.json" << EOF
{
  "timestamp": "$TIMESTAMP",
  "type": "$TYPE",
  "status": "$STATUS",
  "db_file": "$(basename "$LATEST_DB" 2>/dev/null || echo '')",
  "db_size": "$DB_SIZE",
  "code_file": "$(basename "$LATEST_CODE" 2>/dev/null || echo '')",
  "code_size": "$CODE_SIZE",
  "total_db_backups": $TOTAL_DB,
  "total_code_backups": $TOTAL_CODE,
  "notified": false
}
EOF

echo "[notify] ✅ 备份状态已写入 ${STATUS_DIR}/latest.json"
