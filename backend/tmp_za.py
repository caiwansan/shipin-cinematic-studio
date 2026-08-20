import json,urllib.request;H='http://127.0.0.1:4002';T='0ba5bf98-7005-4019-a431-6a0fb4b2d28d'
def q(p,body=None,m='GET'):
    req=urllib.request.Request(H+p,data=json.dumps(body).encode() if body else None,method=m)
    req.add_header('Authorization','Bearer '+T)
    if body: req.add_header('Content-Type','application/json')
    try:
        r=urllib.request.urlopen(req);return r.status,r.read().decode()[:200]
    except Exception as e:
        st=getattr(e,'code',None);bd=getattr(e,'read',lambda:b'')();
        if st==400 or st==500:
            try:return st,e.read().decode()[:200]
            except:return st,str(bd)[:200]
        return '?'+str(e),str(e)[:200]
L=q('/api/city/list');print('LIST:',L)
import re
cc=re.findall(r'"id\":\s*\"([^\"]+)\"',L[1]);print('IDS:',cc[:3])
cid=cc[0] if cc else ''
for p in ['/api/city/election/status?cityId='+cid,'/api/city/detail-votes?cityId='+cid,'/api/city/close/status?cityId='+cid,'/api/city/partners?cityId='+cid,'/api/city/members?cityId='+cid]:
    print(p,'->',q(p))
print('INVITE ->',q('/api/city/invite',{'cityId':cid},'POST'))
