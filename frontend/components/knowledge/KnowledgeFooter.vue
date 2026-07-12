<template>
  <div class="bg-white">
    <div class="max-w-4xl mx-auto px-4 py-8">
      <div class="border-t border-gray-200 pt-6 text-sm text-gray-400 text-center">
        <p>© {{ currentYear }} 昆仑镜. All rights reserved.</p>
        <p class="mt-1">由 昆仑镜 知识引擎驱动</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ manifest: any }>()

const currentYear = computed(() => new Date().getFullYear())
</script>
