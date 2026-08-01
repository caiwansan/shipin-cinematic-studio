-- Sprint-RECRUITMENT-REALITY-04 T03: AI 员工额度体系（套餐配额配置 + 权益用量）
ALTER TABLE "enterprise_plan" ADD COLUMN IF NOT EXISTS "quota_config" JSONB;
ALTER TABLE "enterprise_entitlement" ADD COLUMN IF NOT EXISTS "quota_usage" JSONB;
