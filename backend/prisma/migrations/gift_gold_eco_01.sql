-- GIFT-GOLD-ECO-01 礼物金币体系（2026-08-06）
-- 链条：钻石(充值,只花不提) → 礼物(打赏,65%即时转金币) → 金币(10:1兑余额,200起) → 余额(可提现,5%手续费)

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "gold_coins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AgentWithdraw" ADD COLUMN IF NOT EXISTS "fee" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "gift_product" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "priceDiamonds" INTEGER NOT NULL DEFAULT 1,
  "iconUrl" TEXT NOT NULL DEFAULT '',
  "category" TEXT NOT NULL DEFAULT '热门',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "gift_record" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "senderId" UUID NOT NULL,
  "receiverId" UUID NOT NULL,
  "giftProductId" UUID NOT NULL,
  "priceDiamonds" INTEGER NOT NULL,
  "coinsAwarded" INTEGER NOT NULL,
  "channelId" TEXT NOT NULL DEFAULT '',
  "channelType" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "gift_record_sender_idx" ON "gift_record" ("senderId", "createdAt");
CREATE INDEX IF NOT EXISTS "gift_record_receiver_idx" ON "gift_record" ("receiverId", "createdAt");

CREATE TABLE IF NOT EXISTS "gold_coin_log" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "amount" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "remark" TEXT,
  "relatedId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "gold_coin_log_user_idx" ON "gold_coin_log" ("userId", "createdAt");
