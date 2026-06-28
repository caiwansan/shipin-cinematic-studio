/**
 * 手机号脱敏：138xxxx0000
 * 保留前3位 + **** + 后4位
 * 非手机号格式原样返回
 */
export function maskPhone(phone: string | null | undefined): string | null | undefined {
  if (!phone) return phone
  // 支持 11 位手机号或带国家码格式 +86138xxxx0000
  const cleaned = phone.replace(/[^0-9]/g, '')
  if (cleaned.length === 11) {
    return cleaned.slice(0, 3) + '****' + cleaned.slice(7)
  }
  if (cleaned.length > 11) {
    // 带国家码如 86138xxxx0000
    return cleaned.slice(0, -8) + '****' + cleaned.slice(-4)
  }
  return phone
}
