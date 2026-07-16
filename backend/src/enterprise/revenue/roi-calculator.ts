/**
 * Phase 4: ROI Calculator — CTO修正: 投入/已产生价值/预测价值 三分离
 */
export interface ROIInput {
  planCost: number          // 套餐费用(分)
  tokenCost: number         // Token消耗(分)
  channelCost: number       // 渠道成本(分)
}

export interface ROIOutput {
  // AI投入（真实）
  investment: {
    planCost: number
    tokenCost: number
    channelCost: number
    totalCost: number
    displayCost: string      // 格式化显示
  }
  // 已产生价值（真实）
  realized: {
    leads: number
    hotLeads: number
    interactions: number
    opportunities: number
  }
  // 预测价值（模型）
  predicted: {
    estimatedRevenue: number    // 各线索 Σ(estimatedValue × purchaseProb)
    displayRevenue: string
    avgDealSize: number
    weightedPipeline: number    // 加权 Pipeline
    displayPipeline: string
  }
  // 效率
  efficiency: {
    costPerLead: number         // 单线索成本
    roiRatio: number            // ROI倍数 = 预测收入 / 投入
    roiDisplay: string
  }
}

export function calculateROI(
  input: ROIInput,
  metrics: {
    leads: number
    hotLeads: number
    interactions: number
    opportunities: number
    leadValues: { estimatedValue: number; purchaseProb: number }[]
  }
): ROIOutput {
  const totalCost = input.planCost + input.tokenCost + input.channelCost
  
  // 预测收入 = 每个高意向线索 Σ(预估金额 × 成交概率)
  const estimatedRevenue = metrics.leadValues
    .filter(l => l.purchaseProb >= 50)
    .reduce((s, l) => s + Math.round(l.estimatedValue * l.purchaseProb / 100), 0)
  
  // 加权 Pipeline (所有线索加权)
  const weightedPipeline = metrics.leadValues
    .reduce((s, l) => s + Math.round(l.estimatedValue * l.purchaseProb / 100), 0)
  
  const avgDealSize = metrics.leads > 0
    ? Math.round(metrics.leadValues.reduce((s, l) => s + l.estimatedValue, 0) / Math.max(metrics.leadValues.length, 1))
    : 0
  
  // ROI = 预测收入 / 投入 (最小避免除零)
  const roiRatio = totalCost > 0 ? Math.round((estimatedRevenue / totalCost) * 100) / 100 : 0
  
  const costPerLead = metrics.leads > 0 ? Math.round(totalCost / metrics.leads) : 0
  
  return {
    investment: {
      planCost: input.planCost,
      tokenCost: input.tokenCost,
      channelCost: input.channelCost,
      totalCost,
      displayCost: formatMoney(totalCost)
    },
    realized: {
      leads: metrics.leads,
      hotLeads: metrics.hotLeads,
      interactions: metrics.interactions,
      opportunities: metrics.opportunities
    },
    predicted: {
      estimatedRevenue,
      displayRevenue: formatMoney(estimatedRevenue),
      avgDealSize,
      weightedPipeline,
      displayPipeline: formatMoney(weightedPipeline)
    },
    efficiency: {
      costPerLead,
      roiRatio,
      roiDisplay: `${roiRatio}x`
    }
  }
}

function formatMoney(fen: number): string {
  const yuan = fen / 100
  if (yuan >= 10000) return `¥${(yuan / 10000).toFixed(1)}万`
  if (yuan >= 1000) return `¥${(yuan / 1000).toFixed(1)}k`
  return `¥${yuan.toFixed(0)}`
}
