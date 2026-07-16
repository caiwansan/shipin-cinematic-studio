-- P4.2.5.2-IMP-01.5: Interaction Feed Runtime
-- Add traceId + sentiment to EnterpriseInteraction

ALTER TABLE "enterprise_interaction"
    ADD COLUMN IF NOT EXISTS "trace_id" TEXT,
    ADD COLUMN IF NOT EXISTS "sentiment" TEXT;

CREATE INDEX IF NOT EXISTS "enterprise_interaction_trace_id_idx"
    ON "enterprise_interaction"("trace_id");

CREATE INDEX IF NOT EXISTS "enterprise_interaction_sentiment_idx"
    ON "enterprise_interaction"("sentiment");
