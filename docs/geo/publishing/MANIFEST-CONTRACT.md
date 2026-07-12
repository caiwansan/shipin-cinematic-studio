# Publish Manifest — Single Publishing Contract for RC3 Production

## Scope

This document defines the **PublishManifest** as the sole publishing contract for GEO-RC3 Production. Every publishing component (Renderer, Generator, Sitemap, Feed, API, Distribution) **must** consume the Manifest and **must not** read the database directly.

## Architecture Rule

> **Publish Manifest** is the Single Publishing Contract for RC3 Production.
> All publishing components consume the Manifest only — no direct database reads.

## Lifecycle

1. **KnowledgePackage** → (Builder) → **PublishManifest** → (Registered in Registry)
2. **Renderer / Generator / Sitemap / Feed / API** → reads from **Manifest Registry**
3. **Distribution** → consumes finalized **PublishManifest**

## Manifest Structure

| Section | Purpose |
|---------|---------|
| `identity` | Content identity (type, id, slug, canonical URL) |
| `routing` | URL path, route name, version |
| `content` | Body blocks, summary, definition, features, useCases, timeline |
| `structuredData` | JSON-LD, schema types, entity graph |
| `metadata` | SEO (title, description, OG, Twitter, robots) |
| `discoverability` | Sitemap, Feed, llms.txt settings |
| `assets` | Primary image, gallery, attachments |
| `publishing` | Status, confidence, snapshot version, source |
| `version` | Manifest version, content version, SHA-256 hash |

## Rules

- **Single source of truth** — Manifest is the only contract; no dual paths
- **No raw DB access** — Components consume Manifest, not Prisma/raw data
- **Slug generation** — lowercase + hyphens, no database IDs
- **canonicalUrl** — uses `baseUrl` configuration, never hardcoded
- **Version independence** — Manifest version (`1.0.0`) is separate from content version (increments with content changes)
- **Immutability** — Once published, content is frozen; updates create new versions

## Components Using Manifest

- **Renderer** — renders content blocks to HTML/MDX
- **Sitemap Generator** — reads discoverability.inSitemap + routing.path
- **Feed Generator** — reads discoverability.inFeed + content.summary
- **API Layer** — serves manifest data to frontends
- **Distribution Engine** — pushes manifest content to channels

## Verification

All components verify via:
```
GET /api/v1/geo/manifests/stats  →  registry statistics
GET /api/v1/geo/manifests         →  all manifests
GET /api/v1/geo/manifests/:slug   →  single manifest
```
