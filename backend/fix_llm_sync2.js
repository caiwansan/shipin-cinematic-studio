const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Sync data from user_llm_key with UUID cast
  const keys = await p.$queryRawUnsafe('SELECT user_id, provider, model, base_url, api_key FROM user_llm_key');
  console.log('Found', keys.length, 'users in user_llm_key');

  for (const k of keys) {
    try {
      await p.$executeRawUnsafe(
        `INSERT INTO "userModelConfigV2" ("userId","llmProvider","llmModel","llmApiKey","llmBaseUrl","createdAt","updatedAt")
         VALUES ($1::uuid,$2,$3,$4,$5,NOW(),NOW())
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
