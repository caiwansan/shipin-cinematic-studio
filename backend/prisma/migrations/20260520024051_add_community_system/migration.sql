-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "continuation_from" UUID,
ADD COLUMN     "execution_results" JSONB,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "workspace_id" UUID;

-- AlterTable
ALTER TABLE "UserAsset" ADD COLUMN     "cinematicScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "consistencyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "emotionalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "engagementScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "freshnessScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "modifiedBy" TEXT,
ADD COLUMN     "narrativeScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "renderQualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "retentionScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "universeClusterId" UUID,
ADD COLUMN     "universeScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "worldDepthScore" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ai_stage_model_config" (
    "stage" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'bailian',
    "model" TEXT NOT NULL DEFAULT 'wan2.7-t2v',
    "size" TEXT NOT NULL DEFAULT '1024x1024',
    "params" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_stage_model_config_pkey" PRIMARY KEY ("stage")
);

-- CreateTable
CREATE TABLE "CreatorDnaProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "cinematicStyleSignature" TEXT,
    "pacingProfile" TEXT,
    "emotionalProfile" TEXT,
    "visualProfile" TEXT,
    "directorSpeciesType" TEXT,
    "dominantGenres" TEXT,
    "creatorRank" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorDnaProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_character_specs" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "characterName" TEXT NOT NULL,
    "gender" TEXT,
    "age" TEXT,
    "physicalDescription" TEXT,
    "clothing" TEXT,
    "imagePrompt" TEXT NOT NULL,
    "negativePrompt" TEXT,
    "referenceImageUrl" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_character_specs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_scene_specs" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "sceneId" TEXT NOT NULL,
    "sceneName" TEXT NOT NULL,
    "description" TEXT,
    "imagePrompt" TEXT NOT NULL,
    "negativePrompt" TEXT,
    "aspectRatio" TEXT NOT NULL DEFAULT '16:9',
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_scene_specs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_voice_configs" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "characterName" TEXT NOT NULL,
    "voiceType" TEXT,
    "speakingStyle" TEXT,
    "pitch" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "speed" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "ttsPrompt" TEXT,
    "audio_url" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_voice_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_video_segments" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "segmentId" TEXT NOT NULL,
    "title" TEXT,
    "associatedScenes" TEXT,
    "duration" INTEGER,
    "narrativePurpose" TEXT,
    "shotPattern" TEXT,
    "emotionArc" TEXT,
    "backgroundMusic" TEXT,
    "video_url" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_video_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_frame_designs" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "segmentId" TEXT NOT NULL,
    "firstFrameDesc" TEXT,
    "firstFramePrompt" TEXT,
    "firstFrameAngle" TEXT,
    "lastFrameDesc" TEXT,
    "lastFramePrompt" TEXT,
    "lastFrameAngle" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_frame_designs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_video_productions" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "overallStyle" TEXT,
    "fps" INTEGER NOT NULL DEFAULT 24,
    "resolution" TEXT NOT NULL DEFAULT '1920x1080',
    "colorPalette" TEXT,
    "transitionStyle" TEXT,
    "subtitleStyle" TEXT,
    "globalNegativePrompt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_video_productions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_effect_specs" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "effectName" TEXT NOT NULL,
    "effectType" TEXT,
    "triggerScene" TEXT,
    "triggerEvent" TEXT,
    "visualDescription" TEXT,
    "colorPalette" TEXT,
    "duration" DOUBLE PRECISION,
    "intensity" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_effect_specs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_action_specs" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "characterName" TEXT NOT NULL,
    "actionName" TEXT NOT NULL,
    "triggerCondition" TEXT,
    "movementDesc" TEXT,
    "facialExpression" TEXT,
    "bodyLanguage" TEXT,
    "cameraFocus" TEXT,
    "duration" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_action_specs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_camera_specs" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "segmentId" TEXT,
    "cameraMovement" TEXT NOT NULL,
    "shotSize" TEXT,
    "angle" TEXT,
    "duration" DOUBLE PRECISION,
    "transition" TEXT,
    "purpose" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_camera_specs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_emotion_specs" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "characterName" TEXT NOT NULL,
    "emotionType" TEXT NOT NULL,
    "intensity" TEXT,
    "facialDesc" TEXT,
    "bodyLanguage" TEXT,
    "voiceTone" TEXT,
    "triggerEvent" TEXT,
    "timing" TEXT,
    "cameraPreference" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_emotion_specs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_tasks" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "exportType" TEXT NOT NULL DEFAULT 'zip',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "outputUrl" TEXT,
    "packageSize" INTEGER,
    "error" TEXT,
    "traceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "export_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UniverseCluster" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "genre" TEXT,
    "description" TEXT,
    "embeddingCenter" TEXT,
    "activityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evolutionState" TEXT NOT NULL DEFAULT 'active',
    "workCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UniverseCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetLike" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetComment" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberPlan" (
    "id" UUID NOT NULL,
    "level" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "months" INTEGER NOT NULL DEFAULT 1,
    "storageLimit" INTEGER NOT NULL DEFAULT 500,
    "dailyQuota" INTEGER NOT NULL DEFAULT 5,
    "maxResolution" TEXT NOT NULL DEFAULT '720p',
    "maxDuration" INTEGER NOT NULL DEFAULT 15,
    "concurrentTasks" INTEGER NOT NULL DEFAULT 1,
    "watermark" BOOLEAN NOT NULL DEFAULT true,
    "apiAccess" BOOLEAN NOT NULL DEFAULT false,
    "icon" TEXT NOT NULL DEFAULT '🎬',
    "color" TEXT NOT NULL DEFAULT '#818cf8',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "keyName" TEXT NOT NULL,
    "keyValue" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserApiKey" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "keyName" TEXT NOT NULL,
    "keyValue" TEXT NOT NULL,
    "baseUrl" TEXT,
    "modelType" TEXT NOT NULL,
    "modelName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserModelConfig" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'aliyun',
    "apiKey" TEXT,
    "baseUrl" TEXT,
    "llmModel" TEXT NOT NULL DEFAULT 'qwen3.6-max-preview',
    "llmEnabled" BOOLEAN NOT NULL DEFAULT true,
    "imageModel" TEXT NOT NULL DEFAULT 'wan2.7-image-pro',
    "imageEnabled" BOOLEAN NOT NULL DEFAULT true,
    "videoModel" TEXT NOT NULL DEFAULT 'wan2.7-t2v',
    "videoEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ttsModel" TEXT NOT NULL DEFAULT 'cosyvoice-v3.5-plus',
    "ttsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserModelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelProvider" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "modelType" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "apiKeyEnv" TEXT NOT NULL,
    "endpoint" TEXT,
    "aspectRatioMap" JSONB,
    "defaultParams" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_presets" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'designed',
    "description" TEXT,
    "targetModel" TEXT NOT NULL DEFAULT 'cosyvoice-v3.5-plus',
    "sampleUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyUsage" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "videoCount" INTEGER NOT NULL DEFAULT 0,
    "imageCount" INTEGER NOT NULL DEFAULT 0,
    "ttsCount" INTEGER NOT NULL DEFAULT 0,
    "llmCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'operator',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetDna" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "promptStructure" TEXT,
    "styleVector" TEXT,
    "characterEmbedding" TEXT,
    "compositionVector" TEXT,
    "colorDistribution" TEXT,
    "modelInfo" TEXT,
    "workflowInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetDna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetLineage" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "parentAssetIds" TEXT,
    "rootAssetId" UUID,
    "lineageDepth" INTEGER NOT NULL DEFAULT 0,
    "creatorChain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetLineage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetReference" (
    "id" UUID NOT NULL,
    "sourceAssetId" UUID NOT NULL,
    "targetAssetId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "referenceType" TEXT NOT NULL,
    "coinsPaid" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContributionWeight" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "contributionScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "inheritedWeight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContributionWeight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevenueSplit" (
    "id" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "assetId" UUID,
    "amount" INTEGER NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevenueSplit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetTransaction" (
    "id" UUID NOT NULL,
    "fromUserId" UUID,
    "toUserId" UUID,
    "assetId" UUID NOT NULL,
    "projectId" UUID,
    "transactionType" TEXT NOT NULL,
    "coinsAmount" INTEGER NOT NULL,
    "platformFee" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorWallet" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "totalEarned" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" INTEGER NOT NULL DEFAULT 0,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "referenceCount" INTEGER NOT NULL DEFAULT 0,
    "reuseCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationQueue" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "similarityScore" DOUBLE PRECISION,
    "reportedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentConfig" (
    "id" UUID NOT NULL,
    "method" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qrCodeUrl" TEXT,
    "account" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSecret" (
    "id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "remark" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentSecret_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentOrder" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "orderNo" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'credit',
    "amount" DOUBLE PRECISION NOT NULL,
    "coins" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "planType" TEXT,
    "prepayId" TEXT,
    "qrCode" TEXT,
    "payUrl" TEXT,
    "outTradeNo" TEXT,
    "rawNotify" TEXT,
    "remark" TEXT,
    "payTime" TIMESTAMP(3),
    "confirmAdminId" INTEGER,
    "confirmTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentDef" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "model" TEXT,
    "system_prompt" TEXT NOT NULL DEFAULT '',
    "capabilities" TEXT NOT NULL DEFAULT '[]',
    "memory_enabled" BOOLEAN NOT NULL DEFAULT false,
    "cost_level" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'active',
    "version" TEXT NOT NULL DEFAULT 'v1',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentEdge" (
    "id" UUID NOT NULL,
    "from_agent_id" TEXT NOT NULL,
    "to_agent_id" TEXT NOT NULL,
    "condition" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "execution_mode" TEXT NOT NULL DEFAULT 'sync',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowDef" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entry_agent_id" TEXT,
    "graph_json" TEXT,
    "version" TEXT NOT NULL DEFAULT 'v1',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentExecution" (
    "id" UUID NOT NULL,
    "workflow_id" TEXT,
    "run_id" TEXT,
    "agent_id" TEXT NOT NULL,
    "input" TEXT,
    "output" TEXT,
    "llm_calls" INTEGER NOT NULL DEFAULT 0,
    "tokens_used" INTEGER NOT NULL DEFAULT 0,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latency" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMemory" (
    "id" UUID NOT NULL,
    "agent_id" TEXT NOT NULL,
    "projectId" TEXT,
    "memory_type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding_vector" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetRights" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "publicView" BOOLEAN NOT NULL DEFAULT true,
    "reuseAllowed" BOOLEAN NOT NULL DEFAULT true,
    "downloadAllowed" BOOLEAN NOT NULL DEFAULT false,
    "commercialAllowed" BOOLEAN NOT NULL DEFAULT false,
    "externalAsset" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetRights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserLimit" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "llm_limit_per_min" INTEGER NOT NULL DEFAULT 30,
    "gpu_limit_per_day" INTEGER NOT NULL DEFAULT 100,
    "agent_limit" INTEGER NOT NULL DEFAULT 10,
    "burst_limit" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "UserLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskQueue" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" TEXT,
    "enqueue_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "estimated_cost" DOUBLE PRECISION,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "lock_worker_id" TEXT,
    "error" TEXT,

    CONSTRAINT "TaskQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskExecution" (
    "id" UUID NOT NULL,
    "task_id" TEXT NOT NULL,
    "workflow_id" TEXT,
    "dag_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "current_node" TEXT,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentExecutionLog" (
    "id" UUID NOT NULL,
    "execution_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "input" TEXT,
    "output" TEXT,
    "latency" INTEGER NOT NULL DEFAULT 0,
    "tokens_used" INTEGER NOT NULL DEFAULT 0,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "worker_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DAGGraph" (
    "id" UUID NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "dag_hash" TEXT,
    "optimized_graph" TEXT NOT NULL,
    "parallel_groups" TEXT,
    "execution_order" TEXT,
    "compiled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "DAGGraph_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DAGState" (
    "id" UUID NOT NULL,
    "dag_id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "active_nodes" TEXT,
    "completed_nodes" TEXT,
    "failed_nodes" TEXT,
    "current_load" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DAGState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GPUNode" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'online',
    "max_capacity" INTEGER NOT NULL DEFAULT 4,
    "current_load" INTEGER NOT NULL DEFAULT 0,
    "queue_depth" INTEGER NOT NULL DEFAULT 0,
    "temperature" DOUBLE PRECISION DEFAULT 0,
    "last_heartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GPUNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GPUTaskLog" (
    "id" UUID NOT NULL,
    "task_id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "assigned_gpu" TEXT,
    "user_id" TEXT,
    "prompt" TEXT,
    "enqueue_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "estimated_seconds" INTEGER DEFAULT 60,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "GPUTaskLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GPUThrottleState" (
    "id" UUID NOT NULL,
    "gpu_id" TEXT NOT NULL,
    "load_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "throttle_level" INTEGER NOT NULL DEFAULT 0,
    "mode" TEXT NOT NULL DEFAULT 'normal',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GPUThrottleState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemMonitor" (
    "id" UUID NOT NULL,
    "cpu_usage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gpu_usage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "memory_usage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "queue_depth" INTEGER NOT NULL DEFAULT 0,
    "llm_requests_per_sec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "error_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemMonitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "api_type" TEXT NOT NULL,
    "limit_per_sec" INTEGER NOT NULL DEFAULT 10,
    "limit_per_min" INTEGER NOT NULL DEFAULT 60,
    "limit_per_day" INTEGER NOT NULL DEFAULT 1000,
    "current_usage" INTEGER NOT NULL DEFAULT 0,
    "window_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CircuitBreaker" (
    "id" UUID NOT NULL,
    "service" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'closed',
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "threshold" INTEGER NOT NULL DEFAULT 5,
    "last_failure_time" TIMESTAMP(3),
    "last_success_time" TIMESTAMP(3),
    "cooldownTime" INTEGER NOT NULL DEFAULT 30000,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CircuitBreaker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerHeartbeat" (
    "id" UUID NOT NULL,
    "worker_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'online',
    "current_tasks" INTEGER NOT NULL DEFAULT 0,
    "heartbeat_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerHeartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesktopRuntimeConfig" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "runtimeMode" TEXT NOT NULL DEFAULT 'desktop',
    "gpuPreference" TEXT,
    "autoDetect" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesktopRuntimeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalGPUNode" (
    "id" TEXT NOT NULL,
    "adapterName" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "memoryMB" INTEGER NOT NULL,
    "computeUnits" INTEGER NOT NULL,
    "driverVersion" TEXT,
    "temperature" DOUBLE PRECISION,
    "usagePercent" DOUBLE PRECISION,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocalGPUNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseCache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "licenseToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVerified" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicenseCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalAssetIndex" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "localPath" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "checksum" TEXT,
    "syncedFromCloud" BOOLEAN NOT NULL DEFAULT false,
    "lastUsed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocalAssetIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KernelEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "source" TEXT NOT NULL,
    "payload" JSONB,
    "chainDepth" INTEGER NOT NULL DEFAULT 0,
    "traceId" TEXT,
    "isLoopBreaker" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KernelEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KernelStateSnapshot" (
    "id" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "diff" JSONB,
    "recordedBy" TEXT NOT NULL DEFAULT 'kernel',
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KernelStateSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuntimeRegistry" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dependencies" TEXT[],
    "phase" TEXT NOT NULL DEFAULT 'BOOTING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuntimeRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KernelHealthLog" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "metrics" JSONB NOT NULL,
    "recommendations" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KernelHealthLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulerTask" (
    "id" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "moduleId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "timeout" INTEGER,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "SchedulerTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceAllocation" (
    "id" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "sessionId" TEXT,
    "allocatedTo" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "ResourceAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLoopViolation" (
    "id" TEXT NOT NULL,
    "eventChain" TEXT[],
    "triggerEvent" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "breachedRule" TEXT NOT NULL,
    "actionTaken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLoopViolation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuntimeDependencyGraph" (
    "id" TEXT NOT NULL,
    "graphId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "nodes" JSONB NOT NULL,
    "edges" JSONB NOT NULL,
    "cycleDetected" BOOLEAN NOT NULL DEFAULT false,
    "cyclePaths" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuntimeDependencyGraph_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KernelShadowEventLog" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "mirroredAt" TIMESTAMP(3) NOT NULL,
    "consistency" DOUBLE PRECISION,
    "originalEvent" JSONB,
    "shadowEvent" JSONB,
    "isMatch" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KernelShadowEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KernelCutoverScore" (
    "id" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "eventConsistency" DOUBLE PRECISION NOT NULL,
    "stateConsistency" DOUBLE PRECISION NOT NULL,
    "schedulerStability" DOUBLE PRECISION NOT NULL,
    "gpuCorrectness" DOUBLE PRECISION NOT NULL,
    "latencyImpact" DOUBLE PRECISION NOT NULL,
    "decision" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KernelCutoverScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KernelDualExecutionLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "oldLatency" DOUBLE PRECISION NOT NULL,
    "kernelLatency" DOUBLE PRECISION NOT NULL,
    "matchRate" DOUBLE PRECISION NOT NULL,
    "oldResult" JSONB,
    "kernelResult" JSONB,
    "diff" JSONB,
    "passed" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KernelDualExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KernelStateDiffLog" (
    "id" TEXT NOT NULL,
    "statePath" TEXT NOT NULL,
    "oldValue" JSONB,
    "kernelValue" JSONB,
    "diff" JSONB,
    "isConsistent" BOOLEAN NOT NULL,
    "severity" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KernelStateDiffLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KernelRollbackHistory" (
    "id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "triggerSource" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "snapshotId" TEXT,
    "errorRate" DOUBLE PRECISION,
    "duration" INTEGER,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KernelRollbackHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KernelHealthMetrics" (
    "id" TEXT NOT NULL,
    "eventLatency" DOUBLE PRECISION NOT NULL,
    "schedulerDelay" DOUBLE PRECISION NOT NULL,
    "gpuUtilization" DOUBLE PRECISION NOT NULL,
    "workerLoad" DOUBLE PRECISION NOT NULL,
    "stateSyncDelay" DOUBLE PRECISION NOT NULL,
    "errorRate" DOUBLE PRECISION NOT NULL,
    "memoryUsage" DOUBLE PRECISION NOT NULL,
    "healthScore" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KernelHealthMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationReference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "taskId" TEXT NOT NULL,
    "assetUrl" TEXT NOT NULL,
    "assetId" UUID,
    "refType" TEXT NOT NULL DEFAULT 'style',
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "priority" TEXT NOT NULL DEFAULT 'secondary',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionRecord" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "projectId" UUID,
    "title" TEXT NOT NULL DEFAULT '未命名',
    "prompt" TEXT NOT NULL DEFAULT '',
    "resultType" TEXT NOT NULL,
    "resultUrl" TEXT,
    "thumbnail" TEXT,
    "referenceMode" TEXT NOT NULL DEFAULT 'soft',
    "directorParams" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "World" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL DEFAULT '新世界',
    "state" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "World_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Observer" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "worldId" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'observer',
    "influenceWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "stats" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Observer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" UUID NOT NULL,
    "worldId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "tick" INTEGER NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NarrativeScene" (
    "id" UUID NOT NULL,
    "worldId" UUID NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "tickRange" TEXT NOT NULL DEFAULT '',
    "data" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NarrativeScene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "worldId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL DEFAULT 30,
    "faction" TEXT NOT NULL DEFAULT 'civilian',
    "location" TEXT NOT NULL DEFAULT 'city_center',
    "activity" TEXT NOT NULL DEFAULT 'observing',
    "alive" BOOLEAN NOT NULL DEFAULT true,
    "personality" TEXT NOT NULL DEFAULT '{"logic":0.5,"emotion":0.5,"aggression":0.3,"empathy":0.5}',
    "emotion" TEXT NOT NULL DEFAULT '{"joy":0.5,"anger":0.1,"fear":0.2,"sadness":0.1,"trust":0.5}',
    "state" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tickBorn" INTEGER NOT NULL DEFAULT 0,
    "tickDied" INTEGER,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterMemory" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'event',
    "content" TEXT NOT NULL,
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "tick" INTEGER NOT NULL,
    "emotionalTag" TEXT NOT NULL DEFAULT 'neutral',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterRelation" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'trust',
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterBehavior" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'observe',
    "targetId" TEXT,
    "context" TEXT NOT NULL DEFAULT '',
    "tick" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "executed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterBehavior_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_stages" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "stage_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "input_data" JSONB,
    "output_data" JSONB,
    "reference_urls" JSONB,
    "runtime_version" TEXT,
    "blocked_by" TEXT,
    "block_reason" TEXT,
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_jobs" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "stage_key" TEXT NOT NULL,
    "job_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" JSONB,
    "result" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "sort_key" INTEGER,
    "error" TEXT,
    "locked_by" TEXT,
    "locked_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_images" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "characterName" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "character_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scene_images" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "sceneName" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scene_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storyboard_images" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "segmentId" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storyboard_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prop_images" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "prop_name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '通用',
    "description" TEXT,
    "image_url" TEXT NOT NULL,
    "image_prompt" TEXT,
    "negative_prompt" TEXT,
    "reference_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prop_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prop_library" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '通用',
    "description" TEXT,
    "defaultPrompt" TEXT,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prop_library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "frame_images" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "segmentId" TEXT NOT NULL,
    "frameType" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "frame_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_references" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "characterName" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "refType" TEXT NOT NULL DEFAULT 'standard',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "character_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scene_references" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "sceneName" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "refType" TEXT NOT NULL DEFAULT 'standard',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scene_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_chat_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_chat_messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_chat_memories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_chat_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB,
    "result" JSONB,
    "trace" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_logs" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "projectId" UUID,
    "taskId" TEXT,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taskType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "tokens" TEXT,
    "isPlatform" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "world_memory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "name" TEXT,
    "memory" JSONB NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "episode_ref" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "world_memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_constitution" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "schema_version" TEXT NOT NULL,
    "constitution_version" TEXT NOT NULL,
    "constitution_hash" TEXT NOT NULL,
    "constitution" JSONB NOT NULL,
    "immutable" BOOLEAN NOT NULL DEFAULT true,
    "degraded" BOOLEAN NOT NULL DEFAULT false,
    "degrade_reason" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_constitution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "director_memory" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "continuity_state" JSONB NOT NULL,
    "emotional_history" JSONB NOT NULL,
    "visual_anchors" JSONB NOT NULL,
    "character_locks" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "director_memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_queue" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "locked_by" TEXT,
    "locked_at" TIMESTAMP(3),
    "projectId" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetRegistry" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetVersion" (
    "id" UUID NOT NULL,
    "assetRegistryId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "optimizationType" TEXT,
    "agent" TEXT,
    "diffSummary" TEXT,
    "content" JSONB NOT NULL,
    "prompt" JSONB,
    "user_edited" BOOLEAN NOT NULL DEFAULT false,
    "parent_version" INTEGER,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "reference_images" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContinuityLink" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "fromSegmentId" UUID NOT NULL,
    "fromType" TEXT NOT NULL,
    "toSegmentId" UUID NOT NULL,
    "toType" TEXT NOT NULL,
    "linkType" TEXT NOT NULL DEFAULT 'next_scene',
    "inheritedContent" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContinuityLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvocationLog" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "projectId" TEXT,
    "traceId" TEXT,
    "capability" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "latencyMs" INTEGER,
    "tokenUsage" INTEGER,
    "errorMsg" TEXT,
    "agentType" TEXT,
    "operationType" TEXT,
    "assetRegistryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvocationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetGraphEdge" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "fromAssetId" UUID NOT NULL,
    "fromType" TEXT NOT NULL,
    "toAssetId" UUID NOT NULL,
    "toType" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetGraphEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgMember" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_posts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mediaJson" TEXT NOT NULL DEFAULT '[]',
    "tags" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'general',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectReason" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "rewardCoins" INTEGER NOT NULL DEFAULT 0,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isEssence" BOOLEAN NOT NULL DEFAULT false,
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_comments" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "parentId" UUID,
    "content" TEXT NOT NULL,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_likes" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_comment_likes" (
    "id" UUID NOT NULL,
    "commentId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_comment_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_rewards" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "coins" INTEGER NOT NULL,
    "remark" TEXT DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreatorDnaProfile_userId_key" ON "CreatorDnaProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_video_productions_projectId_key" ON "ai_video_productions"("projectId");

-- CreateIndex
CREATE INDEX "AssetLike_assetId_idx" ON "AssetLike"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetLike_assetId_userId_key" ON "AssetLike"("assetId", "userId");

-- CreateIndex
CREATE INDEX "AssetComment_assetId_createdAt_idx" ON "AssetComment"("assetId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MemberPlan_level_key" ON "MemberPlan"("level");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_provider_key" ON "ApiKey"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "UserApiKey_userId_provider_key" ON "UserApiKey"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "UserModelConfig_userId_provider_key" ON "UserModelConfig"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "ModelProvider_provider_key" ON "ModelProvider"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "voice_presets_voiceId_targetModel_key" ON "voice_presets"("voiceId", "targetModel");

-- CreateIndex
CREATE UNIQUE INDEX "DailyUsage_userId_date_key" ON "DailyUsage"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "AssetDna_assetId_key" ON "AssetDna"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetLineage_assetId_key" ON "AssetLineage"("assetId");

-- CreateIndex
CREATE INDEX "AssetReference_sourceAssetId_idx" ON "AssetReference"("sourceAssetId");

-- CreateIndex
CREATE INDEX "AssetReference_targetAssetId_idx" ON "AssetReference"("targetAssetId");

-- CreateIndex
CREATE INDEX "ContributionWeight_assetId_idx" ON "ContributionWeight"("assetId");

-- CreateIndex
CREATE INDEX "ContributionWeight_creatorId_idx" ON "ContributionWeight"("creatorId");

-- CreateIndex
CREATE INDEX "RevenueSplit_creatorId_idx" ON "RevenueSplit"("creatorId");

-- CreateIndex
CREATE INDEX "RevenueSplit_transactionId_idx" ON "RevenueSplit"("transactionId");

-- CreateIndex
CREATE INDEX "AssetTransaction_fromUserId_idx" ON "AssetTransaction"("fromUserId");

-- CreateIndex
CREATE INDEX "AssetTransaction_toUserId_idx" ON "AssetTransaction"("toUserId");

-- CreateIndex
CREATE INDEX "AssetTransaction_assetId_idx" ON "AssetTransaction"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorWallet_userId_key" ON "CreatorWallet"("userId");

-- CreateIndex
CREATE INDEX "ModerationQueue_status_idx" ON "ModerationQueue"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentConfig_method_key" ON "PaymentConfig"("method");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSecret_channel_key" ON "PaymentSecret"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_orderNo_key" ON "PaymentOrder"("orderNo");

-- CreateIndex
CREATE INDEX "PaymentOrder_userId_idx" ON "PaymentOrder"("userId");

-- CreateIndex
CREATE INDEX "PaymentOrder_orderNo_idx" ON "PaymentOrder"("orderNo");

-- CreateIndex
CREATE INDEX "PaymentOrder_status_idx" ON "PaymentOrder"("status");

-- CreateIndex
CREATE INDEX "PaymentOrder_createdAt_idx" ON "PaymentOrder"("createdAt");

-- CreateIndex
CREATE INDEX "AgentExecution_run_id_idx" ON "AgentExecution"("run_id");

-- CreateIndex
CREATE INDEX "AgentExecution_workflow_id_idx" ON "AgentExecution"("workflow_id");

-- CreateIndex
CREATE INDEX "AgentMemory_agent_id_memory_type_idx" ON "AgentMemory"("agent_id", "memory_type");

-- CreateIndex
CREATE UNIQUE INDEX "AssetRights_assetId_key" ON "AssetRights"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "UserLimit_user_id_key" ON "UserLimit"("user_id");

-- CreateIndex
CREATE INDEX "TaskQueue_user_id_idx" ON "TaskQueue"("user_id");

-- CreateIndex
CREATE INDEX "TaskQueue_status_priority_idx" ON "TaskQueue"("status", "priority");

-- CreateIndex
CREATE INDEX "TaskQueue_enqueue_time_idx" ON "TaskQueue"("enqueue_time");

-- CreateIndex
CREATE INDEX "TaskExecution_task_id_idx" ON "TaskExecution"("task_id");

-- CreateIndex
CREATE INDEX "TaskExecution_status_idx" ON "TaskExecution"("status");

-- CreateIndex
CREATE INDEX "AgentExecutionLog_execution_id_idx" ON "AgentExecutionLog"("execution_id");

-- CreateIndex
CREATE INDEX "AgentExecutionLog_agent_id_idx" ON "AgentExecutionLog"("agent_id");

-- CreateIndex
CREATE INDEX "DAGGraph_workflow_id_idx" ON "DAGGraph"("workflow_id");

-- CreateIndex
CREATE INDEX "DAGGraph_dag_hash_idx" ON "DAGGraph"("dag_hash");

-- CreateIndex
CREATE UNIQUE INDEX "DAGState_execution_id_key" ON "DAGState"("execution_id");

-- CreateIndex
CREATE INDEX "DAGState_dag_id_idx" ON "DAGState"("dag_id");

-- CreateIndex
CREATE INDEX "DAGState_status_idx" ON "DAGState"("status");

-- CreateIndex
CREATE INDEX "GPUTaskLog_status_priority_idx" ON "GPUTaskLog"("status", "priority");

-- CreateIndex
CREATE INDEX "GPUTaskLog_assigned_gpu_idx" ON "GPUTaskLog"("assigned_gpu");

-- CreateIndex
CREATE INDEX "GPUTaskLog_user_id_idx" ON "GPUTaskLog"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "GPUThrottleState_gpu_id_key" ON "GPUThrottleState"("gpu_id");

-- CreateIndex
CREATE INDEX "SystemMonitor_timestamp_idx" ON "SystemMonitor"("timestamp");

-- CreateIndex
CREATE INDEX "RateLimit_user_id_api_type_idx" ON "RateLimit"("user_id", "api_type");

-- CreateIndex
CREATE UNIQUE INDEX "CircuitBreaker_service_key" ON "CircuitBreaker"("service");

-- CreateIndex
CREATE INDEX "WorkerHeartbeat_worker_id_idx" ON "WorkerHeartbeat"("worker_id");

-- CreateIndex
CREATE INDEX "WorkerHeartbeat_heartbeat_at_idx" ON "WorkerHeartbeat"("heartbeat_at");

-- CreateIndex
CREATE INDEX "LicenseCache_userId_idx" ON "LicenseCache"("userId");

-- CreateIndex
CREATE INDEX "LicenseCache_licenseToken_idx" ON "LicenseCache"("licenseToken");

-- CreateIndex
CREATE INDEX "LicenseCache_expiresAt_idx" ON "LicenseCache"("expiresAt");

-- CreateIndex
CREATE INDEX "LocalAssetIndex_category_idx" ON "LocalAssetIndex"("category");

-- CreateIndex
CREATE INDEX "LocalAssetIndex_syncedFromCloud_idx" ON "LocalAssetIndex"("syncedFromCloud");

-- CreateIndex
CREATE INDEX "KernelEvent_eventType_idx" ON "KernelEvent"("eventType");

-- CreateIndex
CREATE INDEX "KernelEvent_createdAt_idx" ON "KernelEvent"("createdAt");

-- CreateIndex
CREATE INDEX "KernelEvent_traceId_idx" ON "KernelEvent"("traceId");

-- CreateIndex
CREATE INDEX "KernelStateSnapshot_createdAt_idx" ON "KernelStateSnapshot"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RuntimeRegistry_moduleId_key" ON "RuntimeRegistry"("moduleId");

-- CreateIndex
CREATE INDEX "RuntimeRegistry_moduleId_idx" ON "RuntimeRegistry"("moduleId");

-- CreateIndex
CREATE INDEX "RuntimeRegistry_phase_idx" ON "RuntimeRegistry"("phase");

-- CreateIndex
CREATE INDEX "KernelHealthLog_moduleId_idx" ON "KernelHealthLog"("moduleId");

-- CreateIndex
CREATE INDEX "KernelHealthLog_createdAt_idx" ON "KernelHealthLog"("createdAt");

-- CreateIndex
CREATE INDEX "KernelHealthLog_status_idx" ON "KernelHealthLog"("status");

-- CreateIndex
CREATE INDEX "SchedulerTask_taskType_idx" ON "SchedulerTask"("taskType");

-- CreateIndex
CREATE INDEX "SchedulerTask_status_idx" ON "SchedulerTask"("status");

-- CreateIndex
CREATE INDEX "SchedulerTask_priority_idx" ON "SchedulerTask"("priority");

-- CreateIndex
CREATE INDEX "ResourceAllocation_resourceType_idx" ON "ResourceAllocation"("resourceType");

-- CreateIndex
CREATE INDEX "ResourceAllocation_allocatedTo_idx" ON "ResourceAllocation"("allocatedTo");

-- CreateIndex
CREATE INDEX "ResourceAllocation_isActive_idx" ON "ResourceAllocation"("isActive");

-- CreateIndex
CREATE INDEX "EventLoopViolation_triggerEvent_idx" ON "EventLoopViolation"("triggerEvent");

-- CreateIndex
CREATE INDEX "EventLoopViolation_createdAt_idx" ON "EventLoopViolation"("createdAt");

-- CreateIndex
CREATE INDEX "RuntimeDependencyGraph_graphId_idx" ON "RuntimeDependencyGraph"("graphId");

-- CreateIndex
CREATE INDEX "KernelShadowEventLog_eventType_idx" ON "KernelShadowEventLog"("eventType");

-- CreateIndex
CREATE INDEX "KernelShadowEventLog_createdAt_idx" ON "KernelShadowEventLog"("createdAt");

-- CreateIndex
CREATE INDEX "KernelShadowEventLog_isMatch_idx" ON "KernelShadowEventLog"("isMatch");

-- CreateIndex
CREATE INDEX "KernelCutoverScore_createdAt_idx" ON "KernelCutoverScore"("createdAt");

-- CreateIndex
CREATE INDEX "KernelCutoverScore_decision_idx" ON "KernelCutoverScore"("decision");

-- CreateIndex
CREATE INDEX "KernelDualExecutionLog_taskId_idx" ON "KernelDualExecutionLog"("taskId");

-- CreateIndex
CREATE INDEX "KernelDualExecutionLog_passed_idx" ON "KernelDualExecutionLog"("passed");

-- CreateIndex
CREATE INDEX "KernelDualExecutionLog_createdAt_idx" ON "KernelDualExecutionLog"("createdAt");

-- CreateIndex
CREATE INDEX "KernelStateDiffLog_isConsistent_idx" ON "KernelStateDiffLog"("isConsistent");

-- CreateIndex
CREATE INDEX "KernelStateDiffLog_severity_idx" ON "KernelStateDiffLog"("severity");

-- CreateIndex
CREATE INDEX "KernelStateDiffLog_createdAt_idx" ON "KernelStateDiffLog"("createdAt");

-- CreateIndex
CREATE INDEX "KernelRollbackHistory_createdAt_idx" ON "KernelRollbackHistory"("createdAt");

-- CreateIndex
CREATE INDEX "KernelRollbackHistory_success_idx" ON "KernelRollbackHistory"("success");

-- CreateIndex
CREATE INDEX "KernelHealthMetrics_recordedAt_idx" ON "KernelHealthMetrics"("recordedAt");

-- CreateIndex
CREATE INDEX "GenerationReference_userId_idx" ON "GenerationReference"("userId");

-- CreateIndex
CREATE INDEX "GenerationReference_taskId_idx" ON "GenerationReference"("taskId");

-- CreateIndex
CREATE INDEX "ProductionRecord_userId_createdAt_idx" ON "ProductionRecord"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Observer_worldId_idx" ON "Observer"("worldId");

-- CreateIndex
CREATE INDEX "Event_worldId_tick_idx" ON "Event"("worldId", "tick");

-- CreateIndex
CREATE INDEX "NarrativeScene_worldId_idx" ON "NarrativeScene"("worldId");

-- CreateIndex
CREATE INDEX "Character_worldId_idx" ON "Character"("worldId");

-- CreateIndex
CREATE INDEX "CharacterMemory_characterId_idx" ON "CharacterMemory"("characterId");

-- CreateIndex
CREATE INDEX "CharacterRelation_fromId_idx" ON "CharacterRelation"("fromId");

-- CreateIndex
CREATE INDEX "CharacterRelation_toId_idx" ON "CharacterRelation"("toId");

-- CreateIndex
CREATE INDEX "CharacterBehavior_characterId_idx" ON "CharacterBehavior"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_stages_projectId_stage_key_key" ON "pipeline_stages"("projectId", "stage_key");

-- CreateIndex
CREATE INDEX "pipeline_jobs_projectId_stage_key_idx" ON "pipeline_jobs"("projectId", "stage_key");

-- CreateIndex
CREATE INDEX "pipeline_jobs_status_locked_by_idx" ON "pipeline_jobs"("status", "locked_by");

-- CreateIndex
CREATE INDEX "pipeline_jobs_status_priority_idx" ON "pipeline_jobs"("status", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "character_images_projectId_sortOrder_key" ON "character_images"("projectId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "scene_images_projectId_sortOrder_key" ON "scene_images"("projectId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "storyboard_images_projectId_sortOrder_key" ON "storyboard_images"("projectId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "frame_images_projectId_segmentId_frameType_key" ON "frame_images"("projectId", "segmentId", "frameType");

-- CreateIndex
CREATE UNIQUE INDEX "character_references_projectId_characterName_refType_key" ON "character_references"("projectId", "characterName", "refType");

-- CreateIndex
CREATE UNIQUE INDEX "scene_references_projectId_sceneName_refType_key" ON "scene_references"("projectId", "sceneName", "refType");

-- CreateIndex
CREATE UNIQUE INDEX "customer_chat_memories_user_id_key_key" ON "customer_chat_memories"("user_id", "key");

-- CreateIndex
CREATE INDEX "jobs_projectId_idx" ON "jobs"("projectId");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_type_idx" ON "jobs"("type");

-- CreateIndex
CREATE INDEX "usage_logs_userId_idx" ON "usage_logs"("userId");

-- CreateIndex
CREATE INDEX "usage_logs_createdAt_idx" ON "usage_logs"("createdAt");

-- CreateIndex
CREATE INDEX "usage_logs_taskType_idx" ON "usage_logs"("taskType");

-- CreateIndex
CREATE INDEX "world_memory_projectId_idx" ON "world_memory"("projectId");

-- CreateIndex
CREATE INDEX "world_memory_projectId_entityType_idx" ON "world_memory"("projectId", "entityType");

-- CreateIndex
CREATE UNIQUE INDEX "world_memory_projectId_entityType_entity_id_key" ON "world_memory"("projectId", "entityType", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "story_constitution_constitution_hash_key" ON "story_constitution"("constitution_hash");

-- CreateIndex
CREATE INDEX "story_constitution_project_id_idx" ON "story_constitution"("project_id");

-- CreateIndex
CREATE INDEX "story_constitution_constitution_hash_idx" ON "story_constitution"("constitution_hash");

-- CreateIndex
CREATE UNIQUE INDEX "director_memory_project_id_key" ON "director_memory"("project_id");

-- CreateIndex
CREATE INDEX "job_queue_status_priority_idx" ON "job_queue"("status", "priority");

-- CreateIndex
CREATE INDEX "job_queue_projectId_idx" ON "job_queue"("projectId");

-- CreateIndex
CREATE INDEX "AssetRegistry_projectId_type_status_idx" ON "AssetRegistry"("projectId", "type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AssetRegistry_projectId_type_sourceId_key" ON "AssetRegistry"("projectId", "type", "sourceId");

-- CreateIndex
CREATE INDEX "AssetVersion_assetRegistryId_createdAt_idx" ON "AssetVersion"("assetRegistryId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssetVersion_assetRegistryId_version_key" ON "AssetVersion"("assetRegistryId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ContinuityLink_projectId_fromSegmentId_key" ON "ContinuityLink"("projectId", "fromSegmentId");

-- CreateIndex
CREATE INDEX "InvocationLog_userId_createdAt_idx" ON "InvocationLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "InvocationLog_projectId_capability_idx" ON "InvocationLog"("projectId", "capability");

-- CreateIndex
CREATE INDEX "InvocationLog_traceId_idx" ON "InvocationLog"("traceId");

-- CreateIndex
CREATE INDEX "AssetGraphEdge_projectId_fromAssetId_idx" ON "AssetGraphEdge"("projectId", "fromAssetId");

-- CreateIndex
CREATE INDEX "AssetGraphEdge_projectId_toAssetId_idx" ON "AssetGraphEdge"("projectId", "toAssetId");

-- CreateIndex
CREATE INDEX "AssetGraphEdge_projectId_relationType_idx" ON "AssetGraphEdge"("projectId", "relationType");

-- CreateIndex
CREATE UNIQUE INDEX "OrgMember_organizationId_userId_key" ON "OrgMember"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "community_posts_status_createdAt_idx" ON "community_posts"("status", "createdAt");

-- CreateIndex
CREATE INDEX "community_posts_userId_idx" ON "community_posts"("userId");

-- CreateIndex
CREATE INDEX "community_posts_category_idx" ON "community_posts"("category");

-- CreateIndex
CREATE INDEX "community_comments_postId_createdAt_idx" ON "community_comments"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "community_comments_userId_idx" ON "community_comments"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "community_likes_postId_userId_key" ON "community_likes"("postId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "community_comment_likes_commentId_userId_key" ON "community_comment_likes"("commentId", "userId");

-- CreateIndex
CREATE INDEX "community_rewards_postId_idx" ON "community_rewards"("postId");

-- CreateIndex
CREATE INDEX "UserAsset_universeScore_idx" ON "UserAsset"("universeScore" DESC);

-- CreateIndex
CREATE INDEX "UserAsset_universeClusterId_idx" ON "UserAsset"("universeClusterId");

-- AddForeignKey
ALTER TABLE "CreatorDnaProfile" ADD CONSTRAINT "CreatorDnaProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_character_specs" ADD CONSTRAINT "ai_character_specs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_scene_specs" ADD CONSTRAINT "ai_scene_specs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_voice_configs" ADD CONSTRAINT "ai_voice_configs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_video_segments" ADD CONSTRAINT "ai_video_segments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_frame_designs" ADD CONSTRAINT "ai_frame_designs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_video_productions" ADD CONSTRAINT "ai_video_productions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_effect_specs" ADD CONSTRAINT "ai_effect_specs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_action_specs" ADD CONSTRAINT "ai_action_specs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_camera_specs" ADD CONSTRAINT "ai_camera_specs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_emotion_specs" ADD CONSTRAINT "ai_emotion_specs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_tasks" ADD CONSTRAINT "export_tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAsset" ADD CONSTRAINT "UserAsset_universeClusterId_fkey" FOREIGN KEY ("universeClusterId") REFERENCES "UniverseCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetLike" ADD CONSTRAINT "AssetLike_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "UserAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetComment" ADD CONSTRAINT "AssetComment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "UserAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetComment" ADD CONSTRAINT "AssetComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserApiKey" ADD CONSTRAINT "UserApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserModelConfig" ADD CONSTRAINT "UserModelConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyUsage" ADD CONSTRAINT "DailyUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentEdge" ADD CONSTRAINT "AgentEdge_from_agent_id_fkey" FOREIGN KEY ("from_agent_id") REFERENCES "AgentDef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentEdge" ADD CONSTRAINT "AgentEdge_to_agent_id_fkey" FOREIGN KEY ("to_agent_id") REFERENCES "AgentDef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowDef" ADD CONSTRAINT "WorkflowDef_entry_agent_id_fkey" FOREIGN KEY ("entry_agent_id") REFERENCES "AgentDef"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentExecution" ADD CONSTRAINT "AgentExecution_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "AgentDef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMemory" ADD CONSTRAINT "AgentMemory_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "AgentDef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observer" ADD CONSTRAINT "Observer_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarrativeScene" ADD CONSTRAINT "NarrativeScene_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterMemory" ADD CONSTRAINT "CharacterMemory_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterRelation" ADD CONSTRAINT "CharacterRelation_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterRelation" ADD CONSTRAINT "CharacterRelation_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterBehavior" ADD CONSTRAINT "CharacterBehavior_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_jobs" ADD CONSTRAINT "pipeline_jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_images" ADD CONSTRAINT "character_images_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_images" ADD CONSTRAINT "scene_images_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storyboard_images" ADD CONSTRAINT "storyboard_images_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prop_images" ADD CONSTRAINT "prop_images_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frame_images" ADD CONSTRAINT "frame_images_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_references" ADD CONSTRAINT "character_references_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_references" ADD CONSTRAINT "scene_references_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_chat_messages" ADD CONSTRAINT "customer_chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "customer_chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRegistry" ADD CONSTRAINT "AssetRegistry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetVersion" ADD CONSTRAINT "AssetVersion_assetRegistryId_fkey" FOREIGN KEY ("assetRegistryId") REFERENCES "AssetRegistry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityLink" ADD CONSTRAINT "ContinuityLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetGraphEdge" ADD CONSTRAINT "AssetGraphEdge_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "community_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_likes" ADD CONSTRAINT "community_likes_postId_fkey" FOREIGN KEY ("postId") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_likes" ADD CONSTRAINT "community_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_comment_likes" ADD CONSTRAINT "community_comment_likes_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "community_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_comment_likes" ADD CONSTRAINT "community_comment_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_rewards" ADD CONSTRAINT "community_rewards_postId_fkey" FOREIGN KEY ("postId") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_rewards" ADD CONSTRAINT "community_rewards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
