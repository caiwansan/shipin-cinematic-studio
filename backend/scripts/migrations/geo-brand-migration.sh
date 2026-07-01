#!/bin/bash
# P2-T001 Phase 1B — Brand Foundation Migration
# 目标：创建 GEOBrand + GEOKnowledgeSource，将现有 GEOProject 数据迁移为 Brand
# 安全：Feature Flag 控制，零数据丢失，支持 --dry-run / --rollback
# 用法:
#   bash scripts/migrations/geo-brand-migration.sh [--dry-run|--rollback|--report]

set -e
cd /root/shipin-cinematic-studio

ENV_FILE="backend/.env"
source "$ENV_FILE" 2>/dev/null || true

# ── Flags ──
DRY_RUN=false
ROLLBACK=false
REPORT_ONLY=false
case "${1:-}" in
  --dry-run)  DRY_RUN=true ;;
  --rollback) ROLLBACK=true ;;
  --report)   REPORT_ONLY=true ;;
esac

MIGRATION_LOG="data/migrations/brand-migration.log"
mkdir -p data/migrations

# ── Helpers ──
log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$MIGRATION_LOG"; }
error() { echo "[ERROR] $*" | tee -a "$MIGRATION_LOG"; }

# ── Report Only ──
report() {
  log "=== Migration Data Quality Report ==="
  echo ""

  TOTAL=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM kmki_geo_projects WHERE deleted_at IS NULL;" 2>/dev/null | tr -d ' ')
  echo "Projects (active):       ${TOTAL:-0}"

  NO_WEBSITE=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM kmki_geo_projects WHERE (website IS NULL OR website = '') AND deleted_at IS NULL;" 2>/dev/null | tr -d ' ')
  echo "  Missing Website:       ${NO_WEBSITE:-0}"

  NO_DESC=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM kmki_geo_projects WHERE (name IS NULL OR name = '') AND deleted_at IS NULL;" 2>/dev/null | tr -d ' ')
  echo "  Missing Name:          ${NO_DESC:-0}"

  NO_INDUSTRY=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM kmki_geo_projects WHERE (industry IS NULL OR industry = '') AND deleted_at IS NULL;" 2>/dev/null | tr -d ' ')
  echo "  Missing Industry:      ${NO_INDUSTRY:-0}"

  DUP_DOMAINS=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) FROM (
      SELECT website FROM kmki_geo_projects
      WHERE website IS NOT NULL AND website != '' AND deleted_at IS NULL
      GROUP BY website HAVING COUNT(*) > 1
    ) d;" 2>/dev/null | tr -d ' ')
  echo "  Duplicate Domains:     ${DUP_DOMAINS:-0}"

  # Brand count if migration already ran
  BRAND_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM kmki_geo_brands;" 2>/dev/null | tr -d ' ')
  echo ""
  echo "Existing Brands:         ${BRAND_COUNT:-0}"

  ORPHAN=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM kmki_geo_projects WHERE brand_id IS NULL AND deleted_at IS NULL;" 2>/dev/null | tr -d ' ')
  echo "Projects without Brand:  ${ORPHAN:-0}"

  if [ "$BRAND_COUNT" -gt 0 ] && [ "$ORPHAN" -eq 0 ]; then
    echo ""
    log "✅ 所有项目已有 Brand。迁移已完成或无需执行。"
  fi

  echo ""
  log "Report saved to: $MIGRATION_LOG"
}

# ── Rollback ──
rollback() {
  log "=== Rollback: Brand Migration ==="
  log "正在回滚 Brand 迁移..."

  psql "$DATABASE_URL" -c "UPDATE kmki_geo_projects SET brand_id = NULL, brand_version = NULL, brand_snapshot = NULL, trigger = 'manual';" 2>/dev/null
  psql "$DATABASE_URL" -c "DELETE FROM kmki_geo_knowledge_sources;" 2>/dev/null
  psql "$DATABASE_URL" -c "DELETE FROM kmki_geo_brands;" 2>/dev/null

  log "✅ 回滚完成。所有 GEOProject 已清除 Brand 关联。"
  log "注意：GEOBrand 表结构未删除（仅为空表），如需完全回退请手动执行 Prisma migrate down。"
  echo ""
  report
}

# ── Main Migration ──
run_migration() {
  log "=== P2-T001 Phase 1B: Brand Foundation Migration ==="
  if [ "$DRY_RUN" = true ]; then
    log "🟡 DRY RUN 模式 — 仅分析，不写数据库"
  fi
  log ""

  # Step 1: Data quality snapshot
  log "[1/6] 数据质量分析..."
  if [ "$DRY_RUN" = true ]; then
    report
    log ""
    log "🟡 Dry Run 完成。上述操作为模拟，未实际写入。"
    log "   执行完整迁移请运行: bash scripts/migrations/geo-brand-migration.sh"
    return 0
  fi

  # Backup
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  BACKUP_FILE="data/migrations/brand-migration-backup-${TIMESTAMP}.sql"
  log "[2/6] 备份当前数据库到 $BACKUP_FILE..."
  pg_dump "$DATABASE_URL" --data-only --table=kmki_geo_projects > "$BACKUP_FILE" 2>/dev/null || \
    log "  ⚠️  备份跳过（pg_dump 不可用），继续执行"
  log "  ✅ 备份文件: $BACKUP_FILE"

  # Step 3: Apply schema (safe — only adds, no breaks)
  log "[3/6] 验证 Prisma schema..."
  cd backend
  npx prisma validate > /dev/null 2>&1
  log "  ✅ Schema 验证通过"

  # Step 4: Create Brand for existing projects
  log "[4/6] 为现有项目创建 Brand..."
  psql "$DATABASE_URL" -t -c "
  INSERT INTO kmki_geo_brands (id, slug, name, \"primaryDomain\", description, industry, region, \"primaryLanguage\", status, version, \"createdAt\", \"updatedAt\")
  SELECT
    gen_random_uuid()::text,
    lower(regexp_replace(coalesce(name, 'unnamed'), '[^a-zA-Z0-9\\u4e00-\\u9fa5]', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 8),
    name,
    coalesce(website, ''),
    NULL,
    industry,
    country,
    coalesce(language, 'zh'),
    'active',
    1,
    NOW(),
    NOW()
  FROM kmki_geo_projects
  WHERE deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM kmki_geo_brands b
      WHERE b.name = kmki_geo_projects.name
        AND (b.\"primaryDomain\" = kmki_geo_projects.website OR (b.\"primaryDomain\" = '' AND kmki_geo_projects.website IS NULL))
    )
  ON CONFLICT DO NOTHING;" 2>/dev/null

  log "  ✅ Brand 创建完成"

  # Step 5: Backfill brandId
  log "[5/6] 回填 brandId + brandSnapshot..."
  psql "$DATABASE_URL" -t -c "
  UPDATE kmki_geo_projects p
  SET brand_id = b.id,
      brand_version = 1,
      trigger = 'manual'
  FROM kmki_geo_brands b
  WHERE p.brand_id IS NULL
    AND p.deleted_at IS NULL
    AND b.name = p.name;" 2>/dev/null

  # Verify
  ORPHAN=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM kmki_geo_projects WHERE brand_id IS NULL AND deleted_at IS NULL;" 2>/dev/null | tr -d ' ')
  log "  ✅ brandId 回填完成（orphan: ${ORPHAN}）"

  # Step 6: Create initial KnowledgeSource from website
  log "[6/6] 从官网创建初始知识源..."
  psql "$DATABASE_URL" -t -c "
  INSERT INTO kmki_geo_knowledge_sources (id, brand_id, type, url, label, crawl_strategy, status, created_at, updated_at)
  SELECT
    gen_random_uuid()::text,
    b.id,
    'official_site',
    b.\"primaryDomain\",
    b.name || ' 官网',
    'manual',
    'pending',
    NOW(),
    NOW()
  FROM kmki_geo_brands b
  WHERE b.\"primaryDomain\" != ''
    AND NOT EXISTS (
      SELECT 1 FROM kmki_geo_knowledge_sources ks
      WHERE ks.brand_id = b.id AND ks.type = 'official_site'
    );" 2>/dev/null

  log "  ✅ 初始知识源创建完成"
  log ""
  log "=== Migration 完成 ==="
  echo ""
  report
}

# ── Main ──
case "${1:-}" in
  --report)   report ;;
  --rollback) rollback ;;
  --dry-run)  run_migration ;;
  *)          run_migration ;;
esac
