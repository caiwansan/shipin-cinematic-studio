star=chr(42)*3
q=chr(39)
f='/root/shipin-cinematic-studio/backend/e2e_fgroups2.mts'
s=open(f,encoding='utf-8').read()
s=s.replace('Authorization:'+q+star+q+' + t','Authorization:'+q+'Bearer '+q+' + t')
open(f,'w',encoding='utf-8').write(s)
