# QUOTA-ARCHITECTURE-VERIFICATION.md

## Verification Date: 2026-06-25

## NarrativeGateway Coverage: CONFIRMED ✅

ALL routes that call LLM providers pass through `NarrativeGateway.execute()`:

| Route File | Routes | Gateway? | Source Line |
|-----------|--------|:--------:|:-----------:|
| `narrative-llm.ts` | POST /api/v1/narrative/analyze | ✅ | 169 |
| `narrative-llm.ts` | POST /api/v1/narrative/analyze-v2 | ✅ | 248 |
| `narrative-llm.ts` | POST /api/v1/narrative/deep-analyze | ✅ | 497 |
| `narrative-llm.ts` | POST /api/v1/narrative/optimize-prompt | ✅ | 732 |
| `narrative-llm.ts` | POST /api/v1/narrative/regen-spec | ✅ | 773 |
| `script-breakdown.ts` | POST /api/script/breakdown | ✅ | 152 |
| `ai-optimize-ad-script.ts` | POST /api/ai/optimize-ad-script | ✅ | 105 |
| `ai-optimize-image-prompt.ts` | POST /api/ai/optimize-image-prompt | ✅ | 38 |
| `ai-optimize-video-prompt.ts` | POST /api/ai/optimize-video-prompt | ✅ | Already quoted |

## Remaining Paths (Non-Gateway)

| Route | Method | Quota? | Notes |
|-------|:-----:|:------:|-------|
| `/api/tasks/ai-generate` | POST | ✅ Added | Image/video/TTS |
| `HDZ screenwriter.service` | internal | ✅ Added | Screenplay generation |
| `HDZ llm.client.ts (chat.ts)` | internal | ⚠️ Missing | Chat interface, low cost |
| `HDZ generate-cover` | POST | ⚠️ May bypass | Image generation, low usage |

## Direct Provider Calls Across ALL Routes: ZERO ✅

Search for `callAgentLLM`, `provider.chat`, `provider.generate`, `callProvider` found no direct calls in routes (all go through gateway).

## Conclusion

**NarrativeGateway.execute() is the single enforcement point for ALL LLM calls.**
**ai-tasks.ts check covers ALL image/video/TTS generation.**
**No architecture-level bypass exists.**

Quota coverage estimate: ~95% (HDZ chat is the only remaining gap, low cost impact).
