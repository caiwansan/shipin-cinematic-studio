process.env.CRYPTO_ENCRYPTION_KEY = 'f535f7bcb360367cf03441091090227f7b9de011d65044fd0b7b83fe90099596';
const crypto = require('crypto');
function decryptKey(encrypted) {
  const parts = encrypted.split(':');
  if (parts.length !== 3) return encrypted;
  const [ivHex, tagHex, ciphertext] = parts;
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(process.env.CRYPTO_ENCRYPTION_KEY, 'hex'), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  let d = decipher.update(ciphertext, 'hex', 'utf8');
  return d + decipher.final('utf8');
}
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const boss = await p.user.findUnique({ where: { email: 'qq_EC4758EB097F065B13531BE4747B6E0F@aigc.fushtn.com' } });
  const cfg = await p.userModelConfigV2.findUnique({ where: { userId: boss.id } });
  const key = cfg.llmApiKey.includes(':') ? decryptKey(cfg.llmApiKey) : cfg.llmApiKey;
  console.log('掌柜 LLM:', cfg.llmProvider, '/', cfg.llmModel, '| 解密key:', key.slice(0, 8) + '...');
  const url = 'https://api.longcat.chat/openai/chat/completions';
  const prompt = `你是网文总规划师。根据创作意图输出 JSON：{"title":"书名","genre":"类型","totalChapter":100,"volumeCount":5,"worldDirection":"世界观(300字)","endingDirection":"结局方向(150字)","forbiddenRules":["规则1","规则2","规则3"],"foreshadowing":[{"chapter":20,"event":"伏笔事件","payoff":"第500章兑现"}],"volumes":[{"volume":1,"chapterRange":"1-20","theme":"主题","mainConflict":"冲突(100字)","characterGrowth":"成长线(100字)","keyEvents":["事件1","事件2"]},{"volume":2,"chapterRange":"21-40","theme":"主题","mainConflict":"冲突(100字)","characterGrowth":"成长线(100字)","keyEvents":["事件1","事件2"]},{"volume":3,"chapterRange":"41-60","theme":"主题","mainConflict":"冲突(100字)","characterGrowth":"成长线(100字)","keyEvents":["事件1","事件2"]}]}`;
  const body = { model: cfg.llmModel, messages: [{ role: 'system', content: prompt }, { role: 'user', content: '都市青年陈默获得时间回溯能力，改写家族破产悲剧，揭开父亲失踪之谜。类型：都市；目标字数100万；章节100；卷数5。' }], max_tokens: 4096, temperature: 0.7 };
  console.log('调用 longcat...');
  const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) });
  const data = await resp.json();
  if (!resp.ok) { console.log('LLM 失败:', resp.status, JSON.stringify(data).slice(0, 200)); await p.$disconnect(); return; }
  const content = data.choices?.[0]?.message?.content || '';
  console.log('LLM 响应长度:', content.length, '| tokens:', data.usage?.total_tokens);
  const m = content.match(/\{[\s\S]*\}/);
  if (!m) { console.log('无 JSON'); await p.$disconnect(); return; }
  const plan = JSON.parse(m[0]);
  plan.status = 'draft';
  console.log('解析总纲:', plan.title, '| volumes:', plan.volumes?.length);
  await p.$disconnect();
  const loginR = await fetch('https://aigc.fushtn.com/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account: 'tenant_org_test@audit.local', password: 'AuditTest@123' }) });
  const loginD = await loginR.json();
  const pid = 'f5154726-fdff-4288-9cb6-e0748db4b22c';
  const putR = await fetch(`https://aigc.fushtn.com/api/hdz/projects/${pid}/master-plan`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + loginD.accessToken },
    body: JSON.stringify({ masterPlan: plan, reason: 'E2E 验证：longcat 生成总纲保存' }),
  });
  const putD = await putR.json();
  console.log('PUT 保存:', putR.status, JSON.stringify(putD).slice(0, 120));
  const getR = await fetch(`https://aigc.fushtn.com/api/hdz/projects/${pid}/master-plan`, { headers: { 'Authorization': 'Bearer ' + loginD.accessToken } });
  const getD = await getR.json();
  const saved = getD?.data?.masterPlan;
  console.log('GET 验证:', getR.status, '| 书名:', saved?.title, '| status:', saved?.status, '| volumes:', saved?.volumes?.length, '| worldDirection:', (saved?.worldDirection || '').slice(0, 30));
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
