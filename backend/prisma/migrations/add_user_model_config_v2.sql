-- Config System v2：单行配置表
CREATE TABLE IF NOT EXISTS "UserModelConfigV2" (
    "userId" UUID NOT NULL,
    "imageProvider" TEXT NOT NULL DEFAULT 'volcengine',
    "videoProvider" TEXT NOT NULL DEFAULT 'volcengine',
    "ttsProvider" TEXT NOT NULL DEFAULT 'volcengine',
    "imageApiKey" TEXT,
    "videoApiKey" TEXT,
    "ttsApiKey" TEXT,
    "baseUrl" TEXT,
    "imageModel" TEXT NOT NULL DEFAULT 'wan2.7-image-pro',
    "imageEnabled" BOOLEAN NOT NULL DEFAULT true,
    "videoModel" TEXT NOT NULL DEFAULT 'wan2.7-t2v',
    "videoEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ttsModel" TEXT NOT NULL DEFAULT 'cosyvoice-v3.5-plus',
    "ttsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserModelConfigV2_pkey" PRIMARY KEY ("userId")
);

-- 迁移现有数据：从 UserModelConfig 折叠为单行
-- 对每个用户，合并多行 provider 配置为单行 V2
-- 保留最新的 image/video/tts API Key 和模型名
DO $$
DECLARE
    uid UUID;
BEGIN
    FOR uid IN SELECT DISTINCT "userId" FROM "UserModelConfig" LOOP
        INSERT INTO "UserModelConfigV2" ("userId", "imageProvider", "videoProvider", "ttsProvider", "imageApiKey", "videoApiKey", "ttsApiKey", "baseUrl", "imageModel", "imageEnabled", "videoModel", "videoEnabled", "ttsModel", "ttsEnabled", "createdAt", "updatedAt")
        SELECT
            uid,
            -- imageProvider: 取 imageProvider 有值的最新行
            COALESCE(
                (SELECT cfg3."imageProvider" FROM "UserModelConfig" cfg3 WHERE cfg3."userId" = uid AND cfg3."imageProvider" IS NOT NULL ORDER BY cfg3."updatedAt" DESC LIMIT 1),
                'volcengine'
            ),
            -- videoProvider: 取 videoProvider 有值的最新行
            COALESCE(
                (SELECT cfg4."videoProvider" FROM "UserModelConfig" cfg4 WHERE cfg4."userId" = uid AND cfg4."videoProvider" IS NOT NULL ORDER BY cfg4."updatedAt" DESC LIMIT 1),
                'volcengine'
            ),
            -- ttsProvider: 取 ttsProvider 有值的最新行
            COALESCE(
                (SELECT cfg5."ttsProvider" FROM "UserModelConfig" cfg5 WHERE cfg5."userId" = uid AND cfg5."ttsProvider" IS NOT NULL ORDER BY cfg5."updatedAt" DESC LIMIT 1),
                'volcengine'
            ),
            -- imageApiKey: 取 imageApiKey 有值的最新行
            (SELECT cfg6."imageApiKey" FROM "UserModelConfig" cfg6 WHERE cfg6."userId" = uid AND cfg6."imageApiKey" IS NOT NULL ORDER BY cfg6."updatedAt" DESC LIMIT 1),
            -- videoApiKey: 取 videoApiKey 有值的最新行
            (SELECT cfg7."videoApiKey" FROM "UserModelConfig" cfg7 WHERE cfg7."userId" = uid AND cfg7."videoApiKey" IS NOT NULL ORDER BY cfg7."updatedAt" DESC LIMIT 1),
            -- ttsApiKey: 从 ttsProvider 行取 apiKey（用户配置 TTS 时用的是通用 apiKey）
            (SELECT cfg8."apiKey" FROM "UserModelConfig" cfg8 WHERE cfg8."userId" = uid AND cfg8."ttsProvider" IS NOT NULL AND cfg8."apiKey" IS NOT NULL ORDER BY cfg8."updatedAt" DESC LIMIT 1),
            -- baseUrl: 取有 baseUrl 的最新行
            (SELECT cfg9."baseUrl" FROM "UserModelConfig" cfg9 WHERE cfg9."userId" = uid AND cfg9."baseUrl" IS NOT NULL ORDER BY cfg9."updatedAt" DESC LIMIT 1),
            -- imageModel: 从 imageProvider 行取，兜底 default
            COALESCE(
                (SELECT cfg10."imageModel" FROM "UserModelConfig" cfg10 WHERE cfg10."userId" = uid AND cfg10."imageProvider" IS NOT NULL ORDER BY cfg10."updatedAt" DESC LIMIT 1),
                'wan2.7-image-pro'
            ),
            true,
            -- videoModel
            COALESCE(
                (SELECT cfg11."videoModel" FROM "UserModelConfig" cfg11 WHERE cfg11."userId" = uid AND cfg11."videoProvider" IS NOT NULL ORDER BY cfg11."updatedAt" DESC LIMIT 1),
                'wan2.7-t2v'
            ),
            true,
            -- ttsModel
            COALESCE(
                (SELECT cfg12."ttsModel" FROM "UserModelConfig" cfg12 WHERE cfg12."userId" = uid AND cfg12."ttsProvider" IS NOT NULL ORDER BY cfg12."updatedAt" DESC LIMIT 1),
                'cosyvoice-v3.5-plus'
            ),
            true,
            NOW(),
            NOW()
        WHERE NOT EXISTS (SELECT 1 FROM "UserModelConfigV2" WHERE "userId" = uid);
    END LOOP;
END $$;
