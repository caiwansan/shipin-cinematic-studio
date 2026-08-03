-- SPRINT-MEDIA-VIRTUAL-COMPUTER-REALITY-01 Task01 — BrowserProfileLoginState
-- 虚拟电脑登录状态模型：电脑实例在线 ≠ 平台账号在线。
-- loginRealityState 由 ChannelAccount.connectionStatus + 探针信号映射（登录推进/退出时同步）：
--   UNKNOWN / EMPTY / WAITING_LOGIN / SESSION_AUTHENTICATED / IDENTITY_READY / WORKSPACE_READY / LOGGED_OUT
ALTER TABLE "browser_workspace" ADD COLUMN IF NOT EXISTS "login_reality_state" TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "browser_workspace" ADD COLUMN IF NOT EXISTS "last_login_state_at" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "browser_workspace_login_reality_state_idx" ON "browser_workspace"("login_reality_state");

-- 存量回填：已有 CONNECTED 账号的 workspace → WORKSPACE_READY（身份+凭证+runtime 全闭环）
-- 其余保持 UNKNOWN（由下一次探针/登录推进刷新，不猜）
UPDATE "browser_workspace" w
SET "login_reality_state" = 'WORKSPACE_READY',
    "last_login_state_at" = NOW()
FROM "enterprise_channel_account" a
WHERE w."channel_account_id" = a."id"
  AND a."connection_status" = 'CONNECTED'
  AND w."login_reality_state" = 'UNKNOWN';
