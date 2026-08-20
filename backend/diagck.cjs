
const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient();
(async()=>{
  const users=await p.$queryRawUnsafe("SELECT id, username, \"public_key\" IS NOT NULL AND length(\"public_key\")>10 AS has_pub, coalesce(left(\"public_key\",40),'') AS pubhead FROM \"User\" ORDER BY \"createdAt\" DESC LIMIT 15");
  const metas=await p.$queryRawUnsafe("SELECT user_id, left(enc_key,30) AS ek, length(enc_key) AS len, updated_at::text AS ts FROM identity_challenges_meta");
  let out=['=== Users ==='];
  for(const u of users) out.push('  '+u.id.slice(0,8)+' | '+(u.username||'')+' | hasPub='+u.has_pub+' | '+JSON.stringify(u.pubhead.slice(0,25)));
  out.push('=== enc_keys ===');
  for(const m of metas) out.push('  '+m.user_id.slice(0,8)+' | len='+m.len+' | head='+JSON.stringify(m.ek)+' | '+m.ts);
  require('fs').writeFileSync('/tmp/diagck.out', out.join('\n'));
  process.exit(0);
})().catch(e=>{require('fs').writeFileSync('/tmp/diagck.out','FATAL '+String(e.message).slice(0,120));process.exit(1)});
