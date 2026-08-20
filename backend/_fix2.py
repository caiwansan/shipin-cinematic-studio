f='/root/shipin-cinematic-studio/backend/e2e_famgroups.mts'
s=open(f,encoding='utf-8').read()
s=s.replace('Bearer'+chr(32)+chr(32), 'Bearer'+chr(32))
open(f,'w',encoding='utf-8').write(s)
print('ok:', "'Bearer ' + t" in s)
