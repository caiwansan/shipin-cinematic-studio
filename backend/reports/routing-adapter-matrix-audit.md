# 🧭 全局路由 × 模型适配器矩阵审计报告

**生成时间:** 2026-05-24T15:13:34.528Z

## 1. Frontend Routing Graph

| Route | Page | Capabilities | Store Triggers | Hidden Dispatch |
|-------|------|-------------|----------------|-----------------|
| /admin/aigc/admins | admins | production_pipeline | (none) | ✅ |
| /admin/aigc/agents | agents | llm_generate, production_pipeline | (none) | ✅ |
| /admin/aigc/community | community | production_pipeline | (none) | ✅ |
| /admin/aigc/cos | cos | production_pipeline | (none) | ✅ |
| /admin/aigc/customer-service | customer-service | production_pipeline | (none) | ✅ |
| /admin/aigc/login | login | production_pipeline | (none) | ✅ |
| /admin/aigc/market | market | production_pipeline | (none) | ✅ |
| /admin/aigc/members | members | production_pipeline | (none) | ✅ |
| /admin/aigc/messages | messages | image_generate, production_pipeline | (none) | ✅ |
| /admin/aigc/models | models | llm_generate, image_generate, video_generate, tts, production_pipeline | (none) | ✅ |
| /admin/aigc/overview | overview | llm_generate, video_generate, production_pipeline | (none) | ✅ |
| /admin/aigc/payment | payment | llm_generate, production_pipeline | (none) | ✅ |
| /admin/aigc/vip-orders | vip-orders | production_pipeline | (none) | ✅ |
| /admin/aigc/vip | vip | production_pipeline | (none) | ✅ |
| /community/ | index | image_generate, production_pipeline | (none) | ✅ |
| /community/new | new | image_generate, video_generate, production_pipeline | (none) | ✅ |
| /community/post/[id] | [id] | image_generate, video_generate, production_pipeline | (none) | ✅ |
| / | index | image_generate, video_generate, tts, production_pipeline | (none) | ✅ |
| /login | login | image_generate, production_pipeline | useAuthStore | ✅ |
| /mobile | mobile | image_generate, production_pipeline | (none) | ✅ |
| /projects | projects | production_pipeline | useProjectStore | ✅ |
| /studio/export | export | production_pipeline | (none) | ✅ |
| /studio/ | index | production_pipeline | (none) | ✅ |
| /studio/production | production | llm_generate, image_generate, video_generate, tts, production_pipeline | useStudioStore, useAuthStore, useProjectHydrationStore | ✅ |
| /user/agent | agent | image_generate, production_pipeline | useAuthStore | ✅ |
| /user/center | center | image_generate, production_pipeline | (none) | ✅ |
| /user/credits | credits | llm_generate, image_generate, production_pipeline | useAuthStore | ✅ |
| /user/download | download | production_pipeline | (none) | ✅ |
| /user/gallery | gallery | image_generate, production_pipeline | (none) | ✅ |
| /user/library | library | llm_generate, image_generate, video_generate, production_pipeline | useAuthStore | ✅ |
| /user/membership | membership | llm_generate, image_generate, production_pipeline | (none) | ✅ |
| /user/messages | messages | llm_generate, image_generate, production_pipeline | (none) | ✅ |
| /user/profile | profile | image_generate, video_generate, production_pipeline | useAuthStore | ✅ |
| /user/projects | projects | image_generate, video_generate, production_pipeline | useAuthStore | ✅ |
| /user/promo | promo | production_pipeline | useAuthStore | ✅ |
| /user/referral | referral | production_pipeline | (none) | ✅ |
| /user/storage | storage | production_pipeline | (none) | ✅ |

## 2. Capability → Model Adapter Matrix

| Capability | Adapter | Model | Provider | SECS Reachable | Type |
|------------|---------|-------|----------|----------------|------|
| images | dalle-image.adapter | dalle-image | dalle | ✅ | ✅ current |
| images | qwen-image.adapter | qwen-image | qwen | ✅ | ✅ current |
| images | seedream-image.adapter | seedream-image | seedream | ✅ | ✅ current |
| images | siliconflow-image.adapter | siliconflow-image | siliconflow | ✅ | ✅ current |
| images | wan-image.adapter | wan-image | wan | ✅ | ✅ current |
| llm | aliyun-llm.adapter | aliyun-llm | aliyun | ✅ | ✅ current |
| llm | openai-compat.adapter | openai-compat | openai | ❌ | ✅ current |
| llm | volcengine-llm.adapter | volcengine-llm | volcengine | ✅ | ✅ current |
| (root) | registry | registry | unknown | ✅ | ✅ current |
| tts | aliyun-tts.adapter | aliyun-tts | aliyun | ✅ | ✅ current |
| tts | siliconflow-tts.adapter | siliconflow-tts | siliconflow | ✅ | ✅ current |
| tts | volcengine-tts.adapter | volcengine-tts | volcengine | ✅ | ✅ current |
| (root) | types | types | unknown | ❌ | ✅ current |
| video | aliyun-video.adapter | aliyun-video | aliyun | ✅ | ✅ current |
| video | volcengine-video.adapter | volcengine-video | volcengine | ✅ | ✅ current |

## 3. Cross-Layer Coupling Violations

| Type | Severity | Description | Source | Recommendation |
|------|----------|-------------|--------|-----------------|
| SILENT_FALLBACK | 🟡 | Default model fallback in /root/shipin-cinematic-studio/backend/src/services/cos-service.ts | `/root/shipin-cinematic-studio/backend/src/services/cos-service.ts` | Remove default model; let SECS select from UserModelConfig |
| DUAL_ROUTING | 🔴 | Frontend selects model AND backend also routes models via adapters / SECS plans — dual routing risk | `frontend stores + backend model-adapters` | Model selection authority must be unified: either frontend passes model + provider + key as opaque params, or backend SECS resolves everything from UserModelConfig |

## 4. SECS Integration Boundary

| Check | Status |
|-------|--------|
| Frontend → SECS | clean (via SEDP plan selection) |
| Backend → SECS | clean |
| Adapter selection entry | split |

## 5. System Risk Score

| Metric | Score |
|--------|-------|
| ROUTING_COMPLEXITY_SCORE | 70/100 |
| ADAPTER_CONSISTENCY_SCORE | 80/100 |
| CROSS_LAYER_DRIFT_SCORE | 100/100 |

## 6. Classification & Recommendations

### ❌ CRITICAL FIX
- **DUAL_ROUTING**: Frontend selects model AND backend also routes models via adapters / SECS plans — dual routing risk
  → Model selection authority must be unified: either frontend passes model + provider + key as opaque params, or backend SECS resolves everything from UserModelConfig

### ⚠ REFACTOR
- **SILENT_FALLBACK**: Default model fallback in /root/shipin-cinematic-studio/backend/src/services/cos-service.ts
  → Remove default model; let SECS select from UserModelConfig
