
import type { DefineComponent, SlotsType } from 'vue'
type IslandComponent<T extends DefineComponent> = T & DefineComponent<{}, {refresh: () => Promise<void>}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, SlotsType<{ fallback: { error: unknown } }>>
type HydrationStrategies = {
  hydrateOnVisible?: IntersectionObserverInit | true
  hydrateOnIdle?: number | true
  hydrateOnInteraction?: keyof HTMLElementEventMap | Array<keyof HTMLElementEventMap> | true
  hydrateOnMediaQuery?: string
  hydrateAfter?: number
  hydrateWhen?: boolean
  hydrateNever?: true
}
type LazyComponent<T> = (T & DefineComponent<HydrationStrategies, {}, {}, {}, {}, {}, {}, { hydrated: () => void }>)
interface _GlobalComponents {
      'LibraryReaderPanel': typeof import("../components/LibraryReaderPanel.vue")['default']
    'RegionPicker': typeof import("../components/RegionPicker.vue")['default']
    'BusinessLoginModal': typeof import("../components/business/LoginModal.vue")['default']
    'CommunityHero': typeof import("../components/community/CommunityHero.vue")['default']
    'CommunityPostCard': typeof import("../components/community/CommunityPostCard.vue")['default']
    'CustomerService': typeof import("../components/customer/CustomerService.vue")['default']
    'DirectorLocalEngineInstaller': typeof import("../components/director/LocalEngineInstaller.vue")['default']
    'DirectorModelSettingsModal': typeof import("../components/director/ModelSettingsModal.vue")['default']
    'DirectorOllamaSetupModal': typeof import("../components/director/OllamaSetupModal.vue")['default']
    'HdzLibraryReaderPanel': typeof import("../components/hdz/LibraryReaderPanel.vue")['default']
    'KmkiUiActivityFeed': typeof import("../components/kmki-ui/ActivityFeed/index.vue")['default']
    'KmkiUiBadge': typeof import("../components/kmki-ui/Badge/index.vue")['default']
    'KmkiUiCard': typeof import("../components/kmki-ui/Card/index.vue")['default']
    'KmkiUiDiffViewer': typeof import("../components/kmki-ui/DiffViewer/index.vue")['default']
    'KmkiUiEmptyState': typeof import("../components/kmki-ui/EmptyState/index.vue")['default']
    'KmkiUiExplainPanel': typeof import("../components/kmki-ui/ExplainPanel/index.vue")['default']
    'KmkiUiHealthIndicator': typeof import("../components/kmki-ui/HealthIndicator/index.vue")['default']
    'KmkiUiMetric': typeof import("../components/kmki-ui/Metric/index.vue")['default']
    'KmkiUiSkeleton': typeof import("../components/kmki-ui/Skeleton/index.vue")['default']
    'KmkiUiTimeline': typeof import("../components/kmki-ui/Timeline/index.vue")['default']
    'KunlunBaseGlassPanel': typeof import("../components/kunlun/base/GlassPanel.vue")['default']
    'KunlunBaseMirrorPanel': typeof import("../components/kunlun/base/MirrorPanel.vue")['default']
    'KunlunBusinessKunlunFooter': typeof import("../components/kunlun/business/KunlunFooter.vue")['default']
    'KunlunBusinessKunlunNav': typeof import("../components/kunlun/business/KunlunNav.vue")['default']
    'KunlunCardsMirrorCard': typeof import("../components/kunlun/cards/MirrorCard.vue")['default']
    'KunlunCardsRealmCard': typeof import("../components/kunlun/cards/RealmCard.vue")['default']
    'KunlunCommonSceneErrorBoundary': typeof import("../components/kunlun/common/SceneErrorBoundary.vue")['default']
    'KunlunEffectsAuroraLayer': typeof import("../components/kunlun/effects/AuroraLayer.vue")['default']
    'KunlunEffectsLightBeam': typeof import("../components/kunlun/effects/LightBeam.vue")['default']
    'KunlunEffectsParticleField': typeof import("../components/kunlun/effects/ParticleField.vue")['default']
    'KunlunEffectsPrismBorder': typeof import("../components/kunlun/effects/PrismBorder.vue")['default']
    'KunlunHeroMirror': typeof import("../components/kunlun/hero/HeroMirror.vue")['default']
    'KunlunScenesChoiceLiberationScene': typeof import("../components/kunlun/scenes/ChoiceLiberationScene.vue")['default']
    'KunlunScenesCreationLawScene': typeof import("../components/kunlun/scenes/CreationLawScene.vue")['default']
    'KunlunScenesCreatorVoicesScene': typeof import("../components/kunlun/scenes/CreatorVoicesScene.vue")['default']
    'KunlunScenesFinalCTAScene': typeof import("../components/kunlun/scenes/FinalCTAScene.vue")['default']
    'KunlunScenesFourStepScene': typeof import("../components/kunlun/scenes/FourStepScene.vue")['default']
    'KunlunScenesHeroScene': typeof import("../components/kunlun/scenes/HeroScene.vue")['default']
    'KunlunScenesWenquxingScene': typeof import("../components/kunlun/scenes/WenquxingScene.vue")['default']
    'KunlunScenesWorkbenchUniverseScene': typeof import("../components/kunlun/scenes/WorkbenchUniverseScene.vue")['default']
    'R11CausePanel': typeof import("../components/r11/CausePanel.vue")['default']
    'R11DiffTimeline': typeof import("../components/r11/DiffTimeline.vue")['default']
    'R11DriftMonitor': typeof import("../components/r11/DriftMonitor.vue")['default']
    'R11GraphRenderer': typeof import("../components/r11/GraphRenderer.vue")['default']
    'R11ReplayInspector': typeof import("../components/r11/ReplayInspector.vue")['default']
    'R11StabilityDashboard': typeof import("../components/r11/StabilityDashboard.vue")['default']
    'R11Api': typeof import("../components/r11/r11-api")['default']
    'RevenueUpgradeModal': typeof import("../components/revenue/UpgradeModal.vue")['default']
    'WizardFirstRunWizard': typeof import("../components/wizard/FirstRunWizard.vue")['default']
    'NuxtWelcome': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/welcome.vue")['default']
    'NuxtLayout': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-layout")['default']
    'NuxtErrorBoundary': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-error-boundary")['default']
    'ClientOnly': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/client-only")['default']
    'DevOnly': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/dev-only")['default']
    'ServerPlaceholder': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/server-placeholder")['default']
    'NuxtLink': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-link")['default']
    'NuxtLoadingIndicator': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-loading-indicator")['default']
    'NuxtRouteAnnouncer': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-route-announcer")['default']
    'NuxtImg': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtImg']
    'NuxtPicture': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtPicture']
    'NuxtPage': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/pages/runtime/page")['default']
    'NoScript': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['NoScript']
    'Link': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Link']
    'Base': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Base']
    'Title': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Title']
    'Meta': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Meta']
    'Style': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Style']
    'Head': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Head']
    'Html': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Html']
    'Body': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Body']
    'NuxtIsland': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-island")['default']
    'NuxtRouteAnnouncer': IslandComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/server-placeholder")['default']>
      'LazyLibraryReaderPanel': LazyComponent<typeof import("../components/LibraryReaderPanel.vue")['default']>
    'LazyRegionPicker': LazyComponent<typeof import("../components/RegionPicker.vue")['default']>
    'LazyBusinessLoginModal': LazyComponent<typeof import("../components/business/LoginModal.vue")['default']>
    'LazyCommunityHero': LazyComponent<typeof import("../components/community/CommunityHero.vue")['default']>
    'LazyCommunityPostCard': LazyComponent<typeof import("../components/community/CommunityPostCard.vue")['default']>
    'LazyCustomerService': LazyComponent<typeof import("../components/customer/CustomerService.vue")['default']>
    'LazyDirectorLocalEngineInstaller': LazyComponent<typeof import("../components/director/LocalEngineInstaller.vue")['default']>
    'LazyDirectorModelSettingsModal': LazyComponent<typeof import("../components/director/ModelSettingsModal.vue")['default']>
    'LazyDirectorOllamaSetupModal': LazyComponent<typeof import("../components/director/OllamaSetupModal.vue")['default']>
    'LazyHdzLibraryReaderPanel': LazyComponent<typeof import("../components/hdz/LibraryReaderPanel.vue")['default']>
    'LazyKmkiUiActivityFeed': LazyComponent<typeof import("../components/kmki-ui/ActivityFeed/index.vue")['default']>
    'LazyKmkiUiBadge': LazyComponent<typeof import("../components/kmki-ui/Badge/index.vue")['default']>
    'LazyKmkiUiCard': LazyComponent<typeof import("../components/kmki-ui/Card/index.vue")['default']>
    'LazyKmkiUiDiffViewer': LazyComponent<typeof import("../components/kmki-ui/DiffViewer/index.vue")['default']>
    'LazyKmkiUiEmptyState': LazyComponent<typeof import("../components/kmki-ui/EmptyState/index.vue")['default']>
    'LazyKmkiUiExplainPanel': LazyComponent<typeof import("../components/kmki-ui/ExplainPanel/index.vue")['default']>
    'LazyKmkiUiHealthIndicator': LazyComponent<typeof import("../components/kmki-ui/HealthIndicator/index.vue")['default']>
    'LazyKmkiUiMetric': LazyComponent<typeof import("../components/kmki-ui/Metric/index.vue")['default']>
    'LazyKmkiUiSkeleton': LazyComponent<typeof import("../components/kmki-ui/Skeleton/index.vue")['default']>
    'LazyKmkiUiTimeline': LazyComponent<typeof import("../components/kmki-ui/Timeline/index.vue")['default']>
    'LazyKunlunBaseGlassPanel': LazyComponent<typeof import("../components/kunlun/base/GlassPanel.vue")['default']>
    'LazyKunlunBaseMirrorPanel': LazyComponent<typeof import("../components/kunlun/base/MirrorPanel.vue")['default']>
    'LazyKunlunBusinessKunlunFooter': LazyComponent<typeof import("../components/kunlun/business/KunlunFooter.vue")['default']>
    'LazyKunlunBusinessKunlunNav': LazyComponent<typeof import("../components/kunlun/business/KunlunNav.vue")['default']>
    'LazyKunlunCardsMirrorCard': LazyComponent<typeof import("../components/kunlun/cards/MirrorCard.vue")['default']>
    'LazyKunlunCardsRealmCard': LazyComponent<typeof import("../components/kunlun/cards/RealmCard.vue")['default']>
    'LazyKunlunCommonSceneErrorBoundary': LazyComponent<typeof import("../components/kunlun/common/SceneErrorBoundary.vue")['default']>
    'LazyKunlunEffectsAuroraLayer': LazyComponent<typeof import("../components/kunlun/effects/AuroraLayer.vue")['default']>
    'LazyKunlunEffectsLightBeam': LazyComponent<typeof import("../components/kunlun/effects/LightBeam.vue")['default']>
    'LazyKunlunEffectsParticleField': LazyComponent<typeof import("../components/kunlun/effects/ParticleField.vue")['default']>
    'LazyKunlunEffectsPrismBorder': LazyComponent<typeof import("../components/kunlun/effects/PrismBorder.vue")['default']>
    'LazyKunlunHeroMirror': LazyComponent<typeof import("../components/kunlun/hero/HeroMirror.vue")['default']>
    'LazyKunlunScenesChoiceLiberationScene': LazyComponent<typeof import("../components/kunlun/scenes/ChoiceLiberationScene.vue")['default']>
    'LazyKunlunScenesCreationLawScene': LazyComponent<typeof import("../components/kunlun/scenes/CreationLawScene.vue")['default']>
    'LazyKunlunScenesCreatorVoicesScene': LazyComponent<typeof import("../components/kunlun/scenes/CreatorVoicesScene.vue")['default']>
    'LazyKunlunScenesFinalCTAScene': LazyComponent<typeof import("../components/kunlun/scenes/FinalCTAScene.vue")['default']>
    'LazyKunlunScenesFourStepScene': LazyComponent<typeof import("../components/kunlun/scenes/FourStepScene.vue")['default']>
    'LazyKunlunScenesHeroScene': LazyComponent<typeof import("../components/kunlun/scenes/HeroScene.vue")['default']>
    'LazyKunlunScenesWenquxingScene': LazyComponent<typeof import("../components/kunlun/scenes/WenquxingScene.vue")['default']>
    'LazyKunlunScenesWorkbenchUniverseScene': LazyComponent<typeof import("../components/kunlun/scenes/WorkbenchUniverseScene.vue")['default']>
    'LazyR11CausePanel': LazyComponent<typeof import("../components/r11/CausePanel.vue")['default']>
    'LazyR11DiffTimeline': LazyComponent<typeof import("../components/r11/DiffTimeline.vue")['default']>
    'LazyR11DriftMonitor': LazyComponent<typeof import("../components/r11/DriftMonitor.vue")['default']>
    'LazyR11GraphRenderer': LazyComponent<typeof import("../components/r11/GraphRenderer.vue")['default']>
    'LazyR11ReplayInspector': LazyComponent<typeof import("../components/r11/ReplayInspector.vue")['default']>
    'LazyR11StabilityDashboard': LazyComponent<typeof import("../components/r11/StabilityDashboard.vue")['default']>
    'LazyR11Api': LazyComponent<typeof import("../components/r11/r11-api")['default']>
    'LazyRevenueUpgradeModal': LazyComponent<typeof import("../components/revenue/UpgradeModal.vue")['default']>
    'LazyWizardFirstRunWizard': LazyComponent<typeof import("../components/wizard/FirstRunWizard.vue")['default']>
    'LazyNuxtWelcome': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/welcome.vue")['default']>
    'LazyNuxtLayout': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-layout")['default']>
    'LazyNuxtErrorBoundary': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-error-boundary")['default']>
    'LazyClientOnly': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/client-only")['default']>
    'LazyDevOnly': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/dev-only")['default']>
    'LazyServerPlaceholder': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/server-placeholder")['default']>
    'LazyNuxtLink': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-link")['default']>
    'LazyNuxtLoadingIndicator': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-loading-indicator")['default']>
    'LazyNuxtRouteAnnouncer': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-route-announcer")['default']>
    'LazyNuxtImg': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtImg']>
    'LazyNuxtPicture': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtPicture']>
    'LazyNuxtPage': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/pages/runtime/page")['default']>
    'LazyNoScript': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['NoScript']>
    'LazyLink': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Link']>
    'LazyBase': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Base']>
    'LazyTitle': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Title']>
    'LazyMeta': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Meta']>
    'LazyStyle': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Style']>
    'LazyHead': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Head']>
    'LazyHtml': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Html']>
    'LazyBody': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Body']>
    'LazyNuxtIsland': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-island")['default']>
    'LazyNuxtRouteAnnouncer': LazyComponent<IslandComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/server-placeholder")['default']>>
}

declare module 'vue' {
  export interface GlobalComponents extends _GlobalComponents { }
}

export const LibraryReaderPanel: typeof import("../components/LibraryReaderPanel.vue")['default']
export const RegionPicker: typeof import("../components/RegionPicker.vue")['default']
export const BusinessLoginModal: typeof import("../components/business/LoginModal.vue")['default']
export const CommunityHero: typeof import("../components/community/CommunityHero.vue")['default']
export const CommunityPostCard: typeof import("../components/community/CommunityPostCard.vue")['default']
export const CustomerService: typeof import("../components/customer/CustomerService.vue")['default']
export const DirectorLocalEngineInstaller: typeof import("../components/director/LocalEngineInstaller.vue")['default']
export const DirectorModelSettingsModal: typeof import("../components/director/ModelSettingsModal.vue")['default']
export const DirectorOllamaSetupModal: typeof import("../components/director/OllamaSetupModal.vue")['default']
export const HdzLibraryReaderPanel: typeof import("../components/hdz/LibraryReaderPanel.vue")['default']
export const KmkiUiActivityFeed: typeof import("../components/kmki-ui/ActivityFeed/index.vue")['default']
export const KmkiUiBadge: typeof import("../components/kmki-ui/Badge/index.vue")['default']
export const KmkiUiCard: typeof import("../components/kmki-ui/Card/index.vue")['default']
export const KmkiUiDiffViewer: typeof import("../components/kmki-ui/DiffViewer/index.vue")['default']
export const KmkiUiEmptyState: typeof import("../components/kmki-ui/EmptyState/index.vue")['default']
export const KmkiUiExplainPanel: typeof import("../components/kmki-ui/ExplainPanel/index.vue")['default']
export const KmkiUiHealthIndicator: typeof import("../components/kmki-ui/HealthIndicator/index.vue")['default']
export const KmkiUiMetric: typeof import("../components/kmki-ui/Metric/index.vue")['default']
export const KmkiUiSkeleton: typeof import("../components/kmki-ui/Skeleton/index.vue")['default']
export const KmkiUiTimeline: typeof import("../components/kmki-ui/Timeline/index.vue")['default']
export const KunlunBaseGlassPanel: typeof import("../components/kunlun/base/GlassPanel.vue")['default']
export const KunlunBaseMirrorPanel: typeof import("../components/kunlun/base/MirrorPanel.vue")['default']
export const KunlunBusinessKunlunFooter: typeof import("../components/kunlun/business/KunlunFooter.vue")['default']
export const KunlunBusinessKunlunNav: typeof import("../components/kunlun/business/KunlunNav.vue")['default']
export const KunlunCardsMirrorCard: typeof import("../components/kunlun/cards/MirrorCard.vue")['default']
export const KunlunCardsRealmCard: typeof import("../components/kunlun/cards/RealmCard.vue")['default']
export const KunlunCommonSceneErrorBoundary: typeof import("../components/kunlun/common/SceneErrorBoundary.vue")['default']
export const KunlunEffectsAuroraLayer: typeof import("../components/kunlun/effects/AuroraLayer.vue")['default']
export const KunlunEffectsLightBeam: typeof import("../components/kunlun/effects/LightBeam.vue")['default']
export const KunlunEffectsParticleField: typeof import("../components/kunlun/effects/ParticleField.vue")['default']
export const KunlunEffectsPrismBorder: typeof import("../components/kunlun/effects/PrismBorder.vue")['default']
export const KunlunHeroMirror: typeof import("../components/kunlun/hero/HeroMirror.vue")['default']
export const KunlunScenesChoiceLiberationScene: typeof import("../components/kunlun/scenes/ChoiceLiberationScene.vue")['default']
export const KunlunScenesCreationLawScene: typeof import("../components/kunlun/scenes/CreationLawScene.vue")['default']
export const KunlunScenesCreatorVoicesScene: typeof import("../components/kunlun/scenes/CreatorVoicesScene.vue")['default']
export const KunlunScenesFinalCTAScene: typeof import("../components/kunlun/scenes/FinalCTAScene.vue")['default']
export const KunlunScenesFourStepScene: typeof import("../components/kunlun/scenes/FourStepScene.vue")['default']
export const KunlunScenesHeroScene: typeof import("../components/kunlun/scenes/HeroScene.vue")['default']
export const KunlunScenesWenquxingScene: typeof import("../components/kunlun/scenes/WenquxingScene.vue")['default']
export const KunlunScenesWorkbenchUniverseScene: typeof import("../components/kunlun/scenes/WorkbenchUniverseScene.vue")['default']
export const R11CausePanel: typeof import("../components/r11/CausePanel.vue")['default']
export const R11DiffTimeline: typeof import("../components/r11/DiffTimeline.vue")['default']
export const R11DriftMonitor: typeof import("../components/r11/DriftMonitor.vue")['default']
export const R11GraphRenderer: typeof import("../components/r11/GraphRenderer.vue")['default']
export const R11ReplayInspector: typeof import("../components/r11/ReplayInspector.vue")['default']
export const R11StabilityDashboard: typeof import("../components/r11/StabilityDashboard.vue")['default']
export const R11Api: typeof import("../components/r11/r11-api")['default']
export const RevenueUpgradeModal: typeof import("../components/revenue/UpgradeModal.vue")['default']
export const WizardFirstRunWizard: typeof import("../components/wizard/FirstRunWizard.vue")['default']
export const NuxtWelcome: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/welcome.vue")['default']
export const NuxtLayout: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-layout")['default']
export const NuxtErrorBoundary: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-error-boundary")['default']
export const ClientOnly: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/client-only")['default']
export const DevOnly: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/dev-only")['default']
export const ServerPlaceholder: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/server-placeholder")['default']
export const NuxtLink: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-link")['default']
export const NuxtLoadingIndicator: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-loading-indicator")['default']
export const NuxtRouteAnnouncer: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-route-announcer")['default']
export const NuxtImg: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtImg']
export const NuxtPicture: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtPicture']
export const NuxtPage: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/pages/runtime/page")['default']
export const NoScript: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['NoScript']
export const Link: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Link']
export const Base: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Base']
export const Title: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Title']
export const Meta: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Meta']
export const Style: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Style']
export const Head: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Head']
export const Html: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Html']
export const Body: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Body']
export const NuxtIsland: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-island")['default']
export const NuxtRouteAnnouncer: IslandComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/server-placeholder")['default']>
export const LazyLibraryReaderPanel: LazyComponent<typeof import("../components/LibraryReaderPanel.vue")['default']>
export const LazyRegionPicker: LazyComponent<typeof import("../components/RegionPicker.vue")['default']>
export const LazyBusinessLoginModal: LazyComponent<typeof import("../components/business/LoginModal.vue")['default']>
export const LazyCommunityHero: LazyComponent<typeof import("../components/community/CommunityHero.vue")['default']>
export const LazyCommunityPostCard: LazyComponent<typeof import("../components/community/CommunityPostCard.vue")['default']>
export const LazyCustomerService: LazyComponent<typeof import("../components/customer/CustomerService.vue")['default']>
export const LazyDirectorLocalEngineInstaller: LazyComponent<typeof import("../components/director/LocalEngineInstaller.vue")['default']>
export const LazyDirectorModelSettingsModal: LazyComponent<typeof import("../components/director/ModelSettingsModal.vue")['default']>
export const LazyDirectorOllamaSetupModal: LazyComponent<typeof import("../components/director/OllamaSetupModal.vue")['default']>
export const LazyHdzLibraryReaderPanel: LazyComponent<typeof import("../components/hdz/LibraryReaderPanel.vue")['default']>
export const LazyKmkiUiActivityFeed: LazyComponent<typeof import("../components/kmki-ui/ActivityFeed/index.vue")['default']>
export const LazyKmkiUiBadge: LazyComponent<typeof import("../components/kmki-ui/Badge/index.vue")['default']>
export const LazyKmkiUiCard: LazyComponent<typeof import("../components/kmki-ui/Card/index.vue")['default']>
export const LazyKmkiUiDiffViewer: LazyComponent<typeof import("../components/kmki-ui/DiffViewer/index.vue")['default']>
export const LazyKmkiUiEmptyState: LazyComponent<typeof import("../components/kmki-ui/EmptyState/index.vue")['default']>
export const LazyKmkiUiExplainPanel: LazyComponent<typeof import("../components/kmki-ui/ExplainPanel/index.vue")['default']>
export const LazyKmkiUiHealthIndicator: LazyComponent<typeof import("../components/kmki-ui/HealthIndicator/index.vue")['default']>
export const LazyKmkiUiMetric: LazyComponent<typeof import("../components/kmki-ui/Metric/index.vue")['default']>
export const LazyKmkiUiSkeleton: LazyComponent<typeof import("../components/kmki-ui/Skeleton/index.vue")['default']>
export const LazyKmkiUiTimeline: LazyComponent<typeof import("../components/kmki-ui/Timeline/index.vue")['default']>
export const LazyKunlunBaseGlassPanel: LazyComponent<typeof import("../components/kunlun/base/GlassPanel.vue")['default']>
export const LazyKunlunBaseMirrorPanel: LazyComponent<typeof import("../components/kunlun/base/MirrorPanel.vue")['default']>
export const LazyKunlunBusinessKunlunFooter: LazyComponent<typeof import("../components/kunlun/business/KunlunFooter.vue")['default']>
export const LazyKunlunBusinessKunlunNav: LazyComponent<typeof import("../components/kunlun/business/KunlunNav.vue")['default']>
export const LazyKunlunCardsMirrorCard: LazyComponent<typeof import("../components/kunlun/cards/MirrorCard.vue")['default']>
export const LazyKunlunCardsRealmCard: LazyComponent<typeof import("../components/kunlun/cards/RealmCard.vue")['default']>
export const LazyKunlunCommonSceneErrorBoundary: LazyComponent<typeof import("../components/kunlun/common/SceneErrorBoundary.vue")['default']>
export const LazyKunlunEffectsAuroraLayer: LazyComponent<typeof import("../components/kunlun/effects/AuroraLayer.vue")['default']>
export const LazyKunlunEffectsLightBeam: LazyComponent<typeof import("../components/kunlun/effects/LightBeam.vue")['default']>
export const LazyKunlunEffectsParticleField: LazyComponent<typeof import("../components/kunlun/effects/ParticleField.vue")['default']>
export const LazyKunlunEffectsPrismBorder: LazyComponent<typeof import("../components/kunlun/effects/PrismBorder.vue")['default']>
export const LazyKunlunHeroMirror: LazyComponent<typeof import("../components/kunlun/hero/HeroMirror.vue")['default']>
export const LazyKunlunScenesChoiceLiberationScene: LazyComponent<typeof import("../components/kunlun/scenes/ChoiceLiberationScene.vue")['default']>
export const LazyKunlunScenesCreationLawScene: LazyComponent<typeof import("../components/kunlun/scenes/CreationLawScene.vue")['default']>
export const LazyKunlunScenesCreatorVoicesScene: LazyComponent<typeof import("../components/kunlun/scenes/CreatorVoicesScene.vue")['default']>
export const LazyKunlunScenesFinalCTAScene: LazyComponent<typeof import("../components/kunlun/scenes/FinalCTAScene.vue")['default']>
export const LazyKunlunScenesFourStepScene: LazyComponent<typeof import("../components/kunlun/scenes/FourStepScene.vue")['default']>
export const LazyKunlunScenesHeroScene: LazyComponent<typeof import("../components/kunlun/scenes/HeroScene.vue")['default']>
export const LazyKunlunScenesWenquxingScene: LazyComponent<typeof import("../components/kunlun/scenes/WenquxingScene.vue")['default']>
export const LazyKunlunScenesWorkbenchUniverseScene: LazyComponent<typeof import("../components/kunlun/scenes/WorkbenchUniverseScene.vue")['default']>
export const LazyR11CausePanel: LazyComponent<typeof import("../components/r11/CausePanel.vue")['default']>
export const LazyR11DiffTimeline: LazyComponent<typeof import("../components/r11/DiffTimeline.vue")['default']>
export const LazyR11DriftMonitor: LazyComponent<typeof import("../components/r11/DriftMonitor.vue")['default']>
export const LazyR11GraphRenderer: LazyComponent<typeof import("../components/r11/GraphRenderer.vue")['default']>
export const LazyR11ReplayInspector: LazyComponent<typeof import("../components/r11/ReplayInspector.vue")['default']>
export const LazyR11StabilityDashboard: LazyComponent<typeof import("../components/r11/StabilityDashboard.vue")['default']>
export const LazyR11Api: LazyComponent<typeof import("../components/r11/r11-api")['default']>
export const LazyRevenueUpgradeModal: LazyComponent<typeof import("../components/revenue/UpgradeModal.vue")['default']>
export const LazyWizardFirstRunWizard: LazyComponent<typeof import("../components/wizard/FirstRunWizard.vue")['default']>
export const LazyNuxtWelcome: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/welcome.vue")['default']>
export const LazyNuxtLayout: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-layout")['default']>
export const LazyNuxtErrorBoundary: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-error-boundary")['default']>
export const LazyClientOnly: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/client-only")['default']>
export const LazyDevOnly: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/dev-only")['default']>
export const LazyServerPlaceholder: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/server-placeholder")['default']>
export const LazyNuxtLink: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-link")['default']>
export const LazyNuxtLoadingIndicator: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-loading-indicator")['default']>
export const LazyNuxtRouteAnnouncer: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-route-announcer")['default']>
export const LazyNuxtImg: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtImg']>
export const LazyNuxtPicture: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtPicture']>
export const LazyNuxtPage: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/pages/runtime/page")['default']>
export const LazyNoScript: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['NoScript']>
export const LazyLink: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Link']>
export const LazyBase: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Base']>
export const LazyTitle: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Title']>
export const LazyMeta: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Meta']>
export const LazyStyle: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Style']>
export const LazyHead: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Head']>
export const LazyHtml: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Html']>
export const LazyBody: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/head/runtime/components")['Body']>
export const LazyNuxtIsland: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/nuxt-island")['default']>
export const LazyNuxtRouteAnnouncer: LazyComponent<IslandComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_cac@6.7.14_db0@0.3.4_ioredis@5.10.1_magicast@0.5.3_ro_c1459088cb193865da7a4ed5a3a03886/node_modules/nuxt/dist/app/components/server-placeholder")['default']>>

export const componentNames: string[]
