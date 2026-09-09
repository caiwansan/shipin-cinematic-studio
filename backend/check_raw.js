const{PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  try{
    const cfg=await p.routeConfig.findFirst({where:{scope:'tea',key:'config'}});
    if(!cfg){console.log('NOT_FOUND');process.exit(1);}
    console.log('Raw value:',cfg.value);
    console.log('Type:',typeof cfg.value);
    process.exit(0);
  }catch(e){console.error('ERR:',e.message);process.exit(1);}
})();