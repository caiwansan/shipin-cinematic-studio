# ============================================================
# RC-2 保护路径定义
# 这些路径下的文件不可删除（运行时活跃）
# ============================================================
RUNTIME_PROTECTED_PATHS=(
  "components/studio/runtime/"
  "components/studio/kernel/"
  "components/studio/execution/"
  "components/studio/StudioWorkflowShell.vue"
  "components/studio/workflow/"
  "components/director/"
  "composables/"
  "pages/"
  "layouts/"
  "middleware/"
  "plugins/"
  "nuxt.config.ts"
)

BACKEND_PROTECTED_PATHS=(
  "src/routes/"
  "src/services/"
  "src/model-adapters/"
  "src/queue/"
  "src/prompts/"
  "src/kernel/"
  "src/director/"
  "src/director-v2/"
  "src/runtime/"
  "src/index.ts"
)
