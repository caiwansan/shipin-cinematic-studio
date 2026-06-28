# Abandoned Systems

## Purpose

This document catalogs systems that were built, partially integrated, and then abandoned.
It exists to prevent AI-driven re-invention and human confusion.

## Legend

- **dead**: no runtime path, no route registration, purely research
- **frozen**: has route registration but no production usage
- **archived**: type-level integration only, execution path disconnected

---

## 1. Simulation System

- **Location**: `src/simulation/`, `src/director-simulation/`
- **Status**: frozen
- **Why built**: Pre-execution simulation for scene/episode quality gatekeeping
- **Why abandoned**: Director-v2 observability plane made simulation redundant for runtime decisions
- **What remains**: Routes registered, worker infra exists, no active calls

## 2. Production Loop

- **Location**: `src/production-loop/`
- **Status**: frozen
- **Files**: `api.ts` — registered routes
- **Why built**: Intended as the "production feedback loop" for continuous improvement
- **Why abandoned**: Scope creep — unclear success criteria

## 3. Replay System

- **Location**: `src/replay/`, `src/replay-analytics/`
- **Status**: frozen
- **Why built**: Execution trace replay for debugging and analytics
- **Why abandoned**: Event journal (`/journal` endpoint) served the same purpose with less complexity
- **Route**: Registered but no active consumers

## 4. Shadow Execution

- **Location**: `src/queue/` → `capability-dispatcher.ts`
- **Status**: frozen → comment-removed in code pruning
- **Why built**: Dual execution for A/B comparison of LLM outputs
- **Why abandoned**: Added latency and complexity without proven value

## 5. Control Plane (v2)

- **Location**: `src/control-plane/`
- **Status**: archived
- **Why built**: System-wide control plane for routing and scaling
- **Why abandoned**: Superseded by simpler PM2-based process management

## 6. Queue System (legacy)

- **Location**: `src/queue/`
- **Status**: frozen
- **Why built**: Original capability dispatch queue
- **Why abandoned**: Replaced by `src/jobs/` (PostgreSQL SKIP LOCKED)

## 7. Asset Economy

- **Location**: `src/core/asset-economy/`
- **Status**: archived
- **Why built**: Token/credit economy for asset usage
- **Why abandoned**: Business model not implemented

## 8. Payment System

- **Location**: `src/payment/`
- **Status**: archived
- **Why built**: Payment processing routes
- **Why abandoned**: Payment handled by external provider (Baota panel)

---

## Summary Statistics

| Status | Count | Examples |
|--------|-------|---------|
| dead (deleted) | 157 files | kernel, autograph |
| frozen | 15 directories | simulation, replay, production-loop, queue |
| archived | 12 directories | graph-runtime, control-plane, payment, schemas |

## Risk

These systems create "zombie imports" — files that are imported but whose execution path is disconnected.
During any future refactor, verify actual runtime usage before removing.
