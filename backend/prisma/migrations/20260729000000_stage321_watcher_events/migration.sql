-- CreateTable
CREATE TABLE IF NOT EXISTS "dual_write_watcher_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "latency_ms" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "flags" TEXT,
    "diff" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dual_write_watcher_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_watcher_created_at" ON "dual_write_watcher_events"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_watcher_status" ON "dual_write_watcher_events"("status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_watcher_entity" ON "dual_write_watcher_events"("entity", "status", "created_at" DESC);
