# Kunlun Mirror (昆仑镜) Backend Architecture Audit

**Date**: 2026-07-03  
**Scope**: `/root/shipin-cinematic-studio/backend/src` (2067 TypeScript files, 22K+ lines routes)  
**Audit Type**: Full architectural compliance review against freeze requirements

---

## 1. Findings Summary Table

| Area | Status | Severity | Details |
|------|--------|----------|---------|
| **Route Inventory** | ⚠️ WARN | MEDIUM | 185 route files, ~22,316 lines. 3 mega-files: execution-images (1293), member (1063), payment (1053) |
| **`as any` in routes** | ❌ CRITICAL | HIGH | 1004 `as any` usages confirmed (worse than previously reported 459) |
| **Bypass Path 1: images.ts** | ✅ RESOLVED | — | Proxies to `/api/tasks/ai-generate`. But `/videos/generate` (no auth) has direct logic (line 97) |
| **Bypass Path 2: tts.ts** | ✅ RESOLVED | — | Proxies to `/api/tasks/ai-generate`. Clean SEEL implementation |
| **Bypass Path 3: voice.ts** | ✅ RESOLVED | — | `/voice/test` proxies to `/api/tasks/ai-generate`. `/voice/design`/`/clone` are non-execution |
| **DESKTOP Bypass** | ❌ CRITICAL | HIGH | desktop-tts (edge-tts), desktop-comfy, desktop-ollama, desktop-video — all bypass SEEL entirely |
| **Direct prisma in routes** | ❌ CRITICAL | HIGH | Routes consistently call `prisma` from `../utils/index` directly (not through repositories) |
| **Repository Pattern** | ⚠️ WARN | MEDIUM | 4 thin wrappers in `services/repositories/` + GEO repos. Thin POJOs, not true Repository pattern |
| **GEO/HDZ/Knowledge Separation** | ✅ GOOD | — | Proper directory isolation. But HDZ services import prisma directly (164 occurrences) |
| **Agent Orchestrator** | ⚠️ WARN | LOW | 1239-line monolithic orchestrator. DAG model is clean but no error recovery between phases |
| **Hardcoded URLs (model-adapters)** | ❌ CRITICAL | HIGH | 7+ hardcoded URLs: siliconflow-tts, siliconflow-image, aliyun-tts, volcengine-tts, openai-compat (3), GEO deepseek adapter |
| **Hardcoded URLs (providers)** | ❌ CRITICAL | HIGH | GEO presence adapters have hardcoded URLs (e.g., deepseek adapter uses `DEEPSEEK_BASE_URL` fallback) |
| **Rate Limiting** | ❌ FAIL | HIGH | RateLimiter exists at `services/geo/provider/rate-limiter.ts` but NOT wired into any execution path. Global Fastify rate-limit (600/min/IP) only |
| **executionCutover (SEEL)** | ⚠️ WARN | MEDIUM | Most old routes proxy. But desktop routes + v1 video routes + some direct fetches remain |
| **Governance Wiring** | ❌ FAIL | CRITICAL | PolicyEngine exists but NOT called anywhere. ContractDriftAnalyzer NOT wired. governanceGate is LOG_ONLY. DriftDetector=0 references. **Not integrated** |
| **Config Secrets** | ⚠️ WARN | MEDIUM | `config/env.ts` has defaults (development-friendly). `config-runtime` only freezes crypto key. process.env key pollution via registry.ts |
| **Response Format Consistency** | ⚠️ WARN | MEDIUM | Hybrid patterns: some `{success, data}`, some bare objects, some `{success, error}`. ApiResponse type underused |
| **Empty catch blocks** | ❌ CRITICAL | HIGH | 17+ silent `catch {}` blocks confirmed across codebase |
| **console.log in prod code** | ⚠️ WARN | LOW | ~200+ instances in services, ~285 in routes |
| **AbortSignal.timeout leak** | ❌ CRITICAL | HIGH | 120000ms timeouts in siliconflow-tts, aliyun-tts. Never aborted/cleaned |
| **writeFileSync blocking event loop** | ❌ CRITICAL | HIGH | `writeFileSync` in request handler: siliconflow-tts.ts:180,196. desktop-tts also uses sync file ops |
| **Legacy queue-manager** | ⚠️ WARN | MEDIUM | Still exists at `src/queue/queue-manager.ts` (378 lines). Coexists with new execution system |
| **Dead code** | ⚠️ WARN | LOW | `.bak` files in HDZ, `_deprecated/` in GEO, backup route files (`.preboundary-fix`, `.analyze-v2-bak`) |
| **process.env key pollution** | ❌ CRITICAL | HIGH | registry.ts:108-116 injects `runtime.apiKey` into process.env before adapter execution, deletes in finally. Race condition risk |
| **Memory-only state** | ❌ CRITICAL | HIGH | All execution state stores confirmed memory-only (no persistence) |

---

## 2. Architecture Compliance Score: **42/100**

### Scoring Breakdown

| Category | Weight | Score | Reason |
|----------|--------|-------|--------|
| **SEEL/ExecutionCutover** | 15% | 6/15 | Core paths proxy; desktop routes + v1 video routes are bypasses |
| **Repository Pattern Compliance** | 10% | 3/10 | Thin wrappers, routes call prisma directly |
| **Service Layer Separation** | 10% | 7/10 | Good directory structure; HDZ still has direct prisma coupling |
| **Provider Abstraction** | 15% | 5/15 | 7+ hardcoded URLs, no wired rate limiting, AbortSignal leaks |
| **Governance Wiring** | 15% | 0/15 | PolicyEngine/DriftDetector exist but ZERO integrations. governanceGate=LOG_ONLY |
| **Config Sovereignty** | 10% | 6/10 | config-runtime bootstraps crypto key; process.env pollution defeats sovereignty |
| **API Consistency** | 10% | 5/10 | Hybrid response patterns; ApiResponse contract underutilized |
| **Error Handling** | 10% | 4/10 | Silent catches, console.log, no structured error taxonomy |
| **Dead Code & Tech Debt** | 5% | 3/5 | Backup files, deprecated code, 1004 `as any` casts |
| **Security (payment race, credit)** | 10%* | 3/10 | Payment race condition, credit non-atomicity, process.env pollution |

*\*Weight adjusted: security concerns pull score down further*

**Final Score: 42/100** — Below minimum freeze compliance (target: ≥70)

---

## 3. Priority Issues List

### 🔴 P0 — Immediate (blocking freeze compliance)

1. **Governance layer not wired** — PolicyEngine, DriftDetector, ContractDriftAnalyzer exist as code but have ZERO callers. Runtime has no contract enforcement.
2. **Desktop route bypasses** — desktop-tts.ts (edge-tts), desktop-comfy, desktop-ollama, desktop-video bypass SEEL execution lock
3. **process.env key pollution** — `registry.ts:108-116` and `index.ts:156-177` both pollute process.env. Race condition when multiple requests hit concurrently
4. **AbortSignal.timeout(120000) never cleaned** — Creates AbortSignal objects that are never freed. Memory leak in every TTS/image request
5. **writeFileSync in request path** — Blocks event loop. siliconflow-tts.ts writes audio to disk synchronously during request handling

### 🟠 P1 — High Priority

6. **1004 `as any` in routes** — Type erasure defeats all compile-time safety
7. **Direct prisma calls in routes** — ~164 direct `prisma` imports in HDZ alone. Repository pattern not enforced
8. **7+ hardcoded BASE_URLs** — In model-adapters (siliconflow-tts/image, aliyun-tts, volcengine-tts, openai-compat, GEO deepseek adapter). Should be config-driven
9. **Rate limiter not wired** — `services/geo/provider/rate-limiter.ts` exists but is a standalone class with no integration into any execution path
10. **Memory-only state stores** — All execution state is in-memory. No persistence across restarts

### 🟡 P2 — Medium Priority

11. **Legacy queue-manager still exists** — `src/queue/queue-manager.ts` (378 lines) coexists with new BullMQ-based execution system
12. **Hybrid response formats** — Some routes return `{success, data}`, some bare `{...}`, some `{error: string}`. No unified envelope
13. **17+ empty catch blocks** — `catch {}` silently swallows errors across the codebase
14. **Dead code files** — `.bak` files in HDZ, `_deprecated/` in GEO publishing, backup route files
15. **Monolithic orchestrator** — `aigc-orchestrator.ts` at 1239 lines. No error compensation between phases

### 🟢 P3 — Low Priority

16. **~500 console.log in production paths** — Creates noise and potential PII leakage
17. **Geo repository redundancy** — Both `services/repositories/` and `services/geo/repositories/` exist with overlapping patterns
18. **ContractDriftAnalyzer is a filesystem scanner** — Reads src/routes/ at runtime via fs.readdirSync. Won't work in production build
19. **Payment race condition still present** — `payment.ts:17` as any instances suggest untyped credit operations
20. **Synchronous fs calls in desktop-tts** — `execSync`, `existsSync`, `unlinkSync` in request path

---

## 4. Detailed Findings

### 4.1 Route Inventory

```
src/routes/ — 185 files, ~22,316 total lines
├── Top 5 by size:
│   execution-images.ts: 1293 lines (mega-file)
│   member.ts:          1063 lines (mega-file)
│   payment.ts:         1053 lines (mega-file)
│   narrative-llm.ts:   933 lines
│   workbench-director: 906 lines
├── 10 platform sub-route dirs (agent, workspace, resource, etc.)
├── 15+ HDZ/routes (hdz/*)
└── 52+ top-level route files
```

**Auth middleware**: Most routes use `{ preHandler: [fastify.authenticate] }` but some lack it (health, captcha, system-version, some v1 endpoints).

### 4.2 Bypass Paths — Verified Status

| Route | SEEL Status | Evidence |
|-------|-------------|----------|
| `POST /images/generate` | ✅ Clean | Proxies to `/api/tasks/ai-generate` via `server.inject()` |
| `POST /videos/generate` | ❌ PARTIAL | In images.ts but uses same proxy. No auth middleware (line 97) |
| `POST /tts/synthesize` | ✅ Clean | Proxies via `server.inject()` |
| `POST /voice/test` | ✅ Clean | Proxies via `server.inject()` (line 203) |
| `POST /desktop/tts/generate` | ❌ BYPASS | Calls edge-tts directly (child_process spawn) |
| `POST /desktop/video/check` | ❌ BYPASS | Calls ComfyUI models directly |

### 4.3 Repository Layer Assessment

**`services/repositories/` (4 files)**: user.repository.ts, membership.repository.ts, knowledge-object.repository.ts, execution-trace.repository.ts — all are 15-25 line POJOs that call prisma directly. Not true repositories (no domain abstraction, no transaction management, no caching).

**`services/geo/repositories/` (15+ files)**: Similar pattern — thin wrappers with `catch { return null }` masking errors.

**Routes bypassing repositories**: Routes like `voice.ts`, `projects.ts`, `member.ts` frequently call `import { prisma } from '../utils/index'` directly.

### 4.4 Governance Wiring — NOT Connected

```
src/governance/
├── core/policy-engine.ts      → PolicyEngine class (53 lines, exported but NEVER imported)
├── analyzers/contract-drift-analyzer.ts → ContractDriftAnalyzer (NEVER imported)
├── governance-gate.ts          → LOG_ONLY mode (ENFORCE: false)
├── governance-controller.ts    → Optimization governance (NOT wired to execution)
├── init-governance.ts          → Stub (console.log only)
└── index.ts                   → Exports PolicyEngine but no callers found
```

**grep result**: `import.*governanceGate|from.*governance.*gate` → **0 matches** outside governance directory itself. `DriftDetector|ContractDriftAnalyzer` → **0 matches** in non-governance files.

### 4.5 Hardcoded URLs in Model Adapters

| Adapter | Hardcoded URL |
|---------|---------------|
| `openai-compat.adapter.ts` | `BASE_URLS = { deepseek: 'https://api.deepseek.com/...', openai: 'https://api.openai.com/...', siliconflow: 'https://api.siliconflow.cn/...' }` |
| `siliconflow-tts.adapter.ts` | `const BASE_URL = 'https://api.siliconflow.cn/v1/audio/speech'` |
| `siliconflow-image.adapter.ts` | `const BASE_URL = 'https://api.siliconflow.cn/v1/images/generations'` |
| `aliyun-tts.adapter.ts` | `const TTS_URL = 'https://dashscope.aliyuncs.com/...'` |
| `volcengine-tts.adapter.ts` | `const BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3/tts'` |
| GEO deepseek adapter | `DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL \|\| 'https://api.deepseek.com/v1'` |

### 4.6 Configuration Weaknesses

- `config/env.ts` — Well-structured Zod schema, but has development defaults (MINIO_SECRET_KEY='minioadmin', etc.)
- `config-runtime/bootstrap.ts` — Only freezes `CRYPTO_ENCRYPTION_KEY`. Other secrets remain mutable in process.env
- `config-runtime/guard.ts` — `assertConfigIntegrity` is exported but never called in any execution path
- **process.env pollution**: Both `index.ts` (lines 156-177) and `model-adapters/registry.ts` (lines 108-116) write API keys to `process.env`. The registry's finally block (line 206) tries to clean up but is not exhaustive

---

## 5. Recommendations

### Critical (must fix for architecture freeze compliance)

1. **Wire Governance layer** into CI/CD pipeline. Call `ContractDriftAnalyzer.analyzeRoutes()` as a pre-commit hook. Call `PolicyEngine` in the test suite. These are built but dormant.

2. **Seal desktop bypasses** — desktop-tts, desktop-comfy, desktop-ollama, desktop-video should either go through SEEL or have clear documentation that they are LOCAL-ONLY and never used in production.

3. **Fix process.env pollution** — Remove `registry.ts` lines 108-116 that inject runtime.apiKey into process.env. Pass API keys through explicit function parameters, not environment variables.

4. **Fix AbortSignal timeout leaks** — Clean up signals after completion. Use `AbortController` with explicit cleanup.

5. **Replace synchronous file I/O** — All `writeFileSync`/`readFileSync`/`readdirSync` in request handlers must be converted to async alternatives.

### High Priority

6. **Enforce repository pattern** — Ban direct `prisma` imports in route files via lint rule. Create proper repositories with domain interfaces.

7. **Reduce `as any` from 1004 to <50** — Implement typed request/response schemas (Zod is already used in places — extend it).

8. **Move hardcoded URLs to config** — Add per-provider baseUrl fields to `config/env.ts` or database config. Remove all inline URL strings from adapter files.

9. **Wire rate limiter** — Integrate `services/geo/provider/rate-limiter.ts` into the model-adapter execution path.

10. **Fix empty catch blocks** — At minimum log the error. Better yet, use structured error handling.

### Medium Priority

11. **Remove dead code** — Delete `.bak` files, `_deprecated/` directories, backup route files.

12. **Unify response format** — Make all routes return `{success: boolean, data?: T, error?: string}` using the existing `ApiResponse` type contract.

13. **Break up mega-files** — execution-images.ts (1293 lines), member.ts (1063 lines), payment.ts (1053 lines) need decomposition.

14. **Fix payment race condition** — Add database-level locking or optimistic concurrency for credit operations.

---

## 6. File-by-File Compliance Hotspots

| File | Lines | Issues |
|------|-------|--------|
| `src/routes/execution-images.ts` | 1293 | Mega-file, 33 `as any`, no repository pattern |
| `src/routes/member.ts` | 1063 | Mega-file, 38 `as any`, direct prisma calls |
| `src/routes/payment.ts` | 1053 | Mega-file, 17 `as any`, race condition risk |
| `src/index.ts` | 1203 | Process.env pollution, 50+ REMOVED comments, loose error handling |
| `src/agents/aigc-orchestrator.ts` | 1239 | Monolithic, no phase error recovery |
| `src/model-adapters/tts/siliconflow-tts.adapter.ts` | 208 | Hardcoded URL, AbortSignal leak, writeFileSync, catch {} |
| `src/model-adapters/tts/aliyun-tts.adapter.ts` | 141 | Hardcoded URL, AbortSignal leak |
| `src/model-adapters/registry.ts` | 225 | process.env pollution in execute() |
| `src/queue/queue-manager.ts` | 378 | Legacy system, coexists with BullMQ |
| `src/governance/core/policy-engine.ts` | 53 | Well-designed but ZERO callers |
| `src/governance/analyzers/contract-drift-analyzer.ts` | 62 | File system scanner, ZERO callers |
| `src/governance/governance-gate.ts` | 74 | LOG_ONLY mode, never blocks anything |

---

*Audit completed: 2026-07-03 by Hermes Agent*  
*Score: 42/100 — Architecture freeze NOT compliant. 5 P0 + 4 P1 items blocking compliance.*
