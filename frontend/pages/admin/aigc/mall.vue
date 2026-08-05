<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-sm text-white/70 font-medium">商城管理</h2>
    </div>

    <!-- 横向导航（参照法律工作台管理页） -->
    <div class="mall-tabs">
      <button
        v-for="tab in tabItems"
        :key="tab.id"
        :class="['mall-tab', { 'mall-tab--active': activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <AdminMallProductsTab
      v-if="activeTab === 'products'"
      :loading="productsLoading"
      :error="error"
      :products="products"
      :total="productsTotal"
      :page="productsPage"
      :totalPages="Math.ceil(productsTotal / 20)"
      :searchQuery="searchQuery"
      :categories="categories"
      :showForm="showProductForm"
      :editing="editingProduct"
      v-model:form="productForm"
      @search="searchProducts"
      @prevPage="productsPage > 1 && (productsPage--, fetchProducts())"
      @nextPage="productsPage < Math.ceil(productsTotal / 20) && (productsPage++, fetchProducts())"
      @openCreate="openProductCreate"
      @openEdit="openProductEdit"
      @save="saveProduct"
      @delete="deleteProduct"
      @toggleActive="toggleProductActive"
      @toggleRecommend="toggleProductRecommend"
      @toggleNew="toggleProductNew"
      @closeForm="closeProductForm"
    />

    <AdminMallCategoriesTab
      v-if="activeTab === 'categories'"
      :loading="categoriesLoading"
      :error="error"
      :categories="categories"
      :showForm="showCategoryForm"
      :editing="editingCategory"
      :form="categoryForm"
      @openCreate="openCategoryCreate"
      @openEdit="openCategoryEdit"
      @save="saveCategory"
      @delete="deleteCategory"
      @closeForm="closeCategoryForm"
    />

    <AdminMallBannersTab
      v-if="activeTab === 'banners'"
      :loading="bannersLoading"
      :error="error"
      :banners="banners"
      :showForm="showBannerForm"
      :editing="editingBanner"
      :form="bannerForm"
      @openCreate="openBannerCreate"
      @openEdit="openBannerEdit"
      @save="saveBanner"
      @delete="deleteBanner"
      @toggleActive="toggleBannerActive"
      @closeForm="closeBannerForm"
    />

    <AdminMallRecommendTab
      v-if="activeTab === 'recommend'"
      :loading="recommendLoading"
      :error="error"
      :products="products"
      @toggleRecommend="toggleProductRecommend"
      @toggleNew="toggleProductNew"
    />

    <AdminMallCouponsTab
      v-if="activeTab === 'coupons'"
      :loading="couponsLoading"
      :error="error"
      :coupons="coupons"
      :showForm="showCouponForm"
      :editing="editingCoupon"
      :form="couponForm"
      @openCreate="openCouponCreate"
      @openEdit="openCouponEdit"
      @save="saveCoupon"
      @delete="deleteCoupon"
      @closeForm="closeCouponForm"
    />

    <AdminMallOrdersTab
      v-if="activeTab === 'orders'"
      :loading="ordersLoading"
      :error="error"
      :orders="orders"
      :total="ordersTotal"
      :page="ordersPage"
      :totalPages="Math.ceil(ordersTotal / 20)"
      :orderSearch="orderSearch"
      :orderStatus="orderStatus"
      :detail="orderDetail"
      :showShip="showShipForm"
      :form="shipForm"
      @search="searchOrders"
      @prevOrderPage="ordersPage > 1 && (ordersPage--, fetchOrders())"
      @nextOrderPage="ordersPage < Math.ceil(ordersTotal / 20) && (ordersPage++, fetchOrders())"
      @filterStatus="(s: string) => { orderStatus = s; ordersPage = 1; fetchOrders() }"
      @viewDetail="viewOrderDetail"
      @openShip="openShipForm"
      @ship="doShip"
      @cancel="cancelOrder"
      @refund="refundOrder"
      @closeDetail="orderDetail = null"
      @closeShip="showShipForm = false"
    />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin-aigc' })
import { ref, onMounted } from 'vue'
import { getToken } from '~/utils/token-cache'

const API_PREFIX = '/api/admin/mall'

async function api(method: string, path: string, body?: any) {
  const token = getToken()
  const res = await fetch(`${API_PREFIX}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error || '请求失败')
  return json.data
}

const activeTab = ref('products')
const tabItems = [
  { id: 'products', label: '商品管理' },
  { id: 'categories', label: '分类管理' },
  { id: 'banners', label: 'Banner 管理' },
  { id: 'recommend', label: '推荐管理' },
  { id: 'coupons', label: '营销管理' },
  { id: 'orders', label: '订单管理' },
]
const error = ref('')

// ─── Products ───
const productsLoading = ref(false)
const products = ref<any[]>([])
const productsTotal = ref(0)
const productsPage = ref(1)
const searchQuery = ref('')
const showProductForm = ref(false)
const editingProduct = ref<any>(null)
const productForm = ref<any>({ name: '', price: 0, originalPrice: 0, stock: 0, categoryId: '', cover: '', images: [], detail: '', subtitle: '', isRecommend: false, isNew: false, isActive: true, sort: 0 })

async function fetchProducts() {
  productsLoading.value = true; error.value = ''
  try {
    const params = new URLSearchParams({ page: String(productsPage.value), pageSize: '20' })
    if (searchQuery.value) params.set('search', searchQuery.value)
    const data = await api('GET', `/products?${params}`)
    products.value = data.items
    productsTotal.value = data.total
  } catch (e: any) { error.value = e.message }
  productsLoading.value = false
}

function searchProducts() { productsPage.value = 1; fetchProducts() }

function openProductCreate() {
  editingProduct.value = null
  productForm.value = { name: '', price: 0, originalPrice: 0, stock: 0, categoryId: '', cover: '', images: [], detail: '', subtitle: '', isRecommend: false, isNew: false, isActive: true, sort: 0 }
  showProductForm.value = true
}
function openProductEdit(p: any) {
  editingProduct.value = p
  productForm.value = { ...p }
  showProductForm.value = true
}
function closeProductForm() { showProductForm.value = false; editingProduct.value = null }

async function saveProduct() {
  try {
    if (editingProduct.value) {
      await api('PUT', `/products/${editingProduct.value.id}`, productForm.value)
    } else {
      await api('POST', '/products', productForm.value)
    }
    closeProductForm()
    fetchProducts()
  } catch (e: any) { error.value = e.message }
}

async function deleteProduct(p: any) {
  if (!confirm('确定删除该商品？')) return
  try { await api('DELETE', `/products/${p.id}`); fetchProducts() }
  catch (e: any) { error.value = e.message }
}

async function toggleProductActive(p: any) {
  try { await api('PUT', `/products/${p.id}/toggle`); fetchProducts() }
  catch (e: any) { error.value = e.message }
}
async function toggleProductRecommend(p: any) {
  try { await api('PUT', `/products/${p.id}/recommend`, { isRecommend: !p.isRecommend }); fetchProducts() }
  catch (e: any) { error.value = e.message }
}
async function toggleProductNew(p: any) {
  try { await api('PUT', `/products/${p.id}/new`, { isNew: !p.isNew }); fetchProducts() }
  catch (e: any) { error.value = e.message }
}

// ─── Categories ───
const categoriesLoading = ref(false)
const categories = ref<any[]>([])
const showCategoryForm = ref(false)
const editingCategory = ref<any>(null)
const categoryForm = ref<any>({ name: '', sort: 0, visible: true })

async function fetchCategories() {
  categoriesLoading.value = true
  try { categories.value = await api('GET', '/categories') }
  catch (e: any) { error.value = e.message }
  categoriesLoading.value = false
}

function openCategoryCreate() {
  editingCategory.value = null
  categoryForm.value = { name: '', sort: 0, visible: true }
  showCategoryForm.value = true
}
function openCategoryEdit(c: any) {
  editingCategory.value = c
  categoryForm.value = { name: c.name, sort: c.sort, visible: c.visible }
  showCategoryForm.value = true
}
function closeCategoryForm() { showCategoryForm.value = false; editingCategory.value = null }

async function saveCategory() {
  try {
    if (editingCategory.value) {
      await api('PUT', `/categories/${editingCategory.value.id}`, categoryForm.value)
    } else {
      await api('POST', '/categories', categoryForm.value)
    }
    closeCategoryForm()
    fetchCategories()
  } catch (e: any) { error.value = e.message }
}

async function deleteCategory(c: any) {
  if (!confirm('确定删除该分类？')) return
  try { await api('DELETE', `/categories/${c.id}`); fetchCategories() }
  catch (e: any) { error.value = e.message }
}

// ─── Banners ───
const bannersLoading = ref(false)
const banners = ref<any[]>([])
const showBannerForm = ref(false)
const editingBanner = ref<any>(null)
const bannerForm = ref<any>({ image: '', imageUrl: '', link: '', linkValue: '', linkType: '', sortOrder: 0, isActive: true })

async function fetchBanners() {
  bannersLoading.value = true
  try { banners.value = await api('GET', '/banners') }
  catch (e: any) { error.value = e.message }
  bannersLoading.value = false
}

function openBannerCreate() {
  editingBanner.value = null
  bannerForm.value = { image: '', imageUrl: '', link: '', linkValue: '', linkType: '', sortOrder: 0, isActive: true }
  showBannerForm.value = true
}
function openBannerEdit(b: any) {
  editingBanner.value = b
  bannerForm.value = { image: b.image || b.imageUrl || '', imageUrl: b.imageUrl || b.image || '', link: b.link || b.linkValue || '', linkValue: b.linkValue || b.link || '', linkType: b.linkType || '', sortOrder: b.sortOrder ?? b.sort ?? 0, isActive: b.isActive }
  showBannerForm.value = true
}
function closeBannerForm() { showBannerForm.value = false; editingBanner.value = null }

async function saveBanner() {
  try {
    // 映射后端字段（imageUrl/linkType/linkValue/sort）
    const payload = {
      imageUrl: bannerForm.value.imageUrl || bannerForm.value.image,
      linkType: bannerForm.value.linkType || null,
      linkValue: bannerForm.value.linkValue || bannerForm.value.link || '',
      sort: bannerForm.value.sortOrder ?? 0,
      isActive: bannerForm.value.isActive,
    }
    if (editingBanner.value) {
      await api('PUT', `/banners/${editingBanner.value.id}`, payload)
    } else {
      await api('POST', '/banners', payload)
    }
    closeBannerForm()
    fetchBanners()
  } catch (e: any) { error.value = e.message }
}

async function deleteBanner(b: any) {
  if (!confirm('确定删除该 Banner？')) return
  try { await api('DELETE', `/banners/${b.id}`); fetchBanners() }
  catch (e: any) { error.value = e.message }
}

async function toggleBannerActive(b: any) {
  try { await api('PUT', `/banners/${b.id}`, { ...b, isActive: !b.isActive }); fetchBanners() }
  catch (e: any) { error.value = e.message }
}

// ─── Coupons ───
const couponsLoading = ref(false)
const coupons = ref<any[]>([])
const showCouponForm = ref(false)
const editingCoupon = ref<any>(null)
const couponForm = ref<any>({ name: '', type: 'discount', value: 0, minAmount: 0, maxPerUser: 1, totalCount: 0, startAt: '', endAt: '', isActive: true })

async function fetchCoupons() {
  couponsLoading.value = true
  try { coupons.value = await api('GET', '/coupons') }
  catch (e: any) { error.value = e.message }
  couponsLoading.value = false
}

function openCouponCreate() {
  editingCoupon.value = null
  couponForm.value = { name: '', type: 'discount', value: 0, minAmount: 0, maxPerUser: 1, totalCount: 0, startAt: '', endAt: '', isActive: true }
  showCouponForm.value = true
}
function openCouponEdit(c: any) {
  editingCoupon.value = c
  couponForm.value = { name: c.name, type: c.type, value: c.value, minAmount: c.minAmount, maxPerUser: c.maxPerUser, totalCount: c.totalCount, startAt: c.startAt || '', endAt: c.endAt || '', isActive: c.isActive }
  showCouponForm.value = true
}
function closeCouponForm() { showCouponForm.value = false; editingCoupon.value = null }

async function saveCoupon() {
  try {
    const payload = { ...couponForm.value }
    if (editingCoupon.value) {
      await api('PUT', `/coupons/${editingCoupon.value.id}`, payload)
    } else {
      await api('POST', '/coupons', payload)
    }
    closeCouponForm()
    fetchCoupons()
  } catch (e: any) { error.value = e.message }
}

async function deleteCoupon(c: any) {
  if (!confirm('确定删除该优惠券？')) return
  try { await api('DELETE', `/coupons/${c.id}`); fetchCoupons() }
  catch (e: any) { error.value = e.message }
}

// ─── Orders ───
const ordersLoading = ref(false)
const orders = ref<any[]>([])
const ordersTotal = ref(0)
const ordersPage = ref(1)
const orderSearch = ref('')
const orderStatus = ref('')
const orderDetail = ref<any>(null)
const showShipForm = ref(false)
const shipForm = ref({ trackingNo: '' })
const shippingOrderNo = ref('')

async function fetchOrders() {
  ordersLoading.value = true; error.value = ''
  try {
    const params = new URLSearchParams({ page: String(ordersPage.value), pageSize: '20' })
    if (orderSearch.value) params.set('search', orderSearch.value)
    if (orderStatus.value) params.set('status', orderStatus.value)
    const data = await api('GET', `/orders?${params}`)
    orders.value = data.items
    ordersTotal.value = data.total
  } catch (e: any) { error.value = e.message }
  ordersLoading.value = false
}

function searchOrders() { ordersPage.value = 1; fetchOrders() }

async function viewOrderDetail(orderNo: string) {
  try { orderDetail.value = await api('GET', `/orders/${orderNo}`) }
  catch (e: any) { error.value = e.message }
}

function openShipForm(orderNo: string) {
  shippingOrderNo.value = orderNo
  shipForm.value = { trackingNo: '' }
  showShipForm.value = true
}

async function doShip() {
  if (!shipForm.value.trackingNo) return
  try {
    await api('PUT', `/orders/${shippingOrderNo.value}/ship`, { trackingNo: shipForm.value.trackingNo })
    showShipForm.value = false
    fetchOrders()
    if (orderDetail.value) viewOrderDetail(shippingOrderNo.value)
  } catch (e: any) { error.value = e.message }
}

async function cancelOrder(orderNo: string) {
  if (!confirm('确定取消该订单？')) return
  try { await api('PUT', `/orders/${orderNo}/cancel`); fetchOrders() }
  catch (e: any) { error.value = e.message }
}

async function refundOrder(orderNo: string) {
  if (!confirm('确定退款该订单？')) return
  try { await api('PUT', `/orders/${orderNo}/refund`); fetchOrders() }
  catch (e: any) { error.value = e.message }
}

// ─── Init ───
onMounted(() => {
  fetchProducts()
  fetchCategories()
  fetchBanners()
  fetchCoupons()
  fetchOrders()
})
</script>

<style scoped>
/* 横向导航（参照法律工作台管理页设计） */
.mall-tabs { display: flex; gap: 4px; border-bottom: 1px solid rgba(248,246,241,0.08); margin-bottom: 4px; flex-wrap: wrap; }
.mall-tab { padding: 10px 18px; font-size: 13px; background: transparent; border: none; color: rgba(248,246,241,0.5); cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.15s; }
.mall-tab:hover { color: rgba(248,246,241,0.7); }
.mall-tab--active { color: #FBBF24; border-bottom-color: #FBBF24; }

.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
