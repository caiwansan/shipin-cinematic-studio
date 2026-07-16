-- P4.2.5.2-IMP-01.3: Callback Runtime Hardening
-- Event Deduplication + Dead Letter Queue + Trace Logging

-- ─── ProcessedEvent (Dedup Table) ─────────────────────────

CREATE TABLE IF NOT EXISTS "processed_event" (
    "id"                TEXT NOT NULL DEFAULT gen_random_uuid(),
    "event_id"          TEXT NOT NULL,
    "tenant_id"         TEXT NOT NULL,
    "channel_account_id" TEXT NOT NULL,
    "channel_type"      TEXT NOT NULL DEFAULT 'wechat_work',
    "event_type"        TEXT NOT NULL,
    "status"            TEXT NOT NULL DEFAULT 'success',
    "trace_id"          TEXT NOT NULL,
    "processed_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error"             TEXT,

    CONSTRAINT "processed_event_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "processed_event_event_id_channel_account_id_key"
    ON "processed_event"("event_id", "channel_account_id");

CREATE INDEX IF NOT EXISTS "processed_event_tenant_id_idx" ON "processed_event"("tenant_id");
CREATE INDEX IF NOT EXISTS "processed_event_channel_account_id_idx" ON "processed_event"("channel_account_id");
CREATE INDEX IF NOT EXISTS "processed_event_trace_id_idx" ON "processed_event"("trace_id");
CREATE INDEX IF NOT EXISTS "processed_event_processed_at_idx" ON "processed_event"("processed_at");

-- ─── DeadLetterEvent (DLQ Table) ──────────────────────────

CREATE TABLE IF NOT EXISTS "dead_letter_event" (
    "id"                TEXT NOT NULL DEFAULT gen_random_uuid(),
    "event_id"          TEXT NOT NULL,
    "tenant_id"         TEXT NOT NULL,
    "channel_account_id" TEXT NOT NULL,
    "channel_type"      TEXT NOT NULL DEFAULT 'wechat_work',
    "event_type"        TEXT NOT NULL,
    "payload"           JSONB NOT NULL DEFAULT '{}',
    "error"             TEXT NOT NULL,
    "retry_count"       INTEGER NOT NULL DEFAULT 0,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_retried_at"   TIMESTAMP(3),
    "resolved_at"       TIMESTAMP(3),
    "resolution"        TEXT,

    CONSTRAINT "dead_letter_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "dead_letter_event_tenant_id_idx" ON "dead_letter_event"("tenant_id");
CREATE INDEX IF NOT EXISTS "dead_letter_event_channel_account_id_idx" ON "dead_letter_event"("channel_account_id");
CREATE INDEX IF NOT EXISTS "dead_letter_event_event_type_idx" ON "dead_letter_event"("event_type");
CREATE INDEX IF NOT EXISTS "dead_letter_event_created_at_idx" ON "dead_letter_event"("created_at");
CREATE INDEX IF NOT EXISTS "dead_letter_event_resolved_at_idx" ON "dead_letter_event"("resolved_at");

-- ─── EventTraceLog (Observability Table) ──────────────────

CREATE TABLE IF NOT EXISTS "event_trace_log" (
    "id"                TEXT NOT NULL DEFAULT gen_random_uuid(),
    "trace_id"          TEXT NOT NULL,
    "event_id"          TEXT NOT NULL,
    "tenant_id"         TEXT NOT NULL,
    "channel_account_id" TEXT NOT NULL,
    "stage"             TEXT NOT NULL,
    "status"            TEXT NOT NULL,
    "message"           TEXT,
    "metadata"           JSONB NOT NULL DEFAULT '{}',
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_trace_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "event_trace_log_trace_id_idx" ON "event_trace_log"("trace_id");
CREATE INDEX IF NOT EXISTS "event_trace_log_event_id_idx" ON "event_trace_log"("event_id");
CREATE INDEX IF NOT EXISTS "event_trace_log_tenant_id_idx" ON "event_trace_log"("tenant_id");
CREATE INDEX IF NOT EXISTS "event_trace_log_created_at_idx" ON "event_trace_log"("created_at");
