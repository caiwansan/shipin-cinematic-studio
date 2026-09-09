export default defineEventHandler((event) => {
  const query = getQuery(event)
  const g = query.g as string
  
  if (!g) {
    setResponseStatus(event, 400)
    return 'Invalid link'
  }

  setResponseHeader(event, 'Content-Type', 'text/html; charset=utf-8')
  
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Join Group</title></head><body style="font-family:-apple-system,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f5f5f5;margin:0"><div style="background:#fff;border-radius:16px;padding:32px;max-width:400px;width:90%;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.1)"><h2 style="margin-bottom:16px;color:#333">加入群聊</h2><div style="color:#666;margin-bottom:24px" id="info">Loading...</div><button id="btn" onclick="join()" disabled style="padding:12px 32px;background:#07c160;color:#fff;border:none;border-radius:8px;font-size:16px;cursor:pointer">加入群聊</button><div id="msg" style="margin-top:16px"></div></div><script>var g="${g}",b=document.getElementById("btn"),i=document.getElementById("info"),m=document.getElementById("msg");i.textContent=g;b.disabled=false;function join(){b.disabled=true;b.textContent="加入中...";var t=localStorage.getItem("token")||"";fetch("/api/im/groups/"+encodeURIComponent(g)+"/join",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+t}}).then(function(r){return r.json()}).then(function(d){if(d.success){m.innerHTML=d.data&&d.data.pending?"<span style=color:green>已提交申请，等待审批</span>":"<span style=color:green>加入成功！</span>";b.textContent="已加入"}else{m.innerHTML="<span style=color:red>"+(d.error||"失败")+"</span>";b.disabled=false;b.textContent="加入群聊"}}).catch(function(){m.innerHTML="<span style=color:red>网络错误</span>";b.disabled=false;b.textContent="加入群聊"})}</script></body></html>`
})
