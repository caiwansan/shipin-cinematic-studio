-- CreateTable
CREATE TABLE "prompt_memory" (
    "id" BIGSERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "optimizedPrompt" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "style" TEXT,
    "mode" TEXT,
    "qualityScore" DOUBLE PRECISION,
    "consistencyScore" DOUBLE PRECISION,
    "realismScore" DOUBLE PRECISION,
    "renderTimeMs" INTEGER NOT NULL DEFAULT 0,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "failureReason" TEXT,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_memory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prompt_memory_userId_idx" ON "prompt_memory"("userId");

-- CreateIndex
CREATE INDEX "prompt_memory_taskType_idx" ON "prompt_memory"("taskType");

-- CreateIndex
CREATE INDEX "prompt_memory_provider_idx" ON "prompt_memory"("provider");

-- CreateIndex
CREATE INDEX "prompt_memory_qualityScore_idx" ON "prompt_memory"("qualityScore");
