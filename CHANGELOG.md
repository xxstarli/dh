# V1.2.0

版本定位：哆啦A梦主题视觉升级。

## Changed

- 接入七张本地透明 PNG；天空蓝背景、云朵、品牌 Logo 与克制的主题装饰。
- 优化搜索、分类标题、卡片、管理模式及弹窗的边框、圆角与阴影。
- 保留全部分类和网站、PC 最多五列与 5→4→3→2 响应式；装饰不参与交互。
- 发布包版本从 package.json 读取，避免覆盖历史版本归档。

## Preserved

- V1.1.0 PHP + SQLite 架构、数据库结构、API、鉴权、安全策略与业务 JavaScript 不变。
- 无数据迁移、无新增功能；保留搜索、CRUD、排序、图标及持久化规则。

## Validation

- 最终检查、证据与部署状态见 docs/V1.2.0发布验收.md；历史 Tag 不变。

# V1.1.0

发布日期：2026-09-12

## Changed

- Rebuilt production runtime for legacy CentOS 7 compatibility using PHP 7.4+ and SQLite.
- Replaced Next.js/Node/React/Prisma production runtime with PHP, HTML, CSS and Vanilla JavaScript.
- Replaced Sharp with signature, MIME and image-structure validation and original-byte storage.
- Added CSRF tokens to existing server-side Session and Origin protection.

## Preserved

- V1 UI, user workflows, search, category and site management, drag sorting.
- Favicon fallback and custom icon workflows, existing WebP icon URLs.
- Existing SQLite business tables, string IDs, Settings and bcrypt password hashes.

## Database

- No business schema migration required. Existing databases are validated without reseeding.
- New databases are initialized without sample data and require a supplied bcrypt hash.

## Validation

- Local PHP 7.4: 13 test groups, 147 assertions; V1 backup copy: 148 assertions.
- Actual cURL transport integration: DNS pinning, timeout, 2MB limits, redirects and no credential forwarding passed.
- Chrome / Edge: 12 complete test scenarios passed.
- PHP process restart and both browsers close/reopen: data, order and uploaded icons persisted.
- Linux PHP 7.4 / 8.3 and browser/build CI passed.
- CentOS PHP 7.4.11 / SQLite 3.7.17: 13 groups, 148 assertions passed on a V1 database copy.
- Candidate and formal HTTP management, uploads, Favicon and refresh persistence passed.
- FPM/Nginx reload persistence and existing-site regression passed; shared-pool request-level PHP_ADMIN_VALUE overrides were removed after detecting cross-site interference.
- Original 516-item checklist: 510 passed, 0 failed, 4 browser/physical-device boundaries and 2 not applicable.
- Final annotated tag is created only after the release CI verifies the original baseline and the CentOS-accepted runtime files.

## Known validation boundaries

- Safari and physical mobile devices still require real-device verification.
- HTTP traffic is unencrypted; do not transmit management credentials over untrusted networks.

# V1.0.0

发布日期：2026-09-11

## Added

- 个人导航首页
- 分类展示
- 网站卡片
- 网站搜索
- 管理密码登录
- 分类新增 / 编辑 / 删除
- 分类拖拽排序
- 网站新增 / 编辑 / 删除
- 网站分类内拖拽排序
- 网站跨分类编辑
- Favicon 自动获取
- 自定义图标上传
- 数据持久化
- 响应式布局
- 管理鉴权与安全防护

## Validation

- lint 通过
- typecheck 通过
- build 通过
- 业务测试 6/6
- Chrome / Edge 端到端 12/12
- 509 项通过
- 0 项失败
- 正式构建首页、搜索、管理登录退出、刷新通过
- 正式业务数据与冻结前一致，未混入测试数据
- 生产依赖审计未报告已知漏洞
- 44 个业务、UI、数据库和测试相关文件的哈希与冻结前一致

原验收清单共516项：509通过、0失败、5项部分/未验证、2项不适用。
Chrome/Edge记录基于本机安装版本，未声称已在线核验当日最新版。
原始需求和UI设计不变；本次冻结仅涉及版本文档、Git排除规则和发布操作。

## Known validation boundaries

- Safari 未完成真机验证
- 手机真机未完成验证
- 远端生产升级部署未验证

## Data and backup

- SQLite、图标、管理密码、环境配置及备份均不进入版本库。
- 已创建发布前一致性SQLite备份，完整性校验通过。
- 本地备份包括正式图标目录及访问受限的环境配置副本。
- 部署方式和初始化命令见 README.md。
