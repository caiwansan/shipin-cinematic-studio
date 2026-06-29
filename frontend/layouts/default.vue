<template>
  <div>
    <slot />
    <!-- @deprecated 智能客服 — V4.2 业务废弃，全局客服浮窗已隐藏，保留代码可恢复 -->
    <!-- <ClientOnly>
      <CustomerService />
    </ClientOnly> -->
  </div>
</template>

<script setup lang="ts">
// @deprecated CustomerService — V4.2 业务废弃
// import CustomerService from '~/components/customer/CustomerService.vue'
</script>
