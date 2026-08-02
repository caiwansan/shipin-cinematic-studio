-- TASK03.1.5 — Browser Runtime Upgrade：渠道账号运行环境（ChannelBrowserSession）
-- 账号身份（enterprise_channel_account）与运行环境（浏览器 profile 会话）分离
-- 凭证唯一源仍是 enterprise_channel_account.credential_encrypted（本表不存凭证/cookie）

CREATE TABLE IF NOT EXISTS "channel_browser_session" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "channel_account_id" TEXT NOT NULL,
    "browser_type" TEXT NOT NULL DEFAULT 'chromium',
    "profile_path" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IDLE',
    "last_started_at" TIMESTAMP(3),
    "last_health_check_at" TIMESTAMP(3),
    "last_error" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "channel_browser_session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "channel_browser_session_channel_account_id_browser_type_key" ON "channel_browser_session" ("channel_account_id", "browser_type");
CREATE INDEX IF NOT EXISTS "channel_browser_session_channel_account_id_idx" ON "channel_browser_session" ("channel_account_id");
CREATE INDEX IF NOT EXISTS "channel_browser_session_status_idx" ON "channel_browser_session" ("status");

ALTER TABLE "channel_browser_session" ADD CONSTRAINT "channel_browser_session_channel_account_id_fkey"
    FOREIGN KEY ("channel_account_id") REFERENCES "enterprise_channel_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
