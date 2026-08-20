# -*- coding: utf-8 -*-
star=chr(42)*3
f='/root/shipin-cinematic-studio/backend/e2e_famgroups.mts'
s=open(f,encoding='utf-8').read()
s=s.replace('Authorization: '+chr(39)+star+chr(39)+' + t', 'Authorization: '+chr(39)+'Bearer '+' '+chr(39)+' + t')
open(f,'w',encoding='utf-8').write(s)
print('patched; has Bearer:', 'Bearer' in s)
