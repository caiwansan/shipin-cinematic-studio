const{PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  try{
    const all=await p.routeConfig.findMany();
    for(const r of all){
      console.log('---');
      console.log('scope:',r.scope,'key:',r.key);
      try{const v=JSON.parse(JSON.stringify(r.value));console.log('value:',JSON.stringify(v).slice(0,200));}catch(e){console.log('raw:',String(r.value).slice(0,200));}
    }
    process.exit(0);
  }catch(e){console.error('ERR:',e.message);process.exit(1);}
})();