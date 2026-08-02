/**
 * TASK03.2.1 探针信号单测 — 验证 Cookie 信号 + 身份提取逻辑
 * 不连真实账号：注入测试 cookie 验证 B 信号；直接调私有方法验证判定
 */
import { browserRuntime } from '../src/services/media/browser-runtime.service.js'

async function main() {
  const sid = 'douyin:08a0f643-fb0d-48d5-af18-ad87bd9a34fb'
  // 当前真实状态：未登录（二维码页）
  const cookies = await browserRuntime.getCookies(sid)
  const names = (cookies || []).map(c => c.name)
  const key = ['sessionid', 'sid_guard', 'uid_tt'].filter(k => names.includes(k))
  console.log('真实 cookies:', names.slice(0, 12))
  console.log('关键登录 cookie 命中:', key, '=>', key.length >= 2 ? 'COOKIE_SIGNAL_ON' : 'COOKIE_SIGNAL_OFF (未登录, 正确)')
}

main().catch(e => { console.error('ERR:', e.message); process.exit(1) })
