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

// 已知 IP 记忆：登录过的 IP 进入列表（30 天内、最多 10 个），列表内 IP 登录视为"同一环境"共存
const KNOWN_IP_TTL_MS = 30 * 24 * 3600 * 1000
const KNOWN_IP_MAX = 10

function parseKnownIps(raw: any): Array<{ ip: string; at: number }> {
  try {
    if (typeof raw === 'string') {
      const arr = JSON.parse(raw)
      return Array.isArray(arr) ? arr : []
    }
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

// 会话版本策略：
// - 登录 IP 与 activeIp 相同，或该 IP 在 30 天已知列表内 → 不递增 tokenVersion（多端共存）
// - 全新 IP 登录 → 递增 tokenVersion（旧 token 全部失效，实现"新环境登录顶掉旧环境"）
export async function nextTokenVersion(user: any, ip: string): Promise<number> {
  const curVer = user.tokenVersion || 1
  const now = Date.now()
  let known = parseKnownIps(user.knownIps).filter(k => now - (k.at || 0) < KNOWN_IP_TTL_MS).slice(0, KNOWN_IP_MAX)
  const isKnown = known.some(k => k.ip === ip)
  const sameIp = !!user.activeIp && user.activeIp === ip

  if (sameIp || isKnown) {
    // 共存：不递增版本，只刷新 activeIp / 已知列表
    const nextKnown = [...known.filter(k => k.ip !== ip), { ip, at: now }].slice(-KNOWN_IP_MAX)
    await prisma.user.update({
      where: { id: user.id },
      data: { activeIp: ip, knownIps: JSON.stringify(nextKnown) },
    }).catch(() => {})
    return curVer
  }

  // 全新 IP：互踢（旧 token 全部失效）
  const newVer = curVer + 1
  const nextKnown = [...known, { ip, at: now }].slice(-KNOWN_IP_MAX)
  await prisma.user.update({
    where: { id: user.id },
    data: { tokenVersion: newVer, activeIp: ip, knownIps: JSON.stringify(nextKnown) },
  }).catch(() => {})
  return newVer
}
