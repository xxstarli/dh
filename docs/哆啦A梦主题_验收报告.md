# 哆啦A梦主题素材包接入验收

2026-09-13。项目：E:\Star\小码力\导航站。正式基线 V1.1.0；本轮为未发布的 v1.2.0 视觉候选。

## 1. 修改文件

|文件|本轮修改|
|---|---|
|public/index.php|七张 PNG 引用；独立 Logo 与挥手人物，原站点名称、自定义 Logo 分支、搜索和管理入口保留|
|public/assets/theme/doraemon/theme.css|适配 PNG 自带留白、人物大小、云朵位置和透明度；浅蓝搜索边框；分类装饰线改为预留空间的 flex 元素|
|scripts/router.php|仅本地开发静态资源白名单增加七个中文 PNG 名称的 URL 解码匹配；API 分支不变|
|tests/e2e/navigation.spec.ts|本轮截图独立目录；增加 Logo 加载及人物不与搜索/管理按钮重叠断言；区分普通编辑与故障恢复截图|
|design-qa.md|本轮最终视觉 QA|
|docs/哆啦A梦主题_验收报告.md、docs/哆啦A梦主题_资源记录.md|当前素材接入报告与来源；前一版另存本轮证据目录|

工作树仍包含上一轮未提交主题改动；没有覆盖用户原始素材或 v1.1.0 Tag。

## 2. 新增主题资源

源目录：哆啦A梦主题/。静态目录：public/assets/theme/doraemon/。

|实际源文件|目标文件|
|---|---|
|哆啦a梦开心挥手贴纸.png.png|哆啦A梦_顶部人物.png|
|蓝色机器猫微笑图标.png.png|哆啦A梦_Logo.png|
|透明背景的梦幻云朵横幅.png.png|云朵_顶部.png|
|透明背景的卡通云朵边框.png.png|云朵_底部.png|
|粉色任意门插画.png.png|任意门.png|
|光泽金色铃铛图标.png.png|铃铛.png|
|卡通竹蜻蜓玩具贴纸.png.png|竹蜻蜓.png|

全部按字节原样复制，保留 alpha 透明通道。七张共 5,018,338 字节（约 4.79 MiB）；未转换 SVG、未重新生成、未加入 Sharp 或图片处理运行依赖。SHA-256 一致性证据：docs/evidence/doraemon-png/asset-manifest.json。前一轮 PNG/SVG 文件保留但不再被首页引用。

## 3. 首页主题

完成。独立 Logo、挥手人物、顶部/底部云朵、任意门、铃铛、竹蜻蜓全部使用此次本地素材。背景 #DDF4FF → #EDF9FF → #D8F1FF；白色卡片、浅蓝边框、14px 圆角、柔和阴影与 2px Hover 上浮沿用已验收皮肤。

Header 仍是品牌/搜索/管理；人物位于独立空位，pointer-events:none，图片本体完整可见。所有装饰 absolute，不增加内容高度，背景层 z-index:-1，aria-hidden。底部云朵位于内容后面，不遮挡卡片文字和点击。

仍全部展示分类/链接，每行最多 5 个，末行左对齐、不拉伸补满。没有侧栏、分页、查看更多，也没有写入参考图中的样例分类或网站。

真实开发首页 http://localhost:3000 保持原来 1 个分类/1 个网站；六分类/30 卡片截图来自隔离 E2E 数据，用于密度和布局检查。E2E 网站使用原默认图标，并非改动了正式网站 Favicon。

## 4. 管理模式与弹窗

同步完成。管理提示、卡片、菜单和按钮沿用蓝白主题。管理登录、添加/编辑网站、添加/编辑分类共用原生 dialog 样式：白底、浅蓝描边、柔和阴影、蓝色主按钮；没有把人物加入弹窗。

普通模式无编辑、删除、添加或拖拽控件。原有进入/退出管理、CRUD、拖拽、失败回滚和会话恢复流程通过原回归验证。

## 5. 是否修改业务逻辑

否。git diff 核对 app/、public/api/、生产 JavaScript、database/、配置示例、package.json 无变化。数据库结构、正式开发数据、API、鉴权、Session、CSRF、Origin、SSRF、PHP + SQLite 架构均未改。

测试脚本的写操作仅使用既有 storage/e2e、storage/restart、storage/php-tests-* 隔离库；未操作远程生产环境。开发 router 的变更仅用于按指定中文文件名提供静态图片。

## 6. Chrome / Edge 回归

|检查|结果|
|---|---|
|最终 Chrome E2E|6/6 通过|
|最终 Edge E2E|6/6 通过|
|最终完整回归|12/12，0 失败、0 跳过，约 46.7 秒|
|补拍正常编辑完整流程|Chrome/Edge 2/2 通过|
|PHP 原业务测试|13 组 / 147 断言通过；PHP 7.4.33 / SQLite 3.31.1|
|传输安全|DNS 固定、无凭证转发、大小/超时限制、禁止自动重定向通过|
|PHP 语法、ESLint、TypeScript、diff whitespace|通过|
|PHP/Chrome/Edge 重启|数据、排序、图标、HTTP Cookie 持久化通过|
|主题资源|7 张 PNG 加载正常，复制哈希一致；装饰不接收点击；人物与主要控件不重叠|
|正式开发只读检查|搜索、登录弹窗开关、手机无溢出；页面脚本错误为 0|

使用项目已有 Playwright Chrome/msedge 通道；没有新增测试依赖。此前浏览器连接工具无法获取 Chrome，因此继续使用用户明确要求的 E2E 方式。

如实记录：一轮中 Edge 新标签页检查曾未找到 Keyboard Link（11/12）；未修改业务代码或放宽断言。该场景单独带 trace 复查 1/1 通过，最终完整重跑 12/12 通过；这一次未复现失败的根因未确认。记录保存在 intermittent-edge-results.json、edge-recheck-results.json 和 edge-recheck-trace.zip。最终汇总为 e2e-results.json。

## 7. 响应式

1536/1200/900/390/360 宽度分别为 5/4/3/2/2 列，Chrome/Edge 均通过。卡片宽度一致、末行左对齐、无横向滚动。低于 1400px 隐藏人物，低于 1300px 隐藏门/竹蜻蜓；手机隐藏铃铛、减淡云层。390×844 弹窗和菜单不超出视口，内容可滚动。未测手机真机或 Safari。

## 8. 发布建议

建议作为 v1.2.0「哆啦A梦主题视觉升级」候选。当前本地功能/视觉验收通过；仍需采用主题后的正常发布流程，并留意上述一次未复现的 Edge 检查失败。

最终收口已更新版本为 1.2.0，完成独立发布包构建；不覆盖 navigation-v1.1.0.tar.gz。最新测试、冻结和部署状态以 V1.2.0发布验收.md 为准。生产切换尚待 SSH 认证。

## 截图

均位于 docs/evidence/doraemon-png/；Chrome 和 Edge 各有对应证据：

- chrome-home.png：普通首页，1536×1024、六分类/30 卡片。
- chrome-admin.png：管理首页，全页截图。
- chrome-dialog.png：添加网站。
- chrome-edit-dialog.png：正常编辑网站；故障恢复截图另外命名。
- chrome-mobile.png、chrome-mobile-dialog.png：手机管理模式及弹窗。
- dev-home.png、dev-login.png、dev-mobile.png：真实开发配置的只读截图。
- compare-home.png：参考 UI 与本轮首页并排对照；使用此次素材替换参考人物位置是明确允许的差异。

本轮视觉修正：首轮人物顶部轻微裁切、顶部云层偏多；缩小人物并上移/减淡云朵后重拍。最终无功能遮挡；保留原字体和线稿分类图标。

最终收口补充：开发服务器首页已启用输出缓冲，并在响应式 E2E 校验原始 HTML 的 main 标签及 30 张卡片。修正后完整回归 12/12（46.5 秒）通过；此前一次响应片段缺失的证据和诊断边界详见 design-qa.md。
