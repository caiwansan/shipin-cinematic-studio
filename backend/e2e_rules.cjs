const crypto=require('crypto'), http=require('http'), fs=require('fs');
const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient();
(async()=>{
  const env=fs.readFileSync('/root/shipin-cinematic-studio/backend/.env','utf8');
  const sec=(env.match(/JWT_SECRET\s*=\s*["']?([^\s"']+)/)||[])[1];
  // 用北屋用户(有169工分，可测飞升台工分→茶票；茶票100可测茶票被拒)
  const uid='b99a4589-a05b-422d-9bf4-970d940141e0';
  const u=await p.user.findUnique({where:{id:uid}});
  const now=Math.floor(Date.now()/1000);
  const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
  const data=b64({alg:'HS256',typ:'JWT'}) + String.fromCharCode(46) + b64({id:uid,email:(u.email||''),tokenVersion:u.tokenVersion,iat:now,exp:now+600});
  const token=data + String.fromCharCode(46) + crypto.createHmac('sha256',sec).update(data).digest('base64url');
  function R(path,m,b){return new Promise(res=>{const r=http.request({host:'127.0.0.1',port:4002,path,method:m||'GET',headers:{Authorization:'***'+token,'Content-Type':'application/json'}},x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>res({code:x.statusCode,body:d}));});r.on('error',e=>res({code:'ERR',body:e.message}));if(b)r.write(JSON.stringify(b));r.end();});}
  const show=async(label,pth,m,b)=>{const r=await R(pth,m,b);console.log('\n['+label+'] '+pth+' -> '+r.code);console.log(String(r.body).slice(0,350).replace(/\n/g,' '));};
  await show('飞升台·工分→茶票(5工分)','/api/tea/exchange/do','POST',{direction:'gongfen_to_chapiao',amount:5});
  await show('飞升台·茶票→工分(应拒)','/api/tea/exchange/do','POST',{direction:'chapiao_to_gongfen',amount:5});
  await show('竞猜下注(11工分应拒)','/api/tea/quiz/today','GET');
  const t=JSON.parse((await R('/api/tea/quiz/today')).body);
  const qid=t.data.quiz.id;
  await show('竞猜下注(11工分>10应拒)','/api/tea/quiz/bet','POST',{quizId:qid,option:0,amount:11});
  await show('竞猜下注(5工分应OK)','/api/tea/quiz/bet','POST',{quizId:qid,option:1,amount:5});
  await show('茶票分布节点','/api/tea/chain/distribution');
  process.exit(0);
})().catch(e=>{console.error('FATAL',e.message);process.exit(1)});
