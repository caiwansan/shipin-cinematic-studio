-- USER-FOLLOW-01 关注体系
CREATE TABLE IF NOT EXISTS "user_follow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_follow_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_follow_followerId_followingId_key" ON "user_follow"("followerId", "followingId");
CREATE INDEX IF NOT EXISTS "user_follow_followingId_idx" ON "user_follow"("followingId");
