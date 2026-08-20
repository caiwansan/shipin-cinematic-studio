import json,urllib.request,re
env=open('/root/shipin-cinematic-studio/backend/.env').read()
m=re.search(r'PORT=?(\d+)',env);port=m.group(1) if m else '4002'
H='http://127.0.0.1:'+port
def q(p,body=None,tok='0ba5bf98-7005-4019-a431-6a0fb4b2d28d',m='GET'):
    req=urllib.request.Request(H+p,data=json.dumps(body).encode() if body else None,method=m)
    req.add_header('Authorization','Bearer '+tok)
    if body: req.add_header('Content-Type','application/json')
    try:
        r=urllib.request.urlopen(req);return r.status,r.read().decode()[:120]
    except Exception as e:
        return getattr(e,'code','ERR'),str(e)[:120]
print('PORT',port)
print('ME:',q('/api/auth/me'))
print('CITIES:',q('/api/city/list'))
