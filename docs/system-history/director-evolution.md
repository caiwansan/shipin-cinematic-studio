# Director Evolution History

## Overview

The director subsystem went through 3 generations. The current active version is v2.

## v1 — Original Director Intelligence Layer

- **Location**: `src/director/`
- **Status**: frozen
- **Period**: early development
- **Architecture**: 10 files — 5 Agent modules + 4 Engine modules + rule base
- **Components**:
  - Narrative understanding
  - Character/scene/rhythm/shot design
  - Prompt compilation
- **Why frozen**: v2 proved more stable. v1 agents were ported or superseded.
- **Integration**: DirectorEngine (src/engine/) still routes through director.ts but v1 logic is dormant.

## v2 — Semantic Runtime (current active)

- **Location**: `src/director-v2/`
- **Status**: active, production
- **Period**: 2026-05-14 onward
- **Architecture**: Director Field Theory — 7-layer IntentAnchor structure
- **4 production entrypoints**:
  - `POST /api/v2/director/generate` — full generation
  - `GET /api/v2/director/status` — observability
  - `GET /api/v2/director/preview` — session preview
  - `POST /api/v2/director/refine` — refinement
- **Key design**: Non-causal observability plane — diagnostics layer reads but never writes runtime
- **561 tests** all green

## Director Simulation Layer

- **Location**: `src/director-simulation/`
- **Status**: frozen
- **6 files**: scene/episode/emotion/continuity preplay + Gatekeeper
- Gatekeeper decision model: GO >0.85 / FIX 0.6-0.85 / BLOCK <0.6
- Routes registered but never production-hardened

## Why Not Merging

v1 and v2 coexist because v1 routes (`/api/v1/director/*`) still serve legacy clients. 
Migration plan: retire v1 routes when all clients use v2.
