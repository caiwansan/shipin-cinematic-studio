p = 'pages/admin/dashboard.vue'
s = open(p).read()
if 'AgentApplyPanel' in s:
    print('ALREADY')
else:
    # 1) 闭合 flex-1 + 右栏 + 闭合 max-w
    old1 = '      </template>\n    </div>\n    <DetailDrawer'
    new1 = '      </template>\n      </div>\n      <!-- 右栏：昆仑茶馆 · 城市代理申请管理 -->\n      <AgentApplyPanel class="w-[340px] shrink-0 hidden xl:block" />\n    </div>\n    <DetailDrawer'
    assert old1 in s, 'PANEL ANCHOR MISS'
    s = s.replace(old1, new1, 1)
    # 2) import
    old3 = "import KpiOverview from '~/components/admin/dashboard/KpiOverview.vue'"
    if old3 in s:
        s = s.replace(old3, old3 + "\nimport AgentApplyPanel from '~/components/admin/dashboard/AgentApplyPanel.vue'", 1)
    else:
        old3b = '<script setup lang="ts">'
        assert old3b in s, 'IMPORT ANCHOR MISS'
        s = s.replace(old3b, old3b + "\nimport AgentApplyPanel from '~/components/admin/dashboard/AgentApplyPanel.vue'", 1)
    open(p, 'w').write(s)
    print('DASH_PANEL_ADDED')
