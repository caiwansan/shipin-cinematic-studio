require('dotenv').config();
const jwt=require('jsonwebtoken');
const {PrismaClient}=require('/root/shipin-cinematic-studio/backend/node_modules/@prisma/client');
const p=new PrismaClient();
const http=require('http');
function req(path,body,m,T){return new Promise(res=>{const data=body?JSON.stringify(body):null;const r=http.request({host:'127.0.0.1',port:Number(process.env.PORT||4002),path,m:m,headers:{Authorization:'Bearer '+T,'Content-Type':'application/json'}},x=>{let b='';x.on('data',d=>b+=d);x.on('end',()=>res(x.statusCode+' '+b.slice(0,150)))});if(data)r.write(data);r.end();})}
(async()=>{
const u=await p.user.findUnique({where:{id:'8aed92ac-fd0e-401f-b668-b7ae6c14f1e6'}});
const T=jwt.sign({id:u.id,email:u.email||'',tokenVersion:1},process.env.JWT_SECRET,{expiresIn:'6h'});
console.log('TOKEN_OK len',T.length);
console.log('ME:',await req('/api/auth/me',null,'GET',T));
process.exit(0);
})();
