const{PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  try{
    const cfg=await p.routeConfig.findFirst({where:{scope:'tea',key:'config'}});
    if(!cfg){console.error('NOT_FOUND');process.exit(1);}
    let v=typeof cfg.value==='string'?JSON.parse(cfg.value):cfg.value;
    v.apkSha256='F95AC82C1F86785111B4477CD82EEF53902E014402FD89AC3DB68C5859DDFD58';
    v.apkSize=50943512;
    v.latestVersion='1.2.7-fix3';
    v.latestVersionCode='1207';
    v.apkUrl='https://aigc.fushtn.com/releases/desktop/mobile/kunlun-tea-NATIVE-v1.2.7-fix3.apk';
    v.updatedAt=new Date().toISOString();
    await p.routeConfig.update({where:{id:cfg.id},data:{value:v}});
    console.log('OK: routeConfig updated to v1.2.7-fix3');
    process.exit(0);
  }catch(e){console.error('ERR:',e.message);process.exit(1);}
})();