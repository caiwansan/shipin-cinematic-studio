import re
p = 'pages/admin/dashboard.vue'
s = open(p).read()
# 1) 移除右栏 AgentApplyPanel 行
s = s.replace('      <!-- 右栏：昆仑茶馆 · 城市代理申请管理 -->\n      <AgentApplyPanel class="w-[340px] shrink-0 hidden xl:block" />\n', '', 1)
# 2) 还原 flex 容器（flex-1 闭合移除）
s = s.replace('      </div>\n    </div>\n\n    <!-- 详情抽屉', '    </div>\n\n    <!-- 详情抽屉', 1)
# 3) 还原外层容器
s = s.replace('    <div class="max-w-[1560px] mx-auto px-4 py-3 flex gap-3 items-start">\n      <div class="flex-1 space-y-3 min-w-0">', '    <div class="max-w-[1560px] mx-auto px-4 py-3 space-y-3">', 1)
# 4) 移除 import
s = s.replace("import AgentApplyPanel from '~/components/admin/dashboard/AgentApplyPanel.vue'\n", '', 1)
open(p, 'w').write(s)
# 验证还原
check = open(p).read()
ok = 'AgentApplyPanel' not in check and 'flex gap-3 items-start' not in check and 'space-y-3"' in check
print('REVERTED' if ok else '!! REVERT INCOMPLETE')
if not ok:
    for line in check.split('\n'):
        if 'AgentApplyPanel' in line or 'flex gap-3' in line or 'flex-1 space-y' in line:
            print('LEFTOVER:', line)
