# UI-D1 Regression Audit — Video Generation Button Visibility

## Incident
UI-D1 refactor caused the "Video Generation" entry point to be hidden.

## Root Cause (RCA)
**display:none cascade effect (suspect 1)**

UI-D1 implemented `display:none` on the legacy `collapse-section.open` container to hide the duplicate input area (narrative/dialogue/effects/negative/duration). However, the model selector and execution buttons (compile + generate video) are also children of this same `collapse-section.open` div. The `display:none` on the parent cascaded to all children, making the buttons invisible.

## DOM Structure (Before Fix)
```
<div class="collapse-section open" style="display:none;">     ← HIDDEN
  <div class="aigc-form" style="display:none;">                ← Duplicate inputs (correctly hidden)
    ...
  </div>
  <div class="field-group">                                    ← Model selector (UNINTENTIONALLY hidden)
    <label>🤖 视频模型</label>
    <select v-model="selectedVideoModel">...
  </div>
  <div class="detail-header">                                  ← Execution buttons (UNINTENTIONALLY hidden)
    <button>🎬 AI 优化提示词</button>
    <button>🎬 生成视频</button>
  </div>
</div>
```

## Fix
Remove `style="display:none"` from `collapse-section.open`. The only section that should remain hidden is the `aigc-form` (the duplicate input fields), which already has its own `display:none`.

## Verification
- Build: ✅ `npx nuxi build` passes
- JS files: ✅ All 14 JS references return HTTP 200
- MIME type: ✅ `content-type: application/javascript`
- Deployed: ✅ `pm2 restart frontend` with new server bundle

## Risk Assessment
| Area | Impact | Status |
|------|--------|--------|
| Compiler execution | None — only visibility | ✅ Safe |
| Asset Builder Layer | None | ✅ Safe |
| Storyboard binding | None | ✅ Safe |
| Compiler logic | Not touched | ✅ Safe |

## Lessons for next UI refactor
1. Always verify that `display:none` on a parent does not cascade to children that should remain visible
2. Use `display:none` at the **child level** only, never at the structural container level
3. After refactor, verify ALL buttons in the affected region are visible and clickable, not just the refactored ones
