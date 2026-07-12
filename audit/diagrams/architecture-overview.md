# 昆仑镜系统架构图

## 1. 高维架构总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           KUNLUN MIRROR (昆仑镜)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │                         FRONTEND (Nuxt 3)                        │       │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │       │
│  │  │ Pages/UI │  │ Pinia   │  │Composable│  │ API Client     │  │       │
│  │  │ (Vue 3)  │◄─┤ Stores  │◄─┤ (logic)  │  │(fetch/$fetch)  │  │       │
│  │  └──────────┘  └──────────┘  └──────────┘  └───────┬────────┘  │       │
│  │                                                     │            │       │
│  │          ┌──────────────────────────────────────────┘            │       │
│  │          ▼                                                       │       │
│  │  ┌─────────────────────────────────────────────────────────┐     │       │
│  │  │           5 Workbenches (碎片化)                          │     │       │
│  │  │ ┌──────┐ ┌────┐ ┌────────┐ ┌─────────┐ ┌───────────┐   │     │       │
│  │  │ │ HDZ  │ │ GEO│ │Studio  │ │Director │ │ Platform  │   │     │       │
│  │  │ │Novel │ │    │ │  V2    │ │  OS     │ │ Workspace │   │     │       │
│  │  │ └──────┘ └────┘ └────────┘ └─────────┘ └───────────┘   │     │       │
│  │  └─────────────────────────────────────────────────────────┘     │       │
│  └───────────────────────────┬──────────────────────────────────────┘       │
│                              │ HTTP/SSE                                      │
├──────────────────────────────┼──────────────────────────────────────────────┤
│                              ▼                                               │
│                        BACKEND (Fastify 5)                                   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │   ROUTES LAYER (100+ routes, 25 without auth)                  │ │   │
│  │  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐   │ │   │
│  │  │  │ /api/  │ │/admin/ │ │/hdz/   │ │/geo/    │ │/platform/│   │ │   │
│  │  │  └────────┘ └────────┘ └────────┘ └──────────┘ └──────────┘   │ │   │
│  │  └──────────────────────┬─────────────────────────────────────────┘ │   │
│  │                         ▼                                           │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │  AI RUNTIME (碎片化 — 4条路径)                                  │ │   │
│  │  │                                                                │ │   │
│  │  │   Path 1 (✅):  Route ─► Runtime Gateway ─► Provider Registry  │ │   │
│  │  │                        ─► Provider ─► Model API                │ │   │
│  │  │                                                                │ │   │
│  │  │   Path 2 (❌):  Route ─► Model Adapters ─► Model API (bypass)  │ │   │
│  │  │                                                                │ │   │
│  │  │   Path 3 (❌):  Route ─► Queue (BullMQ) ─► Worker Runtime      │ │   │
│  │  │                        ─► Model API (direct apiKey)            │ │   │
│  │  │                                                                │ │   │
│  │  │   Path 4 (❌):  Route ─► Services ─► fetch() ─► Model API      │ │   │
│  │  │                        (full bypass, no guard no audit)        │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                      │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │  SERVICES LAYER (200+ service files)                           │ │   │
│  │  │  ┌────────┐ ┌──────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐   │ │   │
│  │  │  │ Platform│ │   GEO   │ │  Goal   │ │  Asset  │ │  HDZ   │   │ │   │
│  │  │  └────────┘ └──────────┘ └─────────┘ └─────────┘ └────────┘   │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                      │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │  GOVERNANCE / SAAS LAYER                                        │ │   │
│  │  │  ┌─────────┐ ┌───────┐ ┌───────────┐ ┌──────────┐ ┌────────┐  │ │   │
│  │  │  │Quota    │ │Usage  │ │Permission │ │Subscription│ │Billing │  │ │   │
│  │  │  └─────────┘ └───────┘ └───────────┘ └──────────┘ └────────┘  │ │   │
│  │  └────────┬───────────────────────────────────────────────────────┘ │   │
│  │           ▼                                                          │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │  DATABASE / STORAGE                                            │ │   │
│  │  │  ┌──────────┐ ┌──────┐ ┌───────────┐ ┌──────────┐ ┌────────┐  │ │   │
│  │  │  │PostgreSQL│ │Redis │ │   MinIO   │ │   COS   │ │  OSS   │  │ │   │
│  │  │  │(324 tbls)│ │      │ │ (Local FS)│ │         │ │        │  │ │   │
│  │  │  │ NO INDEX │ │      │ │           │ │         │ │        │  │ │   │
│  │  │  └──────────┘ └──────┘ └───────────┘ └──────────┘ └────────┘  │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  EXTERNAL PROVIDERS:                                                         │
│    ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌───────────┐ ┌───────────┐    │
│    │DashScope │ │VolcEngine│ │SiliconFlow │ │DeepSeek   │ │  Suno     │    │
│    │(Aliyun)  │ │(ByteDance)│ │            │ │           │ │ (Music)   │    │
│    └──────────┘ └──────────┘ └────────────┘ └───────────┘ └───────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. AI 调用路径图

```
                        ┌──────────────┐
                        │   User Page  │
                        └──────┬───────┘
                               │ HTTP Request
                               ▼
                    ┌──────────────────┐
                    │   Fastify Route  │
                    └──────┬───────────┘
                           │
          ┌────────────────┼────────────────┬────────────────┐
          ▼                ▼                ▼                ▼
   ┌────────────┐  ┌─────────────┐  ┌────────────┐  ┌──────────────┐
   │Runtime     │  │Model-Adapter│  │Queue       │  │Service       │
   │Gateway     │  │(bypass)     │  │(BullMQ)    │  │(direct)      │
   └──────┬─────┘  └──────┬──────┘  └─────┬──────┘  └──────┬───────┘
          │               │               │               │
          ▼               ▼               ▼               ▼
   ┌────────────┐  ┌─────────────┐  ┌────────────┐  ┌──────────────┐
   │Provider    │  │Provider     │  │Worker      │  │fetch()       │
   │Registry    │  │(hardcoded)  │  │Runtime     │  │(hardcoded)   │
   └──────┬─────┘  └──────┬──────┘  └─────┬──────┘  └──────┬───────┘
          │               │               │               │
          └───────────────┼───────────────┼───────────────┘
                          ▼               ▼
                   ┌─────────────────────────┐
                   │   Model Provider API    │
                   │(DashScope/VolcEngine/..)│
                   └─────────────────────────┘

Guards:  Path1 ✅(quota,permission,rate-limit)
         Path2 ❌(no guards)
         Path3 ❌(no guards)
         Path4 ❌(no guards)
```

## 3. 数据库模型关系图 (简化)

```
User ──┬── Project ──┬── Scene ── SceneImage
       │              ├── CharacterProfile ── CharacterImage
       │              ├── VideoTask ── VideoSegment
       │              ├── Storyboard ── StoryboardImage
       │              └── Asset ── UserAsset
       │
       ├── Membership
       ├── Subscription
       ├── DailyUsage
       ├── CustomerChatSession ── CustomerChatMessage
       ├── Wallet ── RechargeOrder
       └── CreatorWallet

GEO Models:    GeoProject ── GEOClaim ── GEOEvidence
               GEOBrand ── GEOActionPlan
               GEOScanRecord ── GEOPresenceEvidence

HDZ Models:    HdzProject ── HdzChapter ── HdzOutline
               HdzCharacter ── HdzFaction
               HdzManuscript

Platform:      WorkflowDef ── WorkflowNode ── WorkflowEdge
               WorkflowInstance ── WorkflowExecution
               AgentDef ── AgentSession ── AgentExecution
               CapabilityContract ── Tenant
```

## 4. 关键架构问题摘要

```
┌──────────────────────────────────────────────────────────────┐
│  CRITICALISSUES                                              │
│                                                              │
│  🔴 324 DB tables with 0 indexes                             │
│  🔴 4 different AI call paths, 3 bypassing runtime/guards    │
│  🔴 25 API routes with zero authentication                   │
│  🔴 >=30 raw SQL executions (injection risks)                │
│  🔴 12 API keys in cleartext .env                            │
│                                                              │
│  🟠 5+ workspace implementations (no unification)            │
│  🟠 51+ unused database models                               │
│  🟠 Tokens stored in localStorage (XSS vulnerable)           │
│  🟠 OAuth state in memory (not multi-instance safe)          │
│  🟠 Quota/Subscription guards not covering all AI paths      │
│  🟠 223 module entry points (over-modularized)              │
│                                                              │
│  🟡 10+ legacy/deprecated code directories still present     │
│  🟡 15+ hardcoded prompt templates                           │
│  🟡 3+ HTTP clients used inconsistently in frontend          │
│  🟡 26+ Pinia stores, some with overlapping state            │
│  🟡 Incomplete Project lifecycle state machine               │
└──────────────────────────────────────────────────────────────┘
```

## 5. 依赖流

```
Frontend (Nuxt 3) ──HTTP──► Backend (Fastify 5)
                                  │
                                  ├── Prisma ──► PostgreSQL (324 tables)
                                  │                 └── 0 indexes
                                  ├── ioredis ──► Redis (Queue + State)
                                  ├── BullMQ ──► Redis Queue
                                  ├── cos-nodejs-sdk-v5 ──► Tencent COS
                                  ├── @aws-sdk/client-s3 ──► S3/MinIO
                                  └── fetch/axios ──► External AI Providers
                                       ├── DashScope (Aliyun)
                                       ├── VolcEngine (ByteDance)
                                       ├── DeepSeek
                                       ├── SiliconFlow
                                       ├── Suno/Mureka (Music)
                                       └── TencentCloud (SMS)
```
