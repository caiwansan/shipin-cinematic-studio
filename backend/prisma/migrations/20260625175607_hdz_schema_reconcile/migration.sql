-- AlterTable
ALTER TABLE "hdz_projects" ADD COLUMN     "libraryReaderCache" JSONB DEFAULT '{}',
ADD COLUMN     "libraryReaderSummaries" JSONB DEFAULT '{}',
ALTER COLUMN "libraryReaderEnabled" SET NOT NULL;

-- CreateTable
CREATE TABLE "entity_registry" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_log" (
    "id" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scene_dag" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "sceneId" TEXT NOT NULL,
    "chapterNo" INTEGER NOT NULL,
    "sceneNo" INTEGER NOT NULL,
    "dagJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scene_dag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "world_state" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "entityId" TEXT NOT NULL,
    "stateJson" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "world_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "writer_alignment_metrics" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "chapterId" UUID,
    "scoreJson" JSONB NOT NULL DEFAULT '{}',
    "shadowStateDelta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "writer_alignment_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plot_dag_edges" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "edgeType" TEXT NOT NULL DEFAULT 'causality',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plot_dag_edges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "entity_registry_projectId_entityType_idx" ON "entity_registry"("projectId", "entityType");

-- CreateIndex
CREATE UNIQUE INDEX "entity_registry_projectId_name_key" ON "entity_registry"("projectId", "name");

-- CreateIndex
CREATE INDEX "event_log_entityType_entityId_idx" ON "event_log"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "event_log_eventType_idx" ON "event_log"("eventType");

-- CreateIndex
CREATE INDEX "scene_dag_projectId_chapterNo_idx" ON "scene_dag"("projectId", "chapterNo");

-- CreateIndex
CREATE UNIQUE INDEX "scene_dag_projectId_sceneId_key" ON "scene_dag"("projectId", "sceneId");

-- CreateIndex
CREATE INDEX "world_state_projectId_idx" ON "world_state"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "world_state_projectId_entityId_key" ON "world_state"("projectId", "entityId");

-- CreateIndex
CREATE INDEX "writer_alignment_metrics_projectId_idx" ON "writer_alignment_metrics"("projectId");

-- CreateIndex
CREATE INDEX "plot_dag_edges_projectId_idx" ON "plot_dag_edges"("projectId");

-- AddForeignKey
ALTER TABLE "entity_registry" ADD CONSTRAINT "entity_registry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "hdz_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_dag" ADD CONSTRAINT "scene_dag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "hdz_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "world_state" ADD CONSTRAINT "world_state_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "hdz_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "writer_alignment_metrics" ADD CONSTRAINT "writer_alignment_metrics_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "hdz_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plot_dag_edges" ADD CONSTRAINT "plot_dag_edges_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "hdz_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

