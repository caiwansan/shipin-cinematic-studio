p = 'pages/admin/dashboard.vue'
s = open(p).read()
if 'AgentApplyPanel' in s:
    print('ALREADY')
else:
    old1 = '  <div class="min-h-full" style="background: #070B16">\n    <div class="max-w-[1560px] mx-auto px-4 py-3 space-y-3">'
    new1 = '  <div class="min-h-full" style="background: #070B16">\n    <div class="max-w-[1560px] mx-auto px-4 py-3 flex gap-3 items-start">\n      <div class="flex-1 space-y-3 min-w-0">'
    assert old1 in s, 'LAYOUT ANCHOR MISS'
    s = s.replace(old1, new1, 1)
    old2 = '      </template>\n    </div>\n    <!-- ===== Drawer ===== -->'
    new2 = '      </template>\n      </div>\n      <!-- 右栏：昆仑茶馆 · 城市代理申请管理 -->\n      <AgentApplyPanel class="w-[340px] shrink-0 hidden xl:block" />\n    </div>\n    <!-- ===== Drawer ===== -->'
    assert old2 in s, 'PANEL ANCHOR MISS'
    s = s.replace(old2, new2, 1)
    old3 = "import KpiOverview from '~/components/admin/dashboard/KpiOverview.vue'"
    if old3 in s:
        s = s.replace(old3, old3 + "\nimport AgentApplyPanel from '~/components/admin/dashboard/AgentApplyPanel.vue'", 1)
    else:
        old3b = '<script setup lang="ts">'
        assert old3b in s, 'IMPORT ANCHOR MISS'
        s = s.replace(old3b, old3b + "\nimport AgentApplyPanel from '~/components/admin/dashboard/AgentApplyPanel.vue'", 1)
    open(p, 'w').write(s)
    print('DASH_PANEL_ADDED')
