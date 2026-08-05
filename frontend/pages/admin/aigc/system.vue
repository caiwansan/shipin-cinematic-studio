<template>
  <div class="space-y-6 max-w-3xl">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-sm text-white/70 font-medium">⚙️ 系统设置</h2>
        <p class="text-[10px] text-gray-600 mt-0.5">平台身份与 SEO 配置，官网/后台/公开页面统一读取</p>
      </div>
      <button @click="save" :disabled="saving"
        class="px-4 py-1.5 text-xs bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-all disabled:opacity-50">
        {{ saving ? '保存中...' : '💾 保存' }}
      </button>
    </div>

    <!-- Tab 切换 -->
    <div class="flex gap-1 border-b border-[#1A2240]">
      <button v-for="t in tabs" :key="t.id" @click="tab = t.id"
        class="px-4 py-2 text-xs transition-all border-b-2 -mb-px"
        :class="tab === t.id ? 'text-blue-400 border-blue-500' : 'text-gray-500 border-transparent hover:text-gray-300'">
        {{ t.label }}
      </button>
    </div>

    <!-- ── 基础信息 ── -->
    <div v-if="tab === 'site'" class="space-y-4">
      <div class="grid grid-cols-1 gap-4">
        <div>
          <label class="text-[11px] text-gray-500 block mb-1.5">系统名称</label>
          <input v-model="cfg.site_name" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
        </div>
        <div>
          <label class="text-[11px] text-gray-500 block mb-1.5">网站标题（浏览器 Tab / 首页 Title）</label>
          <input v-model="cfg.site_title" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
        </div>
        <div>
          <label class="text-[11px] text-gray-500 block mb-1.5">网站介绍（一句话）</label>
          <textarea v-model="cfg.site_intro" rows="2" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50 resize-none"></textarea>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">Logo 路径</label>
            <input v-model="cfg.site_logo" placeholder="/logo.png" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
            <p class="text-[9px] text-gray-700 mt-1">上传至 /public 后填相对路径，如 /logo.png</p>
          </div>
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">favicon 路径</label>
            <input v-model="cfg.site_favicon" placeholder="/favicon.ico" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
          </div>
        </div>
        <div>
          <label class="text-[11px] text-gray-500 block mb-1.5">官网域名</label>
          <input v-model="cfg.site_domain" placeholder="aigc.fushtn.com" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
          <p class="text-[9px] text-gray-700 mt-1">用于生成 sitemap.xml 完整 URL，不带 https://</p>
        </div>
        <div>
          <label class="text-[11px] text-gray-500 block mb-1.5">OG 分享图（可选）</label>
          <input v-model="cfg.og_image" placeholder="/og.png" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
        </div>
      </div>

      <!-- 财务/钻石兑换 -->
      <div class="border-t border-[#1A2240] pt-4">
        <h3 class="text-xs text-white/60 font-medium mb-3">💎 钻石兑换比例</h3>
        <div class="grid grid-cols-1 gap-4">
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">充值比例（1 元 = N 钻石）</label>
            <input v-model="cfg.diamond_exchange_rate" type="number" min="1" max="10000"
              class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
            <p class="text-[9px] text-gray-700 mt-1">默认 10（1:10）。影响充值钻石发放、档位展示与兑换汇率（1 钻 = {{ (1 / Math.max(1, Number(cfg.diamond_exchange_rate) || 10)).toFixed(2) }} 元）</p>
          </div>
        </div>
      </div>

      <!-- ICP -->
      <div class="border-t border-[#1A2240] pt-4">
        <h3 class="text-xs text-white/60 font-medium mb-3">ICP 备案信息</h3>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">ICP 备案号</label>
            <input v-model="cfg.icp_beian" placeholder="京ICP备xxxxxxxx号" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">许可证</label>
            <input v-model="cfg.icp_license" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">公司名称</label>
            <input v-model="cfg.icp_company" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">版权信息</label>
            <input v-model="cfg.icp_copyright" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
          </div>
        </div>
      </div>
    </div>

    <!-- ── SEO 设置 ── -->
    <div v-if="tab === 'seo'" class="space-y-4">
      <div class="grid grid-cols-1 gap-4">
        <div>
          <label class="text-[11px] text-gray-500 block mb-1.5">SEO 标题</label>
          <input v-model="cfg.seo_title" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
          <p class="text-[9px] text-gray-700 mt-1">建议 ≤ 60 字，当前 {{ cfg.seo_title?.length || 0 }} 字</p>
        </div>
        <div>
          <label class="text-[11px] text-gray-500 block mb-1.5">SEO 关键词</label>
          <input v-model="cfg.seo_keywords" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
        </div>
        <div>
          <label class="text-[11px] text-gray-500 block mb-1.5">SEO 描述</label>
          <textarea v-model="cfg.seo_description" rows="2" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50 resize-none"></textarea>
          <p class="text-[9px] text-gray-700 mt-1">建议 ≤ 150 字，当前 {{ cfg.seo_description?.length || 0 }} 字</p>
        </div>
        <div>
          <label class="text-[11px] text-gray-500 block mb-1.5">robots.txt 内容</label>
          <textarea v-model="cfg.seo_robots" rows="6" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 font-mono focus:outline-none focus:border-blue-500/50 resize-none"></textarea>
          <p class="text-[9px] text-gray-700 mt-1">保存后 /robots.txt 动态生效，自动附加 Sitemap 行</p>
        </div>
        <div>
          <label class="text-[11px] text-gray-500 block mb-1.5">sitemap 收录路径（每行一个，/ 开头）</label>
          <textarea v-model="cfg.seo_sitemap_urls" rows="4" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 font-mono focus:outline-none focus:border-blue-500/50 resize-none"></textarea>
          <p class="text-[9px] text-gray-700 mt-1">保存后 /sitemap.xml 动态生成，域名取「官网域名」</p>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">百度站长验证（可选）</label>
            <input v-model="cfg.seo_verify_baidu" placeholder="如：abc123def456" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label class="text-[11px] text-gray-500 block mb-1.5">Google 站长验证（可选）</label>
            <input v-model="cfg.seo_verify_google" placeholder="如：AbC-1234567890" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/50" />
          </div>
        </div>
      </div>

      <!-- 实时预览 -->
      <div class="border border-[#1A2240] rounded-xl p-4 bg-[#0B1020]/40">
        <h3 class="text-xs text-white/60 font-medium mb-2">🔍 搜索预览</h3>
        <div class="bg-white rounded-lg p-3">
          <div class="text-[13px] text-blue-600">{{ cfg.site_domain }}</div>
          <div class="text-[15px] text-[#1a0dab] leading-snug">{{ cfg.seo_title || cfg.site_title }}</div>
          <div class="text-[12px] text-gray-600 mt-1 leading-snug">{{ cfg.seo_description || cfg.site_description }}</div>
        </div>
      </div>
    </div>

    <div v-if="saved" class="fixed bottom-6 right-6 px-4 py-2.5 bg-green-500/15 border border-green-500/40 text-green-400 text-xs rounded-xl shadow-lg">✅ 配置已保存，已生效</div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin-aigc' })
import { ref, reactive, onMounted } from 'vue'

const tab = ref<'site' | 'seo'>('site')
const tabs = [
  { id: 'site', label: '基础信息' },
  { id: 'seo', label: 'SEO 设置' },
]
const saving = ref(false)
const saved = ref(false)

const cfg = reactive<Record<string, string>>({
  site_name: '', site_title: '', site_description: '', site_keywords: '',
  site_intro: '', site_logo: '/logo.png', site_favicon: '/favicon.ico',
  site_domain: '', og_image: '', icp_beian: '', icp_license: '',
  icp_company: '', icp_business: '', icp_copyright: '',
  diamond_exchange_rate: '10',
  seo_title: '', seo_keywords: '', seo_description: '',
  seo_robots: '', seo_sitemap_urls: '', seo_verify_baidu: '', seo_verify_google: '',
})

async function fetchConfig() {
  try {
    const token = window.localStorage?.getItem('auth_token')
    const res = await fetch('/api/admin/system/config', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (res.status === 401) { window.location.href = '/admin/aigc/login'; return }
    const data = await res.json()
    Object.assign(cfg, data)
  } catch { /* ignore */ }
}

async function save() {
  saving.value = true
  saved.value = false
  try {
    const token = window.localStorage?.getItem('auth_token')
    const res = await fetch('/api/admin/system/config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(cfg),
    })
    if (res.status === 401) { window.location.href = '/admin/aigc/login'; return }
    const data = await res.json()
    if (data.config) Object.assign(cfg, data.config)
    saved.value = true
    setTimeout(() => (saved.value = false), 2500)
  } catch { /* ignore */ } finally {
    saving.value = false
  }
}

onMounted(fetchConfig)
</script>
