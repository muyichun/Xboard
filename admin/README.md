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
- `src/pages/`：业务页面和扩展管理。
- `src/components/`：表格、分页、表单、对话框、编辑器等可复用组件。
- `tests/`：前后端单位、协议、筛选等契约测试。
- `../tests/Admin/`：隔离数据库 fixture 和真实 Chromium 验收。

新增业务先核对控制器和 Request 校验规则，再配置模块。不要把不同接口的金额、流量或分页约定统一猜测为一种格式。`Module.savePayload` 和 `Action.payload` 是显式转换边界；批量更新仅发送用户明确选择的字段。

## 入口与回退

- 新版：`/<后台路径>?admin_ui=next#/`
- 原版：`/<后台路径>?admin_ui=legacy#/`
- 无参数：取 `admin_ui` 设置；默认 `legacy`。

预览阶段不改变默认入口。验收后可在新版「系统配置 → 用户端外观」修改默认管理端。切回 `legacy` 或使用查询参数即可恢复原页面，数据库和 API 不需要迁移。

登录令牌保存在当前标签页的 sessionStorage，不写入源码、配置或 localStorage。所有业务操作继续由服务端管理员中间件授权。401/403 会清除会话并返回登录页。

更多功能和验收说明见 [重写说明](../docs/admin/rewrite.md)。
