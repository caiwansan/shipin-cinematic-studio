-- CreateTable
CREATE TABLE "enterprise_candidate" (
    "id" uuid NOT NULL,
    "organization_id" uuid NOT NULL,
    "channel_id" uuid NOT NULL,
    "job_id" uuid,
    "name" text NOT NULL,
    "phone" text,
    "email" text,
    "skills" text[],
    "experience_years" integer NOT NULL DEFAULT 0,
    "summary" text,
    "expected_salary" text,
    "status" text NOT NULL DEFAULT 'new',
    "ai_analysis" text,
    "imported_by" uuid,
    "imported_at" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "enterprise_candidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "enterprise_candidate_organization_id_idx" ON "enterprise_candidate"("organization_id");
CREATE INDEX "enterprise_candidate_channel_id_idx" ON "enterprise_candidate"("channel_id");
CREATE INDEX "enterprise_candidate_organization_id_status_idx" ON "enterprise_candidate"("organization_id", "status");

-- AddForeignKey
ALTER TABLE "enterprise_candidate" ADD CONSTRAINT "enterprise_candidate_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "recruitment_channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
