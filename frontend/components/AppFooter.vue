<template>
  <footer style="text-align:center;padding:20px 16px 28px;font-size:0.7rem;color:#a0a4b8;line-height:2;background:#0a0e1a;border-top:1px solid rgba(255,255,255,0.06)">
    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;max-width:680px;margin:0 auto">
      <!-- 企业/业务说明 -->
      <div v-if="company || business" style="color:#c8cbe0">
        <template v-if="company">{{ company }}</template>
        <template v-if="company && business"> · </template>
        <template v-if="business">{{ business }}</template>
      </div>

      <!-- 备案号 + 许可证 -->
      <div style="display:flex;justify-content:center;gap:14px;flex-wrap:wrap">
        <a v-if="icpBeian" :href="'https://beian.miit.gov.cn/'" target="_blank" rel="noopener noreferrer"
           style="color:#a0a4b8;text-decoration:none;transition:color 0.2s"
           @mouseover="$event.target.style.color='#fff'"
           @mouseout="$event.target.style.color='#a0a4b8'">
          {{ icpBeian }}
        </a>
        <span v-if="icpLicense" style="color:#a0a4b8">{{ icpLicense }}</span>
      </div>

      <!-- 版权 -->
      <div v-if="copyright" style="color:#7a7e92;font-size:0.65rem">{{ copyright }}</div>
    </div>
  </footer>
</template>

<script setup lang="ts">
const icpBeian = ref('')
const icpLicense = ref('')
const company = ref('')
const business = ref('')
const copyright = ref('')

onMounted(async () => {
  try {
    const data = await $fetch('/api/system/config')
    if (data?.icp_beian) icpBeian.value = data.icp_beian
    if (data?.icp_license) icpLicense.value = data.icp_license
    if (data?.icp_company) company.value = data.icp_company
    if (data?.icp_business) business.value = data.icp_business
    if (data?.icp_copyright) copyright.value = data.icp_copyright
  } catch {}
})
</script>
