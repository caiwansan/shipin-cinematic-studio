const{PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  try{
    const cfg=await p.routeConfig.findFirst({where:{scope:'tea',key:'config'}});
    if(!cfg){console.error('NOT_FOUND');process.exit(1);}
    const v=JSON.parse(JSON.stringify(cfg.value));
    v.apkSha256='4867A6EEA03BB2CC5743F872C02D9D0C149E66D37267E2404B6EFCEA4BA615B8';
    v.apkSize=50992664;
    v.latestVersion='1.2.6';
    v.latestVersionCode='1206';
    v.apkUrl='https://aigc.fushtn.com/releases/desktop/mobile/kunlun-tea-NATIVE-v1.2.6.apk';
    await p.routeConfig.update({where:{id:cfg.id},data:{value:v,updatedAt:new Date()}});
    console.log('OK: routeConfig updated to v1.2.6');
    process.exit(0);
  }catch(e){console.error('ERR:',e.message);process.exit(1);}
})();