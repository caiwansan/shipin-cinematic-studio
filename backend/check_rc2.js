const{PrismaClient}=require("@prisma/client");
const p=new PrismaClient();
(async()=>{
  try{
    const cfg=await p.routeConfig.findFirst({where:{scope:"tea",key:"config"}});
    if(!cfg){console.log("NOT_FOUND");process.exit(1);}
    console.log("TYPE:" + typeof cfg.value);
    console.log("VAL:" + cfg.value.substring(0,500));
    process.exit(0);
  }catch(e){console.error("ERR:",e.message);process.exit(1);}
})();