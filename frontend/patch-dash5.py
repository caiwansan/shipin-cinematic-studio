import re
p = 'pages/admin/dashboard.vue'
s = open(p).read()
if 'AgentApplyPanel' in s:
    print('ALREADY')
else:
    # 1) 外层改 flex + 左内容区
    old1 = '    <div class="max-w-[1560px] mx-auto px-4 py-3 space-y-3">'
    new1 = '    <div class="max-w-[1560px] mx-auto px-4 py-3 flex gap-3 items-start">\n      <div class="flex-1 space-y-3 min-w-0">'
    assert old1 in s, 'FLEX ANCHOR MISS'
    s = s.replace(old1, new1, 1)
    # 2) 内容区闭合 + 右栏
    m = re.search(r'      </template>\n    </div>\n\n    <!--[^\n]*-->', s)
    assert m, 'PANEL ANCHOR MISS'
    seg = m.group(0)
    lines = seg.split('\n')
    new_seg = lines[0] + '\n      </div>\n      <!-- 右栏：昆仑茶馆 · 城市代理申请管理 -->\n      <AgentApplyPanel class="w-[340px] shrink-0 hidden xl:block" />\n    </div>\n\n' + lines[3]
    s = s.replace(seg, new_seg, 1)
    # 3) import
    old3 = "import KpiOverview from '~/components/admin/dashboard/KpiOverview.vue'"
    if old3 in s:
        s = s.replace(old3, old3 + "\nimport AgentApplyPanel from '~/components/admin/dashboard/AgentApplyPanel.vue'", 1)
    else:
        old3b = '<script setup lang="ts">'
        assert old3b in s, 'IMPORT ANCHOR MISS'
        s = s.replace(old3b, old3b + "\nimport AgentApplyPanel from '~/components/admin/dashboard/AgentApplyPanel.vue'", 1)
    open(p, 'w').write(s)
    print('DASH_PANEL_ADDED')
