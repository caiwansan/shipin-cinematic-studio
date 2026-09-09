const{PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  try{
    const cfg=await p.routeConfig.findFirst({where:{scope:'tea',key:'config'}});
    if(!cfg){console.log('NOT_FOUND');process.exit(1);}
    console.log('cfg found, id:',cfg.id);
    console.log('value type:',typeof cfg.value);
    if(typeof cfg.value==='string'){
      const v=JSON.parse(cfg.value);
      console.log('latestVersion:',v.latestVersion);
      console.log('latestVersionCode:',v.latestVersionCode);
    }else{
      console.log('value:',JSON.stringify(cfg.value).slice(0,200));
    }
    process.exit(0);
  }catch(e){console.error('ERR:',e.message);process.exit(1);}
})();