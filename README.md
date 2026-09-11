# 个人导航网站 V1

> 此兼容分支为未发布的 V1.0.1 候选。Sharp WASM、Prisma 和现代 Linux 回归通过；CentOS 7 的 Next/SWC 生产启动失败，已停止适配，未创建 v1.0.1 Tag。正式冻结基线仍为 v1.0.0。详见 [兼容开发与部署报告](docs/07_V1.0.1兼容开发与部署报告.md)。

个人自用、可直接运行的网址导航网站。首页展示全部分类和网站，输入管理密码后在同一页面管理，所有修改即时持久化。

## 技术栈

Next.js 16 App Router、React 19、TypeScript、Tailwind CSS 4、Prisma 6、SQLite、Radix Dialog/Dropdown、dnd-kit、Zod、bcryptjs、Sharp。只有 Category、Site、Settings 和 AdminSession 四个模型。

## 本地运行

需要 Node.js 22.12+（推荐 Node.js 24 LTS）与 pnpm 11。首次安装 pnpm 可运行 `npm install -g pnpm@11`。

在 PowerShell 中进入项目目录：

```powershell
cd "E:\Star\小码力\导航站"
pnpm install --frozen-lockfile
Copy-Item .env.example .env
pnpm admin:password
```

密码工具会隐藏输入并生成 bcrypt 哈希。将哈希填入 `.env` 的 `ADMIN_PASSWORD_HASH`，检查 `APP_ORIGIN` 后运行：

```powershell
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

打开 http://localhost:3000 。首次生产初始化不添加示例分类或网站。

**当前交付目录已初始化。请勿覆盖已有 .env。** 当前随机初始管理密码保存在被 Git 忽略的 `storage/首次管理密码.txt`，只在本机查看。日常使用前可在终端执行 `pnpm admin:password --apply` 设置自己的密码；已有 Session 将同时失效。

当前机器也可直接运行 `./start.ps1`（自动识别现有 Node，无需全局 pnpm）；生产模式使用 `./start.ps1 -Production`。正常启动也可使用 `pnpm dev`。生产运行：

```powershell
pnpm build
pnpm start
```

## 数据和存储

- `prisma/schema.prisma`：模型；`prisma/migrations`：版本化 SQL 迁移。
- 默认数据库：`storage/navigation.db`。`DATABASE_URL` 的相对路径以 `prisma/` 为基准。
- 默认图标目录：`storage/icons/`。`UPLOAD_DIR` 相对路径以项目工作目录为基准。
- 图标由受控 `/api/icons/<sha256>.webp` 接口读取。上传图片实际解码、限制 2MB/1600 万像素并重新编码，不使用原始文件名。
- 新分类、网站追加末尾；换分类追加到目标分类末尾；同分类编辑保留顺序。
- 非空分类同时受事务检查与外键 RESTRICT 保护，不级联删除网站。
- 排序使用事务并检查完整 ID 集合，前端乐观更新失败回滚。
- 自动图标使用受控 HTTP/HTTPS 抓取；内网、回环、保留地址、metadata、非标准端口被拒绝，DNS IP 固定到连接，重定向逐跳复检；最多 3 次重定向、6 秒、2MB。无法获取或不支持的图片安全降级。
- 图标文件为不可变内容寻址文件。替换图标不会立即删除旧文件，避免历史页面和并发编辑引用失效。

## 管理鉴权

服务端使用 bcrypt cost 12 验证密码；随机 256 位 Session Token 仅存于 HttpOnly、SameSite=Strict Cookie，数据库保存 Token 的 SHA-256 摘要。默认有效期 12 小时。HTTPS 的 APP_ORIGIN 自动启用 Secure。退出管理删除服务端 Session。登录限流为每进程每分钟 10 次失败前尝试；适用于本项目单实例部署。

所有写接口、上传及自动图标接口都验证 Session；写请求额外检查 Origin。设置密码/Logo通过初始化配置或终端工具完成，无独立后台。

## 环境变量

|变量|用途|
|---|---|
|DATABASE_URL|SQLite 连接，默认 file:../storage/navigation.db|
|UPLOAD_DIR|持久图标目录，默认 ./storage/icons|
|APP_ORIGIN|浏览器访问的唯一站点来源，包含协议和端口；用于 CSRF 与 Secure Cookie|
|SITE_NAME|首次 Seed 站点名称，默认“我的导航”|
|SITE_LOGO|首次 Seed 可选 Logo 地址，为空使用默认 Logo|
|ADMIN_PASSWORD_HASH|首次 Seed 的 bcrypt cost 12 哈希；不填写明文密码|
|SESSION_HOURS|会话有效小时，1–24，默认 12|

Seed 幂等，已存在 Settings 不覆盖。修改已有密码使用 `pnpm admin:password --apply`，更新其他设置可由维护者通过数据库完成。不要提交 .env、数据库、首次密码文件或 Session。

## 主要目录

- `app/`：首页、加载/错误状态、HTTP API。
- `components/`：导航、分类、网站卡片、管理弹窗与通用对话框/菜单。
- `lib/`：数据库、鉴权、业务事务、共享校验、图标抓取及存储。
- `prisma/`：Schema、Migration、无示例数据 Seed。
- `scripts/`：迁移与隐藏输入密码工具。
- `tests/`：业务/安全测试、Chrome/Edge 端到端验收与生产重启测试。
- `docs/`：原始需求、逐项验收与截图证据。

## 检查和测试

```powershell
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm test:e2e
node tests/restart.mjs
```

端到端测试使用本机已安装的 Chrome 和 Edge，以 `storage/e2e/test.db`、`storage/e2e/icons` 和 3100 端口隔离运行。测试前会清空这一个测试数据库的业务表，**不会访问正式数据库**。测试密码仅用于此测试环境。关闭占用 3100 的旧测试服务后再运行。生产重启测试需要先完成 build 和 e2e，并使用 3101 端口。

`pnpm test` 在 `storage/unit-<进程号>` 中建立隔离数据库。这些目录均被 Git 忽略。

## 部署与备份

推荐单台 Linux/Windows 服务器、一个常驻 Node.js 进程，前方使用 Caddy/Nginx 等 HTTPS 反向代理。可使用 systemd 或其他进程管理器。部署前运行 install、db:generate、db:migrate、db:seed、build，随后 start。数据库与上传目录应位于固定持久目录，例如：

```dotenv
DATABASE_URL="file:/srv/navigation-data/navigation.db"
UPLOAD_DIR="/srv/navigation-data/icons"
APP_ORIGIN="https://nav.example.com"
```

升级应用时仅替换源码和构建产物，保留外置数据库和图标目录。备份时短暂停止写入/服务，再同时备份数据库、图标目录及单独安全保管的环境配置；恢复后启动服务并验证首页和图标。

本架构适合单实例持久磁盘部署；不直接部署到临时文件系统的无状态函数平台。若选择此类平台，应先迁移到托管数据库与对象存储。

## 使用说明

普通模式隐藏空分类，网站整卡新标签页打开。搜索按名称、说明、域名实时过滤。管理状态中网站主体不跳转，菜单仍可“打开网站”。网站跨分类只能通过编辑完成。拖动立即保存；搜索期间暂停排序；完成管理只退出会话。

## 参考

- [Next.js 安装文档](https://nextjs.org/docs/app/getting-started/installation)
- [Prisma SQLite 文档](https://www.prisma.io/docs/orm/v6/overview/databases/sqlite)


## V1.0.0 冻结说明

本项目已于2026-09-11冻结为V1.0.0。版本说明见CHANGELOG.md，提交/备份及部署前检查见docs/07_V1.0.0冻结记录.md。原始需求和UI保持不变；日志、截图及运行证据为本机文件，不随Git提交。
