<template>
  <Teleport to="body">
    <Transition name="drawer-fade">
      <div v-if="open" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" @click="$emit('close')"></div>
    </Transition>
    <Transition name="drawer-slide">
      <aside v-if="open"
        class="fixed top-0 right-0 z-50 h-full w-[620px] max-w-[92vw] overflow-y-auto border-l border-white/[0.08]"
        style="background: #0B1120; box-shadow: -12px 0 48px rgba(0,0,0,0.5);">
        <div class="sticky top-0 z-10 flex items-center justify-between px-5 py-3.5" style="background: rgba(11,17,32,0.92); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,0.06);">
          <div class="flex items-center gap-2">
            <span class="text-base">{{ icon }}</span>
            <h3 class="text-sm font-semibold text-white/90">{{ title }}</h3>
            <span v-if="subtitle" class="text-[9px] text-gray-500 font-mono">{{ subtitle }}</span>
          </div>
          <button @click="$emit('close')" class="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer text-sm">✕</button>
        </div>
        <div class="p-5 space-y-4">
          <slot></slot>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  open: boolean
  title: string
  icon?: string
  subtitle?: string
}>()
defineEmits<{ (e: 'close'): void }>()
</script>

<style scoped>
.drawer-fade-enter-active, .drawer-fade-leave-active { transition: opacity 0.2s; }
.drawer-fade-enter-from, .drawer-fade-leave-to { opacity: 0; }
.drawer-slide-enter-active, .drawer-slide-leave-active { transition: transform 0.25s ease; }
.drawer-slide-enter-from, .drawer-slide-leave-to { transform: translateX(100%); }
</style>
