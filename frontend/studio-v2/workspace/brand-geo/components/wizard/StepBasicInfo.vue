<template>
  <div class="geo-wizard-step">
    <div class="geo-form-group">
      <label class="geo-form-label">品牌名称 *</label>
      <input
        class="geo-input"
        :value="modelValue.name"
        placeholder="输入品牌名称"
        @input="update('name', $event.target.value)"
      />
    </div>
    <div class="geo-form-group">
      <label class="geo-form-label">官网地址</label>
      <input
        class="geo-input"
        :value="modelValue.website"
        placeholder="https://example.com"
        @input="update('website', $event.target.value)"
      />
    </div>
    <div class="geo-form-row">
      <div class="geo-form-group">
        <label class="geo-form-label">行业</label>
        <input
          class="geo-input"
          :value="modelValue.industry"
          placeholder="如：科技、教育"
          @input="update('industry', $event.target.value)"
        />
      </div>
      <div class="geo-form-group">
        <label class="geo-form-label">地区</label>
        <input
          class="geo-input"
          :value="modelValue.region"
          placeholder="如：中国、美国"
          @input="update('region', $event.target.value)"
        />
      </div>
    </div>
    <div class="geo-form-group">
      <label class="geo-form-label">语言</label>
      <select
        class="geo-input"
        :value="modelValue.language"
        @change="update('language', $event.target.value)"
      >
        <option value="中文">中文</option>
        <option value="English">English</option>
        <option value="日本語">日本語</option>
        <option value="한국어">한국어</option>
      </select>
    </div>
    <div class="geo-form-group">
      <label class="geo-form-label">品牌描述</label>
      <textarea
        class="geo-input geo-textarea"
        :value="modelValue.description"
        rows="3"
        placeholder="简要描述品牌定位和背景"
        @input="update('description', $event.target.value)"
      />
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({
      name: '',
      website: '',
      industry: '',
      region: '',
      language: '中文',
      description: ''
    })
  }
})

const emit = defineEmits(['update:modelValue'])

function update(field, value) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}
</script>
