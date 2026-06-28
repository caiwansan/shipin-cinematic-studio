# Showrunner Evolution History

## Overview

The Showrunner was built as a "Director's Brain" — a cognitive pipeline with 5 layers of narrative understanding. It was one of the most architecturally ambitious systems in the repo.

## Architecture (frozen)

L1 Narrative Understanding → L2 Emotion Modeling → L3 Structure Planning → L4 Production Strategy → L5 Executive Coordination

- **Files**: 7 files (5 cognitive layers + main class + 3 API endpoints)
- **Async mode**: Job-based execution via showrunner-worker and cognition-worker
- **Job store**: PostgreSQL-based with SKIP LOCKED

## Why Frozen

1. **Over-engineered for current needs**: The 5-layer cognitive model never found a production use case that justified its complexity
2. **Director-v2 overlapped**: The semantic runtime in director-v2 handled narrative understanding more efficiently
3. **Async job infra exists but unused**: Post `/api/v1/showrunner/plan` and `/api/v1/showrunner/execute` still work, but no client calls them
4. **World Memory Service**: Created alongside showrunner but never populated (Narrative LLM returned empty skeletons)

## Status

- Routes: registered
- Workers: running (showrunner-worker, cognition-worker in jobs/)
- World Memory DB table: exists but empty
- Recommendation: freeze — keep infrastructure, don't enhance

## What Would Need to Happen to Reactivate

1. A client that needs 5-layer cognitive planning
2. Population of World Memory (currently empty)
3. Validation against director-v2 output quality
