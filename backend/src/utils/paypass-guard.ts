// paypass-guard.ts — 昆仑茶馆统一支付密码强制校验（红包/礼物/转账/提现/兑换）
// 规则：任何用户必须先设置支付密码（未设置 → PAYPASS_NOT_SET，客户端引导去设置）；
//       操作时需携带正确 paypass，或 120 秒内通过 /api/tea/paypass/verify 验证过
//       （兼容旧客户端「先验后发」流程）。
import { createHash } from 'crypto'
import { prisma } from './index.js'

const VERIFY_TTL_MS = 120_000
const lastVerify = new Map<string, number>()

export function paypassHash(p: string) {
  return createHash('sha256').update('tea-paypass|' + p).digest('hex')
}

export async function getPaypassData(uid: string): Promise<any> {
  try {
    const rows: any = await prisma.$queryRawUnsafe(`SELECT security_data FROM user_setting WHERE user_uid=$1`, uid)
    if (rows.length && rows[0].security_data) {
      try { return JSON.parse(rows[0].security_data) } catch { }
    }
  } catch { /* 查询异常按未设置处理 */ }
  return null
}

/** /api/tea/paypass/verify 成功后调用，标记该用户 120s 内已验证 */
export function markPaypassVerified(uid: string) {
  lastVerify.set(uid, Date.now())
}

function recentlyVerified(uid: string): boolean {
  const t = lastVerify.get(uid)
  if (t && Date.now() - t < VERIFY_TTL_MS) return true
  lastVerify.delete(uid)
  return false
}

/** 强制校验：未设置抛 PAYPASS_NOT_SET；密码不符且近期未通过 verify 抛 NEED_PAYPASS */
export async function requirePaypass(uid: string, pass?: any): Promise<void> {
  const d = await getPaypassData(uid)
  if (!d || !d.set || !d.pass) throw new Error('PAYPASS_NOT_SET')
  if (typeof pass === 'string' && pass.length > 0 && paypassHash(pass) === d.pass) return
  if (recentlyVerified(uid)) return
  throw new Error('NEED_PAYPASS')
}
