-- Provider State Layer v1.1
CREATE TABLE IF NOT EXISTS provider_state (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    provider TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'healthy',
    "lastError" TEXT,
    "errorCode" TEXT,
    "lastSuccessAt" TIMESTAMPTZ,
    "lastFailAt" TIMESTAMPTZ,
    "keyFingerprint" TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE("userId", provider)
);
CREATE INDEX IF NOT EXISTS idx_provider_state_user ON provider_state("userId", provider);
