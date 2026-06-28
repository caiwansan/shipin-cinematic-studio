# API-CONTRACT-SHIELD-LAYER.md

## Status: IMPLEMENTED ✅

## Architecture

```
UI Layer                  → consumes pure DTOs (no ApiResponse exposure)
  ↓
$api.unwrap(res)          → single extraction point
  ↓
$api.get/post/put/delete  → returns ApiResponse<T>
  ↓
executeInternal()         → JSON.parse(response.text())
  ↓
Backend API               → returns { success: true, data: T }
```

## Rules (enforced)

1. **UI 层禁止访问 res.data / res.data.data**
2. **唯一解包入口**: `$api.unwrap(res)`
3. **自动处理两种信封**: `res?.data?.data ?? res?.data ?? null`
4. **返回值**: `T | null` (null 表示无数据)

## Codemod Changes

| File | Lines | Before | After |
|------|:-----:|--------|-------|
| `core/control/api/kernel.ts` | 1 | (none) | Added `unwrap()` method |
| `pages/hdz/workspace/[id].vue` | 6 | `res.data.data.results[0]` | `$api.unwrap(res)?.results?.[0]` |
| `pages/hdz/workspace/[id].vue` | 1 | `res.data.data.taskIds[0]` | `$api.unwrap(res)!.taskIds[0]` |

## Remaining Locations to Audit

- `index.vue`: uses `res?.data?.data || []` → OK (already consistent with unwrap pattern)
- `workspace/[id].vue:loadProject()`: uses `res?.data?.data` → OK (same pattern)
- `workspace/[id].vue:loadChatSessions()`: uses `res?.data?.data || []` → OK

## Verification

```
grep -rn "res\.data\.data" frontend/pages/  → 0 hits ✅
grep -rn "res\?\.data\b" frontend/pages/  → 0 hits (outside unwrap guard) ✅
```
