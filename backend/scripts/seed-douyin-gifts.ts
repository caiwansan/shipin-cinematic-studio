/**
 * COMMUNITY-GIFT-DOUYIN-01 — 抖音式礼物库 seed（幂等：按名称 upsert）
 * 21 个礼物，三档分类（热门/豪华/专属）+ 每礼物专属渐变配色 iconGradient
 * 运行：npx tsx scripts/seed-douyin-gifts.ts
 */
import { prisma } from '../src/utils/index.js'

const GIFTS = [
  // ── 热门（低价档 1-99） ──
  { name: '荧光棒', priceDiamonds: 5, iconUrl: '✨', gradient: 'linear-gradient(135deg,#84fab0,#8fd3f4)', category: '热门', sortOrder: 1 },
  { name: '小心心', priceDiamonds: 10, iconUrl: '💗', gradient: 'linear-gradient(135deg,#ff9a9e,#fecfef)', category: '热门', sortOrder: 2 },
  { name: '玫瑰花', priceDiamonds: 20, iconUrl: '🌹', gradient: 'linear-gradient(135deg,#ff758c,#ff7eb3)', category: '热门', sortOrder: 3 },
  { name: '棒棒糖', priceDiamonds: 30, iconUrl: '🍭', gradient: 'linear-gradient(135deg,#f6d365,#fda085)', category: '热门', sortOrder: 4 },
  { name: '星星', priceDiamonds: 50, iconUrl: '⭐', gradient: 'linear-gradient(135deg,#fbc2eb,#a6c1ee)', category: '热门', sortOrder: 5 },
  { name: '奶茶', priceDiamonds: 66, iconUrl: '🧋', gradient: 'linear-gradient(135deg,#e0b58f,#f5d9b8)', category: '热门', sortOrder: 6 },
  { name: '纸飞机', priceDiamonds: 66, iconUrl: '✈️', gradient: 'linear-gradient(135deg,#a1c4fd,#c2e9fb)', category: '热门', sortOrder: 7 },
  // ── 豪华（中档 100-999） ──
  { name: '热气球', priceDiamonds: 100, iconUrl: '🎈', gradient: 'linear-gradient(135deg,#a18cd1,#fbc2eb)', category: '豪华', sortOrder: 1 },
  { name: '冰淇淋', priceDiamonds: 128, iconUrl: '🍦', gradient: 'linear-gradient(135deg,#ffecd2,#fcb69f)', category: '豪华', sortOrder: 2 },
  { name: '甜甜圈', priceDiamonds: 168, iconUrl: '🍩', gradient: 'linear-gradient(135deg,#fbc2eb,#ff9a9e)', category: '豪华', sortOrder: 3 },
  { name: '盲盒', priceDiamonds: 199, iconUrl: '🎁', gradient: 'linear-gradient(135deg,#667eea,#764ba2)', category: '豪华', sortOrder: 4 },
  { name: '彩虹', priceDiamonds: 258, iconUrl: '🌈', gradient: 'linear-gradient(135deg,#43e97b,#38f9d7)', category: '豪华', sortOrder: 5 },
  { name: '烟花', priceDiamonds: 520, iconUrl: '🎆', gradient: 'linear-gradient(135deg,#fa709a,#fee140)', category: '豪华', sortOrder: 6 },
  { name: '跑车', priceDiamonds: 666, iconUrl: '🏎️', gradient: 'linear-gradient(135deg,#ff9a9e,#fad0c4)', category: '豪华', sortOrder: 7 },
  // ── 专属（高档 1000+） ──
  { name: '火箭', priceDiamonds: 1314, iconUrl: '🚀', gradient: 'linear-gradient(135deg,#4facfe,#00f2fe)', category: '专属', sortOrder: 1 },
  { name: '豪华游艇', priceDiamonds: 2000, iconUrl: '🛥️', gradient: 'linear-gradient(135deg,#0ba360,#3cba92)', category: '专属', sortOrder: 2 },
  { name: '嘉年华', priceDiamonds: 3000, iconUrl: '🎡', gradient: 'linear-gradient(135deg,#c471f5,#fa71cd)', category: '专属', sortOrder: 3 },
  { name: '梦幻城堡', priceDiamonds: 5200, iconUrl: '🏰', gradient: 'linear-gradient(135deg,#f6d365,#fda085)', category: '专属', sortOrder: 4 },
  { name: '至尊皇冠', priceDiamonds: 8888, iconUrl: '👑', gradient: 'linear-gradient(135deg,#f7971e,#ffd200)', category: '专属', sortOrder: 5 },
  { name: '守护天使', priceDiamonds: 13140, iconUrl: '👼', gradient: 'linear-gradient(135deg,#e0c3fc,#8ec5fc)', category: '专属', sortOrder: 6 },
]

let created = 0
let updated = 0
for (const g of GIFTS) {
  const exist = await prisma.giftProduct.findFirst({ where: { name: g.name } })
  if (exist) {
    await prisma.giftProduct.update({
      where: { id: exist.id },
      data: { priceDiamonds: g.priceDiamonds, iconUrl: g.iconUrl, iconGradient: g.gradient, category: g.category, sortOrder: g.sortOrder, isActive: true },
    })
    updated++
  } else {
    await prisma.giftProduct.create({
      data: { name: g.name, priceDiamonds: g.priceDiamonds, iconUrl: g.iconUrl, iconGradient: g.gradient, category: g.category, sortOrder: g.sortOrder, isActive: true },
    })
    created++
  }
}

// 停用不在模板里的旧礼物（当前无）
const total = await prisma.giftProduct.count({ where: { isActive: true } })
console.log(`✅ 抖音式礼物库就绪：新增 ${created} / 更新 ${updated} / 上架中 ${total}`)
await prisma.$disconnect()
