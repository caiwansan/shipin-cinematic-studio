#!/usr/bin/env node
/**
 * Startup wrapper with env injection:
 * 1. Load .env file (before anything)
 * 2. Load server (dist/index.js will overwrite process.env with encrypted keys)
 * 3. After server starts, re-set process.env with decrypted keys
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const crypto = require('crypto');
const encKeyHex = process.env.CRYPTO_ENCRYPTION_KEY;
if (!encKeyHex) {
  console.error('[wrapper] ❌ CRYPTO_ENCRYPTION_KEY not found');
  process.exit(1);
}

function decryptKey(encrypted) {
  const parts = encrypted.split(':');
  if (parts.length !== 3) throw new Error('Invalid format');
  const key = Buffer.from(encKeyHex, 'hex');
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  let d = decipher.update(parts[2], 'hex', 'utf8');
  d += decipher.final('utf8');
  return d;
}

(async () => {
  // Attempt 1: set from .env directly (these are plaintext)
  const dotenvKeys = ['DEEPSEEK_API_KEY', 'VOLCENGINE_API_KEY', 'ALIYUN_API_KEY',
                      'SILICONFLOW_API_KEY', 'KIMI_API_KEY', 'BAILIAN_API_KEY',
                      'GOOGLE_API_KEY', 'ANTHROPIC_API_KEY', 'XAI_API_KEY',
                      'MOONSHOT_API_KEY', 'ZHIPU_API_KEY', 'OPENAI_API_KEY'];
  for (const k of dotenvKeys) {
    if (process.env[k]) {
      console.log(`[wrapper] .env: ${k} available`);
    } else {
      console.log(`[wrapper] .env: ${k} MISSING`);
    }
  }

  // Load decrypted keys from DB
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const savedKeys = await prisma.apiKey.findMany();
  await prisma.$disconnect();

  // Store decrypted values in a closure
  const decryptedMap = new Map();
  for (const key of savedKeys) {
    try {
      decryptedMap.set(key.keyName, decryptKey(key.keyValue));
    } catch {
      decryptedMap.set(key.keyName, key.keyValue); // fallback to raw
    }
  }
  console.log(`[wrapper] Decrypted ${decryptedMap.size} keys from DB`);

  // Now start the server
  console.log('[wrapper] Starting server...');
  require('./dist/index.js');

  // After server loaded, override process.env with decrypted values
  let overrideCount = 0;
  for (const [name, value] of decryptedMap) {
    process.env[name] = value;
    overrideCount++;
  }
  console.log(`[wrapper] ✅ Overrode ${overrideCount} API keys in process.env (decrypted)`);

  // Verify post-override
  for (const k of dotenvKeys) {
    if (process.env[k]) {
      console.log(`[wrapper] ✅ ${k}=${process.env[k].substring(0, 12)}...`);
    }
  }
})();
