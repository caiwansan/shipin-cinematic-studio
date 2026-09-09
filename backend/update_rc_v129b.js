const{PrismaClient}=require("@prisma/client");
const p=new PrismaClient();
(async()=>{
  try{
    const cfg=await p.routeConfig.findFirst({where:{scope:"tea",key:"config"}});
    if(!cfg){console.error("NOT_FOUND");process.exit(1);}
    const v = typeof cfg.value === 'string' ? JSON.parse(cfg.value) : cfg.value;
    v.apkSha256="8F14AC73A3ECE082EB1ACEABCD44EF54D1DEE2E389776A800FD7BB26F1E32734";
    v.apkSize=50914020;
    v.latestVersion="1.2.9";
    v.latestVersionCode="1209";
    v.apkUrl="https://aigc.fushtn.com/releases/desktop/mobile/kunlun-tea-NATIVE-v1.2.9.apk";
    v.updatedAt=new Date().toISOString();
    await p.routeConfig.update({where:{id:cfg.id},data:{value:v}});
    console.log("OK");
    process.exit(0);
  }catch(e){console.error("ERR:",e.message);process.exit(1);}
})();