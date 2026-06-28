-- CreateEnum
CREATE TYPE "VideoTaskStatus" AS ENUM ('queued', 'processing', 'optimizing', 'storyboarding', 'generating', 'stitching', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "TaskLogLevel" AS ENUM ('info', 'warn', 'error');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('image', 'video', 'audio', 'other');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "memberTier" TEXT NOT NULL DEFAULT 'free',
    "memberExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Captcha" (
    "id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Captcha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsCode" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCode" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "userId" UUID NOT NULL,
    "budgetLimit" DOUBLE PRECISION,
    "budgetSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "budgetAlertAt" DOUBLE PRECISION,
    "budgetNotified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Storyboard" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "shotIndex" INTEGER NOT NULL,
    "duration" DOUBLE PRECISION,
    "shotType" TEXT,
    "subject" TEXT,
    "action" TEXT,
    "expression" TEXT,
    "cameraMovement" TEXT,
    "lens" TEXT,
    "lighting" TEXT,
    "emotion" TEXT,
    "environment" TEXT,
    "cinematicStyle" TEXT,
    "colorStyle" TEXT,
    "realism" BOOLEAN,
    "motionBlur" BOOLEAN,
    "continuityNotes" TEXT,
    "negativePrompt" TEXT,
    "storyboardImage" TEXT,
    "startFrame" INTEGER,
    "endFrame" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Storyboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoTask" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "storyboardId" UUID,
    "status" "VideoTaskStatus" NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "idempotencyKey" TEXT,
    "lockedBy" TEXT,
    "heartbeatAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "taskType" TEXT NOT NULL DEFAULT 'video',
    "scheduledFor" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoSegment" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "shotIndex" INTEGER NOT NULL,
    "filePath" TEXT,
    "thumbnailPath" TEXT,
    "duration" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterProfile" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER,
    "gender" TEXT,
    "face" TEXT,
    "hair" TEXT,
    "clothes" TEXT,
    "body" TEXT,
    "identity" TEXT,
    "speakingStyle" TEXT,
    "personality" TEXT,
    "frontImage" TEXT,
    "sideImage" TEXT,
    "fullBodyImage" TEXT,
    "expressionImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SceneProfile" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "location" TEXT,
    "architecture" TEXT,
    "weather" TEXT,
    "lighting" TEXT,
    "timeOfDay" TEXT,
    "atmosphere" TEXT,
    "colorPalette" TEXT,
    "referenceImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SceneProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptTemplate" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "content" JSONB,
    "variables" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" UUID NOT NULL,
    "projectId" UUID,
    "type" "AssetType" NOT NULL DEFAULT 'other',
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "duration" DOUBLE PRECISION,
    "taskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'free',
    "credits" INTEGER NOT NULL DEFAULT 0,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "storageUsed" BIGINT NOT NULL DEFAULT 0,
    "storageLimit" BIGINT NOT NULL DEFAULT 104857600,
    "agentLevel" TEXT NOT NULL DEFAULT 'none',
    "parentId" UUID,
    "monthlyBudget" DOUBLE PRECISION,
    "monthlySpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthlyResetAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinLog" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "remark" TEXT,
    "relatedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAsset" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail" TEXT,
    "prompt" TEXT,
    "style" TEXT,
    "mode" TEXT,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RechargeOrder" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "coins" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payMethod" TEXT,
    "payTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RechargeOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoragePack" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "size" BIGINT NOT NULL,
    "coins" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expireAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoragePack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentLevelConfig" (
    "id" UUID NOT NULL,
    "level" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceCoins" INTEGER NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentLevelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskLog" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "level" "TaskLogLevel" NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "eventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerRegistration" (
    "id" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "status" TEXT NOT NULL DEFAULT 'active',
    "capacity" INTEGER NOT NULL DEFAULT 5,
    "currentload" INTEGER NOT NULL DEFAULT 0,
    "healthy" BOOLEAN NOT NULL DEFAULT true,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "capabilities" JSONB NOT NULL DEFAULT '{}',
    "lasterror" TEXT,
    "consecutiveerrors" INTEGER NOT NULL DEFAULT 0,
    "successcount" INTEGER NOT NULL DEFAULT 0,
    "failurecount" INTEGER NOT NULL DEFAULT 0,
    "avgresponsetime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "lastweightedat" TIMESTAMP(3),
    "autounhealthyat" TIMESTAMP(3),
    "lastheartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerTaskAssignment" (
    "id" UUID NOT NULL,
    "workerid" TEXT NOT NULL,
    "taskid" TEXT NOT NULL,
    "startedat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estimatedduration" DOUBLE PRECISION,
    "actualresponsetime" DOUBLE PRECISION,

    CONSTRAINT "WorkerTaskAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerHealthHistory" (
    "id" UUID NOT NULL,
    "workerid" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "healthy" BOOLEAN NOT NULL,
    "load" INTEGER NOT NULL DEFAULT 0,
    "recordedat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerHealthHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeadLetterTask" (
    "id" UUID NOT NULL,
    "originalTaskId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL DEFAULT 'video',
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastErrorAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeadLetterTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiModel" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "modelType" TEXT NOT NULL,
    "taskTypes" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "deprecateAt" TIMESTAMP(3),
    "costPerRequest" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costPerToken" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costUnit" TEXT NOT NULL DEFAULT 'USD',
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "avgLatency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rateLimit" TEXT,
    "dailyTokenLimit" INTEGER,
    "concurrencyMax" INTEGER NOT NULL DEFAULT 5,
    "currentLoad" INTEGER NOT NULL DEFAULT 0,
    "endpointUrl" TEXT,
    "apiKeyRef" TEXT,
    "params" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiFallbackRule" (
    "id" UUID NOT NULL,
    "taskType" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "primaryId" UUID NOT NULL,
    "fallbackId" UUID NOT NULL,
    "condition" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiFallbackRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiRoutingPolicy" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "weightCost" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "weightQuality" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "weightLatency" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "weightSuccess" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiRoutingPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiTaskTypeMapping" (
    "id" UUID NOT NULL,
    "taskType" TEXT NOT NULL,
    "description" TEXT,
    "modelIds" TEXT[],
    "policyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiTaskTypeMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiExecutionLog" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "projectId" UUID,
    "modelId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "requestType" TEXT NOT NULL DEFAULT 'api',
    "status" TEXT NOT NULL,
    "latency" DOUBLE PRECISION NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tokensInput" INTEGER,
    "tokensOutput" INTEGER,
    "error" TEXT,
    "policyUsed" TEXT,
    "scoreBefore" DOUBLE PRECISION,
    "scoreAfter" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCircuitBreaker" (
    "id" UUID NOT NULL,
    "modelId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'closed',
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureThreshold" INTEGER NOT NULL DEFAULT 5,
    "successThreshold" INTEGER NOT NULL DEFAULT 3,
    "resetTimeoutMs" INTEGER NOT NULL DEFAULT 30000,
    "lastFailureAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "halfOpenAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiCircuitBreaker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSandboxLog" (
    "id" UUID NOT NULL,
    "executionLogId" UUID NOT NULL,
    "modelName" TEXT NOT NULL,
    "requestType" TEXT NOT NULL DEFAULT 'chat_completion',
    "status" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "timeoutMs" INTEGER NOT NULL DEFAULT 30000,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "tokenCount" INTEGER,
    "promptPreview" TEXT,
    "responsePreview" TEXT,
    "errorType" TEXT,
    "errorDetail" TEXT,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiSandboxLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiTimeoutConfig" (
    "id" UUID NOT NULL,
    "taskType" TEXT NOT NULL,
    "timeoutMs" INTEGER NOT NULL DEFAULT 30000,
    "retryCount" INTEGER NOT NULL DEFAULT 2,
    "retryDelayMs" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiTimeoutConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShadowConfig" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "grayThreshold" INTEGER NOT NULL DEFAULT 0,
    "maxConcurrent" INTEGER NOT NULL DEFAULT 5,
    "rateLimitPerMin" INTEGER NOT NULL DEFAULT 10,
    "costBudget" DECIMAL(12,6) NOT NULL DEFAULT 1.0,
    "costSpent" DECIMAL(12,6) NOT NULL DEFAULT 0.0,
    "autoRollback" BOOLEAN NOT NULL DEFAULT true,
    "lastRolledBack" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShadowConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShadowExecutionLog" (
    "id" TEXT NOT NULL,
    "shadowConfigId" TEXT NOT NULL,
    "sandboxLogId" TEXT,
    "taskId" TEXT,
    "projectId" TEXT,
    "userId" TEXT,
    "taskType" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "promptPreview" TEXT,
    "mockOutput" JSONB,
    "realOutput" JSONB,
    "mockLatencyMs" INTEGER,
    "realLatencyMs" INTEGER,
    "mockCost" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "realCost" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShadowExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShadowDiffResult" (
    "id" TEXT NOT NULL,
    "executionLogId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "structureMatch" BOOLEAN NOT NULL DEFAULT false,
    "structureScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "contentScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "latencyDelta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "costDelta" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "driftScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "overallScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "judgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShadowDiffResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShadowDriftHistory" (
    "id" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "windowCount" INTEGER NOT NULL DEFAULT 0,
    "avgDriftScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "avgStructureScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "avgContentScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "avgLatencyDelta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "avgCostDelta" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "sampleStartAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sampleEndAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShadowDriftHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostBudget" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeId" TEXT,
    "budgetAmount" DECIMAL(12,6) NOT NULL,
    "spentAmount" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "alertThreshold" INTEGER NOT NULL DEFAULT 80,
    "blockThreshold" INTEGER NOT NULL DEFAULT 100,
    "period" TEXT NOT NULL DEFAULT 'monthly',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastAlertAt" TIMESTAMP(3),
    "lastBlockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_metrics" (
    "id" BIGSERIAL NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cpuPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "memoryMb" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "eventLoopLag" DOUBLE PRECISION,
    "queueLength" INTEGER NOT NULL DEFAULT 0,
    "queuePressure" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activeWorkers" INTEGER NOT NULL DEFAULT 0,
    "workerEfficiency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "workerCompleted" INTEGER NOT NULL DEFAULT 0,
    "pidPressure" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "generatorRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costPerMin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ses" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "degraded" BOOLEAN NOT NULL DEFAULT false,
    "stabilityScore" DOUBLE PRECISION,
    "stabilityGrade" TEXT,

    CONSTRAINT "system_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replay_frames" (
    "id" BIGSERIAL NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queueLength" INTEGER NOT NULL DEFAULT 0,
    "queuePressure" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activeWorkers" INTEGER NOT NULL DEFAULT 0,
    "workerThroughput" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "workerEfficiency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pidPressure" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "generatorRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ses" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "memoryMb" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costPerMin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "queueGrowthRate" DOUBLE PRECISION,
    "workerTrend" DOUBLE PRECISION,
    "memorySlope" DOUBLE PRECISION,
    "pidVariance" DOUBLE PRECISION,
    "stabilityScore" DOUBLE PRECISION,
    "stabilityGrade" TEXT,
    "label" TEXT,
    "sessionId" BIGINT,

    CONSTRAINT "replay_frames_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stability_sessions" (
    "id" BIGSERIAL NOT NULL,
    "label" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "queuePattern" TEXT,
    "workerDecayCurve" TEXT,
    "pidSignature" TEXT,
    "costProfile" TEXT,
    "recoveryProfile" TEXT,
    "grade" TEXT,
    "score" DOUBLE PRECISION,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "worstEvent" TEXT,
    "phases" JSONB,

    CONSTRAINT "stability_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "degradation_events" (
    "id" BIGSERIAL NOT NULL,
    "sessionId" BIGINT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "elapsedSec" INTEGER NOT NULL DEFAULT 0,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metricValues" JSONB,

    CONSTRAINT "degradation_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Captcha_token_key" ON "Captcha"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VideoTask_idempotencyKey_key" ON "VideoTask"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PromptTemplate_name_key" ON "PromptTemplate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_taskId_type_key" ON "Asset"("taskId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_key" ON "Membership"("userId");

-- CreateIndex
CREATE INDEX "CoinLog_userId_createdAt_idx" ON "CoinLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserAsset_userId_createdAt_idx" ON "UserAsset"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentLevelConfig_level_key" ON "AgentLevelConfig"("level");

-- CreateIndex
CREATE INDEX "TaskLog_taskId_eventId_idx" ON "TaskLog"("taskId", "eventId");

-- CreateIndex
CREATE INDEX "WorkerTaskAssignment_workerId_idx" ON "WorkerTaskAssignment"("workerid");

-- CreateIndex
CREATE INDEX "WorkerTaskAssignment_taskId_idx" ON "WorkerTaskAssignment"("taskid");

-- CreateIndex
CREATE INDEX "WorkerHealthHistory_workerId_recordedAt_idx" ON "WorkerHealthHistory"("workerid", "recordedat");

-- CreateIndex
CREATE UNIQUE INDEX "AiModel_name_key" ON "AiModel"("name");

-- CreateIndex
CREATE INDEX "AiModel_modelType_status_idx" ON "AiModel"("modelType", "status");

-- CreateIndex
CREATE INDEX "AiFallbackRule_taskType_priority_idx" ON "AiFallbackRule"("taskType", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "AiRoutingPolicy_name_key" ON "AiRoutingPolicy"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AiTaskTypeMapping_taskType_key" ON "AiTaskTypeMapping"("taskType");

-- CreateIndex
CREATE INDEX "AiExecutionLog_modelId_createdAt_idx" ON "AiExecutionLog"("modelId", "createdAt");

-- CreateIndex
CREATE INDEX "AiExecutionLog_taskId_idx" ON "AiExecutionLog"("taskId");

-- CreateIndex
CREATE INDEX "AiExecutionLog_projectId_idx" ON "AiExecutionLog"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "AiCircuitBreaker_modelId_key" ON "AiCircuitBreaker"("modelId");

-- CreateIndex
CREATE INDEX "AiSandboxLog_modelName_createdAt_idx" ON "AiSandboxLog"("modelName", "createdAt");

-- CreateIndex
CREATE INDEX "AiSandboxLog_status_idx" ON "AiSandboxLog"("status");

-- CreateIndex
CREATE INDEX "AiSandboxLog_executionLogId_idx" ON "AiSandboxLog"("executionLogId");

-- CreateIndex
CREATE UNIQUE INDEX "AiTimeoutConfig_taskType_key" ON "AiTimeoutConfig"("taskType");

-- CreateIndex
CREATE UNIQUE INDEX "ShadowDiffResult_executionLogId_key" ON "ShadowDiffResult"("executionLogId");

-- CreateIndex
CREATE INDEX "ShadowDriftHistory_modelName_taskType_idx" ON "ShadowDriftHistory"("modelName", "taskType");

-- CreateIndex
CREATE INDEX "CostBudget_scope_scopeId_idx" ON "CostBudget"("scope", "scopeId");

-- CreateIndex
CREATE INDEX "system_metrics_timestamp_idx" ON "system_metrics"("timestamp");

-- CreateIndex
CREATE INDEX "replay_frames_timestamp_idx" ON "replay_frames"("timestamp");

-- CreateIndex
CREATE INDEX "replay_frames_sessionId_idx" ON "replay_frames"("sessionId");

-- CreateIndex
CREATE INDEX "stability_sessions_status_idx" ON "stability_sessions"("status");

-- CreateIndex
CREATE INDEX "stability_sessions_startedAt_idx" ON "stability_sessions"("startedAt");

-- CreateIndex
CREATE INDEX "degradation_events_sessionId_idx" ON "degradation_events"("sessionId");

-- CreateIndex
CREATE INDEX "degradation_events_timestamp_idx" ON "degradation_events"("timestamp");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Storyboard" ADD CONSTRAINT "Storyboard_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoTask" ADD CONSTRAINT "VideoTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoTask" ADD CONSTRAINT "VideoTask_storyboardId_fkey" FOREIGN KEY ("storyboardId") REFERENCES "Storyboard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoSegment" ADD CONSTRAINT "VideoSegment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "VideoTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterProfile" ADD CONSTRAINT "CharacterProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneProfile" ADD CONSTRAINT "SceneProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Membership"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinLog" ADD CONSTRAINT "coinlog_membership_fkey" FOREIGN KEY ("userId") REFERENCES "Membership"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAsset" ADD CONSTRAINT "userasset_membership_fkey" FOREIGN KEY ("userId") REFERENCES "Membership"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RechargeOrder" ADD CONSTRAINT "recharge_membership_fkey" FOREIGN KEY ("userId") REFERENCES "Membership"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoragePack" ADD CONSTRAINT "storagepack_membership_fkey" FOREIGN KEY ("userId") REFERENCES "Membership"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskLog" ADD CONSTRAINT "TaskLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "VideoTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerTaskAssignment" ADD CONSTRAINT "WorkerTaskAssignment_workerid_fkey" FOREIGN KEY ("workerid") REFERENCES "WorkerRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerHealthHistory" ADD CONSTRAINT "WorkerHealthHistory_workerid_fkey" FOREIGN KEY ("workerid") REFERENCES "WorkerRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiFallbackRule" ADD CONSTRAINT "AiFallbackRule_primaryId_fkey" FOREIGN KEY ("primaryId") REFERENCES "AiModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiFallbackRule" ADD CONSTRAINT "AiFallbackRule_fallbackId_fkey" FOREIGN KEY ("fallbackId") REFERENCES "AiModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShadowExecutionLog" ADD CONSTRAINT "ShadowExecutionLog_shadowConfigId_fkey" FOREIGN KEY ("shadowConfigId") REFERENCES "ShadowConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShadowDiffResult" ADD CONSTRAINT "ShadowDiffResult_executionLogId_fkey" FOREIGN KEY ("executionLogId") REFERENCES "ShadowExecutionLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replay_frames" ADD CONSTRAINT "replay_frames_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "stability_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "degradation_events" ADD CONSTRAINT "degradation_events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "stability_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
