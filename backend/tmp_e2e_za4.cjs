require('dotenv').config();
const jwt=require('jsonwebtoken');
const {PrismaClient}=require('/root/shipin-cinematic-studio/backend/node_modules/@prisma/client');
const p=new PrismaClient();
const http=require('http');
function req(path,body,m,tk){return new Promise(res=>{const data=body?JSON.stringify(body):null;const r=http.request({host:'127.0.0.1',port:Number(process.env.PORT||4002),path,m,headers:{Authorization:'Bearer '+tk,'Content-Type':'application/json'}},x=>{let b='';x.on('data',d=>b+=d);x.on('end',()=>res(x.statusCode+' '+b.slice(0,180)))});if(data)r.write(data);r.end();})}
(async()=>{
const u=await p.user.findUnique({where:{id:'8aed92ac-fd0e-401f-b668-b7ae6c14f1e6'}});
const T=jwt.sign({id:u.id,email:u.email||'',tokenVersion:u.tokenVersion??1},process.env.JWT_SECRET,{expiresIn:'6h'});
const cid='75e20977-52f4-4028-9b64-d6cb1437fbb0';
console.log('ELECT/STATUS:',await req('/api/city/election/status?cityId='+cid,null,'GET',T));
console.log('DETAIL-VOTES:',await req('/api/city/detail-votes?cityId='+cid,null,'GET',T));
console.log('CLOSE/STATUS:',await req('/api/city/close/status?cityId='+cid,null,'GET',T));
console.log('PARTNERS:',await req('/api/city/partners?cityId='+cid,null,'GET',T));
console.log('MEMBERS:',await req('/api/city/members?cityId='+cid,null,'GET',T));
console.log('INVITE:',await req('/api/city/invite',{cityId:cid},'POST',T));
process.exit(0);
})();
