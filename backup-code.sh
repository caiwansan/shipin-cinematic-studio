#!/bin/bash
# ===== 昆仑镜系统自动备份脚本 =====
# 最高宪法：每 3 小时备份数据库，每 6 小时备份网站文件
# 默认保留最近 10 份备份，超出自动删除

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/root/shipin-cinematic-studio/backups"
PROJECT_DIR="/root/shipin-cinematic-studio"
KEEP_COUNT=10
PG_CONTAINER="scs-postgres"
DB_NAME="aigc_scs"

mkdir -p "${BACKUP_DIR}"

# 1. 备份数据库
backup_db() {
  local db_file="${BACKUP_DIR}/kunlunjing_db_${TIMESTAMP}.sql.gz"
  echo "[$(date)] 🗄️ 开始备份数据库..."
  docker exec "${PG_CONTAINER}" pg_dump -U postgres "${DB_NAME}" 2>/dev/null | gzip > "${db_file}"
  if [ $? -eq 0 ] && [ -s "${db_file}" ]; then
    local db_size
    db_size=$(du -h "${db_file}" | cut -f1)
    echo "[$(date)] ✅ 数据库备份完成: $(basename ${db_file}) (${db_size})"
  else
    echo "[$(date)] ⚠️ 数据库备份失败（容器可能未运行）"
    rm -f "${db_file}"
  fi
}

# 2. 备份代码（仅源码，排除媒体文件与构建产物）
#    — 媒体文件（图片/视频/音频）保存在 COS，代码备份不需要
#    — 构建产物（.output、node_modules）太大且可重现
backup_code() {
  local code_file="${BACKUP_DIR}/kunlunjing_code_${TIMESTAMP}.tar.gz"
  echo "[$(date)] 📁 开始备份代码..."
  # 直接用 PROJECT_DIR 作为工作目录，exclude 路径相对于当前目录
  cd "${PROJECT_DIR}" && tar -czf "${code_file}" \
    --exclude="node_modules" \
    --exclude=".git" \
    --exclude=".output" \
    --exclude="./backups" \
    --exclude="*.tar.gz" \
    --exclude="*.png" \
    --exclude="*.jpg" \
    --exclude="*.jpeg" \
    --exclude="*.gif" \
    --exclude="*.webp" \
    --exclude="*.mp4" \
    --exclude="*.mov" \
    --exclude="*.avi" \
    --exclude="*.mkv" \
    --exclude="*.mp3" \
    --exclude="*.wav" \
    --exclude="*.ogg" \
    --exclude="*.wmv" \
    --exclude="*.flv" \
    . 2>/dev/null
  local tar_exit=$?
  cd /
  if [ $tar_exit -eq 0 ] && [ -s "${code_file}" ]; then
    local code_size
    code_size=$(du -h "${code_file}" | cut -f1)
    echo "[$(date)] ✅ 代码备份完成: $(basename ${code_file}) (${code_size})"
  else
    echo "[$(date)] ❌ 代码备份失败 (tar exit=$tar_exit)"
    rm -f "${code_file}"
  fi
}

# 3. 清理过期备份（保留最近 KEEP_COUNT 份，超出自动删除）
cleanup_old() {
  echo "[$(date)] 🧹 清理旧备份（保留最近 ${KEEP_COUNT} 份）..."
  ls -t "${BACKUP_DIR}"/kunlunjing_code_*.tar.gz 2>/dev/null | tail -n +$((KEEP_COUNT + 1)) | xargs -r rm -f
  ls -t "${BACKUP_DIR}"/kunlunjing_db_*.sql.gz 2>/dev/null | tail -n +$((KEEP_COUNT + 1)) | xargs -r rm -f
  echo "[$(date)] ✅ 清理完成"
}

# ===== 主流程 =====
echo "=========================================="

if [ "$1" = "db-only" ]; then
  echo "[$(date)] 🔄 昆仑镜数据库备份（3小时周期）"
  backup_db
elif [ "$1" = "full" ]; then
  echo "[$(date)] 🔄 昆仑镜全量备份（6小时周期）"
  backup_db
  backup_code
else
  echo "[$(date)] 🔄 昆仑镜系统备份（全量）"
  backup_db
  backup_code
fi

cleanup_old

echo "[$(date)] ✅ 本轮备份完成"
echo "=========================================="

# 调用通知脚本写入状态（供 OpenClaw cron job 读取后通过 QQ 汇报）
if [ "$1" = "db-only" ]; then
  /bin/bash /root/shipin-cinematic-studio/backup-notify.sh db-only >> /root/shipin-cinematic-studio/backups/notify.log 2>&1
elif [ "$1" = "full" ]; then
  /bin/bash /root/shipin-cinematic-studio/backup-notify.sh full >> /root/shipin-cinematic-studio/backups/notify.log 2>&1
else
  /bin/bash /root/shipin-cinematic-studio/backup-notify.sh auto >> /root/shipin-cinematic-studio/backups/notify.log 2>&1
fi
