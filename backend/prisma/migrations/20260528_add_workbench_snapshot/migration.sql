-- Phase 7B: WorkbenchSnapshot for studio-v2 persistence
CREATE TABLE IF NOT EXISTS "workbench_snapshots" (
    "id" TEXT NOT NULL,
    "projectId" UUID NOT NULL,
    "runtimeVersion" INTEGER NOT NULL DEFAULT 1,
    "activeStage" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workbench_snapshots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "workbench_snapshots_projectId_key" UNIQUE ("projectId")
);

CREATE INDEX IF NOT EXISTS "workbench_snapshots_projectId_idx" ON "workbench_snapshots"("projectId");

ALTER TABLE "workbench_snapshots" ADD CONSTRAINT "workbench_snapshots_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE;
