-- Sprint-RECRUITMENT-REALITY-03 T06: EnterprisePlan 增加 capabilityCodes（套餐能力集，Plan→Entitlement 继承）
ALTER TABLE "enterprise_plan" ADD COLUMN IF NOT EXISTS "capability_codes" JSONB NOT NULL DEFAULT '[]';
