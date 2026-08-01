-- Sprint-RECRUITMENT-REALITY-04 T01: EnterpriseLlmConfig 增加 Model Health Center 健康状态字段
ALTER TABLE "enterprise_llm_config" ADD COLUMN IF NOT EXISTS "last_health_check_at" TIMESTAMPTZ;
ALTER TABLE "enterprise_llm_config" ADD COLUMN IF NOT EXISTS "health_status" VARCHAR(20) NOT NULL DEFAULT 'untested';
ALTER TABLE "enterprise_llm_config" ADD COLUMN IF NOT EXISTS "health_latency_ms" INTEGER;
ALTER TABLE "enterprise_llm_config" ADD COLUMN IF NOT EXISTS "health_error" TEXT;
