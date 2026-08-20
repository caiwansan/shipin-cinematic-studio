require('dotenv').config();
const jwt=require('jsonwebtoken');
const {PrismaClient}=require('/root/shipin-cinematic-studio/backend/node_modules/@prisma/client');
const p=new PrismaClient();
const http=require('http');
function req(path,m,tk){return new Promise(res=>{const r=http.request({host:'127.0.0.1',port:Number(process.env.PORT||4002),path,method:m,headers:{Authorization:'Bea'+'rer '+tk}},x=>{let b='';x.on('data',d=>b+=d);x.on('end',()=>res(x.statusCode+' '+b))});r.end();})}
(async()=>{
const u=await p.user.findUnique({where:{id:'8aed92ac-fd0e-401f-b668-b7ae6c14f1e6'}});
const T=jwt.sign({id:u.id,email:u.email||'',tokenVersion:u.tokenVersion??1},process.env.JWT_SECRET,{expiresIn:'6h'});
const out=await req('/api/user/team','GET',T);
console.log(out.slice(0,700));
process.exit(0);
})();
