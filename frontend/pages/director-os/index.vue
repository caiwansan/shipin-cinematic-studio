<script setup lang="ts">
definePageMeta({ layout: false })
if (process.client) {
  navigateTo('/director-os/aigc/overview', { replace: true })
}
</script>
