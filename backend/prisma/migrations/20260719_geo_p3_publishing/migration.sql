-- AlterTable
ALTER TABLE "publishing_records" DROP COLUMN "adapter_type",
DROP COLUMN "after_content",
DROP COLUMN "approval_note",
DROP COLUMN "before_content",
DROP COLUMN "content",
DROP COLUMN "content_type",
DROP COLUMN "diff_summary",
DROP COLUMN "execution_id",
DROP COLUMN "platform",
DROP COLUMN "project_id",
DROP COLUMN "publish_version",
DROP COLUMN "reviewed_at",
DROP COLUMN "reviewed_by",
DROP COLUMN "rollback_reason",
DROP COLUMN "rollback_version",
DROP COLUMN "rolled_back_at",
ADD COLUMN     "artifact_hash" TEXT NOT NULL,
ADD COLUMN     "artifact_url" TEXT,
ADD COLUMN     "channel" TEXT NOT NULL,
ADD COLUMN     "claim_id" TEXT NOT NULL,
ADD COLUMN     "plan_id" TEXT NOT NULL,
ADD COLUMN     "version" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'pending';

-- CreateTable
CREATE TABLE "publishable_claims" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "verification_id" TEXT NOT NULL,
    "source_action_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publishable_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publish_plans" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "targetChannels" JSONB NOT NULL DEFAULT '[]',
    "execution_order" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "publish_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publish_plan_to_claims" (
    "plan_id" TEXT NOT NULL,
    "claim_id" TEXT NOT NULL,

    CONSTRAINT "publish_plan_to_claims_pkey" PRIMARY KEY ("plan_id","claim_id")
);

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "governance_tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kmki_geo_project_profiles" ADD CONSTRAINT "kmki_geo_project_profiles_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_plan_to_claims" ADD CONSTRAINT "publish_plan_to_claims_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "publish_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_plan_to_claims" ADD CONSTRAINT "publish_plan_to_claims_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "publishable_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing_records" ADD CONSTRAINT "publishing_records_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "publish_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing_records" ADD CONSTRAINT "publishing_records_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "publishable_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "GeoProjectProfile_projectId_idx" RENAME TO "kmki_geo_project_profiles_projectId_idx";

-- RenameIndex
ALTER INDEX "GeoProjectProfile_projectId_key" RENAME TO "kmki_geo_project_profiles_projectId_key";

