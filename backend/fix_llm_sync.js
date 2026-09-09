const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Check if table exists
  const exists = await p.$queryRawUnsafe("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name='userModelConfigV2') as exists");
  console.log('Table exists:', JSON.stringify(exists));

  if (!exists[0].exists) {
    console.log('Creating table...');
    await p.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "userModelConfigV2" (
        "userId" UUID PRIMARY KEY,
        "llmProvider" TEXT DEFAULT '',
        "llmModel" TEXT DEFAULT '',
        "llmApiKey" TEXT,
        "llmBaseUrl" TEXT DEFAULT '',
        "llmEnabled" BOOLEAN DEFAULT true,
        "imageProvider" TEXT DEFAULT 'volcengine',
        "imageModel" TEXT DEFAULT '',
        "imageApiKey" TEXT,
        "imageBaseUrl" TEXT DEFAULT '',
        "imageEnabled" BOOLEAN DEFAULT true,
        "videoProvider" TEXT DEFAULT '',
        "videoModel" TEXT DEFAULT '',
        "videoApiKey" TEXT,
        "videoBaseUrl" TEXT DEFAULT '',
        "videoEnabled" BOOLEAN DEFAULT true,
        "ttsProvider" TEXT DEFAULT '',
        "ttsModel" TEXT DEFAULT '',
        "ttsApiKey" TEXT,
        "ttsBaseUrl" TEXT DEFAULT '',
        "ttsEnabled" BOOLEAN DEFAULT true,
        "musicProvider" TEXT DEFAULT '',
        "musicModel" TEXT DEFAULT '',
        "musicApiKey" TEXT,
        "musicBaseUrl" TEXT DEFAULT '',
        "musicEnabled" BOOLEAN DEFAULT false,
        "visionUnderstandProvider" TEXT DEFAULT 'volcengine',
        "visionUnderstandModel" TEXT DEFAULT 'doubao-vision-pro-32k',
        "visionUnderstandApiKey" TEXT,
        "visionUnderstandEnabled" BOOLEAN DEFAULT true,
        "visionUnderstandBaseUrl" TEXT DEFAULT '',
        "capabilityLlmConfigs" JSONB,
        "baseUrl" TEXT DEFAULT '',
        "createdAt" TIMESTAMP DEFAULT now(),
        "updatedAt" TIMESTAMP DEFAULT now()
      )
    `);
    console.log('Table created!');
  }

  // Sync data from user_llm_key
  const keys = await p.$queryRawUnsafe('SELECT user_id, provider, model, base_url, api_key FROM user_llm_key');
  console.log('Found', keys.length, 'users in user_llm_key');

  for (const k of keys) {
    try {
      await p.$executeRawUnsafe(
        `INSERT INTO "userModelConfigV2" ("userId","llmProvider","llmModel","llmApiKey","llmBaseUrl","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
         ON CONFLICT ("userId") DO UPDATE SET "llmProvider"=$2,"llmModel"=$3,"llmApiKey"=$4,"llmBaseUrl"=$5,"updatedAt"=NOW()`,
        k.user_id, k.provider, k.model, k.api_key || '', k.base_url || ''
      );
      console.log('Synced user:', k.user_id);
    } catch (e) {
      console.error('Failed:', k.user_id, e.message);
    }
  }

  // Verify
  const result = await p.$queryRawUnsafe('SELECT "userId","llmProvider","llmModel" FROM "userModelConfigV2"');
  console.log('userModelConfigV2:', JSON.stringify(result));

  await p.$disconnect();
})().catch(e => {
  console.error(e.message);
  p.$disconnect();
});
