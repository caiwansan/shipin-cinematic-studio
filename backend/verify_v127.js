const{PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  try{
    const cfg=await p.routeConfig.findFirst({where:{scope:'tea',key:'config'}});
    if(!cfg){console.error('NOT_FOUND');process.exit(1);}
    const v=JSON.parse(JSON.stringify(cfg.value));
    console.log('latestVersion:',v.latestVersion);
    console.log('latestVersionCode:',v.latestVersionCode);
    console.log('apkSize:',v.apkSize);
    process.exit(0);
  }catch(e){console.error('ERR:',e.message);process.exit(1);}
})();