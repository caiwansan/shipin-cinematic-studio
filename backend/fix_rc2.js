const{PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  try{
    const cfg=await p.routeConfig.findFirst({where:{scope:'tea',key:'config'}});
    if(!cfg){console.log('NOT_FOUND');process.exit(1);}
    
    // Value is a string, parse it
    const v=JSON.parse(cfg.value);
    console.log('Current latestVersion:',v.latestVersion);
    
    // Update values
    v.apkSha256='7B08DE689AAE941406ECC98509C2AB68A0F32DD64A88192EE76075A9DFFA3570';
    v.apkSize=50992664;
    v.latestVersion='1.2.7';
    v.latestVersionCode='1207';
    v.apkUrl='https://aigc.fushtn.com/releases/desktop/mobile/kunlun-tea-NATIVE-v1.2.7.apk';
    v.updatedAt=new Date().toISOString();
    
    // Update with the modified object
    await p.routeConfig.update({where:{id:cfg.id},data:{value:v}});
    
    // Verify
    const cfg2=await p.routeConfig.findFirst({where:{scope:'tea',key:'config'}});
    const v2=JSON.parse(cfg2.value);
    console.log('Updated latestVersion:',v2.latestVersion);
    console.log('Updated latestVersionCode:',v2.latestVersionCode);
    console.log('Updated apkSize:',v2.apkSize);
    process.exit(0);
  }catch(e){console.error('ERR:',e.message);process.exit(1);}
})();