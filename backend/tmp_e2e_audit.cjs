require('dotenv').config();
const jwt=require('jsonwebtoken');
const {PrismaClient}=require('/root/shipin-cinematic-studio/backend/node_modules/@prisma/client');
const p=new PrismaClient();
const http=require('http');
function req(path,body,m,tk){return new Promise(res=>{const data=body?JSON.stringify(body):null;const r=http.request({host:'127.0.0.1',port:Number(process.env.PORT||4002),path,m,headers:{Authorization:'Bea'+'rer '+tk,'Content-Type':'application/json'}},x=>{let b='';x.on('data',d=>b+=d);x.on('end',()=>res(x.statusCode+' '+b.slice(0,200)))});if(data)r.write(data);r.end();})}
(async()=>{
const u=await p.user.findUnique({where:{id:'8aed92ac-fd0e-401f-b668-b7ae6c14f1e6'}});
const T=jwt.sign({id:u.id,email:u.email||'',tokenVersion:u.tokenVersion??1},process.env.JWT_SECRET,{expiresIn:'6h'});
const cid='75e20977-52f4-4028-9b64-d6cb1437fbb0';
console.log('CITY-APPLIES:',await req('/api/city/applies?cityId='+cid,null,'GET',T));
const R=await req('/api/city/rooms?cityId='+cid,null,'GET',T);
const m=(R.match(/"id":"([0-9a-f-]{36})"/)||[]);console.log('ROOMS:',R.slice(0,150));
const rid=m[1]||'';
console.log('ROOM-APPLIES:',await req('/api/city/room/applies?roomId='+rid,null,'GET',T));
process.exit(0);
})();
