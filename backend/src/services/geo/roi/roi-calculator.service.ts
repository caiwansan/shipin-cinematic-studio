// ============================================================
// ROI Calculator Service — GEO ROI Engine (Sprint B-2)
// ============================================================

export interface ROICalculationInput {
  industry: string          // 行业
  brandScale: string        // 品牌规模：small/medium/large/enterprise
  averageOrderValue: number // 客单价（元）
  monthlyInquiries: number  // 月咨询量
  conversionRate: number    // 转化率（%）
}

export interface ROICalculationResult {
  estimatedAIExposureIncrease: number     // 预计 AI 新增曝光
  estimatedNewInquiries: number           // 预计新增咨询
  estimatedNewOrders: number              // 预计新增订单
  estimatedNewRevenue: number             // 预计新增收入（元）
  estimatedROI: number                     // ROI（%）
  estimatedPaybackPeriod: number          // 预计回本周期（月）
  industryBenchmark: {
    averageAIExposure: number
    topPerformers: number
  }
}

// Industry coefficient table
const INDUSTRY_COEFFICIENTS: Record<string, { clickRate: number; costFactor: number }> = {
  technology: { clickRate: 0.035, costFactor: 5000 },
  ecommerce: { clickRate: 0.042, costFactor: 8000 },
  finance: { clickRate: 0.028, costFactor: 10000 },
  healthcare: { clickRate: 0.03, costFactor: 6000 },
  education: { clickRate: 0.038, costFactor: 4000 },
  entertainment: { clickRate: 0.045, costFactor: 3000 },
  manufacturing: { clickRate: 0.025, costFactor: 6000 },
  media: { clickRate: 0.045, costFactor: 3000 },
  legal: { clickRate: 0.028, costFactor: 12000 },
  realestate: { clickRate: 0.032, costFactor: 15000 },
  transportation: { clickRate: 0.03, costFactor: 7000 },
  energy: { clickRate: 0.02, costFactor: 8000 },
  catering: { clickRate: 0.05, costFactor: 2000 },
  tourism: { clickRate: 0.04, costFactor: 3000 },
  beauty: { clickRate: 0.048, costFactor: 2500 },
  livestream: { clickRate: 0.055, costFactor: 1500 },
  tea: { clickRate: 0.038, costFactor: 3000 },
  agriculture: { clickRate: 0.025, costFactor: 4000 },
  liquor: { clickRate: 0.035, costFactor: 8000 },
  apparel: { clickRate: 0.042, costFactor: 5000 },
  wellness: { clickRate: 0.036, costFactor: 4000 },
  employment: { clickRate: 0.03, costFactor: 6000 },
  driving: { clickRate: 0.028, costFactor: 3500 },
  carrental: { clickRate: 0.032, costFactor: 5000 },
  lighting: { clickRate: 0.025, costFactor: 4000 },
  decoration: { clickRate: 0.035, costFactor: 6000 },
  agency: { clickRate: 0.03, costFactor: 8000 },
  wedding: { clickRate: 0.04, costFactor: 3000 },
  parenting: { clickRate: 0.038, costFactor: 3500 },
  homeappliance: { clickRate: 0.03, costFactor: 8000 },
  automotive: { clickRate: 0.032, costFactor: 10000 },
  textile: { clickRate: 0.035, costFactor: 4000 },
  construction: { clickRate: 0.022, costFactor: 12000 },
  default: { clickRate: 0.03, costFactor: 5000 },
}

// Brand scale visibility multipliers
const BRAND_SCALE_MULTIPLIERS: Record<string, number> = {
  small: 0.5,
  medium: 1.0,
  large: 2.0,
  enterprise: 3.5,
}

// Industry benchmark exposure (monthly averages)
const INDUSTRY_BENCHMARK: Record<string, { averageAIExposure: number; topPerformers: number }> = {
  technology: { averageAIExposure: 15000, topPerformers: 50000 },
  ecommerce: { averageAIExposure: 25000, topPerformers: 80000 },
  finance: { averageAIExposure: 12000, topPerformers: 40000 },
  healthcare: { averageAIExposure: 10000, topPerformers: 35000 },
  education: { averageAIExposure: 18000, topPerformers: 60000 },
  entertainment: { averageAIExposure: 30000, topPerformers: 100000 },
  manufacturing: { averageAIExposure: 8000, topPerformers: 25000 },
  media: { averageAIExposure: 30000, topPerformers: 100000 },
  legal: { averageAIExposure: 5000, topPerformers: 18000 },
  realestate: { averageAIExposure: 8000, topPerformers: 25000 },
  transportation: { averageAIExposure: 10000, topPerformers: 35000 },
  energy: { averageAIExposure: 6000, topPerformers: 20000 },
  catering: { averageAIExposure: 20000, topPerformers: 60000 },
  tourism: { averageAIExposure: 12000, topPerformers: 40000 },
  beauty: { averageAIExposure: 15000, topPerformers: 50000 },
  livestream: { averageAIExposure: 35000, topPerformers: 120000 },
  tea: { averageAIExposure: 8000, topPerformers: 25000 },
  agriculture: { averageAIExposure: 6000, topPerformers: 20000 },
  liquor: { averageAIExposure: 10000, topPerformers: 35000 },
  apparel: { averageAIExposure: 18000, topPerformers: 60000 },
  wellness: { averageAIExposure: 12000, topPerformers: 40000 },
  employment: { averageAIExposure: 8000, topPerformers: 30000 },
  driving: { averageAIExposure: 5000, topPerformers: 15000 },
  carrental: { averageAIExposure: 7000, topPerformers: 22000 },
  lighting: { averageAIExposure: 5000, topPerformers: 18000 },
  decoration: { averageAIExposure: 8000, topPerformers: 28000 },
  agency: { averageAIExposure: 6000, topPerformers: 20000 },
  wedding: { averageAIExposure: 8000, topPerformers: 25000 },
  parenting: { averageAIExposure: 7000, topPerformers: 22000 },
  homeappliance: { averageAIExposure: 12000, topPerformers: 40000 },
  automotive: { averageAIExposure: 10000, topPerformers: 35000 },
  textile: { averageAIExposure: 8000, topPerformers: 28000 },
  construction: { averageAIExposure: 6000, topPerformers: 20000 },
  default: { averageAIExposure: 15000, topPerformers: 50000 },
}

export function calculateROI(input: ROICalculationInput): ROICalculationResult {
  const { industry, brandScale, averageOrderValue, monthlyInquiries, conversionRate } = input

  // Get industry coefficients (fallback to default)
  const coeff = INDUSTRY_COEFFICIENTS[industry] || INDUSTRY_COEFFICIENTS.default
  const benchmark = INDUSTRY_BENCHMARK[industry] || INDUSTRY_BENCHMARK.default

  // Brand scale visibility multiplier
  const scaleMultiplier = BRAND_SCALE_MULTIPLIERS[brandScale] || BRAND_SCALE_MULTIPLIERS.medium

  // --- Calculation Logic ---

  // Current brand visibility = monthlyInquiries as proxy for current visibility
  // baseExposureIncrease = current visibility × scale multiplier × industry base factor
  const baseExposureIncrease = Math.round(monthlyInquiries * scaleMultiplier * 3.0)

  // New inquiries = base exposure increase × industry click rate
  const estimatedNewInquiries = Math.round(baseExposureIncrease * coeff.clickRate)

  // New orders = new inquiries × conversion rate (conversionRate is %)
  const estimatedNewOrders = Math.round(estimatedNewInquiries * (conversionRate / 100))

  // New revenue = new orders × average order value
  const estimatedNewRevenue = Math.round(estimatedNewOrders * averageOrderValue)

  // GEO Cost = industry cost factor (monthly GEO investment)
  const geoCost = coeff.costFactor

  // ROI (%) = (new revenue - GEO cost) / GEO cost × 100
  const estimatedROI = geoCost > 0
    ? Math.round(((estimatedNewRevenue - geoCost) / geoCost) * 100)
    : 0

  // Payback period (months) = GEO cost / (new revenue per month)
  // If new revenue is 0 or negative, set to a large number
  const estimatedPaybackPeriod = estimatedNewRevenue > 0
    ? Math.round((geoCost / estimatedNewRevenue) * 100) / 100
    : 999

  return {
    estimatedAIExposureIncrease: baseExposureIncrease,
    estimatedNewInquiries,
    estimatedNewOrders,
    estimatedNewRevenue,
    estimatedROI,
    estimatedPaybackPeriod,
    industryBenchmark: {
      averageAIExposure: benchmark.averageAIExposure,
      topPerformers: benchmark.topPerformers,
    },
  }
}
