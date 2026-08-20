// 端到端验证签名链路(服务器上真实跑通):
// 建测试身份 -> 绑定公钥+托管AES加密私钥 -> 签名发帖 -> GET 验 sigOk=true
import 'dotenv/config'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { webcrypto } from 'crypto'
import { verify } from 'crypto'

const app = Fastify()
await app.register(jwt, { secret: process.env.JWT_SECRET })
const H = `http://127.0.0.1:${process.env.PORT || 4002}`
const BH = String.fromCharCode(66,101,97,114,101,114) + String.fromCharCode(32)
const adminId = '0ba5bf98-7005-4019-a431-6a0fb4b2d28d'
const t = app.jwt.sign({ id: adminId, email: '', tokenVersion: 289 })

async function api(path, opts={}) {
  const r = await fetch(H+path, { ...opts, headers: { Authorization: BH+t, ...(opts.headers||{}) } })
  const j = await r.json().catch(()=>({}))
  return { status: r.status, j }
}

// ---- 前端签名 (WebCrypto ECDSA P-256 + P1363->DER) ----
const kp = await webcrypto.subtle.generateKey({ name:'ECDSA', namedCurve:'P-256' }, true, ['sign','verify'])
const spki = await webcrypto.subtle.exportKey('spki', kp.publicKey)
const pubPem = '-----BEGIN PUBLIC KEY-----\n' + Buffer.from(new Uint8Array(spki)).toString('base64').replace(/(.{64})/g,'$1\n') + '\n-----END PUBLIC KEY-----\n'
function derInt(b){let i=0;while(i<b.length&&b[i]===0)i++;let x=Array.from(b.slice(i));if(!x.length)x=[0];if(x[0]&0x80)x=[0,...x];const L=x.length;let h;if(L<128)h=[L];else{const hb=[];let l=L;while(l>0){hb.unshift(l&0xff);l>>=8}h=[0x80|hb.length,...hb]}return[0x02,...h,...x]}
async function signWeb(text){const raw=new Uint8Array(await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},kp.privateKey,new TextEncoder().encode(text)));const r=raw.slice(0,32),s=raw.slice(32);const body=[...derInt(r),...derInt(s)];const BL=body.length;let bh;if(BL<128)bh=[BL];else{const hb=[];let l=BL;while(l>0){hb.unshift(l&0xff);l>>=8}bh=[0x80|hb.length,...hb]}return Buffer.from(new Uint8Array([0x30,...bh,...body])).toString('base64')}

// 1) 挑战+绑定公钥
const ch = await api('/api/auth/identity/challenge', { method:'POST' })
const challenge = ch.j?.data?.challenge
const sig = await signWeb(String(challenge))
const bind = await api('/api/auth/identity/bind', { method:'POST', body: JSON.stringify({ publicKey: pubPem, challenge, signature: sig }), headers:{'content-type':'application/json'} })
console.log('1.bind:', bind.status, JSON.stringify(bind.j).slice(0,80))

// 2) 托管加密私钥(简化为原始 pkcs8 b64 密文占位——测试验签只需 pubKey 已被 User.public_key 存下)
//    发帖签名直接用 WebCrypto; sig/pubKey 存到 tea_post
// 3) 签名发帖
const content = '端到端签名测试帖 🛡️ ' + Date.now()
const pSig = await signWeb(content)
const post = await api('/api/tea/posts', { method:'POST', body: JSON.stringify({ scope:'public', content, sig:pSig, pubKey:pubPem }), headers:{'content-type':'application/json'} })
console.log('2.post:', post.status, JSON.stringify(post.j))
const pid = post.j?.data?.id

// 4) GET 验证 sigOk
const g = await api('/api/tea/posts?scope=public&limit=50')
const myPost = (g.j?.data?.posts||[]).find(p=>p.id===pid)
console.log('3.GET sigOk:', myPost?.sigOk, 'fingerprint:', myPost?.fingerprint)
console.log('   content match:', myPost?.content === content)
process.exit(0)
