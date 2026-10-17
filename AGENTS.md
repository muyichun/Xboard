# AGENTS.md

## 协作约定

- 使用简体中文沟通；代码标识符、命令和日志保持原文。
- 默认将改动留在工作区，不主动执行 `git add`、`git commit` 或 `git push`。
- 维护分支为 `muyichun`；不自动合并 upstream，也不顺带修改相邻仓库。
- 遵循现有代码风格，只修改任务相关内容。不要提交 `.env`、密钥、数据库、日志、镜像包或依赖目录。
- `CLAUDE.md` 是指向本文件的相对软链；协作规范统一修改本文件，保持软链。

## 项目结构

PHP 8.2+、Laravel 12、Octane（Swoole）、Horizon、Redis，默认使用 SQLite。

| 路径 | 用途 |
| --- | --- |
| `app/Http/Controllers/`、`app/Http/Requests/` | API 控制器与请求校验 |
| `app/Http/Routes/V1/`、`app/Http/Routes/V2/` | 版本化 API 路由，由 `RouteServiceProvider` 加载 |
| `routes/` | Web、控制台和广播路由；API 不在 `routes/api.php` |
| `app/Services/`、`app/Models/` | 业务逻辑与数据模型 |
| `app/Jobs/`、`app/Console/` | 队列任务与命令 |
| `app/Protocols/`、`app/Support/ProtocolManager.php` | 客户端订阅格式与协议注册 |
| `app/WebSocket/`、`app/Services/NodeSyncService.php` | 节点连接与配置、用户同步 |
| `plugins-core/`、`plugins/` | 内置插件与运行时挂载的第三方插件 |
| `database/` | 迁移、种子和工厂 |
| `resources/`、`theme/` | 模板、翻译、订阅规则和主题 |
| `public/assets/admin/` | 管理端构建产物的 Git 子模块 |
| `tests/` | PHPUnit 单元和功能测试 |
| `.docker/`、`Dockerfile`、`compose.yaml`、`Makefile`、`scripts/` | 容器、发布与备份配置 |

## 修改要点

- Octane 是常驻进程，不要用静态属性或单例保存请求、用户等状态；注意请求间隔离与资源释放。
- API 变更保持已有 V1/V2 客户端兼容，遵循对应路由的鉴权中间件；相关配置在 `app/Http/Kernel.php`。
- 业务配置使用 `admin_setting()` / `admin_settings_batch()`（`app/Helpers/Functions.php`）；基础设施配置使用 `.env` 和 `config/`。
- 数据库变更通过迁移实现，考虑 SQLite 的并发写入与 SQL 兼容性，不直接改运行中的数据库文件。
- 订阅格式修改查看 `app/Protocols/`；插件扩展沿用 `app/Services/Plugin/` 的 action/filter hook，参考 [插件指南](docs/en/development/plugin-development-guide.md)。
- 管理端为独立子模块，根目录 `package.json` 没有前端构建脚本，不假设可运行 `npm run build`。
- 面板与节点分别发布；涉及节点协议时核对兼容性，节点项目为 `muyichun/Xboard-Node`。

## 验证与发布

- 修改 PHP 后，对涉及文件执行 `php -l 路径`；业务行为变更优先运行相关测试。
- `tests/TestCase.php` 已存在，但仓库没有 `phpunit.xml`。运行测试前确认开发依赖、引导和独立测试环境配置，避免使用真实业务数据。
- 安装开发依赖后可执行 `vendor/bin/phpstan analyse`；配置为 `phpstan.neon`，level 5，检查 `app/`。
- 生产镜像通过 `composer install --no-dev` 构建，不包含 PHPUnit / Larastan；不能假设进入容器即可跑测试。无法验证时说明原因，不声称通过。
- 日常发布命令见 [README.md](README.md)，完整安装、迁移和恢复步骤见 [deploy.md](deploy.md)。
- `make release` 会构建并重建开发环境、健康检查、导出镜像；仅在需要发布验证时执行，不当作普通静态检查。
- 生产机只导入镜像；容器重建保持 `--no-build --pull never`。应用源码和 Composer 依赖在镜像内。
- `.env`、`.docker/.data/`、`storage/logs/`、`storage/theme/`、`plugins/` 和 Redis volume 是持久化数据，修改部署配置时保留这些挂载。
- `make install` 仅用于全新实例；升级或迁移使用 `make deploy`，保留原 `APP_KEY`。
