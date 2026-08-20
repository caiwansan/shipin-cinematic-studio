import { prisma } from './index.js'

// 客户端真实 IP：优先 X-Real-IP（nginx 覆写，防伪造）；其次 X-Forwarded-For 首项；最后 socket IP
export function getClientIp(request: any): string {
  let ip = ''
  const real = request?.headers?.['x-real-ip']
  if (real) {
    ip = String(real)
  } else {
    const fwd = request?.headers?.['x-forwarded-for']
    if (fwd) {
      ip = String(fwd).split(',')[0] || ''
    } else {
      ip = request?.ip || ''
    }
  }
  return String(ip).trim().replace(/^::ffff:/i, '')
}

// 会话版本策略：
// - 同一 IP 登录 → 不递增 tokenVersion（新 token 与旧 token 并存 → 同机多端同时在线）
// - 不同 IP 登录 → 递增 tokenVersion（旧 IP 签发的所有 token 立即失效 → 跨电脑/跨网络互踢）
export async function nextTokenVersion(user: any, ip: string): Promise<number> {
  const curVer = user.tokenVersion || 1
  const sameIp = !!user.activeIp && user.activeIp === ip
  if (sameIp) {
    await prisma.user.update({ where: { id: user.id }, data: { activeIp: ip } }).catch(() => {})
    return curVer
  }
  const newVer = curVer + 1
  await prisma.user.update({ where: { id: user.id }, data: { tokenVersion: newVer, activeIp: ip } }).catch(() => {})
  return newVer
}
