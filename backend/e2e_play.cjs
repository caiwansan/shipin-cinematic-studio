const crypto=require('crypto'), http=require('http'), fs=require('fs');
const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient();
(async()=>{
  const env=fs.readFileSync('/root/shipin-cinematic-studio/backend/.env','utf8');
  const sec=(env.match(/JWT_SECRET\s*=\s*["']?([^\s"']+)/)||[])[1];
  const uid='0ba5bf98-7005-4019-a431-6a0fb4b2d28d';
  const u=await p.user.findUnique({where:{id:uid}});
  const now=Math.floor(Date.now()/1000);
  const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
  const data=b64({alg:'HS256',typ:'JWT'})+'.'+b64({id:uid,email:(u.email||''),tokenVersion:u.tokenVersion,iat:now,exp:now+600});
  const token=data + String.fromCharCode(46) + crypto.createHmac('sha256',sec).update(data).digest('base64url');
  function R(path,m,b){return new Promise(res=>{const r=http.request({host:'127.0.0.1',port:4002,path,method:m||'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'}},x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>res({code:x.statusCode,body:d}));});r.on('error',e=>res({code:'ERR',body:e.message}));if(b)r.write(JSON.stringify(b));r.end();});}
  const show=async(label,pth,m,b)=>{const r=await R(pth,m,b);console.log('\n['+label+'] '+pth+' -> '+r.code);console.log(String(r.body).slice(0,400).replace(/\n/g,' '));};
  await show('签到状态','/api/tea/checkin/status');
  await show('签到','/api/tea/checkin/sign','POST',{});
  await show('签到状态2','/api/tea/checkin/status');
  await show('封神榜','/api/tea/leaderboard?limit=5');
  await show('支付密码状态','/api/tea/paypass/status');
  await show('设置支付密码','/api/tea/paypass/set','POST',{pass:'123456'});
  await show('支付密码校验','/api/tea/paypass/verify','POST',{pass:'123456'});
  await show('支付密码错误','/api/tea/paypass/verify','POST',{pass:'wrong'});
  await show('飞升台汇率','/api/tea/exchange/rate');
  await show('飞升台·工分→茶票(工分不足)','/api/tea/exchange/do','POST',{direction:'gongfen_to_chapiao',amount:5});
  // 竞猜
  await show('今日竞猜','/api/tea/quiz/today');
  const t=JSON.parse((await R('/api/tea/quiz/today')).body);
  const qid=t.data.quiz.id;
  await show('竞猜下注','/api/tea/quiz/bet','POST',{quizId:qid,option:0,amount:3});
  await show('竞猜下注重复','/api/tea/quiz/bet','POST',{quizId:qid,option:1,amount:3});
  await show('竞猜结果','/api/tea/quiz/result?quizId='+qid);
  await show('余额','/api/tea/wallet');
  process.exit(0);
})().catch(e=>{console.error('FATAL',e.message);process.exit(1)});
