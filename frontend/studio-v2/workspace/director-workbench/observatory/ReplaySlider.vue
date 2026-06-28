<template>
  <div class="w-full flex items-center gap-4 px-4 py-2 bg-gray-900 rounded-lg">
    <span class="text-xs text-gray-400 whitespace-nowrap">回放</span>
    <input
      type="range"
      min="0"
      :max="max"
      :value="modelValue"
      @input="onInput"
      class="flex-1 h-1 appearance-none bg-gray-700 rounded-full cursor-pointer
             accent-indigo-500 [&::-webkit-slider-thumb]:appearance-none
             [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
             [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-400"
    />
    <span class="text-xs text-gray-400 w-8 text-right tabular-nums">{{ modelValue }}</span>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: number
  max?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

function onInput(e: Event) {
  const target = e.target as HTMLInputElement
  emit('update:modelValue', Number(target.value))
}
</script>
