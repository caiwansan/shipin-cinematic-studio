const{PrismaClient}=require("@prisma/client");
const p=new PrismaClient();
(async()=>{
  try{
    const cfg=await p.routeConfig.findFirst({where:{scope:"tea",key:"config"}});
    if(!cfg){console.error("NOT_FOUND");process.exit(1);}
    const v = typeof cfg.value === 'string' ? JSON.parse(cfg.value) : cfg.value;
    v.apkSha256="77BC178C0C576746D7F7A6CAAF5EDBAEF469F8E77F51615E1357816E4C8E4F52";
    v.apkSize=50914020;
    v.latestVersion="1.2.9";
    v.latestVersionCode="1209";
    v.apkUrl="https://aigc.fushtn.com/releases/desktop/mobile/kunlun-tea-NATIVE-v1.2.9.apk";
    v.updatedAt=new Date().toISOString();
    await p.routeConfig.update({where:{id:cfg.id},data:{value:v}});
    console.log("OK: routeConfig updated to v1.2.9");
    process.exit(0);
  }catch(e){console.error("ERR:",e.message);process.exit(1);}
})();