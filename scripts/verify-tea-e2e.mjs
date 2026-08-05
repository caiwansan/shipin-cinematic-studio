// 昆仑茶馆端到端验证：登录 → /chat → 连接 → 发消息 → 收消息
// 用法: node scripts/verify-tea-e2e.mjs
import { spawn } from 'node:child_process'

const CHROME = '/opt/google/chrome/chrome'
const BASE = 'https://aigc.fushtn.com'
const LOGIN = { email: 'tenant_org_test@audit.local', password: 'AuditTest@123' }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 1. 登录拿 token
const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(LOGIN),
})
const loginJson = await loginRes.json()
const token = loginJson.accessToken
if (!token) {
  console.log('❌ 登录失败:', JSON.stringify(loginJson).slice(0, 200))
  process.exit(1)
}
console.log('✅ 登录成功, token 前 12 位:', token.slice(0, 12))

// 2. 启动 headless chrome（持久 profile，注入 localStorage）
const userDataDir = '/tmp/chrome-tea-e2e'
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  `--user-data-dir=${userDataDir}`,
  '--remote-debugging-port=9333',
  'about:blank',
])
console.log('🔄 chrome 启动中...')
await sleep(3000)

// 3. CDP 连接（先查 /json/list 拿 page target 的 ws url）
let wsUrl = null
for (let i = 0; i < 10 && !wsUrl; i++) {
  try {
    const list = await (await fetch('http://127.0.0.1:9333/json/list')).json()
    wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl
  } catch {}
  if (!wsUrl) await sleep(1000)
}
if (!wsUrl) {
  console.log('❌ 无法获取 CDP ws url')
  process.exit(1)
}
console.log('🔄 CDP 连接:', wsUrl.slice(0, 60), '...')
const ws = new WebSocket(wsUrl)
let id = 0
const pending = new Map()
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const msgId = ++id
    pending.set(msgId, resolve)
    ws.send(JSON.stringify({ id: msgId, method, params }))
  })
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result)
    pending.delete(msg.id)
  }
}
await new Promise((r) => (ws.onopen = r))

// 4. 打开登录页并注入 token（直接设置 localStorage + cookie 后导航 /chat）
await send('Page.navigate', { url: `${BASE}/login` })
await sleep(2500)
await send('Runtime.evaluate', {
  expression: `localStorage.setItem('auth_token', ${JSON.stringify(token)}); localStorage.setItem('accessToken', ${JSON.stringify(token)}); 'ok'`,
})
console.log('✅ token 已注入 localStorage')

// 5. 导航到 /chat
await send('Page.navigate', { url: `${BASE}/chat` })
await sleep(12000) // 等 SDK 连接 + 历史加载

// 6. 读页面状态
const stateRes = await send('Runtime.evaluate', {
  expression: `(() => {
    const statusEl = document.querySelector('.tea-status');
    const rows = [...document.querySelectorAll('.msg-row')];
    const bubbles = rows.map(r => r.querySelector('.msg-content')?.textContent?.trim() || '');
    return {
      status: statusEl ? statusEl.textContent.trim() : '未找到状态徽标',
      msgCount: rows.length,
      bubbles: bubbles.slice(0, 5),
      connected: !!document.querySelector('.tea-status.is-on'),
    };
  })()`,
  returnByValue: true,
})
const state = stateRes?.result?.value || {}
console.log('📊 页面状态:', JSON.stringify(state, null, 2))

// 7. 发一条消息（分两步：先输入等 Vue 更新，再点发送）
const inputRes = await send('Runtime.evaluate', {
  expression: `(() => {
    const ta = document.querySelector('.msg-input');
    if (!ta) return { ok: false, reason: '无输入框' };
    ta.value = '🫖 E2E验证：昆仑茶馆开张大吉！';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    return { ok: true };
  })()`,
  returnByValue: true,
})
console.log('📝 输入操作:', JSON.stringify(inputRes?.result?.value || {}))
await sleep(800)
const beforeSend = await send('Runtime.evaluate', {
  expression: `(() => {
    const ta = document.querySelector('.msg-input');
    const btn = document.querySelector('.tea-btn.primary');
    return { draft: ta?.value || '', btnDisabled: btn?.disabled ?? null };
  })()`,
  returnByValue: true,
})
console.log('📋 点击前状态:', JSON.stringify(beforeSend?.result?.value || {}))
await send('Runtime.evaluate', {
  expression: `document.querySelector('.tea-btn.primary')?.click(); 'clicked'`,
  returnByValue: true,
})

// 8. 等消息送达后读状态
await sleep(5000)
const afterRes = await send('Runtime.evaluate', {
  expression: `(() => {
    const rows = [...document.querySelectorAll('.msg-row')];
    const texts = rows.map(r => r.querySelector('.msg-content')?.textContent?.trim() || '');
    return { msgCount: rows.length, last3: texts.slice(-3) };
  })()`,
  returnByValue: true,
})
const after = afterRes?.result?.value || {}
console.log('📊 发送后:', JSON.stringify(after, null, 2))

// 9. 三栏控制台验证
const panelRes = await send('Runtime.evaluate', {
  expression: `(() => {
    const sidebar = !!document.querySelector('.tea-sidebar');
    const chat = !!document.querySelector('.tea-chat');
    const panel = !!document.querySelector('.tea-panel');
    const tabs = [...document.querySelectorAll('.panel-tab')].map(t => t.textContent.trim());
    const sideGroups = [...document.querySelectorAll('.side-group-title')].map(t => t.textContent.trim());
    const memberCount = document.querySelectorAll('.member-item').length;
    const chatHead = document.querySelector('.chat-head-name')?.textContent?.trim() || '';
    return { sidebar, chat, panel, tabs, sideGroups, memberCount, chatHead };
  })()`,
  returnByValue: true,
})
const panel = panelRes?.result?.value || {}
console.log('📐 三栏结构:', JSON.stringify(panel, null, 2))

// 10. 切好友 tab → 点好友 → 应弹独立下拉菜单（不再直接切中栏）
const friendRes = await send('Runtime.evaluate', {
  expression: `(() => {
    const tabs = [...document.querySelectorAll('.panel-tab')];
    const friendTab = tabs.find(t => t.textContent.trim() === '好友');
    if (!friendTab) return { ok: false, reason: '无好友tab' };
    friendTab.click();
    return { ok: true };
  })()`,
  returnByValue: true,
})
console.log('📋 切好友tab:', JSON.stringify(friendRes?.result?.value || {}))
await sleep(1000)
const friendListRes = await send('Runtime.evaluate', {
  expression: `(() => {
    const items = [...document.querySelectorAll('.tea-panel .member-item.clickable')];
    return { friendCount: items.length, first: items[0]?.querySelector('.member-name')?.textContent?.trim() || '' };
  })()`,
  returnByValue: true,
})
console.log('👥 好友列表:', JSON.stringify(friendListRes?.result?.value || {}))

// 11b. 点第一个好友 → 验证弹出独立菜单（body 滚动锁定 + fixed 弹层）
const openMenuRes = await send('Runtime.evaluate', {
  expression: `(() => {
    const item = document.querySelector('.tea-panel .member-item.clickable');
    if (!item) return { ok: false, reason: '无好友可点' };
    item.click();
    return { ok: true };
  })()`,
  returnByValue: true,
})
await sleep(600)
const menuRes = await send('Runtime.evaluate', {
  expression: `(() => {
    const menu = document.querySelector('.friend-menu');
    if (!menu) return { menu: false, bodyOverflow: document.body.style.overflow };
    const style = getComputedStyle(menu);
    const rect = menu.getBoundingClientRect();
    const items = [...menu.querySelectorAll('.friend-menu-item')].map(b => b.textContent.trim());
    const name = menu.querySelector('.friend-menu-name')?.textContent?.trim() || '';
    return {
      menu: true,
      name,
      items,
      position: style.position,
      inBody: menu.parentElement === document.body,
      left: Math.round(rect.left), top: Math.round(rect.top),
      bodyOverflow: document.body.style.overflow,
      chatHead: document.querySelector('.chat-head-name')?.textContent?.trim() || '',
    };
  })()`,
  returnByValue: true,
})
const menu = menuRes?.result?.value || {}
console.log('🍵 好友菜单:', JSON.stringify(menu, null, 2))

// 11c. 菜单点「💬 发消息」→ 进入私聊
const menuClickSend = await send('Runtime.evaluate', {
  expression: `(() => {
    const btn = [...document.querySelectorAll('.friend-menu-item')].find(b => b.textContent.includes('发消息'));
    if (!btn) return { ok: false, reason: '无发消息按钮' };
    btn.click();
    return { ok: true };
  })()`,
  returnByValue: true,
})
await sleep(3500)
const dmStateRes = await send('Runtime.evaluate', {
  expression: `(() => {
    const head = document.querySelector('.chat-head-name')?.textContent?.trim() || '';
    const menuGone = !document.querySelector('.friend-menu');
    const unlocked = document.body.style.overflow === '';
    return { chatHead: head, menuGone, unlocked };
  })()`,
  returnByValue: true,
})
console.log('💬 发消息后:', JSON.stringify(dmStateRes?.result?.value || {}))

// 11d. 回好友 tab 再点 → 菜单点「👤 查看资料」→ 右栏资料卡
await send('Runtime.evaluate', {
  expression: `(() => {
    const tabs = [...document.querySelectorAll('.panel-tab')];
    tabs.find(t => t.textContent.trim() === '好友')?.click();
    return 'ok';
  })()`,
  returnByValue: true,
})
await sleep(800)
await send('Runtime.evaluate', {
  expression: `document.querySelector('.tea-panel .member-item.clickable')?.click(); 'ok'`,
  returnByValue: true,
})
await sleep(600)
const menuProfileRes = await send('Runtime.evaluate', {
  expression: `(() => {
    const btn = [...document.querySelectorAll('.friend-menu-item')].find(b => b.textContent.includes('查看资料'));
    if (!btn) return { ok: false, reason: '无查看资料按钮' };
    btn.click();
    return { ok: true };
  })()`,
  returnByValue: true,
})
await sleep(800)
const profileRes = await send('Runtime.evaluate', {
  expression: `(() => {
    const card = document.querySelector('.peer-card');
    const activeTab = [...document.querySelectorAll('.panel-tab')].find(t => t.classList.contains('active'))?.textContent?.trim();
    return {
      card: !!card,
      cardName: card?.querySelector('.peer-name')?.textContent?.trim() || '',
      activeTab,
      chatHead: document.querySelector('.chat-head-name')?.textContent?.trim() || '',
    };
  })()`,
  returnByValue: true,
})
console.log('👤 查看资料后:', JSON.stringify(profileRes?.result?.value || {}))

// 11e. Esc 关闭菜单验证：再点好友 → Esc → 菜单消失 + 滚动解锁
await send('Runtime.evaluate', {
  expression: `document.querySelector('.tea-panel .member-item.clickable')?.click(); 'ok'`,
  returnByValue: true,
})
await sleep(600)
const escRes = await send('Runtime.evaluate', {
  expression: `(() => {
    const menuOpen = !!document.querySelector('.friend-menu');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return { menuOpen };
  })()`,
  returnByValue: true,
})
await sleep(400)
const escAfter = await send('Runtime.evaluate', {
  expression: `(() => ({ menuGone: !document.querySelector('.friend-menu'), unlocked: document.body.style.overflow === '' }))()`,
  returnByValue: true,
})
console.log('🛡 Esc关闭:', JSON.stringify(escRes?.result?.value || {}), '→', JSON.stringify(escAfter?.result?.value || {}))

ws.close()
chrome.kill()
console.log('🎉 E2E 验证完成')
process.exit(0)
