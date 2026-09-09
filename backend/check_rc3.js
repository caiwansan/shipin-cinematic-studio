const{PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  try{
    const r=await p.routeConfig.findFirst({where:{scope:'tea',key:'config'}});
    if(!r){console.log('NOT_FOUND');process.exit(0);}
    console.log('ID:',r.id);
    const v=JSON.parse(JSON.stringify(r.value));
    console.log('VALUE:',JSON.stringify(v,null,2));
    process.exit(0);
  }catch(e){console.error('ERR:',e.message);process.exit(1);}
})();