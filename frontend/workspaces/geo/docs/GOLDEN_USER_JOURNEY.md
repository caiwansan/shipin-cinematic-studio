# Golden User Journey — GEO Workspace

**Status**: Canonical (v3 — Sprint 4 Product RC)
**Scope**: Sprint 4 — Dashboard → Health/Assessment → Recommendations → Verification → Growth → Truth
**Owner**: GEO Team

## Overview

This is the single source of truth for what a working GEO looks like. Every Sprint, every RC Gate, every QA pass runs this journey first.

**v3 key change:** Discovery Lab has been hidden (under upgrade). The primary entry point for brand analysis is now **Health (Assessment)**. The full journey replaces the old discovery-centric flow with a product-grade evaluation pipeline.

## Journey Table

| # | Step | Action | Expected UI | Verifies |
|---|------|--------|-------------|----------|
| 1 | Dashboard | User opens GEO Workspace, sees brand project cards | Brand list with ADI score, platform status | Dashboard loads with real data |
| 2 | Health / Assessment | User clicks Assessment in nav, views ADI score, platform coverage, trends | Health page with real ADI score, platform breakdown, trend chart | Health API returns 200 |
| 3 | Recommendations | User views optimization suggestions based on Health data | Recommendations page with ADI score + suggestion list | Recommendation API returns 200 |
| 4 | Verification | User executes recommendations and verifies brand presence | Verification page, submit & query verification | Verification API returns 200 |
| 5 | Growth | User views brand growth trends | Growth page with trend chart + bar chart | Growth API returns 200 |
| 6 | Truth | User reviews Truth Health on Brand Overview | Brand Overview with Truth Health Mission Card | Truth Score, Golden Truth count, Pending Review, Latest Verification |

## Before / After (Sprint 4)

| Sprint 4 前 | Sprint 4 后 |
|-------------|------------|
| 2 个页面返回 404 (Recommendations, Growth) | 0 个页面返回 404 |
| Discovery Lab 显示 Mock 数据 | Discovery Lab 隐藏，路由保留用于升级提示 |
| Truth 数据不可见 | Truth Health Mission Card 可见 |
| Sidebar 有 Discovery Lab 入口 | Sidebar 干净，指向可用功能 |
| Dashboard 有死代码调用 | Dashboard 代码干净 |

## Deprecated Journey (v2)

The previous journey (Discovery → Recommendation → Mission → Verification) is deprecated. Discovery Lab is under upgrade. Use Health as the primary entry point for brand analysis.
