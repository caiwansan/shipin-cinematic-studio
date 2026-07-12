<template>
  <div class="flex gap-2">
    <!-- 省 -->
    <select v-model="selectedProvince" @change="onProvinceChange"
      class="flex-1 px-3 py-2 rounded-lg bg-[#0B1020] border border-[#1a1a24] text-xs text-white outline-none focus:border-blue-500/50 appearance-none cursor-pointer">
      <option value="">选择省份</option>
      <option v-for="p in provinces" :key="p.code" :value="p.code">{{ p.name }}</option>
    </select>
    <!-- 市 -->
    <select v-model="selectedCity" @change="onCityChange"
      class="flex-1 px-3 py-2 rounded-lg bg-[#0B1020] border border-[#1a1a24] text-xs text-white outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
      :disabled="!selectedProvince">
      <option value="">选择城市</option>
      <option v-for="c in cities" :key="c.code" :value="c.code">{{ c.name }}</option>
    </select>
    <!-- 区县 -->
    <select v-model="selectedDistrict" @change="onDistrictChange"
      class="flex-1 px-3 py-2 rounded-lg bg-[#0B1020] border border-[#1a1a24] text-xs text-white outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
      :disabled="!selectedCity">
      <option value="">选择区县</option>
      <option v-for="d in districts" :key="d.code" :value="d.code">{{ d.name }}</option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const emit = defineEmits<{
  change: [data: { provinceCode: string; provinceName: string; cityCode: string; cityName: string; districtCode: string; districtName: string } | null]
}>()

const selectedProvince = ref('')
const selectedCity = ref('')
const selectedDistrict = ref('')

// pca-code.json 格式: { "86": { "110000":"北京市","110100":"市辖区" }, "110000": { "110100":"市辖区" }, "110100": { "110101":"东城区", ... } }
interface PcaFlat {
  [yearOrCode: string]: { [code: string]: string }
}

const rawData = ref<PcaFlat>({})
const provinces = ref<{ code: string; name: string }[]>([])
const cities = ref<{ code: string; name: string }[]>([])
const districts = ref<{ code: string; name: string }[]>([])

// 省 code 前缀: 两位数字 + 0000（如 110000、120000）
function isProvinceCode(code: string): boolean {
  return code.length === 6 && code.endsWith('0000')
}
// 市 code 前缀: 四位数字 + 00（如 110100、120100）
function isCityCode(code: string): boolean {
  return code.length === 6 && code.endsWith('00') && !code.endsWith('0000')
}
// 区县 code: 完整的 6 位
function isDistrictCode(code: string): boolean {
  return code.length === 6 && !code.endsWith('00')
}

onMounted(async () => {
  try {
    const res = await fetch('/pca-code.json?t=' + Date.now())
    if (res.ok) {
      const json = await res.json() as PcaFlat
      rawData.value = json
      // 从 "86" 键获取省份列表（全国统计用年，含所有省份）
      const provinceMap = json['86'] || {}
      provinces.value = Object.entries(provinceMap)
        .filter(([code]) => isProvinceCode(code))
        .map(([code, name]) => ({ code, name }))
    }
  } catch (e) {
    console.error('Failed to load pca-code.json', e)
  }
})

function onProvinceChange() {
  selectedCity.value = ''
  selectedDistrict.value = ''
  cities.value = []
  districts.value = []
  if (selectedProvince.value) {
    // 从 rawData 中找该省对应的城市
    const cityMap = rawData.value[selectedProvince.value]
    if (cityMap) {
      cities.value = Object.entries(cityMap)
        .filter(([code]) => isCityCode(code))
        .map(([code, name]) => ({ code, name }))
    }
  }
  emitChange()
}

function onCityChange() {
  selectedDistrict.value = ''
  districts.value = []
  if (selectedCity.value) {
    // 从 rawData 中找该市对应的区县
    const districtMap = rawData.value[selectedCity.value]
    if (districtMap) {
      districts.value = Object.entries(districtMap)
        .filter(([code]) => isDistrictCode(code))
        .map(([code, name]) => ({ code, name }))
    }
  }
  emitChange()
}

function onDistrictChange() {
  emitChange()
}

function emitChange() {
  if (selectedProvince.value && selectedCity.value && selectedDistrict.value) {
    const provinceName = provinces.value.find(p => p.code === selectedProvince.value)?.name || ''
    const cityName = cities.value.find(c => c.code === selectedCity.value)?.name || ''
    const districtName = districts.value.find(d => d.code === selectedDistrict.value)?.name || ''
    emit('change', {
      provinceCode: selectedProvince.value,
      provinceName,
      cityCode: selectedCity.value,
      cityName,
      districtCode: selectedDistrict.value,
      districtName,
    })
  } else {
    emit('change', null)
  }
}
</script>
