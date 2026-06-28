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

// 原始数据：嵌套数组 [{code, name, children: [{code, name, children: []}]}]
const rawData = ref<any[]>([])

const provinces = ref<{ code: string; name: string }[]>([])
const cities = ref<{ code: string; name: string }[]>([])
const districts = ref<{ code: string; name: string }[]>([])

onMounted(async () => {
  try {
    const res = await fetch('/pca-code.json')
    if (res.ok) {
      rawData.value = await res.json()
      // 顶级就是省份数组
      provinces.value = rawData.value.map((p: any) => ({
        code: p.code,
        name: p.name,
      }))
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
    const province = rawData.value.find((p: any) => p.code === selectedProvince.value)
    if (province?.children) {
      cities.value = province.children.map((c: any) => ({
        code: c.code,
        name: c.name,
      }))
    }
  }
  emitChange()
}

function onCityChange() {
  selectedDistrict.value = ''
  districts.value = []
  if (selectedCity.value) {
    // 找到所选省份的城市，再找该城市的区县
    const province = rawData.value.find((p: any) => p.code === selectedProvince.value)
    const city = province?.children?.find((c: any) => c.code === selectedCity.value)
    if (city?.children) {
      districts.value = city.children.map((d: any) => ({
        code: d.code,
        name: d.name,
      }))
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
