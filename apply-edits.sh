#!/bin/bash
# Re-apply all our edits to index.vue from backup
set -e

cd /root/shipin-cinematic-studio/frontend
FILE=pages/index.vue

# First create stores/auth
mkdir -p stores
cat > stores/auth.ts << 'EOF'
import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: '',
    user: null,
  }),
  getters: {
    isLoggedIn: (state) => !!state.token,
  },
  actions: {
    setToken(token: string) {
      this.token = token
    },
    setUser(user: any) {
      this.user = user
    },
    logout() {
      this.token = ''
      this.user = null
    },
  },
})
EOF
echo "Created stores/auth.ts"
