import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const cfg = await prisma.userModelConfigV2.findUnique({
    where: { userId: '5cbabc6d-60f1-48e6-b8fe-cb4a15ac50e0' }
  });
  if (!cfg || !cfg.llmApiKey) { console.log('NO CONFIG'); return; }
  console.log('Provider:', cfg.llmProvider);
  console.log('Model:', cfg.llmModel);
  console.log('Encrypted key (hex):', cfg.llmApiKey);
  
  // 用两个 key 都试解密
  for (const keyHex of ['f535f7bcb360367cf03441091090227f7b9de011d65044fd0b7b83fe90099596', ENV_KEY]) {
    try {
      const key = Buffer.from(keyHex, 'hex');
      const parts = cfg.llmApiKey.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const tag = Buffer.from(parts[1], 'hex');
      const text = Buffer.from(parts[2], 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      let d = decipher.update(text, undefined, 'utf8');
      d += decipher.final('utf8');
      console.log(`Decrypted with ${keyHex.substring(0,10)}: ${d.substring(0,30)}...`);
      break;
    } catch(e) {
      console.log(`Failed with ${keyHex.substring(0,10)}: ${e.message}`);
    }
  }
  await prisma.$disconnect();
}

main().catch(console.error);
