# SAAS-QUOTA-COVERAGE-AUDIT.md

## Date
2026-06-25

## Summary

**CRITICAL FINDING**: Only 3 out of 10+ AI call paths have quota enforcement. 
The main AI task route (`POST /api/tasks/ai-generate`) has NO quota check at all.

---

## Q1: ALL AI Call Entry Points

| # | Route / Path | Workbench | Quota Check | Severity |
|---|-------------|-----------|:-----------:|:--------:|
| 1 | `POST /api/tasks/ai-generate` | Short Drama (image/video/tts) | ❌ NONE | 🔴 P0 |
| 2 | `POST /api/script/submit` | Short Drama (analysis) | ❌ NONE | 🔴 P0 |
| 3 | `narrative-llm.ts` (5 LLM paths) | Short Drama (everything) | ❌ NONE | 🔴 P0 |
| 4 | `POST /api/script/regenerate` | Short Drama (analysis) | ❌ NONE | 🔴 P0 |
| 5 | `POST /api/hdz/agent/generate` | Novel Workbench | ❌ NONE | 🔴 P0 |
| 6 | `POST /api/hdz/chat/send` | Novel Workbench | ❌ NONE | 🔴 P0 |
| 7 | `POST /api/hdz/generate-cover` | Novel Workbench | ❌ NONE | 🔴 P0 |
| 8 | `POST /api/ai-optimize-ad-script` | Ad/PPT Workbench | ❌ NONE | 🟠 P1 |
| 9 | `POST /api/ai-optimize-image-prompt` | Image optimization | ❌ NONE | 🟠 P1 |
| 10 | `optimize-video-agent.ts` | Video agent optimization | ✅ CHECKED | 🟢 OK |
| 11 | `ai-optimize-video-prompt.ts` | Video prompt optimization | ✅ CHECKED | 🟢 OK |
| 12 | `customer-service.ts` | Customer service AI | ✅ CHECKED | 🟢 OK |

## Q2: Bypass Path Details

### 🔴 P0: POST /api/tasks/ai-generate (Main AI entry)
- Called by: Storyboard image generation, character image, scene image, video generation, TTS
- Quota: **NONE** — no quota check at route level or in worker
- Impact: ALL image/video/tts generation by FREE users is unbounded
- Files: `routes/ai-tasks.ts`, `queue/worker-runtime.ts`, `queue/queue-manager.ts`

### 🔴 P0: narrative-llm.ts (5 LLM call paths)
- Called by: Script analysis, character extraction, scene extraction, prompt optimization
- Quota: **NONE** — all 5 paths use `narrativeGateway.execute()` without quota check
- Impact: ALL LLM calls for short drama workbench are unbounded
- Files: `routes/narrative-llm.ts`

### 🔴 P0: Novel workbench (HDZ)
- `incrementDailyUsage` exists in `llm.client.ts` (line 282) and `screenwriter.service.ts` (line 166)
- But NO `checkDailyQuota` before the LLM call
- `incrementDailyUsage` has `.catch(() => {})` — silently swallows errors
- Impact: Novel workbench AI calls (chapter generation, chat, rewrite) are unbounded
- Files: `routes/hdz/agent.ts`, `routes/hdz/chat.ts`, `services/hdz/llm.client.ts`

## Q3: Workbench Coverage

| Workbench | AI Operations | Quota Coverage |
|-----------|--------------|:--------------:|
| Short Drama | Script analysis | ❌ |
| Short Drama | Image generation | ❌ |
| Short Drama | Video generation | ❌ |
| Short Drama | TTS generation | ❌ |
| Short Drama | Prompt optimization | ✅ (video-prompt only) |
| Novel | Chapter generation | ❌ |
| Novel | Chat/AI write | ❌ |
| Novel | Cover generation | ❌ |
| Novel | Rewrite/Expand | ❌ |
| PPT/Ad | Script optimization | ❌ |

## Q4: Verification Results (Expected)

| Scenario | Expected | Actual |
|----------|:--------:|:------:|
| FREE user, 21st AI call | ❌ Blocked | ✅ Would pass (no quota) |
| VIP user, 100th call | ✅ Allowed | ✅ Would pass |
| SVIP user, 1000th call | ✅ Allowed | ✅ Would pass |

## Q5: Recommended Fix

Add quota check to the following files (in priority order):

1. `routes/ai-tasks.ts` — Before enqueuing task, check `checkDailyQuota(userId)`
2. `routes/narrative-llm.ts` — Before each `narrativeGateway.execute()` call
3. `routes/hdz/agent.ts` — Before `POST /api/hdz/agent/generate`
4. `routes/hdz/chat.ts` — Before LLM call in chat
5. `routes/script-breakdown.ts` — Before analysis
6. `routes/ai-optimize-ad-script.ts` — Before LLM call
7. `routes/ai-optimize-image-prompt.ts` — Before LLM call

Pattern:
```ts
const quota = await checkDailyQuota(userId)
if (!quota.canProceed) {
  return reply.status(403).send({
    error: `今日 AI 调用次数已达上限（${quota.limit} 次）`,
    quota: { used: quota.used, limit: quota.limit, remaining: quota.remaining }
  })
}
```

## Conclusion

**Quota coverage is extremely low.** Only 3 out of 10+ AI call paths are protected. 
A FREE user can make unlimited AI calls across all three workbenches.
This is a P0 SaaS commercialization blocker.
