/**
 * mall-admin.ts — 昆仑镜商城 v1.0 管理后台路由
 *
 * 前缀 /api/admin/mall
 * 所有路由需要 authenticate + 检查 user.role === 'admin'
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

/** admin preHandler: 先认证，再检查角色 */
async function adminOnly(request: any, reply: any) {
  if (!request.user?.role || !['admin', 'superadmin', 'operator'].includes(request.user.role)) {
    return reply.status(403).send({ success: false, error: '无权访问，仅限管理员' })
  }
}

export async function adminMallRoutes(app: FastifyInstance) {
  // 所有 admin 路由的前置钩子
  app.addHook('preHandler', app.authenticate)
  app.addHook('preHandler', adminOnly)

  // ============================================================
  // 商品管理
  // ============================================================

  /** GET /api/admin/mall/products — 商品列表（含下架/软删除） */
  app.get('/api/admin/mall/products', async (request, reply) => {
    const query = request.query as any
    const page = Math.max(1, parseInt(query.page || '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize || '20', 10)))
    const categoryId = query.categoryId as string | undefined
    const isActive = query.isActive !== undefined ? query.isActive === 'true' : undefined
    const search = query.search as string | undefined
    const includeDeleted = query.includeDeleted === 'true'

    const where: any = {}
    if (!includeDeleted) where.deletedAt = null
    if (categoryId) where.categoryId = categoryId
    if (isActive !== undefined) where.isActive = isActive
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

    return {
      success: true,
      data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    }
  })

  /** POST /api/admin/mall/products — 新增商品 */
  app.post('/api/admin/mall/products', async (request, reply) => {
    const body = request.body as any
    if (!body.name || body.price === undefined || body.price === null) {
      return reply.status(400).send({ success: false, error: '缺少必填字段 name/price' })
    }

    const product = await prisma.mallProduct.create({
      data: {
        categoryId: body.categoryId || null,
        name: body.name,
        subtitle: body.subtitle || null,
        cover: body.cover || null,
        images: body.images || [],
        video: body.video || null,
        detail: body.detail || null,
        originalPrice: body.originalPrice || 0,
        price: body.price,
        stock: body.stock || 0,
        isRecommend: !!body.isRecommend,
        isNew: !!body.isNew,
        isActive: body.isActive !== false,
        sort: body.sort || 0,
      },
    })
    return { success: true, data: product }
  })

  /** PUT /api/admin/mall/products/:id — 修改商品 */
  app.put('/api/admin/mall/products/:id', async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any

    const existing = await prisma.mallProduct.findFirst({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ success: false, error: '商品不存在' })
    }

    const product = await prisma.mallProduct.update({
      where: { id },
      data: {
        categoryId: body.categoryId !== undefined ? body.categoryId || null : undefined,
        name: body.name,
        subtitle: body.subtitle,
        cover: body.cover,
        images: body.images,
        video: body.video,
        detail: body.detail,
        originalPrice: body.originalPrice,
        price: body.price,
        stock: body.stock,
        isRecommend: body.isRecommend,
        isNew: body.isNew,
        isActive: body.isActive,
        sort: body.sort,
      },
    })
    return { success: true, data: product }
  })

  /** DELETE /api/admin/mall/products/:id — 软删除商品 */
  app.delete('/api/admin/mall/products/:id', async (request, reply) => {
    const { id } = request.params as any
    const existing = await prisma.mallProduct.findFirst({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ success: false, error: '商品不存在' })
    }
    await prisma.mallProduct.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    })
    return { success: true, data: null }
  })

  /** PUT /api/admin/mall/products/:id/toggle — 上架/下架 */
  app.put('/api/admin/mall/products/:id/toggle', async (request, reply) => {
    const { id } = request.params as any
    const existing = await prisma.mallProduct.findFirst({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ success: false, error: '商品不存在' })
    }
    const updated = await prisma.mallProduct.update({
      where: { id },
      data: { isActive: !existing.isActive },
    })
    return { success: true, data: updated }
  })

  /** PUT /api/admin/mall/products/:id/recommend — 设置推荐 */
  app.put('/api/admin/mall/products/:id/recommend', async (request, reply) => {
    const { id } = request.params as any
    const { isRecommend } = request.body as any
    const existing = await prisma.mallProduct.findFirst({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ success: false, error: '商品不存在' })
    }
    const updated = await prisma.mallProduct.update({
      where: { id },
      data: { isRecommend: !!isRecommend },
    })
    return { success: true, data: updated }
  })

  /** PUT /api/admin/mall/products/:id/new — 设置新品 */
  app.put('/api/admin/mall/products/:id/new', async (request, reply) => {
    const { id } = request.params as any
    const { isNew } = request.body as any
    const existing = await prisma.mallProduct.findFirst({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ success: false, error: '商品不存在' })
    }
    const updated = await prisma.mallProduct.update({
      where: { id },
      data: { isNew: !!isNew },
    })
    return { success: true, data: updated }
  })

  /** PUT /api/admin/mall/products/reorder — 批量排序 */
  app.put('/api/admin/mall/products/reorder', async (request, reply) => {
    const { items } = request.body as any
    if (!Array.isArray(items) || items.length === 0) {
      return reply.status(400).send({ success: false, error: '缺少 items 数组' })
    }
    await prisma.$transaction(
      items.map((item: { id: string; sort: number }) =>
        prisma.mallProduct.update({
          where: { id: item.id },
          data: { sort: item.sort },
        }),
      ),
    )
    return { success: true, data: null }
  })

  // ============================================================
  // 分类管理
  // ============================================================

  /** GET /api/admin/mall/categories — 分类列表（含隐藏） */
  app.get('/api/admin/mall/categories', async (_request, reply) => {
    const categories = await prisma.mallCategory.findMany({
      where: { deletedAt: null },
      orderBy: { sort: 'asc' },
      include: { _count: { select: { products: true } } },
    })
    return { success: true, data: categories }
  })

  /** POST /api/admin/mall/categories — 新增分类 */
  app.post('/api/admin/mall/categories', async (request, reply) => {
    const body = request.body as any
    if (!body.name) {
      return reply.status(400).send({ success: false, error: '缺少必填字段 name' })
    }
    const category = await prisma.mallCategory.create({
      data: {
        name: body.name,
        sort: body.sort || 0,
        visible: body.visible !== false,
      },
    })
    return { success: true, data: category }
  })

  /** PUT /api/admin/mall/categories/:id — 修改分类 */
  app.put('/api/admin/mall/categories/:id', async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any
    const existing = await prisma.mallCategory.findFirst({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ success: false, error: '分类不存在' })
    }
    const updated = await prisma.mallCategory.update({
      where: { id },
      data: {
        name: body.name,
        sort: body.sort,
        visible: body.visible,
      },
    })
    return { success: true, data: updated }
  })

  /** DELETE /api/admin/mall/categories/:id — 软删除分类 */
  app.delete('/api/admin/mall/categories/:id', async (request, reply) => {
    const { id } = request.params as any
    const existing = await prisma.mallCategory.findFirst({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ success: false, error: '分类不存在' })
    }
    await prisma.mallCategory.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
    return { success: true, data: null }
  })

  /** PUT /api/admin/mall/categories/reorder — 批量排序分类 */
  app.put('/api/admin/mall/categories/reorder', async (request, reply) => {
    const { items } = request.body as any
    if (!Array.isArray(items) || items.length === 0) {
      return reply.status(400).send({ success: false, error: '缺少 items 数组' })
    }
    await prisma.$transaction(
      items.map((item: { id: string; sort: number }) =>
        prisma.mallCategory.update({
          where: { id: item.id },
          data: { sort: item.sort },
        }),
      ),
    )
    return { success: true, data: null }
  })

  // ============================================================
  // Banner 管理
  // ============================================================

  /** GET /api/admin/mall/banners — Banner 列表 */
  app.get('/api/admin/mall/banners', async (_request, reply) => {
    const banners = await prisma.mallBanner.findMany({
      orderBy: { sort: 'asc' },
    })
    return { success: true, data: banners }
  })

  /** POST /api/admin/mall/banners — 新增 Banner */
  app.post('/api/admin/mall/banners', async (request, reply) => {
    const body = request.body as any
    if (!body.imageUrl) {
      return reply.status(400).send({ success: false, error: '缺少必填字段 imageUrl' })
    }
    const banner = await prisma.mallBanner.create({
      data: {
        imageUrl: body.imageUrl,
        linkType: body.linkType || null,
        linkValue: body.linkValue || null,
        sort: body.sort || 0,
        isActive: body.isActive !== false,
      },
    })
    return { success: true, data: banner }
  })

  /** PUT /api/admin/mall/banners/:id — 修改 Banner */
  app.put('/api/admin/mall/banners/:id', async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any
    const existing = await prisma.mallBanner.findFirst({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ success: false, error: 'Banner 不存在' })
    }
    const updated = await prisma.mallBanner.update({
      where: { id },
      data: {
        imageUrl: body.imageUrl,
        linkType: body.linkType,
        linkValue: body.linkValue,
        sort: body.sort,
        isActive: body.isActive,
      },
    })
    return { success: true, data: updated }
  })

  /** DELETE /api/admin/mall/banners/:id — 删除 Banner */
  app.delete('/api/admin/mall/banners/:id', async (request, reply) => {
    const { id } = request.params as any
    const existing = await prisma.mallBanner.findFirst({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ success: false, error: 'Banner 不存在' })
    }
    await prisma.mallBanner.delete({ where: { id } })
    return { success: true, data: null }
  })

  /** PUT /api/admin/mall/banners/reorder — 批量排序 Banner */
  app.put('/api/admin/mall/banners/reorder', async (request, reply) => {
    const { items } = request.body as any
    if (!Array.isArray(items) || items.length === 0) {
      return reply.status(400).send({ success: false, error: '缺少 items 数组' })
    }
    await prisma.$transaction(
      items.map((item: { id: string; sort: number }) =>
        prisma.mallBanner.update({
          where: { id: item.id },
          data: { sort: item.sort },
        }),
      ),
    )
    return { success: true, data: null }
  })

  // ============================================================
  // 优惠券管理
  // ============================================================

  /** GET /api/admin/mall/coupons — 优惠券列表 */
  app.get('/api/admin/mall/coupons', async (_request, reply) => {
    const coupons = await prisma.mallCoupon.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { userCoupons: true } } },
    })
    return { success: true, data: coupons }
  })

  /** POST /api/admin/mall/coupons — 新增优惠券 */
  app.post('/api/admin/mall/coupons', async (request, reply) => {
    const body = request.body as any
    if (!body.name || !body.type || body.value === undefined) {
      return reply.status(400).send({ success: false, error: '缺少必填字段 name/type/value' })
    }
    const coupon = await prisma.mallCoupon.create({
      data: {
        name: body.name,
        type: body.type,
        value: body.value,
        minAmount: body.minAmount || 0,
        maxPerUser: body.maxPerUser || 1,
        totalCount: body.totalCount || 0,
        startAt: body.startAt ? new Date(body.startAt) : null,
        endAt: body.endAt ? new Date(body.endAt) : null,
        isActive: body.isActive !== false,
        giftProductId: body.giftProductId || null,
        forVipPlan: body.forVipPlan || null,
        maxDiscountAmount: body.maxDiscountAmount || 0,
      },
    })
    return { success: true, data: coupon }
  })

  /** PUT /api/admin/mall/coupons/:id — 修改优惠券 */
  app.put('/api/admin/mall/coupons/:id', async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any
    const existing = await prisma.mallCoupon.findFirst({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ success: false, error: '优惠券不存在' })
    }
    const updated = await prisma.mallCoupon.update({
      where: { id },
      data: {
        name: body.name,
        type: body.type,
        value: body.value,
        minAmount: body.minAmount,
        maxPerUser: body.maxPerUser,
        totalCount: body.totalCount,
        startAt: body.startAt ? new Date(body.startAt) : undefined,
        endAt: body.endAt ? new Date(body.endAt) : undefined,
        isActive: body.isActive,
        giftProductId: body.giftProductId !== undefined ? body.giftProductId : undefined,
        forVipPlan: body.forVipPlan !== undefined ? body.forVipPlan : undefined,
        maxDiscountAmount: body.maxDiscountAmount !== undefined ? body.maxDiscountAmount : undefined,
      },
    })
    return { success: true, data: updated }
  })

  /** DELETE /api/admin/mall/coupons/:id — 软删除优惠券 */
  app.delete('/api/admin/mall/coupons/:id', async (request, reply) => {
    const { id } = request.params as any
    const existing = await prisma.mallCoupon.findFirst({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ success: false, error: '优惠券不存在' })
    }
    await prisma.mallCoupon.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    })
    return { success: true, data: null }
  })

  // ============================================================
  // 订单管理
  // ============================================================

  /** GET /api/admin/mall/orders — 订单列表 */
  app.get('/api/admin/mall/orders', async (request, reply) => {
    const query = request.query as any
    const page = Math.max(1, parseInt(query.page || '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize || '20', 10)))
    const status = query.status as string | undefined
    const search = query.search as string | undefined

    const where: any = {}
    if (status) where.status = status
    if (search) {
      where.OR = [
        { orderNo: { contains: search, mode: 'insensitive' } },
        { addressName: { contains: search, mode: 'insensitive' } },
        { addressPhone: { contains: search, mode: 'insensitive' } },
      ]
    }

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
      data: { items: orders, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    }
  })

  /** GET /api/admin/mall/orders/:orderNo — 订单详情 */
  app.get('/api/admin/mall/orders/:orderNo', async (request, reply) => {
    const { orderNo } = request.params as any
    const order = await prisma.mallOrder.findFirst({
      where: { orderNo },
      include: { items: { include: { product: { select: { id: true, name: true, cover: true } } } } },
    })
    if (!order) {
      return reply.status(404).send({ success: false, error: '订单不存在' })
    }
    return { success: true, data: order }
  })

  /** PUT /api/admin/mall/orders/:orderNo/ship — 发货 */
  app.put('/api/admin/mall/orders/:orderNo/ship', async (request, reply) => {
    const { orderNo } = request.params as any
    const { trackingNo } = request.body as any
    if (!trackingNo) {
      return reply.status(400).send({ success: false, error: '缺少 trackingNo' })
    }

    const order = await prisma.mallOrder.findFirst({
      where: { orderNo, status: 'paid' },
    })
    if (!order) {
      return reply.status(404).send({ success: false, error: '订单不存在或状态不正确' })
    }

    const updated = await prisma.mallOrder.update({
      where: { id: order.id },
      data: { status: 'shipped', trackingNo, shippedAt: new Date() },
    })
    return { success: true, data: updated }
  })

  /** PUT /api/admin/mall/orders/:orderNo/cancel — 后台取消订单 */
  app.put('/api/admin/mall/orders/:orderNo/cancel', async (request, reply) => {
    const { orderNo } = request.params as any
    const order = await prisma.mallOrder.findFirst({
      where: { orderNo, status: { in: ['pending', 'paid'] } },
      include: { items: true },
    })
    if (!order) {
      return reply.status(404).send({ success: false, error: '订单不存在或无法取消' })
    }

    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.mallProduct.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity }, sales: { decrement: item.quantity } },
        })
      }
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

  /** PUT /api/admin/mall/orders/:orderNo/refund — 退款 */
  app.put('/api/admin/mall/orders/:orderNo/refund', async (request, reply) => {
    const { orderNo } = request.params as any
    const order = await prisma.mallOrder.findFirst({
      where: { orderNo, status: { in: ['paid', 'shipped'] } },
      include: { items: true },
    })
    if (!order) {
      return reply.status(404).send({ success: false, error: '订单不存在或无法退款' })
    }

    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.mallProduct.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity }, sales: { decrement: item.quantity } },
        })
      }
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
}
