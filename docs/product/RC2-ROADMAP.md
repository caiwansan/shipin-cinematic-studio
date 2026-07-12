# RC2 — Real AI Provider Layer

**Status:** PLAN (pending implementation)
**Phase:** RC2
**Previous phase:** RC1 — Product Experience (frozen)

## Goal

Migrate GEO Workspace Discovery/Verification from Mock → Real AI Providers, keeping Registry architecture intact.

## Architecture

```
Workspace
    │
    ▼
Discovery / Verification
    │
    ▼
Provider Registry
    │
    ├─────────────┬──────────────┐
    ▼             ▼              ▼
  Mock        DeepSeek       Future (Claude, etc.)
```

## Tasks

| Task | Priority | Description |
|------|----------|-------------|
| T001 | P0 | **Provider Infrastructure** — Registry, lifecycle, timeout, retry, circuit breaker, cache, rate limit, health, metrics |
| T002 | P0 | **DeepSeek Discovery Provider** — Prompt template, JSON Schema, auto-retry, token/latency/cost stats |
| T003 | P0 | **DeepSeek Verification Provider** — Real verification: AI recommends, understands, covers, cites |
| T004 | P1 | **Benchmark & Observability** — Provider Dashboard (health, success rate, latency, cost, cache hit) |

## Showcase Upgrade

After RC2: Success Stories / Trending Topics switch from "coming soon" placeholders → real data from DeepSeek Discovery + Verification + platform aggregates.

## Post-RC2

RC3 — Knowledge Asset Center (Information Resource Library) + knowledge asset operations.

## Complete Product Loop

**Discovery → Optimization → Verification → Showcase → Knowledge Asset Center → Continuous Operation**
