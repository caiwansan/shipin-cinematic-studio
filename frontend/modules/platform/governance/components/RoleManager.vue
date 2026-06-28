<template>
  <div class="role-manager">
    <h3>角色管理</h3>
    <div class="role-grid">
      <div v-for="role in roles" :key="role.id" class="role-card">
        <div class="role-name">{{ role.name }}</div>
        <div class="role-code">{{ role.code }}</div>
        <div class="role-caps">
          <span v-for="cap in role.capabilities" :key="cap" class="cap-badge">{{ cap }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Role } from '../types'
defineProps<{ roles: Role[] }>()
</script>

<style scoped>
.role-manager { padding: 16px; }
.role-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; }
.role-card { border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; }
.role-name { font-weight: 600; font-size: 16px; }
.role-code { font-size: 12px; color: #999; margin-bottom: 8px; }
.role-caps { display: flex; flex-wrap: wrap; gap: 4px; }
.cap-badge { padding: 2px 8px; background: #e6f7ff; border-radius: 4px; font-size: 12px; color: #1677ff; border: 1px solid #91d5ff; }
</style>
