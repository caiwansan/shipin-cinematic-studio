import type { ComputedRef, MaybeRef } from 'vue'
export type LayoutKey = "admin-aigc" | "default" | "user" | "vip" | "workbench"
declare module "../../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/pages/runtime/composables" {
  interface PageMeta {
    layout?: MaybeRef<LayoutKey | false> | ComputedRef<LayoutKey | false>
  }
}