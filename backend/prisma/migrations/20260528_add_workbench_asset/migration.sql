-- Phase 7G: WorkbenchAsset table for permanent COS URLs
CREATE TABLE IF NOT EXISTS "workbench_assets" (
    "id" TEXT NOT NULL,
    "projectId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail" TEXT,
    "source" TEXT,
    "prompt" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workbench_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "workbench_assets_projectId_idx" ON "workbench_assets"("projectId");

ALTER TABLE "workbench_assets" ADD CONSTRAINT "workbench_assets_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE;
