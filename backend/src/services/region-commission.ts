// 区域分佣核心服务
// 规则：
//   - 区县级代理：辖区会员充值 → 35% 佣金
//   - 市级代理：辖区会员充值 → 10% 佣金
//   - 如果区县代理空缺，区县35%自动归市代理（共45%）
//   - 如果用户没有区域信息，回退到旧逻辑（marketAgentId 直接分佣）

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface CommissionResult {
  /** 区县级代理分佣 */
  districtCommission: { agentId: string; agentName: string; rate: number; amount: number } | null
  /** 市级代理分佣 */
  cityCommission: { agentId: string; agentName: string; rate: number; amount: number } | null
  /** 总佣金 */
  totalCommission: number
  /** 分佣明细描述（JSON） */
  breakdown: string
}

/**
 * 按区域匹配代理并计算分佣
 * @param userId 充值用户ID
 * @param orderId 充值订单ID
 * @param orderAmount 订单金额（元）
 * @returns 分佣结果
 */
export async function calculateRegionCommission(
  userId: string,
  orderId: string,
  orderAmount: number
): Promise<CommissionResult | null> {
  // 1. 查用户地区信息
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      districtCode: true,
      districtName: true,
      cityCode: true,
      cityName: true,
      provinceCode: true,
      provinceName: true,
      marketAgentId: true,
    },
  })

  if (!user) return null

  // 2. 如果有地区信息，按区域匹配代理
  if (user.districtCode || user.cityCode) {
    const breakdownParts: any[] = []
    let totalCommission = 0

    // 2a. 查找区县级代理（匹配 districtCode）
    let districtAgent: any = null
    if (user.districtCode) {
      // 注意：区县级代理的 regionCode 匹配 districtCode（6位代码相同）
      districtAgent = await prisma.marketAgent.findFirst({
        where: {
          agentType: 'district',
          regionCode: user.districtCode,
          status: 'active',
        },
        select: { id: true, name: true, commissionRate: true },
      })
    }

    // 2b. 查找市级代理
    let cityAgent: any = null
    if (user.cityCode) {
      cityAgent = await prisma.marketAgent.findFirst({
        where: {
          agentType: 'city',
          regionCode: user.cityCode,
          status: 'active',
        },
        select: { id: true, name: true },
      })
    }

    // 2c. 计算区县分佣（35%）
    const districtRate = 35
    if (districtAgent) {
      const districtAmount = Math.round(orderAmount * districtRate) / 100
      if (districtAmount > 0) {
        breakdownParts.push({
          level: 'district',
          agentId: districtAgent.id,
          agentName: districtAgent.name,
          rate: districtRate,
          amount: districtAmount,
        })
        totalCommission += districtAmount
      }
    } else {
      // 区县代理空缺，归给市代理（也是35%）
      if (cityAgent) {
        const cityExtraAmount = Math.round(orderAmount * districtRate) / 100
        if (cityExtraAmount > 0) {
          breakdownParts.push({
            level: 'city_extra',
            agentId: cityAgent.id,
            agentName: cityAgent.name,
            rate: districtRate,
            amount: cityExtraAmount,
          })
          totalCommission += cityExtraAmount
        }
      }
    }

    // 2d. 计算市代理基础佣金（10%）
    const cityRate = 10
    if (cityAgent) {
      const cityAmount = Math.round(orderAmount * cityRate) / 100
      if (cityAmount > 0) {
        breakdownParts.push({
          level: 'city_base',
          agentId: cityAgent.id,
          agentName: cityAgent.name,
          rate: cityRate,
          amount: cityAmount,
        })
        totalCommission += cityAmount
      }
    }

    // 如果有区域匹配结果，返回
    if (breakdownParts.length > 0) {
      const districtResult = breakdownParts.find((p: any) => p.level === 'district')
      const cityBase = breakdownParts.find((p: any) => p.level === 'city_base')
      const cityExtra = breakdownParts.find((p: any) => p.level === 'city_extra')

      return {
        districtCommission: districtResult
          ? { agentId: districtResult.agentId, agentName: districtResult.agentName, rate: districtResult.rate, amount: districtResult.amount }
          : null,
        cityCommission: cityBase
          ? { agentId: cityBase.agentId, agentName: cityBase.agentName, rate: cityBase.rate, amount: cityBase.amount + (cityExtra?.amount || 0) }
          : null,
        totalCommission,
        breakdown: JSON.stringify(breakdownParts),
      }
    }
  }

  // 3. 没有地区信息或没有匹配到区域代理，回退到旧逻辑
  if (user.marketAgentId) {
    // 使用旧的 marketAgentId 分佣逻辑
    const agentInfo = await prisma.marketAgent.findUnique({
      where: { id: user.marketAgentId },
      select: { level: true, commissionRate: true },
    })
    if (agentInfo && agentInfo.commissionRate > 0) {
      const rate = agentInfo.commissionRate
      const amount = Math.round(orderAmount * rate) / 100
      if (amount > 0) {
        return {
          districtCommission: null,
          cityCommission: { agentId: user.marketAgentId, agentName: agentInfo.level, rate, amount },
          totalCommission: amount,
          breakdown: JSON.stringify([{ level: 'legacy', agentId: user.marketAgentId, rate, amount }]),
        }
      }
    }
  }

  return null
}

async function getUserIdByAgentId(agentId: string): Promise<string | null> {
  // 先查 MarketAgent 对应的 user，region-commission 的 agentId 是 MarketAgent.id
  // MarketAgent 关联 user 的方式是 user.marketAgentId
  const user = await prisma.user.findFirst({
    where: { marketAgentId: agentId },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  })
  return user?.id || null
}

/**
 * 执行分佣（创建CommissionOrder并更新MarketAgent统计 + 用户钱包余额）
 */
export async function executeRegionCommission(userId: string, orderId: string, orderAmount: number, remark: string) {
  const result = await calculateRegionCommission(userId, orderId, orderAmount)
  if (!result || result.totalCommission <= 0) return null

  // 解析分佣明细
  const breakdown = JSON.parse(result.breakdown) as Array<{
    level: string
    agentId: string
    agentName?: string
    rate: number
    amount: number
  }>

  // 逐个创建佣金记录
  for (const item of breakdown) {
    await prisma.commissionOrder.create({
      data: {
        agentId: item.agentId,
        userId,
        orderId,
        orderAmount,
        commissionRate: item.rate,
        commissionAmount: item.amount,
        status: 'pending',
        remark: `${remark} | 分佣类型: ${item.level === 'district' ? '区县代理' : item.level === 'city_base' ? '市级代理基础' : item.level === 'city_extra' ? '市级代理(区县空缺)' : '旧有'} | ${item.level}`,
      },
    })

    // 更新代理统计
    await prisma.marketAgent.update({
      where: { id: item.agentId },
      data: {
        totalCommission: { increment: item.amount },
        pendingCommission: { increment: item.amount },
        referredUsers: { increment: item.agentName === undefined ? 0 : 1 },
      },
    })

    // 同步写入代理商用户的钱包余额
    const agentUserId = await getUserIdByAgentId(item.agentId)
    if (agentUserId) {
      await prisma.$executeRawUnsafe(
        `UPDATE "User" SET "walletBalance" = COALESCE("walletBalance", 0) + $1 WHERE id = $2`,
        item.amount, agentUserId
      )
    }
  }

  return result
}
