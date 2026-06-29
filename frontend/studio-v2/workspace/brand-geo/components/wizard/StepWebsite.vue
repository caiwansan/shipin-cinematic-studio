<template>
  <div class="geo-wizard-step">
    <div class="geo-form-group">
      <label class="geo-form-label">官网 URL</label>
      <input
        class="geo-input"
        :value="modelValue.url"
        placeholder="https://example.com"
        @input="emit('update:modelValue', { ...modelValue, url: $event.target.value })"
      />
    </div>
    <div class="geo-form-group">
      <label class="geo-form-label">扫描选项</label>
      <div class="geo-wizard-options">
        <label class="geo-wizard-option">
          <input type="checkbox" v-model="modelValue.deepScan" />
          深度扫描
        </label>
        <label class="geo-wizard-option">
          <input type="checkbox" v-model="modelValue.extractMeta" />
          提取元数据
        </label>
        <label class="geo-wizard-option">
          <input type="checkbox" v-model="modelValue.autoDiscover" />
          自动发现实体
        </label>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({
      url: '',
      deepScan: true,
      extractMeta: true,
      autoDiscover: true
    })
  }
})

const emit = defineEmits(['update:modelValue'])
</script>
