
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
      'AppFooter': typeof import("../components/AppFooter.vue")['default']
    'CommunityPostCard': typeof import("../components/CommunityPostCard.vue")['default']
    'EnterpriseWorkspaceShell': typeof import("../components/EnterpriseWorkspaceShell.vue")['default']
    'LibraryReaderPanel': typeof import("../components/LibraryReaderPanel.vue")['default']
    'RegionPicker': typeof import("../components/RegionPicker.vue")['default']
    'WorkspaceSwitcher': typeof import("../components/WorkspaceSwitcher.vue")['default']
    'AdminDashboardActivityStrip': typeof import("../components/admin/dashboard/ActivityStrip.vue")['default']
    'AdminDashboardActivityTimeline': typeof import("../components/admin/dashboard/ActivityTimeline.vue")['default']
    'AdminDashboardAgentMiniCard': typeof import("../components/admin/dashboard/AgentMiniCard.vue")['default']
    'AdminDashboardAgentRanking': typeof import("../components/admin/dashboard/AgentRanking.vue")['default']
    'AdminDashboardAiHealthMiniCard': typeof import("../components/admin/dashboard/AiHealthMiniCard.vue")['default']
    'AdminDashboardAiHealthPanel': typeof import("../components/admin/dashboard/AiHealthPanel.vue")['default']
    'AdminDashboardDetailDrawer': typeof import("../components/admin/dashboard/DetailDrawer.vue")['default']
    'AdminDashboardEnterpriseIntelPanel': typeof import("../components/admin/dashboard/EnterpriseIntelPanel.vue")['default']
    'AdminDashboardGeographyPanel': typeof import("../components/admin/dashboard/GeographyPanel.vue")['default']
    'AdminDashboardKpiOverview': typeof import("../components/admin/dashboard/KpiOverview.vue")['default']
    'AdminDashboardMetricCard': typeof import("../components/admin/dashboard/MetricCard.vue")['default']
    'AdminDashboardRevenueCockpit': typeof import("../components/admin/dashboard/RevenueCockpit.vue")['default']
    'AdminDashboardRevenuePanel': typeof import("../components/admin/dashboard/RevenuePanel.vue")['default']
    'AdminDashboardRevenueTrendCard': typeof import("../components/admin/dashboard/RevenueTrendCard.vue")['default']
    'AdminDashboardSystemHealthPanel': typeof import("../components/admin/dashboard/SystemHealthPanel.vue")['default']
    'AdminDashboardTimeRangeBar': typeof import("../components/admin/dashboard/TimeRangeBar.vue")['default']
    'AdminDashboardUserGrowthPanel': typeof import("../components/admin/dashboard/UserGrowthPanel.vue")['default']
    'AdminDashboardUserTrendCard': typeof import("../components/admin/dashboard/UserTrendCard.vue")['default']
    'AdminDashboardVipMiniCard': typeof import("../components/admin/dashboard/VipMiniCard.vue")['default']
    'AdminDashboardVipPanel': typeof import("../components/admin/dashboard/VipPanel.vue")['default']
    'AdminDashboardWorkspaceChart': typeof import("../components/admin/dashboard/WorkspaceChart.vue")['default']
    'AdminDashboardWorkspaceEcosystemCard': typeof import("../components/admin/dashboard/WorkspaceEcosystemCard.vue")['default']
    'AdminDashboardWorkspaceMiniCard': typeof import("../components/admin/dashboard/WorkspaceMiniCard.vue")['default']
    'AdminMallBannersTab': typeof import("../components/admin/mall/BannersTab.vue")['default']
    'AdminMallCategoriesTab': typeof import("../components/admin/mall/CategoriesTab.vue")['default']
    'AdminMallCouponsTab': typeof import("../components/admin/mall/CouponsTab.vue")['default']
    'AdminMallOrdersTab': typeof import("../components/admin/mall/OrdersTab.vue")['default']
    'AdminMallProductsTab': typeof import("../components/admin/mall/ProductsTab.vue")['default']
    'AdminMallRecommendTab': typeof import("../components/admin/mall/RecommendTab.vue")['default']
    'AiModelSettingsLauncher': typeof import("../components/ai-model/ModelSettingsLauncher.vue")['default']
    'BusinessLoginModal': typeof import("../components/business/LoginModal.vue")['default']
    'CommunityHero': typeof import("../components/community/CommunityHero.vue")['default']
    'CustomerService': typeof import("../components/customer/CustomerService.vue")['default']
    'DirectorLocalEngineInstaller': typeof import("../components/director/LocalEngineInstaller.vue")['default']
    'DirectorModelSettingsModal': typeof import("../components/director/ModelSettingsModal.vue")['default']
    'DirectorOllamaSetupModal': typeof import("../components/director/OllamaSetupModal.vue")['default']
    'EcomAnalysisPanel': typeof import("../components/ecom/AnalysisPanel.vue")['default']
    'EcomGalleryPanel': typeof import("../components/ecom/GalleryPanel.vue")['default']
    'EcomPromptsPanel': typeof import("../components/ecom/PromptsPanel.vue")['default']
    'EnterpriseUiEnterpriseShell': typeof import("../components/enterprise-ui/EnterpriseShell.vue")['default']
    'EnterpriseUiCardsActionCard': typeof import("../components/enterprise-ui/cards/ActionCard.vue")['default']
    'EnterpriseUiCardsDecisionCard': typeof import("../components/enterprise-ui/cards/DecisionCard.vue")['default']
    'EnterpriseUiCardsMetricCard': typeof import("../components/enterprise-ui/cards/MetricCard.vue")['default']
    'EnterpriseUiCardsSignalCard': typeof import("../components/enterprise-ui/cards/SignalCard.vue")['default']
    'EnterpriseUiFeedbackEmptyState': typeof import("../components/enterprise-ui/feedback/EmptyState.vue")['default']
    'EnterpriseUiFeedbackSkeleton': typeof import("../components/enterprise-ui/feedback/Skeleton.vue")['default']
    'EnterpriseUiFeedbackStatusBadge': typeof import("../components/enterprise-ui/feedback/StatusBadge.vue")['default']
    'EnterpriseUiNavigationEnterpriseHeader': typeof import("../components/enterprise-ui/navigation/EnterpriseHeader.vue")['default']
    'EnterpriseUiNavigationEnterpriseSidebar': typeof import("../components/enterprise-ui/navigation/EnterpriseSidebar.vue")['default']
    'EnterpriseAgentCard': typeof import("../components/enterprise/AgentCard.vue")['default']
    'EnterpriseAiTeamDisplay': typeof import("../components/enterprise/AiTeamDisplay.vue")['default']
    'EnterpriseApprovalCard': typeof import("../components/enterprise/ApprovalCard.vue")['default']
    'EnterpriseEmployeeCard': typeof import("../components/enterprise/EmployeeCard.vue")['default']
    'EnterpriseSetupStepIndicator': typeof import("../components/enterprise/SetupStepIndicator.vue")['default']
    'EnterpriseTodayTasks': typeof import("../components/enterprise/TodayTasks.vue")['default']
    'EnterpriseDashboardAIAgentMiniCard': typeof import("../components/enterprise/dashboard/AIAgentMiniCard.vue")['default']
    'EnterpriseDashboardAIAgentStatusGrid': typeof import("../components/enterprise/dashboard/AIAgentStatusGrid.vue")['default']
    'EnterpriseDashboardAIDepartmentOverview': typeof import("../components/enterprise/dashboard/AIDepartmentOverview.vue")['default']
    'EnterpriseDashboardAINextActionCard': typeof import("../components/enterprise/dashboard/AINextActionCard.vue")['default']
    'EnterpriseDashboardAITeamActivityFeed': typeof import("../components/enterprise/dashboard/AITeamActivityFeed.vue")['default']
    'EnterpriseDashboardAITeamHealthCard': typeof import("../components/enterprise/dashboard/AITeamHealthCard.vue")['default']
    'EnterpriseDashboardSection': typeof import("../components/enterprise/dashboard/DashboardSection.vue")['default']
    'EnterpriseDashboardEmployeeCardAdapter': typeof import("../components/enterprise/dashboard/EmployeeCardAdapter.vue")['default']
    'EnterpriseDashboardEnterpriseTimeline': typeof import("../components/enterprise/dashboard/EnterpriseTimeline.vue")['default']
    'EnterpriseDashboardOutcomeHeroCard': typeof import("../components/enterprise/dashboard/OutcomeHeroCard.vue")['default']
    'EnterpriseDirectorPanel': typeof import("../components/enterprise/director/DirectorPanel.vue")['default']
    'EnterpriseEmployeeProfileCEOCommandContext': typeof import("../components/enterprise/employee-profile/CEOCommandContext.vue")['default']
    'EnterpriseEmployeeProfileContributionTimeline': typeof import("../components/enterprise/employee-profile/ContributionTimeline.vue")['default']
    'EnterpriseEmployeeProfileEmployeeCapability': typeof import("../components/enterprise/employee-profile/EmployeeCapability.vue")['default']
    'EnterpriseEmployeeProfileEmployeeIdentity': typeof import("../components/enterprise/employee-profile/EmployeeIdentity.vue")['default']
    'EnterpriseEmployeeProfileEmployeeKnowledge': typeof import("../components/enterprise/employee-profile/EmployeeKnowledge.vue")['default']
    'EnterpriseEmployeeProfilePage': typeof import("../components/enterprise/employee-profile/EmployeeProfilePage.vue")['default']
    'EnterpriseEmployeeProfileEmployeeRole': typeof import("../components/enterprise/employee-profile/EmployeeRole.vue")['default']
    'EnterpriseEmployeeProfileEmployeeTools': typeof import("../components/enterprise/employee-profile/EmployeeTools.vue")['default']
    'EnterpriseEmployeeProfileGrowthRecord': typeof import("../components/enterprise/employee-profile/GrowthRecord.vue")['default']
    'EnterpriseEmployeeProfileHistoricalOutcomes': typeof import("../components/enterprise/employee-profile/HistoricalOutcomes.vue")['default']
    'EnterpriseRecruitmentAdminAiConfigPanel': typeof import("../components/enterprise/recruitment/AdminAiConfigPanel.vue")['default']
    'EnterpriseRecruitmentCreateJobModal': typeof import("../components/enterprise/recruitment/CreateJobModal.vue")['default']
    'EnterpriseRecruitmentHiringDecisionCard': typeof import("../components/enterprise/recruitment/HiringDecisionCard.vue")['default']
    'EnterpriseRecruitmentHiringInsightsCard': typeof import("../components/enterprise/recruitment/HiringInsightsCard.vue")['default']
    'EnterpriseRecruitmentUiRecruitmentBadge': typeof import("../components/enterprise/recruitment/ui/RecruitmentBadge.vue")['default']
    'EnterpriseRecruitmentUiRecruitmentInput': typeof import("../components/enterprise/recruitment/ui/RecruitmentInput.vue")['default']
    'EnterpriseRecruitmentUiRecruitmentPageShell': typeof import("../components/enterprise/recruitment/ui/RecruitmentPageShell.vue")['default']
    'EnterpriseRecruitmentUiRecruitmentPrimaryButton': typeof import("../components/enterprise/recruitment/ui/RecruitmentPrimaryButton.vue")['default']
    'EnterpriseRecruitmentUiRecruitmentSecondaryButton': typeof import("../components/enterprise/recruitment/ui/RecruitmentSecondaryButton.vue")['default']
    'EnterpriseRecruitmentUiRecruitmentSelect': typeof import("../components/enterprise/recruitment/ui/RecruitmentSelect.vue")['default']
    'EnterpriseRecruitmentUiRecruitmentStatCard': typeof import("../components/enterprise/recruitment/ui/RecruitmentStatCard.vue")['default']
    'EnterpriseWorkspaceAIEmployeeConfig': typeof import("../components/enterprise/workspace/AIEmployeeConfig.vue")['default']
    'EnterpriseWorkspaceAgentCard': typeof import("../components/enterprise/workspace/AgentCard.vue")['default']
    'EnterpriseWorkspaceAgentChannelCard': typeof import("../components/enterprise/workspace/AgentChannelCard.vue")['default']
    'EnterpriseWorkspaceAgentDetailPanel': typeof import("../components/enterprise/workspace/AgentDetailPanel.vue")['default']
    'EnterpriseWorkspaceAgentHealthCard': typeof import("../components/enterprise/workspace/AgentHealthCard.vue")['default']
    'EnterpriseWorkspaceAgentModelCard': typeof import("../components/enterprise/workspace/AgentModelCard.vue")['default']
    'EnterpriseWorkspaceAgentRuntimeCard': typeof import("../components/enterprise/workspace/AgentRuntimeCard.vue")['default']
    'EnterpriseWorkspaceAgentTimeline': typeof import("../components/enterprise/workspace/AgentTimeline.vue")['default']
    'EnterpriseWorkspaceChannelConnectCenter': typeof import("../components/enterprise/workspace/ChannelConnectCenter.vue")['default']
    'EnterpriseWorkspaceCreateOrganizationModal': typeof import("../components/enterprise/workspace/CreateOrganizationModal.vue")['default']
    'EnterpriseWorkspaceEnterpriseIdentityHeader': typeof import("../components/enterprise/workspace/EnterpriseIdentityHeader.vue")['default']
    'EnterpriseWorkspaceEnterpriseModuleRenderer': typeof import("../components/enterprise/workspace/EnterpriseModuleRenderer.vue")['default']
    'EnterpriseWorkspaceEnterpriseOnboardingWizard': typeof import("../components/enterprise/workspace/EnterpriseOnboardingWizard.vue")['default']
    'EnterpriseWorkspace': typeof import("../components/enterprise/workspace/EnterpriseWorkspace.vue")['default']
    'EnterpriseWorkspaceModulesChannelsModule': typeof import("../components/enterprise/workspace/modules/ChannelsModule.vue")['default']
    'EnterpriseWorkspaceModulesDashboardModule': typeof import("../components/enterprise/workspace/modules/DashboardModule.vue")['default']
    'EnterpriseWorkspaceModulesDecisionsModule': typeof import("../components/enterprise/workspace/modules/DecisionsModule.vue")['default']
    'EnterpriseWorkspaceModulesEmployeesModule': typeof import("../components/enterprise/workspace/modules/EmployeesModule.vue")['default']
    'EnterpriseWorkspaceModulesExecutionModule': typeof import("../components/enterprise/workspace/modules/ExecutionModule.vue")['default']
    'EnterpriseWorkspaceModulesGovernanceModule': typeof import("../components/enterprise/workspace/modules/GovernanceModule.vue")['default']
    'EnterpriseWorkspaceModulesGrowthModule': typeof import("../components/enterprise/workspace/modules/GrowthModule.vue")['default']
    'EnterpriseWorkspaceModulesIntelligenceModule': typeof import("../components/enterprise/workspace/modules/IntelligenceModule.vue")['default']
    'EnterpriseWorkspaceModulesKnowledgeModule': typeof import("../components/enterprise/workspace/modules/KnowledgeModule.vue")['default']
    'EnterpriseWorkspaceModulesProviderSettingsModule': typeof import("../components/enterprise/workspace/modules/ProviderSettingsModule.vue")['default']
    'EnterpriseWorkspaceModulesRecruitmentModule': typeof import("../components/enterprise/workspace/modules/RecruitmentModule.vue")['default']
    'EnterpriseWorkspaceModulesSettingsModule': typeof import("../components/enterprise/workspace/modules/SettingsModule.vue")['default']
    'EnterpriseWorkspaceModulesTasksModule': typeof import("../components/enterprise/workspace/modules/TasksModule.vue")['default']
    'HdzLibraryReaderPanel': typeof import("../components/hdz/LibraryReaderPanel.vue")['default']
    'KmkiUiActionCard': typeof import("../components/kmki-ui/ActionCard/index.vue")['default']
    'KmkiUiActionsSection': typeof import("../components/kmki-ui/ActionsSection/index.vue")['default']
    'KmkiUiActivityFeed': typeof import("../components/kmki-ui/ActivityFeed/index.vue")['default']
    'KmkiUiBadge': typeof import("../components/kmki-ui/Badge/index.vue")['default']
    'KmkiUiCard': typeof import("../components/kmki-ui/Card/index.vue")['default']
    'KmkiUiConfidenceMeter': typeof import("../components/kmki-ui/ConfidenceMeter/index.vue")['default']
    'KmkiUiDiffViewer': typeof import("../components/kmki-ui/DiffViewer/index.vue")['default']
    'KmkiUiEffortBadge': typeof import("../components/kmki-ui/EffortBadge/index.vue")['default']
    'KmkiUiEmptyState': typeof import("../components/kmki-ui/EmptyState/index.vue")['default']
    'KmkiUiExecutiveSummaryCard': typeof import("../components/kmki-ui/ExecutiveSummaryCard/index.vue")['default']
    'KmkiUiExplainPanel': typeof import("../components/kmki-ui/ExplainPanel/index.vue")['default']
    'KmkiUiExportMenu': typeof import("../components/kmki-ui/ExportMenu/index.vue")['default']
    'KmkiUiFindingsSection': typeof import("../components/kmki-ui/FindingsSection/index.vue")['default']
    'KmkiUiHealthIndicator': typeof import("../components/kmki-ui/HealthIndicator/index.vue")['default']
    'KmkiUiImpactBadge': typeof import("../components/kmki-ui/ImpactBadge/index.vue")['default']
    'KmkiUiImprovementBadge': typeof import("../components/kmki-ui/ImprovementBadge/index.vue")['default']
    'KmkiUiMetric': typeof import("../components/kmki-ui/Metric/index.vue")['default']
    'KmkiUiNextRecommendations': typeof import("../components/kmki-ui/NextRecommendations/index.vue")['default']
    'KmkiUiOpportunitiesSection': typeof import("../components/kmki-ui/OpportunitiesSection/index.vue")['default']
    'KmkiUiReportCard': typeof import("../components/kmki-ui/ReportCard/index.vue")['default']
    'KmkiUiScoreComparison': typeof import("../components/kmki-ui/ScoreComparison/index.vue")['default']
    'KmkiUiSkeleton': typeof import("../components/kmki-ui/Skeleton/index.vue")['default']
    'KmkiUiStatusChip': typeof import("../components/kmki-ui/StatusChip/index.vue")['default']
    'KmkiUiStepList': typeof import("../components/kmki-ui/StepList/index.vue")['default']
    'KmkiUiTimeline': typeof import("../components/kmki-ui/Timeline/index.vue")['default']
    'KmkiUiVerificationCard': typeof import("../components/kmki-ui/VerificationCard/index.vue")['default']
    'KmkiUiVerificationSection': typeof import("../components/kmki-ui/VerificationSection/index.vue")['default']
    'KmkiUiVerificationTimeline': typeof import("../components/kmki-ui/VerificationTimeline/index.vue")['default']
    'KmkiUiWorkflowStepper': typeof import("../components/kmki-ui/WorkflowStepper/index.vue")['default']
    'KnowledgeBodyRenderer': typeof import("../components/knowledge/KnowledgeBodyRenderer.vue")['default']
    'KnowledgeFAQ': typeof import("../components/knowledge/KnowledgeFAQ.vue")['default']
    'KnowledgeFooter': typeof import("../components/knowledge/KnowledgeFooter.vue")['default']
    'KnowledgeHero': typeof import("../components/knowledge/KnowledgeHero.vue")['default']
    'KnowledgeJSONLD': typeof import("../components/knowledge/KnowledgeJSONLD.vue")['default']
    'KnowledgeMetadata': typeof import("../components/knowledge/KnowledgeMetadata.vue")['default']
    'KnowledgeRelated': typeof import("../components/knowledge/KnowledgeRelated.vue")['default']
    'KnowledgeRenderer': typeof import("../components/knowledge/KnowledgeRenderer.vue")['default']
    'KnowledgeSummary': typeof import("../components/knowledge/KnowledgeSummary.vue")['default']
    'KnowledgeRegistrySetup': typeof import("../components/knowledge/registry.setup")['default']
    'KnowledgeRegistry': typeof import("../components/knowledge/registry")['default']
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
    'KunlunScenesEnterpriseGrowthBanner': typeof import("../components/kunlun/scenes/EnterpriseGrowthBanner.vue")['default']
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
    'RecruitmentActivityFeed': typeof import("../components/recruitment/ActivityFeed.vue")['default']
    'RecruitmentAgentWorkforceCard': typeof import("../components/recruitment/AgentWorkforceCard.vue")['default']
    'RecruitmentHealthBanner': typeof import("../components/recruitment/HealthBanner.vue")['default']
    'RecruitmentMetricCard': typeof import("../components/recruitment/MetricCard.vue")['default']
    'RecruitmentPendingList': typeof import("../components/recruitment/PendingList.vue")['default']
    'RecruitmentFunnel': typeof import("../components/recruitment/RecruitmentFunnel.vue")['default']
    'RecruitmentRoiCard': typeof import("../components/recruitment/RecruitmentRoiCard.vue")['default']
    'RecruitmentShell': typeof import("../components/recruitment/RecruitmentShell.vue")['default']
    'RecruitmentSubscriptionCard': typeof import("../components/recruitment/RecruitmentSubscriptionCard.vue")['default']
    'RecruitmentWorkspaceNav': typeof import("../components/recruitment/RecruitmentWorkspaceNav.vue")['default']
    'RecruitmentSectionCard': typeof import("../components/recruitment/SectionCard.vue")['default']
    'RecruitmentStatusBadge': typeof import("../components/recruitment/StatusBadge.vue")['default']
    'RevenueUpgradeModal': typeof import("../components/revenue/UpgradeModal.vue")['default']
    'UIEmptyState': typeof import("../components/ui/UIEmptyState.vue")['default']
    'UIErrorCard': typeof import("../components/ui/UIErrorCard.vue")['default']
    'UISkeleton': typeof import("../components/ui/UISkeleton.vue")['default']
    'UIToastContainer': typeof import("../components/ui/UIToastContainer.vue")['default']
    'WizardFirstRunWizard': typeof import("../components/wizard/FirstRunWizard.vue")['default']
    'WorkspaceSharedWorkspaceUserCard': typeof import("../components/workspace/shared/WorkspaceUserCard.vue")['default']
    'NuxtWelcome': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/welcome.vue")['default']
    'NuxtLayout': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-layout")['default']
    'NuxtErrorBoundary': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-error-boundary")['default']
    'ClientOnly': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/client-only")['default']
    'DevOnly': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/dev-only")['default']
    'ServerPlaceholder': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/server-placeholder")['default']
    'NuxtLink': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-link")['default']
    'NuxtLoadingIndicator': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-loading-indicator")['default']
    'NuxtRouteAnnouncer': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-route-announcer")['default']
    'NuxtImg': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtImg']
    'NuxtPicture': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtPicture']
    'NuxtPage': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/pages/runtime/page")['default']
    'NoScript': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['NoScript']
    'Link': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Link']
    'Base': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Base']
    'Title': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Title']
    'Meta': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Meta']
    'Style': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Style']
    'Head': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Head']
    'Html': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Html']
    'Body': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Body']
    'NuxtIsland': typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-island")['default']
    'NuxtRouteAnnouncer': IslandComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/server-placeholder")['default']>
      'LazyAppFooter': LazyComponent<typeof import("../components/AppFooter.vue")['default']>
    'LazyCommunityPostCard': LazyComponent<typeof import("../components/CommunityPostCard.vue")['default']>
    'LazyEnterpriseWorkspaceShell': LazyComponent<typeof import("../components/EnterpriseWorkspaceShell.vue")['default']>
    'LazyLibraryReaderPanel': LazyComponent<typeof import("../components/LibraryReaderPanel.vue")['default']>
    'LazyRegionPicker': LazyComponent<typeof import("../components/RegionPicker.vue")['default']>
    'LazyWorkspaceSwitcher': LazyComponent<typeof import("../components/WorkspaceSwitcher.vue")['default']>
    'LazyAdminDashboardActivityStrip': LazyComponent<typeof import("../components/admin/dashboard/ActivityStrip.vue")['default']>
    'LazyAdminDashboardActivityTimeline': LazyComponent<typeof import("../components/admin/dashboard/ActivityTimeline.vue")['default']>
    'LazyAdminDashboardAgentMiniCard': LazyComponent<typeof import("../components/admin/dashboard/AgentMiniCard.vue")['default']>
    'LazyAdminDashboardAgentRanking': LazyComponent<typeof import("../components/admin/dashboard/AgentRanking.vue")['default']>
    'LazyAdminDashboardAiHealthMiniCard': LazyComponent<typeof import("../components/admin/dashboard/AiHealthMiniCard.vue")['default']>
    'LazyAdminDashboardAiHealthPanel': LazyComponent<typeof import("../components/admin/dashboard/AiHealthPanel.vue")['default']>
    'LazyAdminDashboardDetailDrawer': LazyComponent<typeof import("../components/admin/dashboard/DetailDrawer.vue")['default']>
    'LazyAdminDashboardEnterpriseIntelPanel': LazyComponent<typeof import("../components/admin/dashboard/EnterpriseIntelPanel.vue")['default']>
    'LazyAdminDashboardGeographyPanel': LazyComponent<typeof import("../components/admin/dashboard/GeographyPanel.vue")['default']>
    'LazyAdminDashboardKpiOverview': LazyComponent<typeof import("../components/admin/dashboard/KpiOverview.vue")['default']>
    'LazyAdminDashboardMetricCard': LazyComponent<typeof import("../components/admin/dashboard/MetricCard.vue")['default']>
    'LazyAdminDashboardRevenueCockpit': LazyComponent<typeof import("../components/admin/dashboard/RevenueCockpit.vue")['default']>
    'LazyAdminDashboardRevenuePanel': LazyComponent<typeof import("../components/admin/dashboard/RevenuePanel.vue")['default']>
    'LazyAdminDashboardRevenueTrendCard': LazyComponent<typeof import("../components/admin/dashboard/RevenueTrendCard.vue")['default']>
    'LazyAdminDashboardSystemHealthPanel': LazyComponent<typeof import("../components/admin/dashboard/SystemHealthPanel.vue")['default']>
    'LazyAdminDashboardTimeRangeBar': LazyComponent<typeof import("../components/admin/dashboard/TimeRangeBar.vue")['default']>
    'LazyAdminDashboardUserGrowthPanel': LazyComponent<typeof import("../components/admin/dashboard/UserGrowthPanel.vue")['default']>
    'LazyAdminDashboardUserTrendCard': LazyComponent<typeof import("../components/admin/dashboard/UserTrendCard.vue")['default']>
    'LazyAdminDashboardVipMiniCard': LazyComponent<typeof import("../components/admin/dashboard/VipMiniCard.vue")['default']>
    'LazyAdminDashboardVipPanel': LazyComponent<typeof import("../components/admin/dashboard/VipPanel.vue")['default']>
    'LazyAdminDashboardWorkspaceChart': LazyComponent<typeof import("../components/admin/dashboard/WorkspaceChart.vue")['default']>
    'LazyAdminDashboardWorkspaceEcosystemCard': LazyComponent<typeof import("../components/admin/dashboard/WorkspaceEcosystemCard.vue")['default']>
    'LazyAdminDashboardWorkspaceMiniCard': LazyComponent<typeof import("../components/admin/dashboard/WorkspaceMiniCard.vue")['default']>
    'LazyAdminMallBannersTab': LazyComponent<typeof import("../components/admin/mall/BannersTab.vue")['default']>
    'LazyAdminMallCategoriesTab': LazyComponent<typeof import("../components/admin/mall/CategoriesTab.vue")['default']>
    'LazyAdminMallCouponsTab': LazyComponent<typeof import("../components/admin/mall/CouponsTab.vue")['default']>
    'LazyAdminMallOrdersTab': LazyComponent<typeof import("../components/admin/mall/OrdersTab.vue")['default']>
    'LazyAdminMallProductsTab': LazyComponent<typeof import("../components/admin/mall/ProductsTab.vue")['default']>
    'LazyAdminMallRecommendTab': LazyComponent<typeof import("../components/admin/mall/RecommendTab.vue")['default']>
    'LazyAiModelSettingsLauncher': LazyComponent<typeof import("../components/ai-model/ModelSettingsLauncher.vue")['default']>
    'LazyBusinessLoginModal': LazyComponent<typeof import("../components/business/LoginModal.vue")['default']>
    'LazyCommunityHero': LazyComponent<typeof import("../components/community/CommunityHero.vue")['default']>
    'LazyCustomerService': LazyComponent<typeof import("../components/customer/CustomerService.vue")['default']>
    'LazyDirectorLocalEngineInstaller': LazyComponent<typeof import("../components/director/LocalEngineInstaller.vue")['default']>
    'LazyDirectorModelSettingsModal': LazyComponent<typeof import("../components/director/ModelSettingsModal.vue")['default']>
    'LazyDirectorOllamaSetupModal': LazyComponent<typeof import("../components/director/OllamaSetupModal.vue")['default']>
    'LazyEcomAnalysisPanel': LazyComponent<typeof import("../components/ecom/AnalysisPanel.vue")['default']>
    'LazyEcomGalleryPanel': LazyComponent<typeof import("../components/ecom/GalleryPanel.vue")['default']>
    'LazyEcomPromptsPanel': LazyComponent<typeof import("../components/ecom/PromptsPanel.vue")['default']>
    'LazyEnterpriseUiEnterpriseShell': LazyComponent<typeof import("../components/enterprise-ui/EnterpriseShell.vue")['default']>
    'LazyEnterpriseUiCardsActionCard': LazyComponent<typeof import("../components/enterprise-ui/cards/ActionCard.vue")['default']>
    'LazyEnterpriseUiCardsDecisionCard': LazyComponent<typeof import("../components/enterprise-ui/cards/DecisionCard.vue")['default']>
    'LazyEnterpriseUiCardsMetricCard': LazyComponent<typeof import("../components/enterprise-ui/cards/MetricCard.vue")['default']>
    'LazyEnterpriseUiCardsSignalCard': LazyComponent<typeof import("../components/enterprise-ui/cards/SignalCard.vue")['default']>
    'LazyEnterpriseUiFeedbackEmptyState': LazyComponent<typeof import("../components/enterprise-ui/feedback/EmptyState.vue")['default']>
    'LazyEnterpriseUiFeedbackSkeleton': LazyComponent<typeof import("../components/enterprise-ui/feedback/Skeleton.vue")['default']>
    'LazyEnterpriseUiFeedbackStatusBadge': LazyComponent<typeof import("../components/enterprise-ui/feedback/StatusBadge.vue")['default']>
    'LazyEnterpriseUiNavigationEnterpriseHeader': LazyComponent<typeof import("../components/enterprise-ui/navigation/EnterpriseHeader.vue")['default']>
    'LazyEnterpriseUiNavigationEnterpriseSidebar': LazyComponent<typeof import("../components/enterprise-ui/navigation/EnterpriseSidebar.vue")['default']>
    'LazyEnterpriseAgentCard': LazyComponent<typeof import("../components/enterprise/AgentCard.vue")['default']>
    'LazyEnterpriseAiTeamDisplay': LazyComponent<typeof import("../components/enterprise/AiTeamDisplay.vue")['default']>
    'LazyEnterpriseApprovalCard': LazyComponent<typeof import("../components/enterprise/ApprovalCard.vue")['default']>
    'LazyEnterpriseEmployeeCard': LazyComponent<typeof import("../components/enterprise/EmployeeCard.vue")['default']>
    'LazyEnterpriseSetupStepIndicator': LazyComponent<typeof import("../components/enterprise/SetupStepIndicator.vue")['default']>
    'LazyEnterpriseTodayTasks': LazyComponent<typeof import("../components/enterprise/TodayTasks.vue")['default']>
    'LazyEnterpriseDashboardAIAgentMiniCard': LazyComponent<typeof import("../components/enterprise/dashboard/AIAgentMiniCard.vue")['default']>
    'LazyEnterpriseDashboardAIAgentStatusGrid': LazyComponent<typeof import("../components/enterprise/dashboard/AIAgentStatusGrid.vue")['default']>
    'LazyEnterpriseDashboardAIDepartmentOverview': LazyComponent<typeof import("../components/enterprise/dashboard/AIDepartmentOverview.vue")['default']>
    'LazyEnterpriseDashboardAINextActionCard': LazyComponent<typeof import("../components/enterprise/dashboard/AINextActionCard.vue")['default']>
    'LazyEnterpriseDashboardAITeamActivityFeed': LazyComponent<typeof import("../components/enterprise/dashboard/AITeamActivityFeed.vue")['default']>
    'LazyEnterpriseDashboardAITeamHealthCard': LazyComponent<typeof import("../components/enterprise/dashboard/AITeamHealthCard.vue")['default']>
    'LazyEnterpriseDashboardSection': LazyComponent<typeof import("../components/enterprise/dashboard/DashboardSection.vue")['default']>
    'LazyEnterpriseDashboardEmployeeCardAdapter': LazyComponent<typeof import("../components/enterprise/dashboard/EmployeeCardAdapter.vue")['default']>
    'LazyEnterpriseDashboardEnterpriseTimeline': LazyComponent<typeof import("../components/enterprise/dashboard/EnterpriseTimeline.vue")['default']>
    'LazyEnterpriseDashboardOutcomeHeroCard': LazyComponent<typeof import("../components/enterprise/dashboard/OutcomeHeroCard.vue")['default']>
    'LazyEnterpriseDirectorPanel': LazyComponent<typeof import("../components/enterprise/director/DirectorPanel.vue")['default']>
    'LazyEnterpriseEmployeeProfileCEOCommandContext': LazyComponent<typeof import("../components/enterprise/employee-profile/CEOCommandContext.vue")['default']>
    'LazyEnterpriseEmployeeProfileContributionTimeline': LazyComponent<typeof import("../components/enterprise/employee-profile/ContributionTimeline.vue")['default']>
    'LazyEnterpriseEmployeeProfileEmployeeCapability': LazyComponent<typeof import("../components/enterprise/employee-profile/EmployeeCapability.vue")['default']>
    'LazyEnterpriseEmployeeProfileEmployeeIdentity': LazyComponent<typeof import("../components/enterprise/employee-profile/EmployeeIdentity.vue")['default']>
    'LazyEnterpriseEmployeeProfileEmployeeKnowledge': LazyComponent<typeof import("../components/enterprise/employee-profile/EmployeeKnowledge.vue")['default']>
    'LazyEnterpriseEmployeeProfilePage': LazyComponent<typeof import("../components/enterprise/employee-profile/EmployeeProfilePage.vue")['default']>
    'LazyEnterpriseEmployeeProfileEmployeeRole': LazyComponent<typeof import("../components/enterprise/employee-profile/EmployeeRole.vue")['default']>
    'LazyEnterpriseEmployeeProfileEmployeeTools': LazyComponent<typeof import("../components/enterprise/employee-profile/EmployeeTools.vue")['default']>
    'LazyEnterpriseEmployeeProfileGrowthRecord': LazyComponent<typeof import("../components/enterprise/employee-profile/GrowthRecord.vue")['default']>
    'LazyEnterpriseEmployeeProfileHistoricalOutcomes': LazyComponent<typeof import("../components/enterprise/employee-profile/HistoricalOutcomes.vue")['default']>
    'LazyEnterpriseRecruitmentAdminAiConfigPanel': LazyComponent<typeof import("../components/enterprise/recruitment/AdminAiConfigPanel.vue")['default']>
    'LazyEnterpriseRecruitmentCreateJobModal': LazyComponent<typeof import("../components/enterprise/recruitment/CreateJobModal.vue")['default']>
    'LazyEnterpriseRecruitmentHiringDecisionCard': LazyComponent<typeof import("../components/enterprise/recruitment/HiringDecisionCard.vue")['default']>
    'LazyEnterpriseRecruitmentHiringInsightsCard': LazyComponent<typeof import("../components/enterprise/recruitment/HiringInsightsCard.vue")['default']>
    'LazyEnterpriseRecruitmentUiRecruitmentBadge': LazyComponent<typeof import("../components/enterprise/recruitment/ui/RecruitmentBadge.vue")['default']>
    'LazyEnterpriseRecruitmentUiRecruitmentInput': LazyComponent<typeof import("../components/enterprise/recruitment/ui/RecruitmentInput.vue")['default']>
    'LazyEnterpriseRecruitmentUiRecruitmentPageShell': LazyComponent<typeof import("../components/enterprise/recruitment/ui/RecruitmentPageShell.vue")['default']>
    'LazyEnterpriseRecruitmentUiRecruitmentPrimaryButton': LazyComponent<typeof import("../components/enterprise/recruitment/ui/RecruitmentPrimaryButton.vue")['default']>
    'LazyEnterpriseRecruitmentUiRecruitmentSecondaryButton': LazyComponent<typeof import("../components/enterprise/recruitment/ui/RecruitmentSecondaryButton.vue")['default']>
    'LazyEnterpriseRecruitmentUiRecruitmentSelect': LazyComponent<typeof import("../components/enterprise/recruitment/ui/RecruitmentSelect.vue")['default']>
    'LazyEnterpriseRecruitmentUiRecruitmentStatCard': LazyComponent<typeof import("../components/enterprise/recruitment/ui/RecruitmentStatCard.vue")['default']>
    'LazyEnterpriseWorkspaceAIEmployeeConfig': LazyComponent<typeof import("../components/enterprise/workspace/AIEmployeeConfig.vue")['default']>
    'LazyEnterpriseWorkspaceAgentCard': LazyComponent<typeof import("../components/enterprise/workspace/AgentCard.vue")['default']>
    'LazyEnterpriseWorkspaceAgentChannelCard': LazyComponent<typeof import("../components/enterprise/workspace/AgentChannelCard.vue")['default']>
    'LazyEnterpriseWorkspaceAgentDetailPanel': LazyComponent<typeof import("../components/enterprise/workspace/AgentDetailPanel.vue")['default']>
    'LazyEnterpriseWorkspaceAgentHealthCard': LazyComponent<typeof import("../components/enterprise/workspace/AgentHealthCard.vue")['default']>
    'LazyEnterpriseWorkspaceAgentModelCard': LazyComponent<typeof import("../components/enterprise/workspace/AgentModelCard.vue")['default']>
    'LazyEnterpriseWorkspaceAgentRuntimeCard': LazyComponent<typeof import("../components/enterprise/workspace/AgentRuntimeCard.vue")['default']>
    'LazyEnterpriseWorkspaceAgentTimeline': LazyComponent<typeof import("../components/enterprise/workspace/AgentTimeline.vue")['default']>
    'LazyEnterpriseWorkspaceChannelConnectCenter': LazyComponent<typeof import("../components/enterprise/workspace/ChannelConnectCenter.vue")['default']>
    'LazyEnterpriseWorkspaceCreateOrganizationModal': LazyComponent<typeof import("../components/enterprise/workspace/CreateOrganizationModal.vue")['default']>
    'LazyEnterpriseWorkspaceEnterpriseIdentityHeader': LazyComponent<typeof import("../components/enterprise/workspace/EnterpriseIdentityHeader.vue")['default']>
    'LazyEnterpriseWorkspaceEnterpriseModuleRenderer': LazyComponent<typeof import("../components/enterprise/workspace/EnterpriseModuleRenderer.vue")['default']>
    'LazyEnterpriseWorkspaceEnterpriseOnboardingWizard': LazyComponent<typeof import("../components/enterprise/workspace/EnterpriseOnboardingWizard.vue")['default']>
    'LazyEnterpriseWorkspace': LazyComponent<typeof import("../components/enterprise/workspace/EnterpriseWorkspace.vue")['default']>
    'LazyEnterpriseWorkspaceModulesChannelsModule': LazyComponent<typeof import("../components/enterprise/workspace/modules/ChannelsModule.vue")['default']>
    'LazyEnterpriseWorkspaceModulesDashboardModule': LazyComponent<typeof import("../components/enterprise/workspace/modules/DashboardModule.vue")['default']>
    'LazyEnterpriseWorkspaceModulesDecisionsModule': LazyComponent<typeof import("../components/enterprise/workspace/modules/DecisionsModule.vue")['default']>
    'LazyEnterpriseWorkspaceModulesEmployeesModule': LazyComponent<typeof import("../components/enterprise/workspace/modules/EmployeesModule.vue")['default']>
    'LazyEnterpriseWorkspaceModulesExecutionModule': LazyComponent<typeof import("../components/enterprise/workspace/modules/ExecutionModule.vue")['default']>
    'LazyEnterpriseWorkspaceModulesGovernanceModule': LazyComponent<typeof import("../components/enterprise/workspace/modules/GovernanceModule.vue")['default']>
    'LazyEnterpriseWorkspaceModulesGrowthModule': LazyComponent<typeof import("../components/enterprise/workspace/modules/GrowthModule.vue")['default']>
    'LazyEnterpriseWorkspaceModulesIntelligenceModule': LazyComponent<typeof import("../components/enterprise/workspace/modules/IntelligenceModule.vue")['default']>
    'LazyEnterpriseWorkspaceModulesKnowledgeModule': LazyComponent<typeof import("../components/enterprise/workspace/modules/KnowledgeModule.vue")['default']>
    'LazyEnterpriseWorkspaceModulesProviderSettingsModule': LazyComponent<typeof import("../components/enterprise/workspace/modules/ProviderSettingsModule.vue")['default']>
    'LazyEnterpriseWorkspaceModulesRecruitmentModule': LazyComponent<typeof import("../components/enterprise/workspace/modules/RecruitmentModule.vue")['default']>
    'LazyEnterpriseWorkspaceModulesSettingsModule': LazyComponent<typeof import("../components/enterprise/workspace/modules/SettingsModule.vue")['default']>
    'LazyEnterpriseWorkspaceModulesTasksModule': LazyComponent<typeof import("../components/enterprise/workspace/modules/TasksModule.vue")['default']>
    'LazyHdzLibraryReaderPanel': LazyComponent<typeof import("../components/hdz/LibraryReaderPanel.vue")['default']>
    'LazyKmkiUiActionCard': LazyComponent<typeof import("../components/kmki-ui/ActionCard/index.vue")['default']>
    'LazyKmkiUiActionsSection': LazyComponent<typeof import("../components/kmki-ui/ActionsSection/index.vue")['default']>
    'LazyKmkiUiActivityFeed': LazyComponent<typeof import("../components/kmki-ui/ActivityFeed/index.vue")['default']>
    'LazyKmkiUiBadge': LazyComponent<typeof import("../components/kmki-ui/Badge/index.vue")['default']>
    'LazyKmkiUiCard': LazyComponent<typeof import("../components/kmki-ui/Card/index.vue")['default']>
    'LazyKmkiUiConfidenceMeter': LazyComponent<typeof import("../components/kmki-ui/ConfidenceMeter/index.vue")['default']>
    'LazyKmkiUiDiffViewer': LazyComponent<typeof import("../components/kmki-ui/DiffViewer/index.vue")['default']>
    'LazyKmkiUiEffortBadge': LazyComponent<typeof import("../components/kmki-ui/EffortBadge/index.vue")['default']>
    'LazyKmkiUiEmptyState': LazyComponent<typeof import("../components/kmki-ui/EmptyState/index.vue")['default']>
    'LazyKmkiUiExecutiveSummaryCard': LazyComponent<typeof import("../components/kmki-ui/ExecutiveSummaryCard/index.vue")['default']>
    'LazyKmkiUiExplainPanel': LazyComponent<typeof import("../components/kmki-ui/ExplainPanel/index.vue")['default']>
    'LazyKmkiUiExportMenu': LazyComponent<typeof import("../components/kmki-ui/ExportMenu/index.vue")['default']>
    'LazyKmkiUiFindingsSection': LazyComponent<typeof import("../components/kmki-ui/FindingsSection/index.vue")['default']>
    'LazyKmkiUiHealthIndicator': LazyComponent<typeof import("../components/kmki-ui/HealthIndicator/index.vue")['default']>
    'LazyKmkiUiImpactBadge': LazyComponent<typeof import("../components/kmki-ui/ImpactBadge/index.vue")['default']>
    'LazyKmkiUiImprovementBadge': LazyComponent<typeof import("../components/kmki-ui/ImprovementBadge/index.vue")['default']>
    'LazyKmkiUiMetric': LazyComponent<typeof import("../components/kmki-ui/Metric/index.vue")['default']>
    'LazyKmkiUiNextRecommendations': LazyComponent<typeof import("../components/kmki-ui/NextRecommendations/index.vue")['default']>
    'LazyKmkiUiOpportunitiesSection': LazyComponent<typeof import("../components/kmki-ui/OpportunitiesSection/index.vue")['default']>
    'LazyKmkiUiReportCard': LazyComponent<typeof import("../components/kmki-ui/ReportCard/index.vue")['default']>
    'LazyKmkiUiScoreComparison': LazyComponent<typeof import("../components/kmki-ui/ScoreComparison/index.vue")['default']>
    'LazyKmkiUiSkeleton': LazyComponent<typeof import("../components/kmki-ui/Skeleton/index.vue")['default']>
    'LazyKmkiUiStatusChip': LazyComponent<typeof import("../components/kmki-ui/StatusChip/index.vue")['default']>
    'LazyKmkiUiStepList': LazyComponent<typeof import("../components/kmki-ui/StepList/index.vue")['default']>
    'LazyKmkiUiTimeline': LazyComponent<typeof import("../components/kmki-ui/Timeline/index.vue")['default']>
    'LazyKmkiUiVerificationCard': LazyComponent<typeof import("../components/kmki-ui/VerificationCard/index.vue")['default']>
    'LazyKmkiUiVerificationSection': LazyComponent<typeof import("../components/kmki-ui/VerificationSection/index.vue")['default']>
    'LazyKmkiUiVerificationTimeline': LazyComponent<typeof import("../components/kmki-ui/VerificationTimeline/index.vue")['default']>
    'LazyKmkiUiWorkflowStepper': LazyComponent<typeof import("../components/kmki-ui/WorkflowStepper/index.vue")['default']>
    'LazyKnowledgeBodyRenderer': LazyComponent<typeof import("../components/knowledge/KnowledgeBodyRenderer.vue")['default']>
    'LazyKnowledgeFAQ': LazyComponent<typeof import("../components/knowledge/KnowledgeFAQ.vue")['default']>
    'LazyKnowledgeFooter': LazyComponent<typeof import("../components/knowledge/KnowledgeFooter.vue")['default']>
    'LazyKnowledgeHero': LazyComponent<typeof import("../components/knowledge/KnowledgeHero.vue")['default']>
    'LazyKnowledgeJSONLD': LazyComponent<typeof import("../components/knowledge/KnowledgeJSONLD.vue")['default']>
    'LazyKnowledgeMetadata': LazyComponent<typeof import("../components/knowledge/KnowledgeMetadata.vue")['default']>
    'LazyKnowledgeRelated': LazyComponent<typeof import("../components/knowledge/KnowledgeRelated.vue")['default']>
    'LazyKnowledgeRenderer': LazyComponent<typeof import("../components/knowledge/KnowledgeRenderer.vue")['default']>
    'LazyKnowledgeSummary': LazyComponent<typeof import("../components/knowledge/KnowledgeSummary.vue")['default']>
    'LazyKnowledgeRegistrySetup': LazyComponent<typeof import("../components/knowledge/registry.setup")['default']>
    'LazyKnowledgeRegistry': LazyComponent<typeof import("../components/knowledge/registry")['default']>
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
    'LazyKunlunScenesEnterpriseGrowthBanner': LazyComponent<typeof import("../components/kunlun/scenes/EnterpriseGrowthBanner.vue")['default']>
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
    'LazyRecruitmentActivityFeed': LazyComponent<typeof import("../components/recruitment/ActivityFeed.vue")['default']>
    'LazyRecruitmentAgentWorkforceCard': LazyComponent<typeof import("../components/recruitment/AgentWorkforceCard.vue")['default']>
    'LazyRecruitmentHealthBanner': LazyComponent<typeof import("../components/recruitment/HealthBanner.vue")['default']>
    'LazyRecruitmentMetricCard': LazyComponent<typeof import("../components/recruitment/MetricCard.vue")['default']>
    'LazyRecruitmentPendingList': LazyComponent<typeof import("../components/recruitment/PendingList.vue")['default']>
    'LazyRecruitmentFunnel': LazyComponent<typeof import("../components/recruitment/RecruitmentFunnel.vue")['default']>
    'LazyRecruitmentRoiCard': LazyComponent<typeof import("../components/recruitment/RecruitmentRoiCard.vue")['default']>
    'LazyRecruitmentShell': LazyComponent<typeof import("../components/recruitment/RecruitmentShell.vue")['default']>
    'LazyRecruitmentSubscriptionCard': LazyComponent<typeof import("../components/recruitment/RecruitmentSubscriptionCard.vue")['default']>
    'LazyRecruitmentWorkspaceNav': LazyComponent<typeof import("../components/recruitment/RecruitmentWorkspaceNav.vue")['default']>
    'LazyRecruitmentSectionCard': LazyComponent<typeof import("../components/recruitment/SectionCard.vue")['default']>
    'LazyRecruitmentStatusBadge': LazyComponent<typeof import("../components/recruitment/StatusBadge.vue")['default']>
    'LazyRevenueUpgradeModal': LazyComponent<typeof import("../components/revenue/UpgradeModal.vue")['default']>
    'LazyUIEmptyState': LazyComponent<typeof import("../components/ui/UIEmptyState.vue")['default']>
    'LazyUIErrorCard': LazyComponent<typeof import("../components/ui/UIErrorCard.vue")['default']>
    'LazyUISkeleton': LazyComponent<typeof import("../components/ui/UISkeleton.vue")['default']>
    'LazyUIToastContainer': LazyComponent<typeof import("../components/ui/UIToastContainer.vue")['default']>
    'LazyWizardFirstRunWizard': LazyComponent<typeof import("../components/wizard/FirstRunWizard.vue")['default']>
    'LazyWorkspaceSharedWorkspaceUserCard': LazyComponent<typeof import("../components/workspace/shared/WorkspaceUserCard.vue")['default']>
    'LazyNuxtWelcome': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/welcome.vue")['default']>
    'LazyNuxtLayout': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-layout")['default']>
    'LazyNuxtErrorBoundary': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-error-boundary")['default']>
    'LazyClientOnly': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/client-only")['default']>
    'LazyDevOnly': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/dev-only")['default']>
    'LazyServerPlaceholder': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/server-placeholder")['default']>
    'LazyNuxtLink': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-link")['default']>
    'LazyNuxtLoadingIndicator': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-loading-indicator")['default']>
    'LazyNuxtRouteAnnouncer': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-route-announcer")['default']>
    'LazyNuxtImg': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtImg']>
    'LazyNuxtPicture': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtPicture']>
    'LazyNuxtPage': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/pages/runtime/page")['default']>
    'LazyNoScript': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['NoScript']>
    'LazyLink': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Link']>
    'LazyBase': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Base']>
    'LazyTitle': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Title']>
    'LazyMeta': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Meta']>
    'LazyStyle': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Style']>
    'LazyHead': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Head']>
    'LazyHtml': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Html']>
    'LazyBody': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Body']>
    'LazyNuxtIsland': LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-island")['default']>
    'LazyNuxtRouteAnnouncer': LazyComponent<IslandComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/server-placeholder")['default']>>
}

declare module 'vue' {
  export interface GlobalComponents extends _GlobalComponents { }
}

export const AppFooter: typeof import("../components/AppFooter.vue")['default']
export const CommunityPostCard: typeof import("../components/CommunityPostCard.vue")['default']
export const EnterpriseWorkspaceShell: typeof import("../components/EnterpriseWorkspaceShell.vue")['default']
export const LibraryReaderPanel: typeof import("../components/LibraryReaderPanel.vue")['default']
export const RegionPicker: typeof import("../components/RegionPicker.vue")['default']
export const WorkspaceSwitcher: typeof import("../components/WorkspaceSwitcher.vue")['default']
export const AdminDashboardActivityStrip: typeof import("../components/admin/dashboard/ActivityStrip.vue")['default']
export const AdminDashboardActivityTimeline: typeof import("../components/admin/dashboard/ActivityTimeline.vue")['default']
export const AdminDashboardAgentMiniCard: typeof import("../components/admin/dashboard/AgentMiniCard.vue")['default']
export const AdminDashboardAgentRanking: typeof import("../components/admin/dashboard/AgentRanking.vue")['default']
export const AdminDashboardAiHealthMiniCard: typeof import("../components/admin/dashboard/AiHealthMiniCard.vue")['default']
export const AdminDashboardAiHealthPanel: typeof import("../components/admin/dashboard/AiHealthPanel.vue")['default']
export const AdminDashboardDetailDrawer: typeof import("../components/admin/dashboard/DetailDrawer.vue")['default']
export const AdminDashboardEnterpriseIntelPanel: typeof import("../components/admin/dashboard/EnterpriseIntelPanel.vue")['default']
export const AdminDashboardGeographyPanel: typeof import("../components/admin/dashboard/GeographyPanel.vue")['default']
export const AdminDashboardKpiOverview: typeof import("../components/admin/dashboard/KpiOverview.vue")['default']
export const AdminDashboardMetricCard: typeof import("../components/admin/dashboard/MetricCard.vue")['default']
export const AdminDashboardRevenueCockpit: typeof import("../components/admin/dashboard/RevenueCockpit.vue")['default']
export const AdminDashboardRevenuePanel: typeof import("../components/admin/dashboard/RevenuePanel.vue")['default']
export const AdminDashboardRevenueTrendCard: typeof import("../components/admin/dashboard/RevenueTrendCard.vue")['default']
export const AdminDashboardSystemHealthPanel: typeof import("../components/admin/dashboard/SystemHealthPanel.vue")['default']
export const AdminDashboardTimeRangeBar: typeof import("../components/admin/dashboard/TimeRangeBar.vue")['default']
export const AdminDashboardUserGrowthPanel: typeof import("../components/admin/dashboard/UserGrowthPanel.vue")['default']
export const AdminDashboardUserTrendCard: typeof import("../components/admin/dashboard/UserTrendCard.vue")['default']
export const AdminDashboardVipMiniCard: typeof import("../components/admin/dashboard/VipMiniCard.vue")['default']
export const AdminDashboardVipPanel: typeof import("../components/admin/dashboard/VipPanel.vue")['default']
export const AdminDashboardWorkspaceChart: typeof import("../components/admin/dashboard/WorkspaceChart.vue")['default']
export const AdminDashboardWorkspaceEcosystemCard: typeof import("../components/admin/dashboard/WorkspaceEcosystemCard.vue")['default']
export const AdminDashboardWorkspaceMiniCard: typeof import("../components/admin/dashboard/WorkspaceMiniCard.vue")['default']
export const AdminMallBannersTab: typeof import("../components/admin/mall/BannersTab.vue")['default']
export const AdminMallCategoriesTab: typeof import("../components/admin/mall/CategoriesTab.vue")['default']
export const AdminMallCouponsTab: typeof import("../components/admin/mall/CouponsTab.vue")['default']
export const AdminMallOrdersTab: typeof import("../components/admin/mall/OrdersTab.vue")['default']
export const AdminMallProductsTab: typeof import("../components/admin/mall/ProductsTab.vue")['default']
export const AdminMallRecommendTab: typeof import("../components/admin/mall/RecommendTab.vue")['default']
export const AiModelSettingsLauncher: typeof import("../components/ai-model/ModelSettingsLauncher.vue")['default']
export const BusinessLoginModal: typeof import("../components/business/LoginModal.vue")['default']
export const CommunityHero: typeof import("../components/community/CommunityHero.vue")['default']
export const CustomerService: typeof import("../components/customer/CustomerService.vue")['default']
export const DirectorLocalEngineInstaller: typeof import("../components/director/LocalEngineInstaller.vue")['default']
export const DirectorModelSettingsModal: typeof import("../components/director/ModelSettingsModal.vue")['default']
export const DirectorOllamaSetupModal: typeof import("../components/director/OllamaSetupModal.vue")['default']
export const EcomAnalysisPanel: typeof import("../components/ecom/AnalysisPanel.vue")['default']
export const EcomGalleryPanel: typeof import("../components/ecom/GalleryPanel.vue")['default']
export const EcomPromptsPanel: typeof import("../components/ecom/PromptsPanel.vue")['default']
export const EnterpriseUiEnterpriseShell: typeof import("../components/enterprise-ui/EnterpriseShell.vue")['default']
export const EnterpriseUiCardsActionCard: typeof import("../components/enterprise-ui/cards/ActionCard.vue")['default']
export const EnterpriseUiCardsDecisionCard: typeof import("../components/enterprise-ui/cards/DecisionCard.vue")['default']
export const EnterpriseUiCardsMetricCard: typeof import("../components/enterprise-ui/cards/MetricCard.vue")['default']
export const EnterpriseUiCardsSignalCard: typeof import("../components/enterprise-ui/cards/SignalCard.vue")['default']
export const EnterpriseUiFeedbackEmptyState: typeof import("../components/enterprise-ui/feedback/EmptyState.vue")['default']
export const EnterpriseUiFeedbackSkeleton: typeof import("../components/enterprise-ui/feedback/Skeleton.vue")['default']
export const EnterpriseUiFeedbackStatusBadge: typeof import("../components/enterprise-ui/feedback/StatusBadge.vue")['default']
export const EnterpriseUiNavigationEnterpriseHeader: typeof import("../components/enterprise-ui/navigation/EnterpriseHeader.vue")['default']
export const EnterpriseUiNavigationEnterpriseSidebar: typeof import("../components/enterprise-ui/navigation/EnterpriseSidebar.vue")['default']
export const EnterpriseAgentCard: typeof import("../components/enterprise/AgentCard.vue")['default']
export const EnterpriseAiTeamDisplay: typeof import("../components/enterprise/AiTeamDisplay.vue")['default']
export const EnterpriseApprovalCard: typeof import("../components/enterprise/ApprovalCard.vue")['default']
export const EnterpriseEmployeeCard: typeof import("../components/enterprise/EmployeeCard.vue")['default']
export const EnterpriseSetupStepIndicator: typeof import("../components/enterprise/SetupStepIndicator.vue")['default']
export const EnterpriseTodayTasks: typeof import("../components/enterprise/TodayTasks.vue")['default']
export const EnterpriseDashboardAIAgentMiniCard: typeof import("../components/enterprise/dashboard/AIAgentMiniCard.vue")['default']
export const EnterpriseDashboardAIAgentStatusGrid: typeof import("../components/enterprise/dashboard/AIAgentStatusGrid.vue")['default']
export const EnterpriseDashboardAIDepartmentOverview: typeof import("../components/enterprise/dashboard/AIDepartmentOverview.vue")['default']
export const EnterpriseDashboardAINextActionCard: typeof import("../components/enterprise/dashboard/AINextActionCard.vue")['default']
export const EnterpriseDashboardAITeamActivityFeed: typeof import("../components/enterprise/dashboard/AITeamActivityFeed.vue")['default']
export const EnterpriseDashboardAITeamHealthCard: typeof import("../components/enterprise/dashboard/AITeamHealthCard.vue")['default']
export const EnterpriseDashboardSection: typeof import("../components/enterprise/dashboard/DashboardSection.vue")['default']
export const EnterpriseDashboardEmployeeCardAdapter: typeof import("../components/enterprise/dashboard/EmployeeCardAdapter.vue")['default']
export const EnterpriseDashboardEnterpriseTimeline: typeof import("../components/enterprise/dashboard/EnterpriseTimeline.vue")['default']
export const EnterpriseDashboardOutcomeHeroCard: typeof import("../components/enterprise/dashboard/OutcomeHeroCard.vue")['default']
export const EnterpriseDirectorPanel: typeof import("../components/enterprise/director/DirectorPanel.vue")['default']
export const EnterpriseEmployeeProfileCEOCommandContext: typeof import("../components/enterprise/employee-profile/CEOCommandContext.vue")['default']
export const EnterpriseEmployeeProfileContributionTimeline: typeof import("../components/enterprise/employee-profile/ContributionTimeline.vue")['default']
export const EnterpriseEmployeeProfileEmployeeCapability: typeof import("../components/enterprise/employee-profile/EmployeeCapability.vue")['default']
export const EnterpriseEmployeeProfileEmployeeIdentity: typeof import("../components/enterprise/employee-profile/EmployeeIdentity.vue")['default']
export const EnterpriseEmployeeProfileEmployeeKnowledge: typeof import("../components/enterprise/employee-profile/EmployeeKnowledge.vue")['default']
export const EnterpriseEmployeeProfilePage: typeof import("../components/enterprise/employee-profile/EmployeeProfilePage.vue")['default']
export const EnterpriseEmployeeProfileEmployeeRole: typeof import("../components/enterprise/employee-profile/EmployeeRole.vue")['default']
export const EnterpriseEmployeeProfileEmployeeTools: typeof import("../components/enterprise/employee-profile/EmployeeTools.vue")['default']
export const EnterpriseEmployeeProfileGrowthRecord: typeof import("../components/enterprise/employee-profile/GrowthRecord.vue")['default']
export const EnterpriseEmployeeProfileHistoricalOutcomes: typeof import("../components/enterprise/employee-profile/HistoricalOutcomes.vue")['default']
export const EnterpriseRecruitmentAdminAiConfigPanel: typeof import("../components/enterprise/recruitment/AdminAiConfigPanel.vue")['default']
export const EnterpriseRecruitmentCreateJobModal: typeof import("../components/enterprise/recruitment/CreateJobModal.vue")['default']
export const EnterpriseRecruitmentHiringDecisionCard: typeof import("../components/enterprise/recruitment/HiringDecisionCard.vue")['default']
export const EnterpriseRecruitmentHiringInsightsCard: typeof import("../components/enterprise/recruitment/HiringInsightsCard.vue")['default']
export const EnterpriseRecruitmentUiRecruitmentBadge: typeof import("../components/enterprise/recruitment/ui/RecruitmentBadge.vue")['default']
export const EnterpriseRecruitmentUiRecruitmentInput: typeof import("../components/enterprise/recruitment/ui/RecruitmentInput.vue")['default']
export const EnterpriseRecruitmentUiRecruitmentPageShell: typeof import("../components/enterprise/recruitment/ui/RecruitmentPageShell.vue")['default']
export const EnterpriseRecruitmentUiRecruitmentPrimaryButton: typeof import("../components/enterprise/recruitment/ui/RecruitmentPrimaryButton.vue")['default']
export const EnterpriseRecruitmentUiRecruitmentSecondaryButton: typeof import("../components/enterprise/recruitment/ui/RecruitmentSecondaryButton.vue")['default']
export const EnterpriseRecruitmentUiRecruitmentSelect: typeof import("../components/enterprise/recruitment/ui/RecruitmentSelect.vue")['default']
export const EnterpriseRecruitmentUiRecruitmentStatCard: typeof import("../components/enterprise/recruitment/ui/RecruitmentStatCard.vue")['default']
export const EnterpriseWorkspaceAIEmployeeConfig: typeof import("../components/enterprise/workspace/AIEmployeeConfig.vue")['default']
export const EnterpriseWorkspaceAgentCard: typeof import("../components/enterprise/workspace/AgentCard.vue")['default']
export const EnterpriseWorkspaceAgentChannelCard: typeof import("../components/enterprise/workspace/AgentChannelCard.vue")['default']
export const EnterpriseWorkspaceAgentDetailPanel: typeof import("../components/enterprise/workspace/AgentDetailPanel.vue")['default']
export const EnterpriseWorkspaceAgentHealthCard: typeof import("../components/enterprise/workspace/AgentHealthCard.vue")['default']
export const EnterpriseWorkspaceAgentModelCard: typeof import("../components/enterprise/workspace/AgentModelCard.vue")['default']
export const EnterpriseWorkspaceAgentRuntimeCard: typeof import("../components/enterprise/workspace/AgentRuntimeCard.vue")['default']
export const EnterpriseWorkspaceAgentTimeline: typeof import("../components/enterprise/workspace/AgentTimeline.vue")['default']
export const EnterpriseWorkspaceChannelConnectCenter: typeof import("../components/enterprise/workspace/ChannelConnectCenter.vue")['default']
export const EnterpriseWorkspaceCreateOrganizationModal: typeof import("../components/enterprise/workspace/CreateOrganizationModal.vue")['default']
export const EnterpriseWorkspaceEnterpriseIdentityHeader: typeof import("../components/enterprise/workspace/EnterpriseIdentityHeader.vue")['default']
export const EnterpriseWorkspaceEnterpriseModuleRenderer: typeof import("../components/enterprise/workspace/EnterpriseModuleRenderer.vue")['default']
export const EnterpriseWorkspaceEnterpriseOnboardingWizard: typeof import("../components/enterprise/workspace/EnterpriseOnboardingWizard.vue")['default']
export const EnterpriseWorkspace: typeof import("../components/enterprise/workspace/EnterpriseWorkspace.vue")['default']
export const EnterpriseWorkspaceModulesChannelsModule: typeof import("../components/enterprise/workspace/modules/ChannelsModule.vue")['default']
export const EnterpriseWorkspaceModulesDashboardModule: typeof import("../components/enterprise/workspace/modules/DashboardModule.vue")['default']
export const EnterpriseWorkspaceModulesDecisionsModule: typeof import("../components/enterprise/workspace/modules/DecisionsModule.vue")['default']
export const EnterpriseWorkspaceModulesEmployeesModule: typeof import("../components/enterprise/workspace/modules/EmployeesModule.vue")['default']
export const EnterpriseWorkspaceModulesExecutionModule: typeof import("../components/enterprise/workspace/modules/ExecutionModule.vue")['default']
export const EnterpriseWorkspaceModulesGovernanceModule: typeof import("../components/enterprise/workspace/modules/GovernanceModule.vue")['default']
export const EnterpriseWorkspaceModulesGrowthModule: typeof import("../components/enterprise/workspace/modules/GrowthModule.vue")['default']
export const EnterpriseWorkspaceModulesIntelligenceModule: typeof import("../components/enterprise/workspace/modules/IntelligenceModule.vue")['default']
export const EnterpriseWorkspaceModulesKnowledgeModule: typeof import("../components/enterprise/workspace/modules/KnowledgeModule.vue")['default']
export const EnterpriseWorkspaceModulesProviderSettingsModule: typeof import("../components/enterprise/workspace/modules/ProviderSettingsModule.vue")['default']
export const EnterpriseWorkspaceModulesRecruitmentModule: typeof import("../components/enterprise/workspace/modules/RecruitmentModule.vue")['default']
export const EnterpriseWorkspaceModulesSettingsModule: typeof import("../components/enterprise/workspace/modules/SettingsModule.vue")['default']
export const EnterpriseWorkspaceModulesTasksModule: typeof import("../components/enterprise/workspace/modules/TasksModule.vue")['default']
export const HdzLibraryReaderPanel: typeof import("../components/hdz/LibraryReaderPanel.vue")['default']
export const KmkiUiActionCard: typeof import("../components/kmki-ui/ActionCard/index.vue")['default']
export const KmkiUiActionsSection: typeof import("../components/kmki-ui/ActionsSection/index.vue")['default']
export const KmkiUiActivityFeed: typeof import("../components/kmki-ui/ActivityFeed/index.vue")['default']
export const KmkiUiBadge: typeof import("../components/kmki-ui/Badge/index.vue")['default']
export const KmkiUiCard: typeof import("../components/kmki-ui/Card/index.vue")['default']
export const KmkiUiConfidenceMeter: typeof import("../components/kmki-ui/ConfidenceMeter/index.vue")['default']
export const KmkiUiDiffViewer: typeof import("../components/kmki-ui/DiffViewer/index.vue")['default']
export const KmkiUiEffortBadge: typeof import("../components/kmki-ui/EffortBadge/index.vue")['default']
export const KmkiUiEmptyState: typeof import("../components/kmki-ui/EmptyState/index.vue")['default']
export const KmkiUiExecutiveSummaryCard: typeof import("../components/kmki-ui/ExecutiveSummaryCard/index.vue")['default']
export const KmkiUiExplainPanel: typeof import("../components/kmki-ui/ExplainPanel/index.vue")['default']
export const KmkiUiExportMenu: typeof import("../components/kmki-ui/ExportMenu/index.vue")['default']
export const KmkiUiFindingsSection: typeof import("../components/kmki-ui/FindingsSection/index.vue")['default']
export const KmkiUiHealthIndicator: typeof import("../components/kmki-ui/HealthIndicator/index.vue")['default']
export const KmkiUiImpactBadge: typeof import("../components/kmki-ui/ImpactBadge/index.vue")['default']
export const KmkiUiImprovementBadge: typeof import("../components/kmki-ui/ImprovementBadge/index.vue")['default']
export const KmkiUiMetric: typeof import("../components/kmki-ui/Metric/index.vue")['default']
export const KmkiUiNextRecommendations: typeof import("../components/kmki-ui/NextRecommendations/index.vue")['default']
export const KmkiUiOpportunitiesSection: typeof import("../components/kmki-ui/OpportunitiesSection/index.vue")['default']
export const KmkiUiReportCard: typeof import("../components/kmki-ui/ReportCard/index.vue")['default']
export const KmkiUiScoreComparison: typeof import("../components/kmki-ui/ScoreComparison/index.vue")['default']
export const KmkiUiSkeleton: typeof import("../components/kmki-ui/Skeleton/index.vue")['default']
export const KmkiUiStatusChip: typeof import("../components/kmki-ui/StatusChip/index.vue")['default']
export const KmkiUiStepList: typeof import("../components/kmki-ui/StepList/index.vue")['default']
export const KmkiUiTimeline: typeof import("../components/kmki-ui/Timeline/index.vue")['default']
export const KmkiUiVerificationCard: typeof import("../components/kmki-ui/VerificationCard/index.vue")['default']
export const KmkiUiVerificationSection: typeof import("../components/kmki-ui/VerificationSection/index.vue")['default']
export const KmkiUiVerificationTimeline: typeof import("../components/kmki-ui/VerificationTimeline/index.vue")['default']
export const KmkiUiWorkflowStepper: typeof import("../components/kmki-ui/WorkflowStepper/index.vue")['default']
export const KnowledgeBodyRenderer: typeof import("../components/knowledge/KnowledgeBodyRenderer.vue")['default']
export const KnowledgeFAQ: typeof import("../components/knowledge/KnowledgeFAQ.vue")['default']
export const KnowledgeFooter: typeof import("../components/knowledge/KnowledgeFooter.vue")['default']
export const KnowledgeHero: typeof import("../components/knowledge/KnowledgeHero.vue")['default']
export const KnowledgeJSONLD: typeof import("../components/knowledge/KnowledgeJSONLD.vue")['default']
export const KnowledgeMetadata: typeof import("../components/knowledge/KnowledgeMetadata.vue")['default']
export const KnowledgeRelated: typeof import("../components/knowledge/KnowledgeRelated.vue")['default']
export const KnowledgeRenderer: typeof import("../components/knowledge/KnowledgeRenderer.vue")['default']
export const KnowledgeSummary: typeof import("../components/knowledge/KnowledgeSummary.vue")['default']
export const KnowledgeRegistrySetup: typeof import("../components/knowledge/registry.setup")['default']
export const KnowledgeRegistry: typeof import("../components/knowledge/registry")['default']
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
export const KunlunScenesEnterpriseGrowthBanner: typeof import("../components/kunlun/scenes/EnterpriseGrowthBanner.vue")['default']
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
export const RecruitmentActivityFeed: typeof import("../components/recruitment/ActivityFeed.vue")['default']
export const RecruitmentAgentWorkforceCard: typeof import("../components/recruitment/AgentWorkforceCard.vue")['default']
export const RecruitmentHealthBanner: typeof import("../components/recruitment/HealthBanner.vue")['default']
export const RecruitmentMetricCard: typeof import("../components/recruitment/MetricCard.vue")['default']
export const RecruitmentPendingList: typeof import("../components/recruitment/PendingList.vue")['default']
export const RecruitmentFunnel: typeof import("../components/recruitment/RecruitmentFunnel.vue")['default']
export const RecruitmentRoiCard: typeof import("../components/recruitment/RecruitmentRoiCard.vue")['default']
export const RecruitmentShell: typeof import("../components/recruitment/RecruitmentShell.vue")['default']
export const RecruitmentSubscriptionCard: typeof import("../components/recruitment/RecruitmentSubscriptionCard.vue")['default']
export const RecruitmentWorkspaceNav: typeof import("../components/recruitment/RecruitmentWorkspaceNav.vue")['default']
export const RecruitmentSectionCard: typeof import("../components/recruitment/SectionCard.vue")['default']
export const RecruitmentStatusBadge: typeof import("../components/recruitment/StatusBadge.vue")['default']
export const RevenueUpgradeModal: typeof import("../components/revenue/UpgradeModal.vue")['default']
export const UIEmptyState: typeof import("../components/ui/UIEmptyState.vue")['default']
export const UIErrorCard: typeof import("../components/ui/UIErrorCard.vue")['default']
export const UISkeleton: typeof import("../components/ui/UISkeleton.vue")['default']
export const UIToastContainer: typeof import("../components/ui/UIToastContainer.vue")['default']
export const WizardFirstRunWizard: typeof import("../components/wizard/FirstRunWizard.vue")['default']
export const WorkspaceSharedWorkspaceUserCard: typeof import("../components/workspace/shared/WorkspaceUserCard.vue")['default']
export const NuxtWelcome: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/welcome.vue")['default']
export const NuxtLayout: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-layout")['default']
export const NuxtErrorBoundary: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-error-boundary")['default']
export const ClientOnly: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/client-only")['default']
export const DevOnly: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/dev-only")['default']
export const ServerPlaceholder: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/server-placeholder")['default']
export const NuxtLink: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-link")['default']
export const NuxtLoadingIndicator: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-loading-indicator")['default']
export const NuxtRouteAnnouncer: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-route-announcer")['default']
export const NuxtImg: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtImg']
export const NuxtPicture: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtPicture']
export const NuxtPage: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/pages/runtime/page")['default']
export const NoScript: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['NoScript']
export const Link: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Link']
export const Base: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Base']
export const Title: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Title']
export const Meta: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Meta']
export const Style: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Style']
export const Head: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Head']
export const Html: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Html']
export const Body: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Body']
export const NuxtIsland: typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-island")['default']
export const NuxtRouteAnnouncer: IslandComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/server-placeholder")['default']>
export const LazyAppFooter: LazyComponent<typeof import("../components/AppFooter.vue")['default']>
export const LazyCommunityPostCard: LazyComponent<typeof import("../components/CommunityPostCard.vue")['default']>
export const LazyEnterpriseWorkspaceShell: LazyComponent<typeof import("../components/EnterpriseWorkspaceShell.vue")['default']>
export const LazyLibraryReaderPanel: LazyComponent<typeof import("../components/LibraryReaderPanel.vue")['default']>
export const LazyRegionPicker: LazyComponent<typeof import("../components/RegionPicker.vue")['default']>
export const LazyWorkspaceSwitcher: LazyComponent<typeof import("../components/WorkspaceSwitcher.vue")['default']>
export const LazyAdminDashboardActivityStrip: LazyComponent<typeof import("../components/admin/dashboard/ActivityStrip.vue")['default']>
export const LazyAdminDashboardActivityTimeline: LazyComponent<typeof import("../components/admin/dashboard/ActivityTimeline.vue")['default']>
export const LazyAdminDashboardAgentMiniCard: LazyComponent<typeof import("../components/admin/dashboard/AgentMiniCard.vue")['default']>
export const LazyAdminDashboardAgentRanking: LazyComponent<typeof import("../components/admin/dashboard/AgentRanking.vue")['default']>
export const LazyAdminDashboardAiHealthMiniCard: LazyComponent<typeof import("../components/admin/dashboard/AiHealthMiniCard.vue")['default']>
export const LazyAdminDashboardAiHealthPanel: LazyComponent<typeof import("../components/admin/dashboard/AiHealthPanel.vue")['default']>
export const LazyAdminDashboardDetailDrawer: LazyComponent<typeof import("../components/admin/dashboard/DetailDrawer.vue")['default']>
export const LazyAdminDashboardEnterpriseIntelPanel: LazyComponent<typeof import("../components/admin/dashboard/EnterpriseIntelPanel.vue")['default']>
export const LazyAdminDashboardGeographyPanel: LazyComponent<typeof import("../components/admin/dashboard/GeographyPanel.vue")['default']>
export const LazyAdminDashboardKpiOverview: LazyComponent<typeof import("../components/admin/dashboard/KpiOverview.vue")['default']>
export const LazyAdminDashboardMetricCard: LazyComponent<typeof import("../components/admin/dashboard/MetricCard.vue")['default']>
export const LazyAdminDashboardRevenueCockpit: LazyComponent<typeof import("../components/admin/dashboard/RevenueCockpit.vue")['default']>
export const LazyAdminDashboardRevenuePanel: LazyComponent<typeof import("../components/admin/dashboard/RevenuePanel.vue")['default']>
export const LazyAdminDashboardRevenueTrendCard: LazyComponent<typeof import("../components/admin/dashboard/RevenueTrendCard.vue")['default']>
export const LazyAdminDashboardSystemHealthPanel: LazyComponent<typeof import("../components/admin/dashboard/SystemHealthPanel.vue")['default']>
export const LazyAdminDashboardTimeRangeBar: LazyComponent<typeof import("../components/admin/dashboard/TimeRangeBar.vue")['default']>
export const LazyAdminDashboardUserGrowthPanel: LazyComponent<typeof import("../components/admin/dashboard/UserGrowthPanel.vue")['default']>
export const LazyAdminDashboardUserTrendCard: LazyComponent<typeof import("../components/admin/dashboard/UserTrendCard.vue")['default']>
export const LazyAdminDashboardVipMiniCard: LazyComponent<typeof import("../components/admin/dashboard/VipMiniCard.vue")['default']>
export const LazyAdminDashboardVipPanel: LazyComponent<typeof import("../components/admin/dashboard/VipPanel.vue")['default']>
export const LazyAdminDashboardWorkspaceChart: LazyComponent<typeof import("../components/admin/dashboard/WorkspaceChart.vue")['default']>
export const LazyAdminDashboardWorkspaceEcosystemCard: LazyComponent<typeof import("../components/admin/dashboard/WorkspaceEcosystemCard.vue")['default']>
export const LazyAdminDashboardWorkspaceMiniCard: LazyComponent<typeof import("../components/admin/dashboard/WorkspaceMiniCard.vue")['default']>
export const LazyAdminMallBannersTab: LazyComponent<typeof import("../components/admin/mall/BannersTab.vue")['default']>
export const LazyAdminMallCategoriesTab: LazyComponent<typeof import("../components/admin/mall/CategoriesTab.vue")['default']>
export const LazyAdminMallCouponsTab: LazyComponent<typeof import("../components/admin/mall/CouponsTab.vue")['default']>
export const LazyAdminMallOrdersTab: LazyComponent<typeof import("../components/admin/mall/OrdersTab.vue")['default']>
export const LazyAdminMallProductsTab: LazyComponent<typeof import("../components/admin/mall/ProductsTab.vue")['default']>
export const LazyAdminMallRecommendTab: LazyComponent<typeof import("../components/admin/mall/RecommendTab.vue")['default']>
export const LazyAiModelSettingsLauncher: LazyComponent<typeof import("../components/ai-model/ModelSettingsLauncher.vue")['default']>
export const LazyBusinessLoginModal: LazyComponent<typeof import("../components/business/LoginModal.vue")['default']>
export const LazyCommunityHero: LazyComponent<typeof import("../components/community/CommunityHero.vue")['default']>
export const LazyCustomerService: LazyComponent<typeof import("../components/customer/CustomerService.vue")['default']>
export const LazyDirectorLocalEngineInstaller: LazyComponent<typeof import("../components/director/LocalEngineInstaller.vue")['default']>
export const LazyDirectorModelSettingsModal: LazyComponent<typeof import("../components/director/ModelSettingsModal.vue")['default']>
export const LazyDirectorOllamaSetupModal: LazyComponent<typeof import("../components/director/OllamaSetupModal.vue")['default']>
export const LazyEcomAnalysisPanel: LazyComponent<typeof import("../components/ecom/AnalysisPanel.vue")['default']>
export const LazyEcomGalleryPanel: LazyComponent<typeof import("../components/ecom/GalleryPanel.vue")['default']>
export const LazyEcomPromptsPanel: LazyComponent<typeof import("../components/ecom/PromptsPanel.vue")['default']>
export const LazyEnterpriseUiEnterpriseShell: LazyComponent<typeof import("../components/enterprise-ui/EnterpriseShell.vue")['default']>
export const LazyEnterpriseUiCardsActionCard: LazyComponent<typeof import("../components/enterprise-ui/cards/ActionCard.vue")['default']>
export const LazyEnterpriseUiCardsDecisionCard: LazyComponent<typeof import("../components/enterprise-ui/cards/DecisionCard.vue")['default']>
export const LazyEnterpriseUiCardsMetricCard: LazyComponent<typeof import("../components/enterprise-ui/cards/MetricCard.vue")['default']>
export const LazyEnterpriseUiCardsSignalCard: LazyComponent<typeof import("../components/enterprise-ui/cards/SignalCard.vue")['default']>
export const LazyEnterpriseUiFeedbackEmptyState: LazyComponent<typeof import("../components/enterprise-ui/feedback/EmptyState.vue")['default']>
export const LazyEnterpriseUiFeedbackSkeleton: LazyComponent<typeof import("../components/enterprise-ui/feedback/Skeleton.vue")['default']>
export const LazyEnterpriseUiFeedbackStatusBadge: LazyComponent<typeof import("../components/enterprise-ui/feedback/StatusBadge.vue")['default']>
export const LazyEnterpriseUiNavigationEnterpriseHeader: LazyComponent<typeof import("../components/enterprise-ui/navigation/EnterpriseHeader.vue")['default']>
export const LazyEnterpriseUiNavigationEnterpriseSidebar: LazyComponent<typeof import("../components/enterprise-ui/navigation/EnterpriseSidebar.vue")['default']>
export const LazyEnterpriseAgentCard: LazyComponent<typeof import("../components/enterprise/AgentCard.vue")['default']>
export const LazyEnterpriseAiTeamDisplay: LazyComponent<typeof import("../components/enterprise/AiTeamDisplay.vue")['default']>
export const LazyEnterpriseApprovalCard: LazyComponent<typeof import("../components/enterprise/ApprovalCard.vue")['default']>
export const LazyEnterpriseEmployeeCard: LazyComponent<typeof import("../components/enterprise/EmployeeCard.vue")['default']>
export const LazyEnterpriseSetupStepIndicator: LazyComponent<typeof import("../components/enterprise/SetupStepIndicator.vue")['default']>
export const LazyEnterpriseTodayTasks: LazyComponent<typeof import("../components/enterprise/TodayTasks.vue")['default']>
export const LazyEnterpriseDashboardAIAgentMiniCard: LazyComponent<typeof import("../components/enterprise/dashboard/AIAgentMiniCard.vue")['default']>
export const LazyEnterpriseDashboardAIAgentStatusGrid: LazyComponent<typeof import("../components/enterprise/dashboard/AIAgentStatusGrid.vue")['default']>
export const LazyEnterpriseDashboardAIDepartmentOverview: LazyComponent<typeof import("../components/enterprise/dashboard/AIDepartmentOverview.vue")['default']>
export const LazyEnterpriseDashboardAINextActionCard: LazyComponent<typeof import("../components/enterprise/dashboard/AINextActionCard.vue")['default']>
export const LazyEnterpriseDashboardAITeamActivityFeed: LazyComponent<typeof import("../components/enterprise/dashboard/AITeamActivityFeed.vue")['default']>
export const LazyEnterpriseDashboardAITeamHealthCard: LazyComponent<typeof import("../components/enterprise/dashboard/AITeamHealthCard.vue")['default']>
export const LazyEnterpriseDashboardSection: LazyComponent<typeof import("../components/enterprise/dashboard/DashboardSection.vue")['default']>
export const LazyEnterpriseDashboardEmployeeCardAdapter: LazyComponent<typeof import("../components/enterprise/dashboard/EmployeeCardAdapter.vue")['default']>
export const LazyEnterpriseDashboardEnterpriseTimeline: LazyComponent<typeof import("../components/enterprise/dashboard/EnterpriseTimeline.vue")['default']>
export const LazyEnterpriseDashboardOutcomeHeroCard: LazyComponent<typeof import("../components/enterprise/dashboard/OutcomeHeroCard.vue")['default']>
export const LazyEnterpriseDirectorPanel: LazyComponent<typeof import("../components/enterprise/director/DirectorPanel.vue")['default']>
export const LazyEnterpriseEmployeeProfileCEOCommandContext: LazyComponent<typeof import("../components/enterprise/employee-profile/CEOCommandContext.vue")['default']>
export const LazyEnterpriseEmployeeProfileContributionTimeline: LazyComponent<typeof import("../components/enterprise/employee-profile/ContributionTimeline.vue")['default']>
export const LazyEnterpriseEmployeeProfileEmployeeCapability: LazyComponent<typeof import("../components/enterprise/employee-profile/EmployeeCapability.vue")['default']>
export const LazyEnterpriseEmployeeProfileEmployeeIdentity: LazyComponent<typeof import("../components/enterprise/employee-profile/EmployeeIdentity.vue")['default']>
export const LazyEnterpriseEmployeeProfileEmployeeKnowledge: LazyComponent<typeof import("../components/enterprise/employee-profile/EmployeeKnowledge.vue")['default']>
export const LazyEnterpriseEmployeeProfilePage: LazyComponent<typeof import("../components/enterprise/employee-profile/EmployeeProfilePage.vue")['default']>
export const LazyEnterpriseEmployeeProfileEmployeeRole: LazyComponent<typeof import("../components/enterprise/employee-profile/EmployeeRole.vue")['default']>
export const LazyEnterpriseEmployeeProfileEmployeeTools: LazyComponent<typeof import("../components/enterprise/employee-profile/EmployeeTools.vue")['default']>
export const LazyEnterpriseEmployeeProfileGrowthRecord: LazyComponent<typeof import("../components/enterprise/employee-profile/GrowthRecord.vue")['default']>
export const LazyEnterpriseEmployeeProfileHistoricalOutcomes: LazyComponent<typeof import("../components/enterprise/employee-profile/HistoricalOutcomes.vue")['default']>
export const LazyEnterpriseRecruitmentAdminAiConfigPanel: LazyComponent<typeof import("../components/enterprise/recruitment/AdminAiConfigPanel.vue")['default']>
export const LazyEnterpriseRecruitmentCreateJobModal: LazyComponent<typeof import("../components/enterprise/recruitment/CreateJobModal.vue")['default']>
export const LazyEnterpriseRecruitmentHiringDecisionCard: LazyComponent<typeof import("../components/enterprise/recruitment/HiringDecisionCard.vue")['default']>
export const LazyEnterpriseRecruitmentHiringInsightsCard: LazyComponent<typeof import("../components/enterprise/recruitment/HiringInsightsCard.vue")['default']>
export const LazyEnterpriseRecruitmentUiRecruitmentBadge: LazyComponent<typeof import("../components/enterprise/recruitment/ui/RecruitmentBadge.vue")['default']>
export const LazyEnterpriseRecruitmentUiRecruitmentInput: LazyComponent<typeof import("../components/enterprise/recruitment/ui/RecruitmentInput.vue")['default']>
export const LazyEnterpriseRecruitmentUiRecruitmentPageShell: LazyComponent<typeof import("../components/enterprise/recruitment/ui/RecruitmentPageShell.vue")['default']>
export const LazyEnterpriseRecruitmentUiRecruitmentPrimaryButton: LazyComponent<typeof import("../components/enterprise/recruitment/ui/RecruitmentPrimaryButton.vue")['default']>
export const LazyEnterpriseRecruitmentUiRecruitmentSecondaryButton: LazyComponent<typeof import("../components/enterprise/recruitment/ui/RecruitmentSecondaryButton.vue")['default']>
export const LazyEnterpriseRecruitmentUiRecruitmentSelect: LazyComponent<typeof import("../components/enterprise/recruitment/ui/RecruitmentSelect.vue")['default']>
export const LazyEnterpriseRecruitmentUiRecruitmentStatCard: LazyComponent<typeof import("../components/enterprise/recruitment/ui/RecruitmentStatCard.vue")['default']>
export const LazyEnterpriseWorkspaceAIEmployeeConfig: LazyComponent<typeof import("../components/enterprise/workspace/AIEmployeeConfig.vue")['default']>
export const LazyEnterpriseWorkspaceAgentCard: LazyComponent<typeof import("../components/enterprise/workspace/AgentCard.vue")['default']>
export const LazyEnterpriseWorkspaceAgentChannelCard: LazyComponent<typeof import("../components/enterprise/workspace/AgentChannelCard.vue")['default']>
export const LazyEnterpriseWorkspaceAgentDetailPanel: LazyComponent<typeof import("../components/enterprise/workspace/AgentDetailPanel.vue")['default']>
export const LazyEnterpriseWorkspaceAgentHealthCard: LazyComponent<typeof import("../components/enterprise/workspace/AgentHealthCard.vue")['default']>
export const LazyEnterpriseWorkspaceAgentModelCard: LazyComponent<typeof import("../components/enterprise/workspace/AgentModelCard.vue")['default']>
export const LazyEnterpriseWorkspaceAgentRuntimeCard: LazyComponent<typeof import("../components/enterprise/workspace/AgentRuntimeCard.vue")['default']>
export const LazyEnterpriseWorkspaceAgentTimeline: LazyComponent<typeof import("../components/enterprise/workspace/AgentTimeline.vue")['default']>
export const LazyEnterpriseWorkspaceChannelConnectCenter: LazyComponent<typeof import("../components/enterprise/workspace/ChannelConnectCenter.vue")['default']>
export const LazyEnterpriseWorkspaceCreateOrganizationModal: LazyComponent<typeof import("../components/enterprise/workspace/CreateOrganizationModal.vue")['default']>
export const LazyEnterpriseWorkspaceEnterpriseIdentityHeader: LazyComponent<typeof import("../components/enterprise/workspace/EnterpriseIdentityHeader.vue")['default']>
export const LazyEnterpriseWorkspaceEnterpriseModuleRenderer: LazyComponent<typeof import("../components/enterprise/workspace/EnterpriseModuleRenderer.vue")['default']>
export const LazyEnterpriseWorkspaceEnterpriseOnboardingWizard: LazyComponent<typeof import("../components/enterprise/workspace/EnterpriseOnboardingWizard.vue")['default']>
export const LazyEnterpriseWorkspace: LazyComponent<typeof import("../components/enterprise/workspace/EnterpriseWorkspace.vue")['default']>
export const LazyEnterpriseWorkspaceModulesChannelsModule: LazyComponent<typeof import("../components/enterprise/workspace/modules/ChannelsModule.vue")['default']>
export const LazyEnterpriseWorkspaceModulesDashboardModule: LazyComponent<typeof import("../components/enterprise/workspace/modules/DashboardModule.vue")['default']>
export const LazyEnterpriseWorkspaceModulesDecisionsModule: LazyComponent<typeof import("../components/enterprise/workspace/modules/DecisionsModule.vue")['default']>
export const LazyEnterpriseWorkspaceModulesEmployeesModule: LazyComponent<typeof import("../components/enterprise/workspace/modules/EmployeesModule.vue")['default']>
export const LazyEnterpriseWorkspaceModulesExecutionModule: LazyComponent<typeof import("../components/enterprise/workspace/modules/ExecutionModule.vue")['default']>
export const LazyEnterpriseWorkspaceModulesGovernanceModule: LazyComponent<typeof import("../components/enterprise/workspace/modules/GovernanceModule.vue")['default']>
export const LazyEnterpriseWorkspaceModulesGrowthModule: LazyComponent<typeof import("../components/enterprise/workspace/modules/GrowthModule.vue")['default']>
export const LazyEnterpriseWorkspaceModulesIntelligenceModule: LazyComponent<typeof import("../components/enterprise/workspace/modules/IntelligenceModule.vue")['default']>
export const LazyEnterpriseWorkspaceModulesKnowledgeModule: LazyComponent<typeof import("../components/enterprise/workspace/modules/KnowledgeModule.vue")['default']>
export const LazyEnterpriseWorkspaceModulesProviderSettingsModule: LazyComponent<typeof import("../components/enterprise/workspace/modules/ProviderSettingsModule.vue")['default']>
export const LazyEnterpriseWorkspaceModulesRecruitmentModule: LazyComponent<typeof import("../components/enterprise/workspace/modules/RecruitmentModule.vue")['default']>
export const LazyEnterpriseWorkspaceModulesSettingsModule: LazyComponent<typeof import("../components/enterprise/workspace/modules/SettingsModule.vue")['default']>
export const LazyEnterpriseWorkspaceModulesTasksModule: LazyComponent<typeof import("../components/enterprise/workspace/modules/TasksModule.vue")['default']>
export const LazyHdzLibraryReaderPanel: LazyComponent<typeof import("../components/hdz/LibraryReaderPanel.vue")['default']>
export const LazyKmkiUiActionCard: LazyComponent<typeof import("../components/kmki-ui/ActionCard/index.vue")['default']>
export const LazyKmkiUiActionsSection: LazyComponent<typeof import("../components/kmki-ui/ActionsSection/index.vue")['default']>
export const LazyKmkiUiActivityFeed: LazyComponent<typeof import("../components/kmki-ui/ActivityFeed/index.vue")['default']>
export const LazyKmkiUiBadge: LazyComponent<typeof import("../components/kmki-ui/Badge/index.vue")['default']>
export const LazyKmkiUiCard: LazyComponent<typeof import("../components/kmki-ui/Card/index.vue")['default']>
export const LazyKmkiUiConfidenceMeter: LazyComponent<typeof import("../components/kmki-ui/ConfidenceMeter/index.vue")['default']>
export const LazyKmkiUiDiffViewer: LazyComponent<typeof import("../components/kmki-ui/DiffViewer/index.vue")['default']>
export const LazyKmkiUiEffortBadge: LazyComponent<typeof import("../components/kmki-ui/EffortBadge/index.vue")['default']>
export const LazyKmkiUiEmptyState: LazyComponent<typeof import("../components/kmki-ui/EmptyState/index.vue")['default']>
export const LazyKmkiUiExecutiveSummaryCard: LazyComponent<typeof import("../components/kmki-ui/ExecutiveSummaryCard/index.vue")['default']>
export const LazyKmkiUiExplainPanel: LazyComponent<typeof import("../components/kmki-ui/ExplainPanel/index.vue")['default']>
export const LazyKmkiUiExportMenu: LazyComponent<typeof import("../components/kmki-ui/ExportMenu/index.vue")['default']>
export const LazyKmkiUiFindingsSection: LazyComponent<typeof import("../components/kmki-ui/FindingsSection/index.vue")['default']>
export const LazyKmkiUiHealthIndicator: LazyComponent<typeof import("../components/kmki-ui/HealthIndicator/index.vue")['default']>
export const LazyKmkiUiImpactBadge: LazyComponent<typeof import("../components/kmki-ui/ImpactBadge/index.vue")['default']>
export const LazyKmkiUiImprovementBadge: LazyComponent<typeof import("../components/kmki-ui/ImprovementBadge/index.vue")['default']>
export const LazyKmkiUiMetric: LazyComponent<typeof import("../components/kmki-ui/Metric/index.vue")['default']>
export const LazyKmkiUiNextRecommendations: LazyComponent<typeof import("../components/kmki-ui/NextRecommendations/index.vue")['default']>
export const LazyKmkiUiOpportunitiesSection: LazyComponent<typeof import("../components/kmki-ui/OpportunitiesSection/index.vue")['default']>
export const LazyKmkiUiReportCard: LazyComponent<typeof import("../components/kmki-ui/ReportCard/index.vue")['default']>
export const LazyKmkiUiScoreComparison: LazyComponent<typeof import("../components/kmki-ui/ScoreComparison/index.vue")['default']>
export const LazyKmkiUiSkeleton: LazyComponent<typeof import("../components/kmki-ui/Skeleton/index.vue")['default']>
export const LazyKmkiUiStatusChip: LazyComponent<typeof import("../components/kmki-ui/StatusChip/index.vue")['default']>
export const LazyKmkiUiStepList: LazyComponent<typeof import("../components/kmki-ui/StepList/index.vue")['default']>
export const LazyKmkiUiTimeline: LazyComponent<typeof import("../components/kmki-ui/Timeline/index.vue")['default']>
export const LazyKmkiUiVerificationCard: LazyComponent<typeof import("../components/kmki-ui/VerificationCard/index.vue")['default']>
export const LazyKmkiUiVerificationSection: LazyComponent<typeof import("../components/kmki-ui/VerificationSection/index.vue")['default']>
export const LazyKmkiUiVerificationTimeline: LazyComponent<typeof import("../components/kmki-ui/VerificationTimeline/index.vue")['default']>
export const LazyKmkiUiWorkflowStepper: LazyComponent<typeof import("../components/kmki-ui/WorkflowStepper/index.vue")['default']>
export const LazyKnowledgeBodyRenderer: LazyComponent<typeof import("../components/knowledge/KnowledgeBodyRenderer.vue")['default']>
export const LazyKnowledgeFAQ: LazyComponent<typeof import("../components/knowledge/KnowledgeFAQ.vue")['default']>
export const LazyKnowledgeFooter: LazyComponent<typeof import("../components/knowledge/KnowledgeFooter.vue")['default']>
export const LazyKnowledgeHero: LazyComponent<typeof import("../components/knowledge/KnowledgeHero.vue")['default']>
export const LazyKnowledgeJSONLD: LazyComponent<typeof import("../components/knowledge/KnowledgeJSONLD.vue")['default']>
export const LazyKnowledgeMetadata: LazyComponent<typeof import("../components/knowledge/KnowledgeMetadata.vue")['default']>
export const LazyKnowledgeRelated: LazyComponent<typeof import("../components/knowledge/KnowledgeRelated.vue")['default']>
export const LazyKnowledgeRenderer: LazyComponent<typeof import("../components/knowledge/KnowledgeRenderer.vue")['default']>
export const LazyKnowledgeSummary: LazyComponent<typeof import("../components/knowledge/KnowledgeSummary.vue")['default']>
export const LazyKnowledgeRegistrySetup: LazyComponent<typeof import("../components/knowledge/registry.setup")['default']>
export const LazyKnowledgeRegistry: LazyComponent<typeof import("../components/knowledge/registry")['default']>
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
export const LazyKunlunScenesEnterpriseGrowthBanner: LazyComponent<typeof import("../components/kunlun/scenes/EnterpriseGrowthBanner.vue")['default']>
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
export const LazyRecruitmentActivityFeed: LazyComponent<typeof import("../components/recruitment/ActivityFeed.vue")['default']>
export const LazyRecruitmentAgentWorkforceCard: LazyComponent<typeof import("../components/recruitment/AgentWorkforceCard.vue")['default']>
export const LazyRecruitmentHealthBanner: LazyComponent<typeof import("../components/recruitment/HealthBanner.vue")['default']>
export const LazyRecruitmentMetricCard: LazyComponent<typeof import("../components/recruitment/MetricCard.vue")['default']>
export const LazyRecruitmentPendingList: LazyComponent<typeof import("../components/recruitment/PendingList.vue")['default']>
export const LazyRecruitmentFunnel: LazyComponent<typeof import("../components/recruitment/RecruitmentFunnel.vue")['default']>
export const LazyRecruitmentRoiCard: LazyComponent<typeof import("../components/recruitment/RecruitmentRoiCard.vue")['default']>
export const LazyRecruitmentShell: LazyComponent<typeof import("../components/recruitment/RecruitmentShell.vue")['default']>
export const LazyRecruitmentSubscriptionCard: LazyComponent<typeof import("../components/recruitment/RecruitmentSubscriptionCard.vue")['default']>
export const LazyRecruitmentWorkspaceNav: LazyComponent<typeof import("../components/recruitment/RecruitmentWorkspaceNav.vue")['default']>
export const LazyRecruitmentSectionCard: LazyComponent<typeof import("../components/recruitment/SectionCard.vue")['default']>
export const LazyRecruitmentStatusBadge: LazyComponent<typeof import("../components/recruitment/StatusBadge.vue")['default']>
export const LazyRevenueUpgradeModal: LazyComponent<typeof import("../components/revenue/UpgradeModal.vue")['default']>
export const LazyUIEmptyState: LazyComponent<typeof import("../components/ui/UIEmptyState.vue")['default']>
export const LazyUIErrorCard: LazyComponent<typeof import("../components/ui/UIErrorCard.vue")['default']>
export const LazyUISkeleton: LazyComponent<typeof import("../components/ui/UISkeleton.vue")['default']>
export const LazyUIToastContainer: LazyComponent<typeof import("../components/ui/UIToastContainer.vue")['default']>
export const LazyWizardFirstRunWizard: LazyComponent<typeof import("../components/wizard/FirstRunWizard.vue")['default']>
export const LazyWorkspaceSharedWorkspaceUserCard: LazyComponent<typeof import("../components/workspace/shared/WorkspaceUserCard.vue")['default']>
export const LazyNuxtWelcome: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/welcome.vue")['default']>
export const LazyNuxtLayout: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-layout")['default']>
export const LazyNuxtErrorBoundary: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-error-boundary")['default']>
export const LazyClientOnly: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/client-only")['default']>
export const LazyDevOnly: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/dev-only")['default']>
export const LazyServerPlaceholder: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/server-placeholder")['default']>
export const LazyNuxtLink: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-link")['default']>
export const LazyNuxtLoadingIndicator: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-loading-indicator")['default']>
export const LazyNuxtRouteAnnouncer: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-route-announcer")['default']>
export const LazyNuxtImg: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtImg']>
export const LazyNuxtPicture: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtPicture']>
export const LazyNuxtPage: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/pages/runtime/page")['default']>
export const LazyNoScript: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['NoScript']>
export const LazyLink: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Link']>
export const LazyBase: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Base']>
export const LazyTitle: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Title']>
export const LazyMeta: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Meta']>
export const LazyStyle: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Style']>
export const LazyHead: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Head']>
export const LazyHtml: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Html']>
export const LazyBody: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/head/runtime/components")['Body']>
export const LazyNuxtIsland: LazyComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/nuxt-island")['default']>
export const LazyNuxtRouteAnnouncer: LazyComponent<IslandComponent<typeof import("../node_modules/.pnpm/nuxt@3.16.2_@parcel+watcher@2.5.6_@types+node@26.1.1_cac@6.7.14_db0@0.3.4_ioredis@5.11._bd3785bc73d45912c59d4ac5f5e8c74c/node_modules/nuxt/dist/app/components/server-placeholder")['default']>>

export const componentNames: string[]
