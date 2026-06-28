-- AlterTable
ALTER TABLE "UserModelConfig" ADD COLUMN     "imageProvider" TEXT,
ADD COLUMN     "llmProvider" TEXT,
ADD COLUMN     "ttsProvider" TEXT,
ADD COLUMN     "videoProvider" TEXT;
