# Kernel & Autograph History

## Overview

Two major parallel execution systems were started but never integrated into production.

## Kernel System

- **Location**: `src/kernel/` (deleted 2026-05-21, 77 files)
- **Status**: archived → deleted
- **Purpose**: Shadow execution / dual execution system
- **Why built**: Intended to run parallel inference traces for comparison
- **Why archived**: Never reached production readiness. Routes were never registered.
- **Cleanup**: 77 files removed in code pruning (backups/code_prune_20260521_053240/)
- **File count**: 77 files | Lines: `N/A`

## Autograph System

- **Location**: `src/autograph/` (deleted 2026-05-21, 80 files)
- **Status**: archived → deleted
- **Purpose**: Independent AGI inference system
- **Why built**: Research into autonomous agent graph execution
- **Why archived**: Zero route references, no production value
- **Cleanup**: 80 files removed in code pruning
- **File count**: 80 files | Lines: `N/A`

## Lessons

1. "Next-gen execution" is a common AI-generated pattern — resist creating it unless production-proven
2. Dual execution / shadow mode needs a clear success criteria before building
3. Systems without route registration should be flagged early
