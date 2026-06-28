-- AI Film OS v2: Event Sourcing + AI Decision Ledger
CREATE TABLE IF NOT EXISTS "workbench_events" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "userId" UUID,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workbench_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "workbench_events_projectId_createdAt_idx" ON "workbench_events"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "workbench_events_type_idx" ON "workbench_events"("type");

ALTER TABLE "workbench_events" ADD CONSTRAINT "workbench_events_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS "ai_decision_logs" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "segmentId" TEXT,
    "agent" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "graph_context" JSONB,
    "continuity_context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_decision_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_decision_logs_projectId_createdAt_idx" ON "ai_decision_logs"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "ai_decision_logs_segmentId_idx" ON "ai_decision_logs"("segmentId");

ALTER TABLE "ai_decision_logs" ADD CONSTRAINT "ai_decision_logs_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE;
