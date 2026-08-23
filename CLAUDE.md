# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 语言要求

与用户的所有交互（解释、说明、提交信息建议、注释等）一律使用简体中文；代码标识符、命令行、日志保持原文不译。

## 项目与部署

技术栈、部署方式、Makefile 命令见 [README.md](README.md)；发布/回滚/迁移的详细步骤见
[deploy.md](deploy.md)，此处不重复。

补充一点 README 里没写、但写代码前需要知道的：**生产镜像是 `composer install --no-dev` 构建的**
（[Dockerfile](Dockerfile) 第 54、92 行），运行中的容器没有 `phpunit`/`larastan`；仓库也未提交
`phpunit.xml` 和 `tests/TestCase.php`（只有 [tests/](tests) 下的用例文件本身）。所以**现状是测试和
`phpstan analyse`（[phpstan.neon](phpstan.neon)，level 5，只扫 `app/`）都无法在现有容器里直接跑**，
不要假设 `make shell` 进去就能 `php artisan test`。

## 架构要点

- **Octane 常驻内存**：请求间进程不重启，避免用静态属性/单例存请求态数据。
  [app/Services/Plugin/HookManager.php](app/Services/Plugin/HookManager.php) 用 `App::instance()`
  而非静态数组存 hook 正是为此。

- **API 路由不在 `routes/api.php`**：按版本拆在 [app/Http/Routes/V1](app/Http/Routes/V1)、
  [app/Http/Routes/V2](app/Http/Routes/V2) 下的 `*Route` 类里，由
  [RouteServiceProvider](app/Providers/RouteServiceProvider.php) 加载。V1 是旧版/兼容客户端协议，
  V2 是新接口，新功能优先加在 V2。

- **中间件区分调用方身份**（[app/Http/Kernel.php](app/Http/Kernel.php)）：`user`/`admin`/`client`/
  `staff`/`server`/`server.v2` 分别对应用户端、管理端、客户端 App、员工、V1 节点、V2 节点鉴权。

- **订阅协议生成**：[app/Protocols/](app/Protocols) 下每个类对应一种客户端格式（Clash、SingBox、
  Surge…），由 `ProtocolServiceProvider` 注册，加新客户端类型是加类而不是改控制器。

- **插件系统**是 filter/action hook 模式：基类
  [AbstractPlugin](app/Services/Plugin/AbstractPlugin.php)，`HookManager` 管理 hook。内置插件在
  [plugins-core/](plugins-core)，第三方插件放 [plugins/](plugins)（运行时挂载，不进镜像）。开发方式见
  [docs/en/development/plugin-development-guide.md](docs/en/development/plugin-development-guide.md)。

- **节点同步**：[NodeSyncService](app/Services/NodeSyncService.php) 经 WebSocket
  （[app/WebSocket/](app/WebSocket)）向在线节点推送配置/用户变更，在线状态靠 Redis 键
  `node_ws_alive:{id}` 判断。

- **运行时业务配置走数据库，不是 `.env`**：通过 `admin_setting()` / `admin_settings_batch()`
  （[app/Helpers/Functions.php](app/Helpers/Functions.php)）读写，底层是 `Setting` 模型+缓存；
  `.env` 只管基础设施连接参数。

- **数据库默认 SQLite** 单文件，涉及并发写入/迁移的改动要考虑其限制，不要假设是常规 MySQL。
