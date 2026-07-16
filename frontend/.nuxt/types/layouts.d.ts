import type { ComputedRef, MaybeRef } from 'vue'
export type LayoutKey = "geo-workspace-layout" | "admin-aigc" | "default" | "enterprise" | "user" | "vip" | "workbench"
declare module "../../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/pages/runtime/composables" {
  interface PageMeta {
    layout?: MaybeRef<LayoutKey | false> | ComputedRef<LayoutKey | false>
  }
}