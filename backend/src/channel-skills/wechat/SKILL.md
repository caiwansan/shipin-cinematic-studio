# WeChat Official Account Skill — 微信公众号运营技能

**平台:** wechat (微信公众号)
**工作空间:** BrowserWorkspace (持久化 Chrome profile)
**适用:** AI 员工在授权范围内运营企业公众号
**状态:** 🚧 蓝图（渠道接入未完成，禁止臆造能力）

---

## 登录

### 确认登录
- 访问 `https://mp.weixin.qq.com/`（公众号平台）
- 探针信号（多信号判定）：
  - A 页面特征：公众号后台菜单（首页/内容与互动/数据/设置）≥2 项
  - B Cookie：`slave_sid` / `slave_user` / `wap_sid2`
  - C 身份接口：页面含公众号名称 + 唯一标识
- 任一强信号命中 = 已登录

### 新设备首次绑定
- 扫码 + 管理员微信确认（正常安全流程）
- 用户本人确认后固化可信环境 → `AUTH_SUCCESS`

---

## 数据查看（蓝图）

- 数据统计：`/cgi-bin/appmsg?begin=` 阅读/在看/分享
- 粉丝管理：`/cgi-bin/user_tag` 只读

---

## 内容发布

> ⚠️ **冻结**：自动群发禁止，直到 Reality Gate PASS。群发涉及用户触达，必须老板批准。

---

## 风险限制

- ❌ 绕过风控 / 改指纹 / 破解验证码 / 模拟真人规避风控（第一原则）
- 群发每日 1 次（平台硬限制，遵守平台规则）
- 只操作已授权账号；操作记 ChannelOperationLog
