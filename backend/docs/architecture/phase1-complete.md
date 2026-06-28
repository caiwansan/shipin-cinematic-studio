# PHASE 1 — Video Single Truth Enforcement (Complete)

## Status: DONE ✅

### Phase 1A — Adapter Completeness (aliyun-video.adapter.ts)
- Created `src/core/provider-adapters/aliyun-video.adapter.ts`
- Fixed `volcengine-video.adapter.ts` (`generate()` fake API → `submit() + waitForCompletion()`)
- Registered both adapters (startup count: 7→8)
- **Verification**: `npx tsc --noEmit` ✅, 2/2 video providers covered

### Phase 1B — Execution Symmetry Lock
- Created `src/core/provider-adapters/video.failure.ts` (unified failure normalization)
- Added try/catch + `normalizeVideoFailure()` to both adapters
- Both adapters now have identical execute() contract:
  ```
  submit(params) → taskId → waitForCompletion(taskId) → { content, raw: { taskId, status, videoUrl, provider } }
  ```
- **Verification**: identical return shape, zero `.generate()` in video adapters

### Phase 1C — Lifecycle Determinism
- Created `src/core/lifecycle-state-machine.ts` (FSM: created → submitted → processing → completed/failed)
- Created `src/core/job-envelope.ts` (unified envelope + factory)
- Created `src/core/lifecycle-integration.ts` (dispatcher lifecycle wrapper)
- Valid transitions enforced by `transitionJobStatus()`
- **Verification**: FSM rejects illegal transitions, compiles clean

### Phase 1D — Route SDK Elimination
- Removed `aliyunVideo` / `volcengineVideo` imports from `src/routes/images.ts`
- Replaced `videoService.submit() + waitForCompletion()` with `dispatchByCapability('video', ...)`
- Route preserved: quota check, user key detection, download, thumbnail, DB write
- **Verification**: `grep -rn "aliyunVideo\|volcengineVideo" src/routes/` = **0 hits**

## Final State
```
VIDEO_CAPABILITY = SINGLE_PATH ✅
DISPATCHER = TRUE ENTRY POINT   ✅
ROUTES = PURE CONTROL PLANE     ✅
WORKER = EXECUTION ONLY         ✅
```
