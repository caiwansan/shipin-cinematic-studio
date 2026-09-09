const{PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  try{
    const cfg=await p.routeConfig.findFirst({where:{scope:'tea',key:'config'}});
    const v = typeof cfg.value === 'string' ? JSON.parse(cfg.value) : cfg.value;
    console.log('Verified:', v.latestVersion, v.latestVersionCode, v.apkSha256.slice(0,16)+'...');
    process.exit(0);
  }catch(e){console.error('ERR:',e.message);process.exit(1);}
})();