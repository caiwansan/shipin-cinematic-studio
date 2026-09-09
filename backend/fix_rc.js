const{PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  try{
    const cfg=await p.routeConfig.findFirst({where:{scope:'tea',key:'config'}});
    if(!cfg){console.log('NOT_FOUND');process.exit(1);}
    console.log('Found cfg id:',cfg.id);
    console.log('Current value type:',typeof cfg.value);
    const v=JSON.parse(JSON.stringify(cfg.value));
    console.log('Current latestVersion:',v.latestVersion);
    
    // Update values
    v.apkSha256='7B08DE689AAE941406ECC98509C2AB68A0F32DD64A88192EE76075A9DFFA3570';
    v.apkSize=50992664;
    v.latestVersion='1.2.7';
    v.latestVersionCode='1207';
    v.apkUrl='https://aigc.fushtn.com/releases/desktop/mobile/kunlun-tea-NATIVE-v1.2.7.apk';
    v.updatedAt=new Date().toISOString();
    
    const u=await p.routeConfig.update({where:{id:cfg.id},data:{value:v}});
    console.log('Updated successfully');
    console.log('New latestVersion:',u.value.latestVersion);
    console.log('New latestVersionCode:',u.value.latestVersionCode);
    process.exit(0);
  }catch(e){console.error('ERR:',e.message);process.exit(1);}
})();