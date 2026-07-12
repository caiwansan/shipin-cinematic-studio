-- CreateCredentialRuntimeState table
CREATE TABLE IF NOT EXISTS "credential_runtime_state" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'NEW',
    "credentialSourceType" TEXT,
    "credentialSourceId" TEXT,
    "lastValidatedAt" TIMESTAMPTZ,
    "lastSuccessAt" TIMESTAMPTZ,
    "lastFailureAt" TIMESTAMPTZ,
    "failureReason" TEXT,
    "failureCode" TEXT,
    "validationCount" INTEGER NOT NULL DEFAULT 0,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "credential_runtime_state_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "credential_runtime_state_ownerType_ownerId_provider_key" UNIQUE ("ownerType", "ownerId", "provider")
);

CREATE INDEX IF NOT EXISTS "credential_runtime_state_ownerId_provider_idx" ON "credential_runtime_state" ("ownerId", "provider");
