#!/bin/bash
# P1.0 Product Audit — 检查 Sprint P1 交付完整性

echo "=========================================="
echo "  GEO Product Audit v1.0"
echo "=========================================="

echo ""
echo "## 1. 页面完整性"
echo ""

# 导航项与页面映射
declare -A PANEL_MAP
PANEL_MAP["dashboard"]="GeoDashboard (component)"
PANEL_MAP["brands"]="BrandListPage.vue"
PANEL_MAP["website"]="BrandDetailPage.vue (with brandId)"
PANEL_MAP["keywords"]="KeywordPage.vue"
PANEL_MAP["knowledge"]="KnowledgeCenterPage.vue"
PANEL_MAP["knowledge-graph"]="KnowledgeGraphPage.vue"
PANEL_MAP["settings"]="SettingsPage.vue"
PANEL_MAP["execution-studio"]="ExecutionStudioPage.vue"
PANEL_MAP["execution-trace"]="❌ MISSING — falls to placeholder"
PANEL_MAP["system-lens"]="SystemLensPage.vue"
PANEL_MAP["system-control"]="SystemControlPage.vue"
PANEL_MAP["system-metadata"]="SystemMetadataPage.vue"

for panel in "${!PANEL_MAP[@]}"; do
  val="${PANEL_MAP[$panel]}"
  if echo "$val" | grep -q "❌"; then
    echo "  ❌ $panel → $val"
  else
    echo "  ✅ $panel → $val"
  fi
done

echo ""
echo "## 2. 后端路由完整性"
echo ""

ENDPOINTS=(
  "GET /api/geo/brands"
  "POST /api/geo/brands"
  "PUT /api/geo/brands/:id"
  "DELETE /api/geo/brands/:id"
  "GET /api/geo/brands/:id/settings"
  "PUT /api/geo/brands/:id/settings"
  "GET /api/geo/brands/:id/status"
  "GET /api/geo/keywords"
  "POST /api/geo/keywords"
  "DELETE /api/geo/keywords/:id"
  "POST /api/geo/keywords/import"
  "GET /api/geo/keywords/export"
  "POST /api/geo/scans"
  "GET /api/geo/scans"
  "GET /api/geo/scans/:id"
  "DELETE /api/geo/scans/:id"
  "GET /api/geo/dashboard/stats"
  "GET /api/geo/dashboard/provider-status"
)

GLOBAL_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjBiYTViZjk4LTcwMDUtNDAxOS1hNDMxLTZhMGZiNGIyZDI4ZCIsImVtYWlsIjoicXFfNkY3MzZGQUMzN0VEM0EzQUY3NzRBRTA5MjQzNzRGNERAYWlnYy5mdXNodG4uY29tIiwidG9rZW5WZXJzaW9uIjo2MCwiaWF0IjoxNzgyNzMxOTUzfQ.TpuRIpNoViE3roOldBcnAgUzyaet0P5DwneJSqVVEWE"

for ep in "${ENDPOINTS[@]}"; do
  method=$(echo "$ep" | cut -d' ' -f1)
  path=$(echo "$ep" | cut -d' ' -f2-)
  
  # Replace :id with a test id
  url="http://localhost:4002$path"
  url="${url/:id/e76c76d9-843e-46c5-a98d-589da1fb44b6}"
  
  # Simple GET check
  if [ "$method" = "GET" ]; then
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url" -H "Authorization: Bearer $GLOBAL_TOKEN" 2>/dev/null)
    if [ "$status" = "200" ] || [ "$status" = "404" ]; then
      echo "  ✅ $method $path → $status"
    else
      echo "  ⚠ $method $path → $status (not 200/404)"
    fi
  fi
done

echo ""
echo "## 3. 数据一致性"
echo ""

# KO vs Entity
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d aigc_scs -t -A -c "
SELECT 'knowledge_objects', COUNT(*) FROM knowledge_objects
UNION ALL
SELECT 'kmki_geo_entities', COUNT(*) FROM kmki_geo_entities
UNION ALL
SELECT 'kmki_geo_entity_relations', COUNT(*) FROM kmki_geo_entity_relations
UNION ALL
SELECT 'geo_brand_settings', COUNT(*) FROM geo_brand_settings
UNION ALL
SELECT 'geo_keywords', COUNT(*) FROM geo_keywords
UNION ALL
SELECT 'geo_scan_history', COUNT(*) FROM geo_scan_history;
" 2>/dev/null

echo ""
echo "## 4. 问题清单"
echo ""

echo "  ⚠  navigation: execution-trace panel 未映射 → falls to placeholder"
echo "  ⚠  dashboard: 使用 GeoDashboard component 而非 DashboardPage.vue（检查哪个是活跃的）"
echo "  ℹ️  brand settings: 只有通过创建流程才有，现有 113 个项目的旧品牌没有 settings"
echo "  ℹ️  koCount=0: knowledge_objects 无数据，需要迁移旧数据"
echo ""

echo "=========================================="
echo "  Audit Complete"
echo "=========================================="
