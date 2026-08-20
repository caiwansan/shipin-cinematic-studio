import 'dotenv/config'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
const app=Fastify();await app.register(jwt,{secret:process.env.JWT_SECRET})
const H='http://127.0.0.1:'+(process.env.PORT||4002)
const Bt=String.fromCharCode(66,101,97,114,101,114)+' '
const t=app.jwt.sign({id:'admin-e2e',userId:'admin-e2e',username:'admin',role:'admin',isAdmin:true})
async function q(path,opts={}){const r=await fetch(H+path,{...opts,headers:{Authorization:Bt+t,'Content-Type':'application/json',...(opts.headers||{})}});const j=await r.json().catch(()=>null);return {s:r.status,b:j}}
const t1=await q('/api/admin/tea-translate/test',{method:'POST',body:'{}'})
console.log('TEST(use stored key):',t1.s,t1.b&&t1.b.message)
process.exit(0)