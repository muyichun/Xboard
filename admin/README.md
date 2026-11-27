# Xboard 管理端源码

简体中文管理控制台，与 Laravel 管理 API 同仓维护。React + TypeScript + Vite，Tailwind CSS、Base UI / shadcn 风格组件，TanStack Query / Table，React Hook Form + Zod。邮件和订阅模板编辑器按需加载 Monaco。

## 开发

需要 Node.js 22.12+，包管理器版本固定在 `package.json`，依赖固定在 `pnpm-lock.yaml`。

```bash
cd admin
npx --yes pnpm@12.21.0 install --frozen-lockfile
VITE_ADMIN_PATH=你的后台路径 ADMIN_API_ORIGIN=http://127.0.0.1:7001 npx --yes pnpm@12.21.0 dev
```

访问 Vite 输出的 `/assets/admin-next/` 路径。Vite 会代理 `/api` 到开发服务；开发环境应使用独立测试账号。`VITE_ADMIN_PATH` 只在独立 Vite 预览时使用，正式入口由 Blade 注入后台路径。

```bash
npx --yes pnpm@12.21.0 check
npx --yes pnpm@12.21.0 test
npx --yes pnpm@12.21.0 build
```

构建输出到 `public/assets/admin-next/`，不提交依赖和构建产物。Dockerfile 自动完成前端构建并将产物装入应用镜像，原管理端子模块保持可用。生产不需要 Node.js。

## 目录

- `src/lib/`：请求认证、数据转换、列表参数和礼品卡校验。
- `src/modules/`：业务模块、表单字段和设置 schema。
- `src/legacy/`：旧版导航和界面对照层、表格语义单元格、节点协议字段、工单/服务器工作台；复刻功能优先修改此层。
- `src/pages/`：业务页面和扩展管理。
- `src/components/`：表格、分页、表单、对话框、编辑器等可复用组件。
- `tests/`：前后端单位、协议、筛选等契约测试。
- `../tests/Admin/`：隔离数据库 fixture 和真实 Chromium 验收。

新增业务先核对控制器和 Request 校验规则，再配置模块。不要把不同接口的金额、流量或分页约定统一猜测为一种格式。`Module.savePayload` 和 `Action.payload` 是显式转换边界；批量更新仅发送用户明确选择的字段。

## 用户流量记录

用户列表的「TA的流量记录」提供「节点明细」与「按日汇总」，打开后直接按时间倒序显示，不提供日期或节点检索。分页不改变全部记录合计。流量显示使用 KB / MB / GB / TB，继续按 1024 换算。

- 节点明细按用户、日期、节点、协议和倍率累计，保存节点名称快照、实际上下行字节及逐次上报取整后的计费字节，0 倍率仍有实际用量。
- 时间精确到分钟，表示服务端首次／最近收到非零流量上报的时间，按面板统计时区展示，不代表连接起止时间。入队时记录日期，跨午夜排队不挪到执行日。
- 既有按日记录保留，无法追补节点和准确上报时间。升级前已入队、没有接收时间的任务只继续计入原汇总，避免伪造明细。
- 新增表 `v2_stat_user_node` 由迁移创建，原流量表和计费流程保留；`reset:log` 同步清理两个月前的节点明细。上线需先完成正常迁移再启动新版队列。
- 回退应用镜像时可保留新增表，旧代码会忽略它；不要执行迁移回滚删除已积累的明细，也不要以旧数据库覆盖新数据。恢复新版后继续记录，回退期间无法补录节点数据。

`tests/Admin/run.sh` 包含流量写入、筛选、兼容接口与浏览器验收，使用独立数据库。新表迁移回滚和失败事务也仅在该隔离环境测试。

## 入口与回退

- 新版：`/<后台路径>?admin_ui=next#/`
- 原版：`/<后台路径>?admin_ui=legacy#/`
- 无参数：取 `admin_ui` 设置；默认 `legacy`。

预览阶段不改变默认入口。验收后可在新版「系统配置 → 用户端外观」修改默认管理端。切回 `legacy` 或使用查询参数即可恢复原页面，数据库和 API 不需要迁移。

登录令牌保存在当前标签页的 sessionStorage，不写入源码、配置或 localStorage。所有业务操作继续由服务端管理员中间件授权。401/403 会清除会话并返回登录页。

更多功能和验收说明见 [重写说明](../docs/admin/rewrite.md)。

旧版按钮、状态与操作路径的对应关系见 [复刻对照](../docs/admin/legacy-parity.md)。
