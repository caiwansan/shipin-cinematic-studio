<template>
  <div class="max-w-2xl mx-auto px-4 py-6">
    <!-- Back -->
    <div class="flex items-center gap-3 mb-6">
      <button
        class="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        @click="goBack"
      >
        ← 返回品牌列表
      </button>
      <NuxtLink
        to="/"
        class="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
      >
        🏠 返回首页
      </NuxtLink>
    </div>

    <!-- Page Header -->
    <h1 class="text-2xl font-bold text-gray-900 mb-6">创建品牌项目</h1>

    <!-- ===== STATE: Error ===== -->
    <div v-if="store.error" class="mb-4">
      <ErrorBanner
        :title="store.error"
        message=""
        dismissible
        @dismiss="store.clearError()"
      />
    </div>

    <!-- Form -->
    <form @submit.prevent="handleSubmit" class="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
      <!-- Brand Name -->
      <div>
        <label for="name" class="block text-sm font-medium text-gray-700 mb-1">
          品牌名称 <span class="text-red-500">*</span>
        </label>
        <DSInput
          id="name"
          v-model="form.name"
          placeholder="例如：Acme Robotics"
          :disabled="isSubmitting"
          required
        />
      </div>

      <!-- Website -->
      <div>
        <label for="website" class="block text-sm font-medium text-gray-700 mb-1">
          网站地址 <span class="text-red-500">*</span>
        </label>
        <DSInput
          id="website"
          v-model="form.website"
          placeholder="https://example.com"
          type="url"
          :disabled="isSubmitting"
          required
        />
      </div>

      <!-- Industry -->
      <div>
        <label for="industry" class="block text-sm font-medium text-gray-700 mb-1">
          所属行业
        </label>
        <DSInput
          id="industry"
          v-model="form.industry"
          placeholder="例如：人工智能、电商、金融科技"
          :disabled="isSubmitting"
        />
        <p class="text-xs text-gray-400 mt-1">可选，帮助优化扫描分析</p>
      </div>

      <!-- Keywords -->
      <div>
        <label for="keywords" class="block text-sm font-medium text-gray-700 mb-1">
          关键词
        </label>
        <DSInput
          id="keywords"
          v-model="form.keywords"
          placeholder="例如：机器人、自动化、AI"
          :disabled="isSubmitting"
        />
        <p class="text-xs text-gray-400 mt-1">可选，多个关键词用逗号分隔</p>
      </div>

      <!-- Scan After Create Option -->
      <div class="flex items-center gap-2">
        <input
          id="trigger-scan"
          v-model="triggerScanAfterCreate"
          type="checkbox"
          class="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
        />
        <label for="trigger-scan" class="text-sm text-gray-600">
          创建后立即触发扫描
        </label>
      </div>

      <!-- Submit Button -->
      <div class="flex items-center gap-3 pt-2">
        <DSButton
          type="submit"
          variant="primary"
          :disabled="isSubmitting || !form.name || !form.website"
        >
          <span v-if="isSubmitting" class="flex items-center gap-2">
            <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            创建中...
          </span>
          <span v-else>创建项目</span>
        </DSButton>
        <DSButton variant="secondary" @click="goBack" :disabled="isSubmitting">
          取消
        </DSButton>
      </div>
    </form>

    <!-- Info Panel -->
    <div class="mt-6 bg-blue-50 border border-blue-100 rounded-lg p-4">
      <h3 class="text-sm font-medium text-blue-800 mb-1">关于品牌扫描</h3>
      <p class="text-sm text-blue-600 leading-relaxed">
        创建品牌项目后，系统将自动分析你的品牌在 AI 系统中的可见度、准确性、一致性和推荐意愿。
        首次扫描约需 90 秒，完成后即可查看详细的维度评分和优化建议。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useScanStore } from '../stores/useScanStore'
import ErrorBanner from '~/design-system/components/ErrorBanner/index.vue'
import DSButton from '~/design-system/primitives/Button/index.vue'
import DSInput from '~/design-system/primitives/Input/index.vue'

definePageMeta({
  title: '创建品牌',
})

const router = useRouter()
const store = useScanStore()

const form = reactive({
  name: '',
  website: '',
  industry: '',
  keywords: '',
})
const triggerScanAfterCreate = ref(true)
const isSubmitting = ref(false)

async function handleSubmit() {
  if (!form.name || !form.website) return

  isSubmitting.value = true
  store.clearError()

  try {
    const project = await store.createNewProject({
      name: form.name,
      website: form.website,
      industry: form.industry || undefined,
      keywords: form.keywords || undefined,
    })

    if (project) {
      if (triggerScanAfterCreate.value) {
        // Start scan and navigate to detail page
        const scanResult = await store.startScan(project.id)
        if (scanResult) {
          store.addScanHistory(project.id, {
            scanId: scanResult.scanId,
            status: 'pending',
            startedAt: new Date().toISOString(),
          })
        }
      }
      router.push(`/workspace/geo/brand/${project.id}`)
    }
  } finally {
    isSubmitting.value = false
  }
}

function goBack() {
  router.push('/workspace/geo/dashboard')
}
</script>
