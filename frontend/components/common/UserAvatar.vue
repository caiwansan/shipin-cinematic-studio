<template>
  <span class="user-avatar" :class="[`user-avatar--${size}`, className]" :style="styleVar">
    <img v-if="src" :src="src" :alt="alt" class="user-avatar-img" @error="onError" />
    <span v-else class="user-avatar-char">{{ char }}</span>
    <span v-if="showBadge" class="user-avatar-badge" :style="{ background: badgeColor }">{{ badge }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

/**
 * MEMBER-CENTER-02 通用用户头像组件
 * - 全站兼容：首页 / 工作台 / 会员中心 / 聊天 / 社区 统一展示
 * - src 为空或加载失败 → 自动降级为首字母头像
 * - 尺寸：xs(20) sm(28) md(36) lg(48) xl(64) hero(96)
 */
const props = withDefaults(defineProps<{
  src?: string | null
  name?: string
  alt?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero'
  className?: string
  badge?: string
  badgeColor?: string
  showBadge?: boolean
  shape?: 'circle' | 'round'
}>(), {
  src: null,
  name: '',
  alt: '',
  size: 'md',
  className: '',
  badge: '',
  badgeColor: '#f59e0b',
  showBadge: false,
  shape: 'circle',
})

const imgFailed = ref(false)
const src = computed(() => (props.src && !imgFailed.value ? props.src : null))

const char = computed(() => {
  return (props.name || 'U').trim().charAt(0).toUpperCase() || 'U'
})

const styleVar = computed(() => ({
  '--avatar-badge-bg': props.badgeColor,
}))

function onError() {
  imgFailed.value = true
}
</script>

<style scoped>
.user-avatar {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  background: linear-gradient(135deg, #7c5c34, #b98a5a);
  color: #fff;
  font-weight: 600;
  user-select: none;
  vertical-align: middle;
}
.user-avatar--circle { border-radius: 50%; }
.user-avatar--round { border-radius: 12px; }

.user-avatar--xs { width: 20px; height: 20px; font-size: 10px; }
.user-avatar--sm { width: 28px; height: 28px; font-size: 13px; }
.user-avatar--md { width: 36px; height: 36px; font-size: 15px; }
.user-avatar--lg { width: 48px; height: 48px; font-size: 19px; }
.user-avatar--xl { width: 64px; height: 64px; font-size: 24px; }
.user-avatar--hero { width: 96px; height: 96px; font-size: 36px; }

.user-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.user-avatar-char {
  line-height: 1;
}
.user-avatar-badge {
  position: absolute;
  right: -2px;
  bottom: -2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
  color: #fff;
  border: 1.5px solid #fff;
  box-sizing: content-box;
}
</style>
