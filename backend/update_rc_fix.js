const{PrismaClient}=require("@prisma/client");
const p=new PrismaClient();
(async()=>{
  try{
    const cfg=await p.routeConfig.findFirst({where:{scope:"tea",key:"config"}});
    if(!cfg){console.error("NOT_FOUND");process.exit(1);}
    const v = typeof cfg.value === 'string' ? JSON.parse(cfg.value) : cfg.value;
    v.apkSha256="2E282D14AD3E4399752F35302C90C740FC62F3102C937BF2CFDB80FFA72C878B";
    v.apkSize=50914020;
    v.updatedAt=new Date().toISOString();
    await p.routeConfig.update({where:{id:cfg.id},data:{value:v}});
    console.log("OK");
    process.exit(0);
  }catch(e){console.error("ERR:",e.message);process.exit(1);}
})();