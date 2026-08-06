/**
 * mall-public.ts — 昆仑镜商城 v1.0 公共 + 用户路由
 *
 * 前缀 /api/mall
 * 公共路由：商品列表/详情、分类列表、Banner 列表
 * 用户路由（需要 authenticate）：购物车、地址、优惠券、订单
 * 统计路由（需要 admin 权限）
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
// PAYMENT-BALANCE-FIRST-01 余额优先支付
import {
  evaluateBalanceFirst,
  completeWalletPayment,
  settleWalletDeduction,
} from '../services/payment/balance-first.service.js'

/** 赠送优惠券：用户支付成功后，检查所购商品是否有赠券，有则自动发放 */
async function handleGiftCoupons(userId: string, orderNo: string) {
  try {
    const order = await prisma.mallOrder.findFirst({
      where: { orderNo, userId },
      include: { items: true },
    })
    if (!order) return

    for (const item of order.items) {
      const giftCoupons = await prisma.mallCoupon.findMany({
        where: { giftProductId: item.productId, isActive: true, deletedAt: null },
      })
      for (const coupon of giftCoupons) {
        // 检查总量是否已发完
        if (coupon.totalCount > 0 && coupon.usedCount >= coupon.totalCount) continue
        // 检查每人限领
        const userCount = await prisma.mallUserCoupon.count({
          where: { userId, couponId: coupon.id },
        })
        if (userCount >= coupon.maxPerUser) continue
        // 赠送
        await prisma.mallUserCoupon.create({
          data: { userId, couponId: coupon.id },
        })
        await prisma.mallCoupon.update({
          where: { id: coupon.id },
          data: { usedCount: { increment: 1 } },
        })
        console.log(`[GiftCoupon] ✅ 用户 ${userId.substring(0,8)} 获赠优惠券「${coupon.name}」(商品 ${item.productId})`)
      }
    }
  } catch (err) {
    console.error('[GiftCoupon] ❌ 赠送失败:', err)
  }
}

/** 生成订单号：MALL{YYYYMMDD}{6位随机大写} */
function generateOrderNo(): string {
  const now = new Date()
  const y = now.getFullYear().toString()
  const m = (now.getMonth() + 1).toString().padStart(2, '0')
  const d = now.getDate().toString().padStart(2, '0')
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `MALL${y}${m}${d}${rand}`
}

export default async function mallPublicRoutes(app: FastifyInstance) {
  // ============================================================
  // 商品 — 公开
  // ============================================================

  /** GET /api/mall/products — 商品列表（分页 + 筛选） */
  app.get('/api/mall/products', async (request, reply) => {
    const query = request.query as any
    const page = Math.max(1, parseInt(query.page || '1', 10))
    const pageSize = Math.min(50, Math.max(1, parseInt(query.pageSize || '20', 10)))
    const categoryId = query.categoryId as string | undefined
    const isRecommend = query.isRecommend === 'true' ? true : undefined
    const isNew = query.isNew === 'true' ? true : undefined
    const search = query.search as string | undefined

    const where: any = { isActive: true, deletedAt: null }
    if (categoryId) where.categoryId = categoryId
    if (isRecommend !== undefined) where.isRecommend = isRecommend
    if (isNew !== undefined) where.isNew = isNew
    if (search) where.name = { contains: search, mode: 'insensitive' }

    const [total, items] = await Promise.all([
      prisma.mallProduct.count({ where }),
      prisma.mallProduct.findMany({
        where,
        orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { category: { select: { id: true, name: true } } },
      }),
    ])

    // 附上每个商品关联的赠送优惠券信息
    const itemsWithGift = await Promise.all(items.map(async (item) => {
      const giftCoupons = await prisma.mallCoupon.findMany({
        where: { giftProductId: item.id, isActive: true, deletedAt: null },
        select: { id: true, name: true, value: true, type: true },
      })
      return { ...item, giftCoupons: giftCoupons.length > 0 ? giftCoupons : null }
    }))

    return {
      success: true,
      data: {
        items: itemsWithGift,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  })

  /** GET /api/mall/products/:id — 商品详情 */
  app.get('/api/mall/products/:id', async (request, reply) => {
    const { id } = request.params as any
    const product = await prisma.mallProduct.findFirst({
      where: { id, isActive: true, deletedAt: null },
      include: { category: { select: { id: true, name: true } } },
    })
    if (!product) {
      return reply.status(404).send({ success: false, error: '商品不存在' })
    }
    // 附上赠送优惠券信息
    const giftCoupons = await prisma.mallCoupon.findMany({
      where: { giftProductId: id, isActive: true, deletedAt: null },
      select: { id: true, name: true, value: true, type: true },
    })
    return { success: true, data: { ...product, giftCoupons: giftCoupons.length > 0 ? giftCoupons : null } }
  })

  // ============================================================
  // 分类 — 公开
  // ============================================================

  /** GET /api/mall/categories — 分类列表（仅 visible） */
  app.get('/api/mall/categories', async (_request, reply) => {
    const categories = await prisma.mallCategory.findMany({
      where: { visible: true, deletedAt: null },
      orderBy: { sort: 'asc' },
    })
    return { success: true, data: categories }
  })

  // ============================================================
  // Banner — 公开
  // ============================================================

  /** GET /api/mall/banners — Banner 列表（isActive, sorted） */
  app.get('/api/mall/banners', async (_request, reply) => {
    const banners = await prisma.mallBanner.findMany({
      where: { isActive: true },
      orderBy: { sort: 'asc' },
    })
    return { success: true, data: banners }
  })

  // ============================================================
  // 购物车 — 需要 authenticate
  // ============================================================

  /** GET /api/mall/cart — 获取购物车列表 */
  app.get('/api/mall/cart', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const items = await prisma.mallCart.findMany({
      where: { userId: user.id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            cover: true,
            price: true,
            originalPrice: true,
            stock: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return { success: true, data: items }
  })

  /** POST /api/mall/cart — 添加商品到购物车 */
  app.post('/api/mall/cart', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const { productId, quantity = 1 } = request.body as any
    if (!productId) {
      return reply.status(400).send({ success: false, error: '缺少 productId' })
    }

    // 检查商品是否存在且上架
    const product = await prisma.mallProduct.findFirst({
      where: { id: productId, isActive: true, deletedAt: null },
    })
    if (!product) {
      return reply.status(404).send({ success: false, error: '商品不存在或已下架' })
    }

    // upsert: 如果已有则累加数量
    const existing = await prisma.mallCart.findFirst({
      where: { userId: user.id, productId },
    })

    let item
    if (existing) {
      item = await prisma.mallCart.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + (quantity > 0 ? quantity : 1) },
        include: { product: { select: { id: true, name: true, price: true, cover: true, stock: true } } },
      })
    } else {
      item = await prisma.mallCart.create({
        data: { userId: user.id, productId, quantity: Math.max(1, quantity) },
        include: { product: { select: { id: true, name: true, price: true, cover: true, stock: true } } },
      })
    }

    return { success: true, data: item }
  })

  /** PUT /api/mall/cart/:itemId — 修改购物车商品数量 */
  app.put('/api/mall/cart/:itemId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const { itemId } = request.params as any
    const { quantity } = request.body as any

    const item = await prisma.mallCart.findFirst({ where: { id: itemId, userId: user.id } })
    if (!item) {
      return reply.status(404).send({ success: false, error: '购物车商品不存在' })
    }

    if (quantity <= 0) {
      await prisma.mallCart.delete({ where: { id: itemId } })
      return { success: true, data: null, message: '已移除' }
    }

    const updated = await prisma.mallCart.update({
      where: { id: itemId },
      data: { quantity },
      include: { product: { select: { id: true, name: true, price: true, cover: true, stock: true } } },
    })
    return { success: true, data: updated }
  })

  /** DELETE /api/mall/cart/:itemId — 删除购物车商品 */
  app.delete('/api/mall/cart/:itemId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const { itemId } = request.params as any

    const item = await prisma.mallCart.findFirst({ where: { id: itemId, userId: user.id } })
    if (!item) {
      return reply.status(404).send({ success: false, error: '购物车商品不存在' })
    }

    await prisma.mallCart.delete({ where: { id: itemId } })
    return { success: true, data: null }
  })

  // ============================================================
  // 地址 — 需要 authenticate
  // ============================================================

  /** GET /api/mall/addresses — 获取地址列表 */
  app.get('/api/mall/addresses', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const addresses = await prisma.mallAddress.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })
    return { success: true, data: addresses }
  })

  /** POST /api/mall/addresses — 新增地址 */
  app.post('/api/mall/addresses', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const { consignee, phone, province, city, district, detail, isDefault } = request.body as any
    const nameValue = consignee || request.body.name
    if (!nameValue || !phone || !province || !city || !detail) {
      return reply.status(400).send({ success: false, error: '缺少必填字段' })
    }

    // 如果是默认地址，清除其他默认
    if (isDefault) {
      await prisma.mallAddress.updateMany({
        where: { userId: user.id, isDefault: true },
        data: { isDefault: false },
      })
    }

    const address = await prisma.mallAddress.create({
      data: {
        userId: user.id,
        consignee: nameValue,
        phone,
        province,
        city,
        district: district || '',
        detail,
        isDefault: !!isDefault,
      },
    })
    return { success: true, data: address }
  })

  /** PUT /api/mall/addresses/:id — 修改地址 */
  app.put('/api/mall/addresses/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const { id } = request.params as any
    const body = request.body as any

    const existing = await prisma.mallAddress.findFirst({ where: { id, userId: user.id } })
    if (!existing) {
      return reply.status(404).send({ success: false, error: '地址不存在' })
    }

    // 如果是默认地址，清除其他默认
    if (body.isDefault) {
      await prisma.mallAddress.updateMany({
        where: { userId: user.id, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
    }

    const updated = await prisma.mallAddress.update({
      where: { id },
      data: {
        consignee: (body.consignee || body.name) ?? undefined,
        phone: body.phone ?? undefined,
        province: body.province ?? undefined,
        city: body.city ?? undefined,
        district: body.district ?? undefined,
        detail: body.detail ?? undefined,
        isDefault: body.isDefault !== undefined ? !!body.isDefault : undefined,
      },
    })
    return { success: true, data: updated }
  })

  /** DELETE /api/mall/addresses/:id — 删除地址 */
  app.delete('/api/mall/addresses/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const { id } = request.params as any

    const existing = await prisma.mallAddress.findFirst({ where: { id, userId: user.id } })
    if (!existing) {
      return reply.status(404).send({ success: false, error: '地址不存在' })
    }

    await prisma.mallAddress.delete({ where: { id } })
    return { success: true, data: null }
  })

  // ============================================================
  // 优惠券 — 需要 authenticate
  // ============================================================

  /** GET /api/mall/coupons/available — 可领取的优惠券列表 */
  app.get('/api/mall/coupons/available', { preHandler: [app.authenticate] }, async (_request, reply) => {
    const now = new Date()
    const allCoupons = await prisma.mallCoupon.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    })
    // 在 JS 里过滤时间 + 总量（避免 Prisma FieldRef 兼容性问题）
    const coupons = allCoupons.filter((c: any) => {
      if (c.startAt && new Date(c.startAt) > now) return false
      if (c.endAt && new Date(c.endAt) < now) return false
      if (c.totalCount > 0 && c.usedCount >= c.totalCount) return false
      return true
    })
    return { success: true, data: coupons }
  })

  /** POST /api/mall/coupons/:couponId/claim — 领取优惠券 */
  app.post('/api/mall/coupons/:couponId/claim', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const { couponId } = request.params as any

    const coupon = await prisma.mallCoupon.findFirst({
      where: { id: couponId, isActive: true, deletedAt: null },
    })
    if (!coupon) {
      return reply.status(404).send({ success: false, error: '优惠券不存在' })
    }

    // 检查有效期
    const now = new Date()
    if (coupon.startAt && coupon.startAt > now) {
      return reply.status(400).send({ success: false, error: '优惠券尚未开始' })
    }
    if (coupon.endAt && coupon.endAt < now) {
      return reply.status(400).send({ success: false, error: '优惠券已过期' })
    }

    // 检查总数限制
    if (coupon.totalCount > 0 && coupon.usedCount >= coupon.totalCount) {
      return reply.status(400).send({ success: false, error: '优惠券已领完' })
    }

    // 检查每人限制
    const userCount = await prisma.mallUserCoupon.count({
      where: { userId: user.id, couponId },
    })
    if (userCount >= coupon.maxPerUser) {
      return reply.status(400).send({ success: false, error: '已达到领取上限' })
    }

    // 领取（原子操作）
    const userCoupon = await prisma.mallUserCoupon.create({
      data: { userId: user.id, couponId },
    })

    // 增加 usedCount
    await prisma.mallCoupon.update({
      where: { id: couponId },
      data: { usedCount: { increment: 1 } },
    })

    return { success: true, data: userCoupon }
  })

  /** GET /api/mall/coupons/my — 我的优惠券 */
  app.get('/api/mall/coupons/my', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const userCoupons = await prisma.mallUserCoupon.findMany({
      where: { userId: user.id },
      include: { coupon: true },
      orderBy: { createdAt: 'desc' },
    })
    return { success: true, data: userCoupons }
  })

  // ============================================================
  // 订单 — 需要 authenticate
  // ============================================================

  /** POST /api/mall/orders/create — 创建订单 */
  app.post('/api/mall/orders/create', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const { items, addressId, couponId, remark } = request.body as any

    if (!items || !Array.isArray(items) || items.length === 0) {
      return reply.status(400).send({ success: false, error: '请选择商品' })
    }

    // 1) 查询商品
    const productIds = items.map((i: any) => i.productId)
    const products = await prisma.mallProduct.findMany({
      where: { id: { in: productIds }, isActive: true, deletedAt: null },
    })
    const productMap = new Map(products.map((p) => [p.id, p]))

    // 检查商品是否存在和库存
    for (const item of items) {
      const product = productMap.get(item.productId)
      if (!product) {
        return reply.status(404).send({ success: false, error: `商品 ${item.productId} 不存在` })
      }
      if (product.stock < item.quantity) {
        return reply.status(400).send({ success: false, error: `商品 ${product.name} 库存不足` })
      }
    }

    // 2) 查询地址（如果有）
    let addressName = ''
    let addressPhone = ''
    let addressFull = ''
    if (addressId) {
      const address = await prisma.mallAddress.findFirst({
        where: { id: addressId, userId: user.id },
      })
      if (address) {
        addressName = address.consignee
        addressPhone = address.phone
        addressFull = `${address.province} ${address.city} ${address.district} ${address.detail}`
      }
    }

    // 3) 计算金额
    let totalAmount = 0
    const orderItemsData: Array<{
      productId: string
      productName: string
      productCover: string | undefined
      price: number
      quantity: number
      subtotal: number
    }> = []

    for (const item of items) {
      const product = productMap.get(item.productId)!
      const quantity = Math.max(1, item.quantity || 1)
      const subtotal = product.price * quantity
      totalAmount += subtotal
      orderItemsData.push({
        productId: product.id,
        productName: product.name,
        productCover: product.cover || undefined,
        price: product.price,
        quantity,
        subtotal,
      })
    }

    // 4) 优惠券折扣
    let discountAmount = 0
    if (couponId) {
      const userCoupon = await prisma.mallUserCoupon.findFirst({
        where: { userId: user.id, couponId, usedAt: null },
        include: { coupon: true },
      })
      if (userCoupon && userCoupon.coupon.isActive) {
        const coupon = userCoupon.coupon
        if (totalAmount >= coupon.minAmount) {
          if (coupon.type === 'fixed') {
            discountAmount = Math.min(coupon.value, totalAmount)
          } else if (coupon.type === 'discount') {
            discountAmount = totalAmount * (coupon.value / 100)
          } else if (coupon.type === 'full_reduce' && totalAmount >= coupon.minAmount) {
            discountAmount = coupon.value
          }
          discountAmount = Math.round(discountAmount * 100) / 100
        }
      }
    }

    const payAmount = Math.max(0, Math.round((totalAmount - discountAmount) * 100) / 100)

    // 5) 生成订单号
    const orderNo = generateOrderNo()

    // 6) 创建订单（事务）
    const order = await prisma.$transaction(async (tx) => {
      // 扣减库存
      for (const item of items) {
        const product = productMap.get(item.productId)!
        await tx.mallProduct.update({
          where: { id: product.id },
          data: { stock: { decrement: item.quantity }, sales: { increment: item.quantity } },
        })
      }

      // 标记优惠券已使用
      if (couponId) {
        await tx.mallUserCoupon.updateMany({
          where: { userId: user.id, couponId, usedAt: null },
          data: { usedAt: new Date(), orderNo },
        })
      }

      // 创建订单
      return tx.mallOrder.create({
        data: {
          orderNo,
          userId: user.id,
          status: 'pending',
          totalAmount,
          paidAmount: 0,
          payAmount,
          discount: discountAmount,
          addressName: addressName || null,
          addressPhone: addressPhone || null,
          address: addressFull || null,
          remark: remark || null,
          items: {
            create: orderItemsData.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              productImage: item.productCover || null,
              price: item.price,
              quantity: item.quantity,
              subtotal: item.subtotal,
            })),
          },
        },
        include: { items: true },
      })
    })

    return { success: true, data: order }
  })

  /** GET /api/mall/orders — 订单列表 */
  app.get('/api/mall/orders', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const query = request.query as any
    const page = Math.max(1, parseInt(query.page || '1', 10))
    const pageSize = Math.min(50, Math.max(1, parseInt(query.pageSize || '20', 10)))
    const status = query.status as string | undefined

    const where: any = { userId: user.id }
    if (status) where.status = status

    const [total, orders] = await Promise.all([
      prisma.mallOrder.count({ where }),
      prisma.mallOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { items: true },
      }),
    ])

    return {
      success: true,
      data: {
        items: orders,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  })

  /** GET /api/mall/orders/:orderNo — 订单详情 */
  app.get('/api/mall/orders/:orderNo', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const { orderNo } = request.params as any
    const order = await prisma.mallOrder.findFirst({
      where: { orderNo, userId: user.id },
      include: { items: { include: { product: { select: { id: true, name: true, cover: true, price: true } } } } },
    })
    if (!order) {
      return reply.status(404).send({ success: false, error: '订单不存在' })
    }
    return { success: true, data: order }
  })

  /** POST /api/mall/orders/:orderNo/pay — 支付订单（返回收款码信息） */
  /** POST /api/mall/orders/:orderNo/pay — 支付订单
   *
   * 复用昆仑镜会员中心的支付系统（与 VIP 套餐付款体验一致）：
   * 1. 创建 RechargeOrder（与 VIP 共用订单表）
   * 2. 检测可用的支付方式（微信/支付宝密钥配置）并返回
   * 3. 前端选择支付方式后调 create-payment 生成付款二维码
   * 4. 前端轮询支付状态，付款成功自动标记订单已支付
   */
  app.post('/api/mall/orders/:orderNo/pay', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const userId = user.id
    const { orderNo } = request.params as any
    const { method } = request.body as any  // 'wallet' | 'wechat' | 'alipay'

    const mallOrder = await prisma.mallOrder.findFirst({
      where: { orderNo, userId, status: 'pending' },
    })
    if (!mallOrder) {
      return reply.status(404).send({ success: false, error: '订单不存在或状态不正确' })
    }

    if (!['wechat', 'alipay', 'wallet'].includes(method)) {
      return reply.status(400).send({ success: false, error: '不支持的支付方式' })
    }

    const payAmount = Math.round((mallOrder.payAmount || 0) * 100) / 100

    // ─── PAYMENT-BALANCE-FIRST-01 余额优先评估 ───
    const balanceEval = await evaluateBalanceFirst(userId, payAmount)
    const canWallet = balanceEval.mode === 'wallet'

    // 显式选余额支付：余额不足直接报错（用户可选微信/支付宝付差额或全额）
    if (method === 'wallet' && !canWallet) {
      return reply.status(400).send({ success: false, error: `余额不足，当前余额 ¥${balanceEval.balance.toFixed(2)}，请选择微信或支付宝支付` })
    }

    // 余额足够（无论显式选余额，还是微信/支付宝自动余额优先）→ 余额直接支付，无需外部支付
    if (canWallet) {
      const orderNo2 = `MALL${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      const ro = await prisma.rechargeOrder.create({
        data: {
          userId, planLevel: null, coins: 0, amount: payAmount, walletPaid: payAmount,
          status: 'pending', payMethod: 'wallet', orderNo: orderNo2,
          remark: `商城订单 ${mallOrder.orderNo} 支付 ¥${payAmount}（余额支付）`,
        },
      })
      const po = await prisma.paymentOrder.create({
        data: {
          userId, orderNo: orderNo2, type: 'mall', amount: payAmount, coins: 0,
          method: 'wallet', walletPaid: payAmount, status: 'pending',
          remark: `商城订单 ${mallOrder.orderNo} → 支付订单 ${orderNo2}（余额支付）`,
        },
      }).catch(() => null)
      const ok = await completeWalletPayment(po?.id || ro.id, userId, payAmount)
      if (!ok) {
        return reply.status(400).send({ success: false, error: '余额不足，支付失败' })
      }
      // 支付流水 + 商城业务单同步完成
      await prisma.rechargeOrder.update({
        where: { id: ro.id },
        data: { status: 'paid', payTime: new Date() },
      })
      await prisma.mallOrder.updateMany({
        where: { orderNo, userId, status: 'pending' },
        data: { status: 'paid', paidAt: new Date() },
      })
      await handleGiftCoupons(userId, orderNo)
      return {
        success: true,
        data: {
          orderNo: mallOrder.orderNo,
          amount: payAmount,
          method: 'wallet',
          paymentType: 'wallet_balance',
          status: 'paid',
          paidByBalance: true,
          walletPaid: payAmount,
          externalAmount: 0,
          needPoll: false,
        },
      }
    }

    // ===== 余额不足 → 检测支付密钥配置（差额外部支付） =====
    const walletPaid = balanceEval.walletPaid
    const externalAmount = balanceEval.externalAmount
    const secretConfig = await prisma.paymentSecret.findUnique({ where: { channel: method } })
    const isSecretEnabled = secretConfig?.enabled && (() => {
      const config = (typeof secretConfig.config === 'string' ? JSON.parse(secretConfig.config) : secretConfig.config) || {}
      return Object.values(config).some((v: any) => typeof v === 'string' && v.length > 0)
    })()

    if (!isSecretEnabled) {
      // 降级到收款码模式
      const qrConfig = await prisma.paymentConfig.findUnique({ where: { method } })
      if (!qrConfig || !qrConfig.enabled) {
        return reply.status(400).send({ success: false, error: '该支付方式未启用，请联系管理员配置' })
      }
      const qc = typeof qrConfig.config === 'string' ? JSON.parse(qrConfig.config) : (qrConfig.config || {})
      return {
        success: true,
        data: {
          orderNo: mallOrder.orderNo,
          amount: payAmount,
          method,
          walletPaid,
          externalAmount,
          paymentType: 'qrcode_manual',
          qrCodeUrl: qc?.qrcodeUrl || qc?.qrCodeUrl || qc?.qrcode || null,
          account: qc?.account || qc?.alipayAccount || qc?.wechatAccount || null,
          payeeName: qc?.name || qc?.payeeName || null,
          needPoll: false,
          status: 'pending',
        },
      }
    }

    // ===== 创建 RechargeOrder（与 VIP 共用支付流水；walletPaid 记录余额抵扣，外部只付差额） =====
    const orderNo2 = `MALL${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    const rechargeOrder = await prisma.rechargeOrder.create({
      data: {
        userId,
        planLevel: null,
        coins: 0,
        amount: payAmount,
        walletPaid,
        status: 'pending',
        payMethod: 'auto',
        orderNo: orderNo2,
        remark: `商城订单 ${mallOrder.orderNo} 支付 ¥${payAmount}（余额抵扣 ¥${walletPaid.toFixed(2)}，${method === 'wechat' ? '微信' : '支付宝'}支付 ¥${externalAmount.toFixed(2)}）`,
      },
    })

    // 保存支付关联（PaymentOrder 记录关联关系）
    await prisma.paymentOrder.create({
      data: {
        userId,
        orderNo: orderNo2,
        type: 'mall',
        amount: payAmount,
        coins: 0,
        method,
        walletPaid,
        status: 'pending',
        remark: `商城订单 ${mallOrder.orderNo} → 支付订单 ${orderNo2}`,
      },
    }).catch(() => {})

    // ===== 调用支付网关生成付款二维码 =====
    try {
      let payResult: any = { paymentType: '', qrCode: null, codeUrl: null, payUrl: null }

      if (method === 'alipay') {
        const { createAlipayPagePayUrl } = await import('../services/alipay.service.js')
        const notifyUrl = `https://aigc.fushtn.com/api/payment/alipay/notify`
        const returnUrl = `https://aigc.fushtn.com/mall/orders`
        const { payUrl, qrCode } = await createAlipayPagePayUrl({
          outTradeNo: orderNo2,
          subject: `商城订单 ${mallOrder.orderNo}`,
          totalAmount: externalAmount,
          returnUrl,
          notifyUrl,
        })
        await prisma.rechargeOrder.update({ where: { id: rechargeOrder.id }, data: { payMethod: 'alipay_secret' } })
        if (qrCode) {
          payResult = { paymentType: 'alipay_qr', qrCode }
        } else {
          payResult = { paymentType: 'alipay_page', payUrl }
        }
      } else if (method === 'wechat') {
        const { createWxpayNativeQrCode } = await import('../services/wxpay.service.js')
        const notifyUrl = `https://aigc.fushtn.com/api/payment/wxpay/notify`
        const { codeUrl } = await createWxpayNativeQrCode({
          outTradeNo: orderNo2,
          description: `商城订单 ${mallOrder.orderNo}`,
          totalAmount: externalAmount,
          notifyUrl,
        })
        await prisma.rechargeOrder.update({ where: { id: rechargeOrder.id }, data: { payMethod: 'wxpay_native' } })
        payResult = { paymentType: 'wxpay_qr', codeUrl }
      }

      return {
        success: true,
        data: {
          orderNo: mallOrder.orderNo,
          amount: payAmount,
          method,
          walletPaid,
          externalAmount,
          paymentType: payResult.paymentType,
          qrCode: payResult.qrCode,
          codeUrl: payResult.codeUrl,
          payUrl: payResult.payUrl,
          rechargeOrderId: rechargeOrder.id,
          needPoll: true,
          status: 'pending',
        },
      }
    } catch (err: any) {
      console.error('[Mall/Pay] 支付创建失败:', err.message)
      // 支付失败，降级到收款码模式
      const qrConfig = await prisma.paymentConfig.findUnique({ where: { method } })
      if (qrConfig?.enabled) {
        const qc = typeof qrConfig.config === 'string' ? JSON.parse(qrConfig.config) : (qrConfig.config || {})
        return {
          success: true,
          data: {
            orderNo: mallOrder.orderNo,
            amount: mallOrder.payAmount,
            method,
            paymentType: 'qrcode_manual',
            qrCodeUrl: qc?.qrcodeUrl || qc?.qrCodeUrl || qc?.qrcode || null,
            account: qc?.account || qc?.alipayAccount || qc?.wechatAccount || null,
            payeeName: qc?.name || qc?.payeeName || null,
            needPoll: false,
            status: 'pending',
          },
        }
      }
      return reply.status(500).send({ success: false, error: '支付创建失败: ' + err.message })
    }
  })

  /** GET /api/mall/orders/:orderNo/pay-status — 轮询支付状态（与 VIP 共用 /api/payment/alipay/status/:orderId） */
  app.get('/api/mall/orders/:orderNo/pay-status', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const { orderNo } = request.params as any
    const { rechargeOrderId } = request.query as any

    if (!rechargeOrderId) {
      return { success: true, data: { status: 'pending' } }
    }

    // 查 RechargeOrder 状态（与 VIP 轮询共用同一张表）
    const ro = await prisma.rechargeOrder.findUnique({ where: { id: rechargeOrderId } })
    if (!ro) {
      return { success: true, data: { status: 'pending' } }
    }

    if (ro.status === 'paid') {
      // 同步标记 MallOrder
      await prisma.mallOrder.updateMany({
        where: { orderNo, userId: user.id, status: 'pending' },
        data: { status: 'paid', paidAt: new Date() },
      })
      // 赠送优惠券
      await handleGiftCoupons(user.id, orderNo)
      return { success: true, data: { status: 'paid' } }
    }

    return { success: true, data: { status: ro.status } }
  })

  /** POST /api/mall/orders/:orderNo/confirm-pay — 用户确认已付款（收款码模式用） */
  app.post('/api/mall/orders/:orderNo/confirm-pay', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const { orderNo } = request.params as any
    const order = await prisma.mallOrder.findFirst({
      where: { orderNo, userId: user.id, status: 'pending' },
    })
    if (!order) {
      return reply.status(404).send({ success: false, error: '订单不存在或状态不正确' })
    }

    // 标记关联的 RechargeOrder
    await prisma.rechargeOrder.updateMany({
      where: { userId: user.id, status: 'pending', remark: { contains: orderNo } },
      data: { status: 'paid', payTime: new Date() },
    }).catch(() => {})

    const updated = await prisma.mallOrder.update({
      where: { id: order.id },
      data: { status: 'paid', paidAt: new Date() },
    })
    // 赠送优惠券
    await handleGiftCoupons(user.id, orderNo)
    return { success: true, data: updated }
  })

  /** PUT /api/mall/orders/:orderNo/cancel — 取消订单 */
  app.put('/api/mall/orders/:orderNo/cancel', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const { orderNo } = request.params as any
    const order = await prisma.mallOrder.findFirst({
      where: { orderNo, userId: user.id, status: { in: ['pending', 'paid'] } },
      include: { items: true },
    })
    if (!order) {
      return reply.status(404).send({ success: false, error: '订单不存在或无法取消' })
    }

    await prisma.$transaction(async (tx) => {
      // 恢复库存
      for (const item of order.items) {
        await tx.mallProduct.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity }, sales: { decrement: item.quantity } },
        })
      }
      // 恢复优惠券
      if (order.couponId) {
        await tx.mallUserCoupon.updateMany({
          where: { orderNo, usedAt: { not: null } },
          data: { usedAt: null, orderNo: null },
        })
      }
      await tx.mallOrder.update({
        where: { id: order.id },
        data: { status: 'cancelled', cancelledAt: new Date() },
      })
    })

    return { success: true, data: null }
  })

  /** POST /api/mall/orders/:orderNo/confirm — 确认收货 */
  app.post('/api/mall/orders/:orderNo/confirm', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const { orderNo } = request.params as any
    const order = await prisma.mallOrder.findFirst({
      where: { orderNo, userId: user.id, status: 'shipped' },
    })
    if (!order) {
      return reply.status(404).send({ success: false, error: '订单不存在或状态不正确' })
    }

    const updated = await prisma.mallOrder.update({
      where: { id: order.id },
      data: { status: 'completed', completedAt: new Date() },
    })
    return { success: true, data: updated }
  })

  // ============================================================
  // 统计 — 需要 admin 权限
  // ============================================================

  /** GET /api/mall/stats — 商城统计（admin） */
  app.get('/api/mall/stats', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as any
    if (user.role !== 'admin') {
      return reply.status(403).send({ success: false, error: '无权访问' })
    }

    const [productCount, categoryCount, orderCount, totalRevenue, pendingCount, paidCount, shippedCount] =
      await Promise.all([
        prisma.mallProduct.count({ where: { deletedAt: null } }),
        prisma.mallCategory.count({ where: { deletedAt: null } }),
        prisma.mallOrder.count(),
        prisma.mallOrder.aggregate({ _sum: { payAmount: true }, where: { status: { not: 'cancelled' } } }),
        prisma.mallOrder.count({ where: { status: 'pending' } }),
        prisma.mallOrder.count({ where: { status: 'paid' } }),
        prisma.mallOrder.count({ where: { status: 'shipped' } }),
      ])

    return {
      success: true,
      data: {
        productCount,
        categoryCount,
        orderCount,
        totalRevenue: totalRevenue._sum.payAmount || 0,
        pendingCount,
        paidCount,
        shippedCount,
      },
    }
  })
}
