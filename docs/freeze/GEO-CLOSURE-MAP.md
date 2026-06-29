# P2.3 Final Closure Map — GEO Product Surface Lock

**Status**: ✅ Frozen
**Based On**: P2.0 Blueprint + P1.C Freeze Manifest
**Rule**: No new product surface pages beyond this map. Any extension requires architecture review.

---

## 0. Closure Goal

The GEO workspace has exactly **4 product layers**, each with exactly **1 page**:

```
┌─────────────────────────────────────────────────────────────┐
│                     GEO Workspace                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1 — Execution (doing)                                │
│  │  ExecutionStudioPage        ← P2.3 Step 2               │
│  │  └ WorkflowTimeline                                      │
│  │  └ ExecutionOutputPanel                                  │
│  │                                                          │
│  Layer 2 — Lens (seeing)                                    │
│  │  SystemLensPage             ← P2.3 Step 3               │
│  │  └ 4 cards: Summary / Lifecycle / Access / Health        │
│  │                                                          │
│  Layer 3 — Control (managing)                               │
│  │  SystemControlPage          ← P2.3 Step 4               │
│  │  └ 4 panels: Flags / Tier / Debug / Introspection        │
│  │                                                          │
│  Layer 4 — Metadata (explaining)                            │
│     SystemMetadataPage         ← P2.3 Step 5               │
│     └ 4 cards: Narrative / Exec Story / Exposure / Tags    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Surface Page Registry (Frozen)

| Page ID | Page File | Layer | Data Source | Status |
|---------|-----------|-------|-------------|--------|
| `execution-studio` | ExecutionStudioPage.vue | Execution | useGeoHydrate + ExecutionStateManager | ✅ Live |
| `system-lens` | SystemLensPage.vue | Lens | ExecutionStateManager + PermissionService + useGeoHydrate | ✅ Live |
| `system-control` | SystemControlPage.vue | Control | featureFlags + PermissionService + ExecutionStateManager + useGeoHydrate | ✅ Live |
| `system-metadata` | SystemMetadataPage.vue | Metadata | useGeoHydrate + ExecutionStateManager | ✅ Live |

### Backward compatibility (legacy routes retained but not promoted)
| Page ID | Status | Note |
|---------|--------|------|
| `execution` | ⏸️ Legacy | Kept for bookmarks, same as execution-studio |
| `inspector` | ⏸️ Legacy | Kept for bookmarks, superseded by system-lens |

---

## 2. Sidebar Mapping (Frozen)

```
GEO_SIDEBAR_MENU:
├── dashboard        → /workspace/geo?panel=dashboard        ✅
├── projects         → /workspace/geo?panel=projects         ✅
├── execution-studio → /workspace/geo?panel=execution-studio ✅ Layer 1
├── system-lens      → /workspace/geo?panel=system-lens      ✅ Layer 2
├── knowledge-graph  → /workspace/geo?panel=knowledge-graph  ✅
├── system-control   → /workspace/geo?panel=system-control   ✅ Layer 3
└── system-metadata  → /workspace/geo?panel=system-metadata  ✅ Layer 4
```

**Rule**: No new sidebar entries without architecture review.

---

## 3. BrandGEOWorkspace Panel Router (Frozen)

All v-else-if blocks are finalized:

```
activePanelId
├── → dashboard
├── → projects / project-select
├── → project-create
├── → brand-profile                (frozen, Phase 2 stub)
├── → website-scanner              (frozen, Phase 2 stub)
├── → knowledge-graph
├── → execution                    (legacy, same as execution-studio)
├── → inspector                    (legacy, superseded by system-lens)
├── → execution-studio             ← NEW P2.3
├── → system-lens                  ← NEW P2.3
├── → system-control               ← NEW P2.3
├── → system-metadata              ← NEW P2.3
└── → fallback (GeoPlaceholderPanel)
```

**Rule**: No new panel IDs beyond this list. Legacy `execution` and `inspector` may be removed after migration period.

---

## 4. Data Flow Lock (No New Sources)

Every product surface page draws from exactly **3 data sources**:

```
┌──────────────────────────────────────────────────────┐
│               3 Data Sources (Global)                 │
├──────────────────────────────────────────────────────┤
│                                                       │
│  Source 1: useGeoHydrate                              │
│  → projectInfo, executionSummary, watcherSummary     │
│  → recentWatcherEvents, error, loading                │
│  → discoverEntities, buildGraph, evaluateQuality      │
│  → refresh, init, destroy                             │
│                                                       │
│  Source 2: ExecutionStateManager (singleton)          │
│  → getAllStates(projectId), getState(pid, cap)        │
│  → onStateChange(listener)                            │
│                                                       │
│  Source 3: PermissionService (pure fn)                │
│  → hasCapability(tier, capabilityId)                  │
│  → getAllCapabilities()                               │
│  → getCurrentUserTier()                               │
│                                                       │
│  + featureFlags.ts (isFeatureEnabled)                 │
│                                                       │
└──────────────────────────────────────────────────────┘
```

**Rules:**
- ❌ No page may import useBrandGeoStore
- ❌ No page may fetch its own data (no new API calls)
- ❌ No page may create its own state machine / watcher logic
- ✅ All pages must go through these 3 sources

---

## 5. Component Registry (Frozen)

### Shared Components (reusable)
| Component | Used By | Purpose |
|-----------|---------|---------|
| WorkflowTimeline | ExecutionStudioPage | Step flow visualization |
| ExecutionOutputPanel | ExecutionStudioPage | Watcher + result log |

### Page Components (one per page, non-reusable)
| Component | Belongs To |
|-----------|-----------|
| ExecutionStudioPage | Layer 1 |
| SystemLensPage | Layer 2 |
| SystemControlPage | Layer 3 |
| SystemMetadataPage | Layer 4 |

**Rule**: No new shared components that duplicate these. Only extract if used by 2+ pages.

---

## 6. Frozen Domains

### ✅ Frozen (no further development)
- `geo.brand.*` — brand profile backend never implemented
- `geo.dashboard.*` — dashboard stats never had backend
- `geo.task.*` — task system never implemented
- `brand-profile` page — Phase 2 stub
- `website-scanner` page — Phase 2 stub
- `inspector` panel — superseded by system-lens

### ✅ Locked (no new pages/sidebar entries)
- Execution Studio — Layer 1 complete
- System Lens — Layer 2 complete
- System Control — Layer 3 complete
- System Metadata — Layer 4 complete

### 🔮 Future extension (Phase 3+, requires review)
- `geo.export` — execution report export
- `geo.schedule` — scheduled execution
- `geo.compare` — multi-project comparison

---

## 7. Closure Validation Checklist

- [x] All 4 product layers have exactly 1 page
- [x] All pages use only 3 data sources + feature flags
- [x] No page imports useBrandGeoStore
- [x] Sidebar entries match page registry exactly
- [x] BrandGEOWorkspace v-else-if covers all panels
- [x] No legacy fetch remains in product surface pages
- [x] Legacy pages (execution, inspector) retained for migration
- [x] Frozen domains documented

---

## 8. Enforcement

1. **No new page files** in `pages/` without architecture review
2. **No new sidebar entries** without review
3. **No new data sources** — only useGeoHydrate, ExecutionStateManager, PermissionService
4. **No store imports** — useBrandGeoStore import = CI failure
5. **Frozen domains** — any code touching brand/dashboard/task names is rejected
