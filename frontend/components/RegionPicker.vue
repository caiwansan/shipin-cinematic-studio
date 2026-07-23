<template>
  <div class="flex gap-2">
    <!-- 省 -->
    <select
      v-model="selectedProvince"
      @change="onProvinceChange"
      class="region-select"
      :class="$attrs.class"
    >
      <option value="">{{ placeholders.province || '选择省份' }}</option>
      <option v-for="p in provinces" :key="p.code" :value="p.code">
        {{ p.name }}
      </option>
    </select>
    <!-- 市 -->
    <select
      v-model="selectedCity"
      @change="onCityChange"
      class="region-select"
      :class="$attrs.class"
      :disabled="!selectedProvince"
    >
      <option value="">{{ placeholders.city || '选择城市' }}</option>
      <option v-for="c in cities" :key="c.code" :value="c.code">
        {{ c.name }}
      </option>
    </select>
    <!-- 区县 -->
    <select
      v-model="selectedDistrict"
      @change="onDistrictChange"
      class="region-select"
      :class="$attrs.class"
      :disabled="!selectedCity"
    >
      <option value="">{{ placeholders.district || '选择区县' }}</option>
      <option v-for="d in districts" :key="d.code" :value="d.code">
        {{ d.name }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRegions } from '~/composables/useRegions'

const emit = defineEmits<{
  change: [
    data: {
      provinceCode: string
      provinceName: string
      cityCode: string
      cityName: string
      districtCode: string
      districtName: string
    } | null,
  ]
}>()

withDefaults(
  defineProps<{
    placeholders?: { province?: string; city?: string; district?: string }
  }>(),
  { placeholders: () => ({}) },
)

const { fetchProvinces, fetchCities, fetchDistricts } = useRegions()

const selectedProvince = defineModel<string>('selectedProvince', { default: '' })
const selectedCity = defineModel<string>('selectedCity', { default: '' })
const selectedDistrict = defineModel<string>('selectedDistrict', { default: '' })

const provinces = ref<{ code: string; name: string }[]>([])
const cities = ref<{ code: string; name: string }[]>([])
const districts = ref<{ code: string; name: string }[]>([])

async function loadProvinces() {
  provinces.value = await fetchProvinces()
}

function onProvinceChange() {
  selectedCity.value = ''
  selectedDistrict.value = ''
  cities.value = []
  districts.value = []
  if (selectedProvince.value) {
    fetchCities(selectedProvince.value).then((data) => {
      cities.value = data
    })
  }
  emitChange()
}

function onCityChange() {
  selectedDistrict.value = ''
  districts.value = []
  if (selectedCity.value) {
    fetchDistricts(selectedCity.value).then((data) => {
      districts.value = data
    })
  }
  emitChange()
}

function onDistrictChange() {
  emitChange()
}

function emitChange() {
  if (selectedProvince.value && selectedCity.value && selectedDistrict.value) {
    const provinceName =
      provinces.value.find((p) => p.code === selectedProvince.value)?.name || ''
    const cityName =
      cities.value.find((c) => c.code === selectedCity.value)?.name || ''
    const districtName =
      districts.value.find((d) => d.code === selectedDistrict.value)?.name || ''
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

onMounted(async () => {
  await loadProvinces()
})

defineOptions({ name: 'RegionPicker' })
</script>

<style scoped>
.region-select {
  flex: 1;
  min-width: 0;
  padding: 8px 6px;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.7);
  background: #0b1020;
  border: 1px solid #1a2240;
  border-radius: 8px;
  outline: none;
  appearance: none;
  cursor: pointer;
}
.region-select:focus {
  border-color: rgba(59, 130, 246, 0.5);
}
.region-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
