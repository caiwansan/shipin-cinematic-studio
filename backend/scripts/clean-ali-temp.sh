#!/bin/bash
# 清理阿里临时图片（超过7天）
TARGET_DIR="/root/shipin-cinematic-studio/backend/public/uploads"
find "$TARGET_DIR" -name "ali_temp_*" -mtime +7 -delete 2>/dev/null
echo "[$(date)] 已清理 $TARGET_DIR 下超过7天的 ali_temp_ 文件"
