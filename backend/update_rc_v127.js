const{PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  try{
    const cfg=await p.routeConfig.findFirst({where:{scope:'tea',key:'config'}});
    if(!cfg){console.error('NOT_FOUND');process.exit(1);}
    const v = typeof cfg.value === 'string' ? JSON.parse(cfg.value) : cfg.value;
    console.log('Current version:', v.latestVersion, 'code:', v.latestVersionCode);
    v.apkSha256='58C40157ba53242981a71999d7cbbeece0fcb988633299f69e7c008283fc48a1';
    v.apkSize=50992664;
    v.latestVersion='1.2.7';
    v.latestVersionCode='1207';
    v.apkUrl='https://aigc.fushtn.com/releases/desktop/mobile/kunlun-tea-NATIVE-v1.2.7.apk';
    v.updatedAt=new Date().toISOString();
    await p.routeConfig.update({where:{id:cfg.id},data:{value:v}});
    console.log('OK: routeConfig updated to v1.2.7 (code 1207)');
    process.exit(0);
  }catch(e){console.error('ERR:',e.message);process.exit(1);}
})();