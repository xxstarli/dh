# 个人导航网站 V1.2.0

V1.2.0 为哆啦A梦主题视觉升级：本地 PNG、天空蓝背景、卡片与管理弹窗配色。保留 V1.1.0 全部业务、安全规则与 5→4→3→2 响应式布局，无数据库迁移。主题验收见 design-qa.md 与 docs/V1.2.0发布验收.md。

V1.1.0 将 V1.0.0 的运行架构替换为 PHP + SQLite，保留首页、搜索、同页管理、分类/网站 CRUD、拖拽排序、图标与五列响应式布局。V1.0.0 源码和冻结文档保存在原 Tag；实验分支保留但不是本版本基础。

生产依赖：Nginx、PHP-FPM 7.4+、PDO SQLite、cURL、fileinfo、session、json、openssl、mbstring、zlib。无 Composer 框架，无 Node/npm/pnpm/Next/Prisma/Sharp 生产依赖。SortableJS 1.15.6 和 Lucide 图标静态托管，许可证在 public/assets。

## 目录

- app：PHP 数据访问、业务校验、鉴权、图标、SSRF 和响应模块。
- public：唯一 Web Root；基础 HTML、API 路由及静态 CSS/JavaScript。
- database/schema.sql：与 V1.0.0 兼容的四张业务/会话表和索引。
- scripts/init.php：校验既有数据库；新库初始化不含样例数据。
- tests：隔离库 PHP 专项、Chrome/Edge 流程、重启测试；仅开发使用 Node。
- docs：冻结 V1 产品需求和版本验收说明。
- storage、backups、config.local.php：本地持久化及私有配置，均不进入 Git/发布包。

## 本地运行（PHP 7.4+）

```sh
cp config.example.php config.local.php
# 修改配置，使 database/icons/state 指向开发副本，origin 为 http://localhost:3000
php scripts/init.php
php -S localhost:3000 -t public scripts/router.php
```

已有数据库只校验结构、完整性和外键，不改 Settings、不运行 Seed。全新数据库须把 bcrypt 哈希通过标准输入交给 init.php。请使用密码管理器生成密码，通过交互输入的本地脚本调用 password_hash；不要把真实密码写入命令历史。V1.0.0 bcrypt 可直接使用 password_verify 验证。

Windows PowerShell 可用 Copy-Item 替代 cp。开发用 PHP 路径通过 PHP_BIN 指定（仅 Node 测试启动器使用）。

## 配置

唯一生产环境变量 DH_CONFIG 指向 Web Root 外的 PHP 配置文件（返回数组）；未设置时读仓库根 config.local.php。没有框架环境变量或 Session Secret 依赖。

|配置项|用途|
|---|---|
|database|SQLite 文件绝对路径|
|icons|图标持久目录|
|state|登录限流文件目录|
|origin|浏览器实际 Origin，例如 http://navigation.example；无末尾斜杠|
|session_hours|会话时长，默认12小时，范围1–24小时|
|dns_servers|可选可信 DNS 服务器 IP 列表；默认系统 resolv.conf|

不要把真实配置、管理密码、数据库或图标备份发布到公共仓库。配置文件不保存管理明文密码；密码哈希保存在 Settings。

## 数据与鉴权

直接复用 categories、sites、settings、admin_sessions；旧 String/CUID ID 不变，新 ID 使用随机字符串。分类/网站排序和跨分类移动均为 SQLite 事务。无业务 Schema Migration；历史 _prisma_migrations 表可以保留，应用不依赖它。init.php 代替旧 Migration/Seed 的结构准入检查。

管理密码 bcrypt；服务端数据库 Session 只保存随机令牌的 SHA-256 摘要。Cookie 为 HttpOnly、SameSite=Strict，Secure 根据配置 Origin 协议决定。管理写接口同时验证 Session、Origin/Referer 和 CSRF Token。登录限流采用文件锁，在 FPM 工作进程间共享。退出会删除当前 Session。

PNG/JPEG/WebP ≤2MB，校验真实 MIME、signature 和文件结构，按 SHA-256 文件名原样持久化。旧 /api/icons/*.webp 路径保留。Favicon 通过有时限 DNS、全地址检查、cURL 固定已验 IP、手动重定向及2MB上限获取，失败回退默认图标，不阻止保存。

## 开发检查

仅开发机/CI 需要 Node 24 和 pnpm：

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm exec playwright install chrome msedge
pnpm test:e2e
pnpm test:restart
pnpm build
```

lint 包含 PHP 语法及 JavaScript 检查；typecheck 检查 TypeScript 浏览器测试和 SQLite 测试适配器；生产 JavaScript 由 lint 和浏览器验证。build 是白名单打包，无前端编译，输出 dist/navigation-v1.2.0.tar.gz、SHA256SUMS 和逐文件 manifest。PHP_BIN 可设置 PHP 可执行文件路径。V1_DATABASE_COPY 可指向私有 V1 备份，仅 PHP 测试复制使用，禁止上传 CI。

## 部署

1. 审计现有 PHP-FPM 版本、扩展、socket、用户和 SQLite 能力。不得修改其他站点运行时。
2. 备份数据库、图标、配置和本站 Nginx 配置。SQLite 使用在线 backup 或停写后复制，核对 SHA-256 与 integrity_check。
3. 解压已验证发布包至独立 releases/版本目录；仅 public 对 Web 可见。
4. 数据与配置置于 release 外，例如 /var/lib/navigation 与 /etc/navigation。FPM 用户需要数据文件及其父目录的写权限；配置只读，代码只读，不用777。
5. 用 DH_CONFIG=/etc/navigation/config.php php scripts/init.php 校验正式数据副本，无 Seed 覆盖。
6. Nginx 参考 deploy/nginx.example.conf，按实际 socket 和路径修改。先候选验证，再原子切 current 符号链接。nginx -t 成功才 reload。
7. 正式 HTTP 完成登录、写操作、排序、上传、Favicon、刷新、FPM/Nginx reload 和清理临时数据，并回归其他站点。
8. 回滚时 current 指回先前 release、恢复本站 Nginx 配置，经 nginx -t 后 reload。没有业务 Schema 迁移；数据回滚仅在停写并确认备份后执行，避免丢失新数据。

PHP-FPM 由既有服务守护，不启动 Node 服务，不开放应用端口。仅为本站配置 HTTP :80。当前部署目标采用 HTTP，不启用 TLS。HTTP 流量未加密，不适合在不可信网络中传输管理密码或管理 Session。

历史 docs/01–07 描述 V1.0.0 基准；design-qa.md 记录当前主题验收；V1.1.0 的架构替代和新验收单独记录，不改已确认产品需求。
