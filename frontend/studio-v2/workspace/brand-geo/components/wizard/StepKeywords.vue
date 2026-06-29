<template>
  <div class="geo-wizard-step">
    <div class="geo-form-group">
      <label class="geo-form-label">关键词（每行一个）</label>
      <textarea
        class="geo-input geo-textarea"
        :value="modelValue"
        rows="8"
        placeholder="品牌名称&#10;核心产品&#10;目标市场..."
        @input="emit('update:modelValue', $event.target.value)"
      />
      <p class="geo-form-hint">
        已输入 {{ keywordCount }} 个关键词
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue'])

const keywordCount = computed(() => {
  return props.modelValue
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean).length
})
</script>
