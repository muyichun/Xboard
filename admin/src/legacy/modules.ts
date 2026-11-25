import { canReviewCommission } from "../lib/orders";
import { mergeRecords } from "../lib/forms";
import { legacyNodeFields } from "./nodeFields";
import { modules as baseModules } from "../modules/registry";
import { f, required, select, periods } from "../modules/fields";
import type { Module, Column, Action, Row } from "../lib/types";
const c = (key: string, label: string, format?: Column["format"]): Column => ({
    key,
    label,
    format,
});
export const modules: Module[] = baseModules.map((original) => ({
    ...original,
    columns: [...original.columns],
    fields: original.fields ? [...original.fields] : undefined,
    actions: original.actions ? [...original.actions] : [],
    filters: original.filters ? [...original.filters] : [],
}));
const m = (id: string) => modules.find((x) => x.id === id)!;
const users = m("users");
users.description = "在这里可以管理用户，包括增加、删除、编辑、查询等操作。";
users.columns = [
    c("is_admin", "管理员", "boolean"),
    c("is_staff", "员工", "boolean"),
    c("id", "ID"),
    c("email", "邮箱"),
    c("online_count", "在线设备"),
    c("banned", "状态"),
    c("plan.name", "订阅"),
    c("group.name", "权限组"),
    c("total_used", "已用流量", "bytes"),
    c("transfer_enable", "总流量", "bytes"),
    c("expired_at", "到期时间", "time"),
    c("created_at", "注册时间", "time"),
];
users.actions = [
    {
        ...m("orders").create!,
        label: "分配订单",
        seed: (r) => ({ email: r.email }),
    },
    { label: "复制订阅URL", endpoint: "#copy-subscription" },
    {
        label: "重置UUID及订阅URL",
        endpoint: "user/resetSecret",
        danger: true,
        confirm: "重置后原 UUID 及订阅 URL 将立即失效，确定继续？",
    },
    { label: "TA的订单", endpoint: "#user-orders" },
    { label: "TA的邀请", endpoint: "#user-invites" },
    { label: "TA的流量记录", endpoint: "#user-traffic" },
    { label: "重置流量", endpoint: "#user-reset" },
    users.actions!.find((a) => a.endpoint === "user/destroy")!,
];
users.tools = [{ label: "流量重置统计", endpoint: "#reset-stats" }];
const plans = m("plans");
plans.title = "订阅套餐";
plans.description = "在这里可以配置订阅计划，包括添加、删除、编辑等操作。";
plans.create = { label: "添加套餐", endpoint: "plan/save" };
plans.columns = [
    c("id", "ID"),
    c("show", "显示", "boolean"),
    c("sell", "新购", "boolean"),
    c("renew", "续费", "boolean"),
    c("name", "名称"),
    c("users_count", "统计"),
    c("group.name", "权限组"),
    { key: "prices", label: "价格", sortable: false },
];
plans.actions = plans.actions!.filter((a) => a.endpoint !== "plan/update");
const orders = m("orders");
orders.description = "在这里可以查看用户订单，包括分配、查看、删除等操作。";
orders.create = { ...orders.create!, label: "添加订单" };
orders.columns = [
    c("trade_no", "订单号"),
    {
        key: "type",
        label: "类型",
        options: { "1": "新购", "2": "续费", "3": "升级", "4": "流量重置" },
    },
    c("plan.name", "订阅计划"),
    { key: "period", label: "周期", options: periods },
    c("total_amount", "支付金额", "money"),
    {
        key: "status",
        label: "订单状态",
        options: {
            "0": "待支付",
            "1": "开通中",
            "2": "已取消",
            "3": "已完成",
            "4": "已折抵",
        },
    },
    c("commission_balance", "佣金金额", "money"),
    {
        key: "commission_status",
        label: "佣金状态",
        options: { "0": "待确认", "1": "发放中", "2": "有效", "3": "无效" },
    },
    c("created_at", "创建时间", "time"),
];
orders.filters = [
    select("type", "类型", {
        "1": "新购",
        "2": "续费",
        "3": "升级",
        "4": "流量重置",
    }),
    select("period", "周期", periods),
    select("status", "订单状态", {
        "0": "待支付",
        "1": "开通中",
        "2": "已取消",
        "3": "已完成",
        "4": "已折抵",
    }),
    select("commission_status", "佣金状态", {
        "0": "待确认",
        "1": "发放中",
        "2": "有效",
        "3": "无效",
    }),
];
orders.actions!.push(m("commissions").actions![0]);
const coupons = m("coupons");
coupons.title = "优惠券管理";
coupons.description = "在这里可以查看优惠券，包括增加、查看、删除等操作。";
coupons.create = { label: "添加优惠券", endpoint: "coupon/generate" };
coupons.columns = [
    c("id", "ID"),
    c("show", "启用", "boolean"),
    c("name", "卷名称"),
    c("type", "类型"),
    c("code", "卷码"),
    c("limit_use", "剩余次数"),
    c("limit_use_with_user", "可用次数/用户"),
    c("ended_at", "有效期"),
];
coupons.filters = [
    select("type", "类型", { "1": "按金额优惠", "2": "按比例优惠" }),
];
coupons.fields = coupons.fields!.map((x) =>
    x.key === "value"
        ? {
              ...x,
              label: "优惠值",
              min: 0.01,
              hint: "金额优惠单位为元；比例优惠单位为 %",
          }
        : x.key === "type"
          ? select(
                "type",
                "优惠券类型",
                { "1": "按金额优惠", "2": "按比例优惠" },
                { default: 1, required: true },
            )
          : x,
);
coupons.editSeed = (r) => ({
    ...r,
    value: Number(r.type) === 1 ? Number(r.value) / 100 : r.value,
});
coupons.savePayload = (v) => {
    if (v.ended_at <= v.started_at) throw new Error("结束时间必须晚于开始时间");
    return {
        ...v,
        value:
            Number(v.type) === 1 ? Math.round(Number(v.value) * 100) : v.value,
    };
};
coupons.actions = coupons.actions!.filter((a) => a.endpoint !== "coupon/show");
const tickets = m("tickets");
tickets.description = "在这里可以查看用户工单，包括查看、回复、关闭等操作。";
tickets.params = { status: 0 };
tickets.columns = [
    c("id", "工单号"),
    c("subject", "主题"),
    {
        key: "level",
        label: "优先级",
        options: { "0": "低", "1": "中", "2": "高" },
    },
    c("status", "状态"),
    c("updated_at", "最后更新", "time"),
    c("created_at", "创建时间", "time"),
];
tickets.filters = [
    select("level", "优先级", { "0": "低", "1": "中", "2": "高" }),
];
tickets.searchKey = undefined;
const nodes = m("nodes");
nodes.columns = [
    c("id", "节点ID"),
    c("show", "显隐", "boolean"),
    c("name", "节点"),
    c("host", "地址"),
    c("machine_id", "部署方式"),
    c("online", "在线人数"),
    c("rate", "倍率"),
    { key: "traffic", label: "流量使用", sortable: false },
    c("group_ids", "权限组"),
];
nodes.filters = [
    select(
        "type",
        "类型",
        Object.fromEntries(
            baseModules
                .find((x) => x.id === "nodes")!
                .fields!.find((x) => x.key === "type")!
                .options!.map((x) => [x.value, x.label]),
        ),
    ),
    f("machine_id", "服务器", "select", {
        source: "machines",
        options: [{ value: "standalone", label: "独立部署" }],
    }),
];
nodes.bulk = [
    ...["显示节点", "隐藏节点", "启用节点", "禁用节点"].map(
        (label, i): Action => ({
            label,
            endpoint: "server/manage/batchUpdate",
            extra: { [i < 2 ? "show" : "enabled"]: i % 2 === 0 ? 1 : 0 },
        }),
    ),
    ...nodes.bulk!,
];
const machines = m("machines");
machines.description =
    "用于查看服务器健康、负载与承载节点，并从运维视角快捷发起节点操作。";
machines.columns = [
    c("id", "ID"),
    c("name", "服务器名称"),
    c("status", "状态"),
    c("servers_count", "节点数"),
    { key: "load_status", label: "负载", sortable: false },
    c("last_seen_at", "最后心跳", "time"),
];
machines.create = { label: "添加服务器", endpoint: "server/machine/save" };
machines.filters = [
    select("status", "状态", {
        online: "在线",
        offline: "离线",
        inactive: "已禁用",
        never: "从未上报",
    }),
    select("node_filter", "节点", {
        with_nodes: "已承载节点",
        idle_nodes: "空闲服务器",
        high_load: "高负载",
    }),
];
for (const [id, title, create] of [
    ["groups", "权限组管理", "添加权限组"],
    ["routes", "路由管理", "添加路由"],
    ["notices", "公告管理", "添加公告"],
    ["knowledge", "知识库管理", "添加知识"],
]) {
    const item = m(id);
    item.title = title;
    item.create = { label: create, endpoint: item.save! };
}
const templates = m("gift-templates");
templates.title = "模板管理";
templates.create = { ...templates.create!, label: "添加模板" };
templates.columns = [
    c("id", "ID"),
    c("name", "名称"),
    {
        key: "type",
        label: "类型",
        options: { "1": "通用礼品卡", "2": "套餐礼品卡", "3": "盲盒礼品卡" },
    },
    c("status", "状态", "boolean"),
    c("sort", "排序"),
    c("rewards", "奖励内容"),
    c("created_at", "创建时间", "time"),
];
templates.fields = templates.fields!.map((x) => ({
    ...x,
    ...(x.key.startsWith("rewards.")
        ? {
              show: (v: Row) =>
                  x.key === "rewards.random_rewards"
                      ? Number(v.type) === 3
                      : [
                              "rewards.plan_id",
                              "rewards.plan_validity_days",
                          ].includes(x.key)
                        ? Number(v.type) === 2
                        : Number(v.type) === 1,
          }
        : {}),
}));
templates.fields.push(
    f("conditions.disallowed_plans", "禁止的套餐", "multi", {
        source: "plans",
        group: "领取条件",
    }),
    f("rewards.invite_reward_rate", "邀请人奖励比例", "number", {
        min: 0,
        hint: "例如 0.2 代表余额奖励的 20%",
        group: "领取条件",
    }),
);
const codes = m("gift-codes");
codes.title = "兑换码管理";
codes.searchKey = "code";
codes.filters = [
    f("template_id", "模板", "select", { source: "templates" }),
    select("status", "状态", {
        "0": "未使用",
        "1": "已使用",
        "2": "已过期",
        "3": "已禁用",
    }),
];
codes.columns = [
    c("id", "ID"),
    c("code", "兑换码"),
    c("template.name", "模板名称"),
    c("status", "状态"),
    c("expires_at", "过期时间", "time"),
    c("usage_count", "已用次数"),
    c("max_usage", "可用次数"),
    c("created_at", "创建时间", "time"),
];
codes.create!.fields = [
    ...codes.create!.fields!,
    f("download_csv", "导出CSV", "boolean"),
];
m("gift-usages").title = "使用记录";
m("gift-usages").searchKey = "user_email";
m("gift-usages").columns = [
    c("id", "ID"),
    c("code", "兑换码"),
    c("user_email", "用户邮箱"),
    c("template_name", "模板名称"),
    c("created_at", "使用时间", "time"),
];
m("traffic").title = "流量重置日志";
export const moduleById = (id: string) => modules.find((m) => m.id === id)!;

// Keep the old dedicated editors instead of exposing raw arrays/JSON for ordinary work.
nodes.fields = legacyNodeFields;
nodes.filters!.push(f("group_ids", "权限组", "multi", { source: "groups" }));
nodes.editSeed = (r) => ({
    ...r,
    __protocol_extra: Object.fromEntries(
        Object.entries(r.protocol_settings || {}).filter(
            ([key]) =>
                !legacyNodeFields.some(
                    (f) =>
                        f.key === `protocol_settings.${key}` ||
                        f.key.startsWith(`protocol_settings.${key}.`),
                ),
        ),
    ),
});
const originalNodeSave = nodes.savePayload!;
nodes.savePayload = (v, r) => {
    const payload = originalNodeSave(v, r.type === v.type ? r : {});
    payload.protocol_settings = mergeRecords(
        r.type === v.type ? r.protocol_settings || {} : {},
        payload.protocol_settings,
    );
    return payload;
};
nodes.create = { label: "添加节点", endpoint: "server/manage/save" };
nodes.tools = [];
plans.fields = plans.fields!.map((x) =>
    x.key === "content" ? { ...x, kind: "markdown" } : x,
);
templates.fields = templates.fields!.map((x) =>
    x.key === "rewards.random_rewards"
        ? {
              ...x,
              kind: "rewards",
              hint: "填写权重和奖励；余额单位为元，流量单位为 GB",
          }
        : x,
);
for (const id of ["notices", "knowledge"]) {
    const item = m(id);
    item.actions = item.actions!.filter((a) => !a.endpoint.endsWith("/show"));
    item.fields = item.fields!.map((x) =>
        x.key === "content" || x.key === "body"
            ? { ...x, label: "内容（Markdown）", kind: "markdown" }
            : x.key === "language"
              ? select(
                    "language",
                    "语言",
                    {
                        "en-US": "English",
                        "ja-JP": "日本語",
                        "ko-KR": "한국어",
                        "vi-VN": "Tiếng Việt",
                        "zh-CN": "简体中文",
                        "zh-TW": "繁體中文",
                        "ru-RU": "Русский",
                    },
                    { default: "zh-CN", required: true },
                )
              : x,
    );
}
m("routes").fields = m("routes").fields!.map((x) =>
    x.key === "match"
        ? { ...x, kind: "lines", hint: "每行一条匹配规则" }
        : x.key === "action_value"
          ? {
                ...x,
                show: (v) => ["dns", "outbound"].includes(v.action),
                hint: "DNS 动作填写 DNS 服务器；转发动作填写 Outbound Tag",
            }
          : x,
);
orders.actions = orders.actions!.map((a) =>
    a.endpoint === "order/update"
        ? {
              ...a,
              visible: canReviewCommission,
              seed: () => ({ commission_status: "" }),
              extra: { review_pending: true },
              fields: [
                  select(
                      "commission_status",
                      "佣金状态",
                      { "1": "发放中", "3": "无效" },
                      { required: true },
                  ),
              ],
          }
        : a,
);
codes.create!.payload = ({ expires_hours, ...v }) => ({
    ...v,
    ...(expires_hours == null || expires_hours === "" ? {} : { expires_hours }),
});

templates.editSeed = (r) => ({
    ...r,
    rewards: {
        ...r.rewards,
        invite_reward_rate:
            r.rewards?.invite_reward_rate ?? r.limits?.invite_reward_rate ?? 0,
    },
});

m("traffic").tools = [
    { label: "统计概览", endpoint: "#reset-stats" },
    { label: "导出日志", endpoint: "#export-reset-logs" },
];
m("traffic").filters!.push(
    select("trigger_source", "触发来源", {
        auto: "自动",
        manual: "手动",
        api: "API",
        cron: "定时任务",
        user_access: "用户访问",
    }),
);
