/**
 * GEO Workspace Router Plugin
 *
 * Registers sub-routes for GEO workspace pages under /workspace/geo/...
 * This plugin adds routes programmatically since the pages exist in
 * frontend/workspaces/geo/pages/ (outside Nuxt's pages/ directory).
 */
import { defineNuxtPlugin } from '#app'
import { geoRoutes } from '../workspaces/geo/router'

export default defineNuxtPlugin((nuxtApp) => {
  const router = nuxtApp.$router
  if (router) {
    for (const route of geoRoutes) {
      router.addRoute(route)
    }
  }
})
