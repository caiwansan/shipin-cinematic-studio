<template>
  <section
    class="geo-card"
    :class="[`geo-card--${variant}`, className]"
  >
    <div v-if="title" class="geo-card__header">
      <h3 class="geo-card__title">{{ title }}</h3>
      <slot name="header-actions" />
    </div>
    <div class="geo-card__body">
      <slot />
    </div>
    <div v-if="$slots.footer" class="geo-card__footer">
      <slot name="footer" />
    </div>
  </section>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  variant?: string
  className?: string
}>(), {
  variant: 'outline',
  className: '',
})
</script>
