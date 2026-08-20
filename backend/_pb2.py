star=chr(42)*3
q=chr(39)
f='/root/shipin-cinematic-studio/backend/e2e_fgroups2.mts'
s=open(f,encoding='utf-8').read()
s=s.replace(q+star+q, q+'Bearer '+q)  # '***' -> 'Bearer '
open(f,'w',encoding='utf-8').write(s)
print('replaced; auth line:', [l for l in s.split('\n') if 'Authorization' in l])
