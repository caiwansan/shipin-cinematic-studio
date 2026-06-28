-- User 表新增地区字段
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "provinceCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "provinceName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cityCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cityName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "districtCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "districtName" TEXT;

-- MarketAgent 表新增区域字段
ALTER TABLE "MarketAgent" ADD COLUMN IF NOT EXISTS "agentType" TEXT NOT NULL DEFAULT 'market';
ALTER TABLE "MarketAgent" ADD COLUMN IF NOT EXISTS "regionCode" TEXT;
ALTER TABLE "MarketAgent" ADD COLUMN IF NOT EXISTS "regionName" TEXT;

-- 新建 ChinaRegion 表（中国行政区划）
CREATE TABLE IF NOT EXISTS "ChinaRegion" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "parentCode" TEXT,
    CONSTRAINT "ChinaRegion_pkey" PRIMARY KEY ("code")
);

CREATE INDEX IF NOT EXISTS "ChinaRegion_parentCode_idx" ON "ChinaRegion"("parentCode");
