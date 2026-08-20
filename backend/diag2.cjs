
const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient();
(async()=>{
  const fs=require('fs'); let out=[];
  for(const uid of ['0ba5bf98-7005-4019-a431-6a0fb4b2d28d','b99a4589-a05b-422d-9bf4-970d940141e0']){
    const u=await p.$queryRawUnsafe('SELECT id, left(coalesce(\"public_key\",\x27\x27),30) AS pk, length(\"public_key\") AS pkl FROM \"User\" WHERE id=$1::uuid', uid);
    const m=await p.$queryRawUnsafe('SELECT left(enc_key,30) AS ek, length(enc_key) AS len FROM identity_challenges_meta WHERE user_id=$1', uid);
    out.push('UID '+uid.slice(0,8));
    out.push('  public_key: '+(u[0]?('has='+(u[0].pkl>10)+' head='+JSON.stringify(u[0].pk)):'NOT FOUND'));
    out.push('  enc_key: '+(m.length?(JSON.stringify(m[0].ek)+' len='+m[0].len):'none'));
  }
  fs.writeFileSync('/tmp/diag2.out', out.join('\n'));
  process.exit(0);
})().catch(e=>{require('fs').writeFileSync('/tmp/diag2.out','FATAL '+String(e.message).slice(0,150));process.exit(1)});
