# DEPRECATED — KMKI-GEO Legacy Pages

**Date:** 2026-07-18  
**Status:** ⛔ DEPRECATED — not loaded by any route, not imported by any module

## Files

All files under `frontend/modules/geo/` are **deprecated** and must not be used:

| File | Status | Reason |
|------|--------|--------|
| `pages/GEOProjectList.vue` | 🗑️ Dead | Replaced by `studio-v2/workspace/brand-geo/` |
| `pages/GEOProjectWorkspace.vue` | 🗑️ Dead | Replaced by `studio-v2/workspace/brand-geo/` |
| `components/GEOProjectCard.vue` | 🗑️ Dead | Superseded |
| `components/FlowPipeline.vue` | 🗑️ Dead | Superseded |
| `components/TopicResearchPanel.vue` | 🗑️ Dead | Superseded |
| `components/EntityDiscoveryPanel.vue` | 🗑️ Dead | Superseded |
| `components/KnowledgeGraphViewer.vue` | 🗑️ Dead | Superseded |
| `components/ProvenanceTimeline.vue` | 🗑️ Dead | Superseded |
| `runtime/geo.runtime.ts` | 🗑️ Dead | Superseded |
| `services/geo.service.ts` | 🗑️ Dead | Superseded |
| `store/useGEOStore.ts` | 🗑️ Dead | Superseded |
| `types/index.ts` | 🗑️ Dead | Types moved to `studio-v2/types/geo/` |

## Verification

```bash
# No runtime imports confirmed
grep -rn "modules/geo" frontend/ --include="*.vue" --include="*.ts" 2>/dev/null | grep -v node_modules | grep -v ".nuxt" | grep -v ".output"
# → empty (no imports)
```

## Retention

Files are kept for reference only. They will be physically deleted after Phase 1 (Tenant+Project Center) completion.
