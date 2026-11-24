import { giftPayload } from "../lib/gifts";
import type { Module, Action, Field, Row } from "../lib/types";
import {
    f,
    required,
    select,
    planFields,
    userFields,
    nodeFields,
    periods,
    nodeTypes,
} from "./fields";
const drop = (endpoint: string): Action => ({
    label: "删除",
    deletesRecord: true,
    endpoint,
    danger: true,
    confirm: "删除后无法恢复，请确认已核对当前记录。",
});
const toggle = (endpoint: string): Action => ({
    label: "切换启用状态",
    endpoint,
    confirm: "确认切换当前记录的启用状态？",
});
const col = (key: string, label: string, format?: any) => ({
    key,
    label,
    format,
});
const generateUser: Action = {
    label: "创建用户",
    endpoint: "user/generate",
    fields: [
        select(
            "__mode",
            "创建方式",
            { single: "单个账号", batch: "批量账号" },
            { default: "single", required: true },
        ),
        required("email_suffix", "邮箱域名", "text", { hint: "不包含 @" }),
        required("email_prefix", "邮箱前缀", "text", {
            show: (v) => v.__mode === "single",
        }),
        f("email_prefix", "邮箱前缀", "text", {
            show: (v) => v.__mode === "batch",
            hint: "留空生成随机前缀",
        }),
        required("generate_count", "创建数量", "number", {
            default: 1,
            min: 1,
            show: (v) => v.__mode === "batch",
        }),
        f("password", "初始密码", "password", {
            hint: "至少 8 位；留空使用邮箱作为初始密码",
        }),
        f("plan_id", "套餐", "select", { source: "plans" }),
        f("expired_at", "到期时间", "datetime"),
        f("download_csv", "下载账号文件", "boolean", {
            show: (v) => v.__mode === "batch",
        }),
    ],
    payload: ({ __mode, ...v }) => v,
    result: true,
};
export const modules: Module[] = [
    {
        id: "users",
        title: "用户管理",
        description: "管理账号、套餐、流量和邀请关系",
        group: "用户与服务",
        endpoint: "user/fetch",
        method: "post",
        remote: true,
        filterMode: "structured",
        searchKey: "email",
        columns: [
            col("id", "ID"),
            col("email", "邮箱"),
            col("plan.name", "套餐"),
            col("balance", "余额", "yuan"),
            col("total_used", "已用流量", "bytes"),
            col("transfer_enable", "总流量", "bytes"),
            col("expired_at", "到期时间", "time"),
            {
                key: "banned",
                label: "状态",
                options: { "0": "正常", "1": "封禁" },
            },
            col("remarks", "备注"),
        ],
        fields: userFields,
        save: "user/update",
        create: generateUser,
        editSeed: (r) => ({
            ...r,
            invite_user_email: r.invite_user?.email || "",
        }),
        actions: [
            {
                label: "用户流量明细",
                endpoint: "stat/getStatUser",
                method: "get",
                idKey: "user_id",
                result: true,
                fields: [
                    f("page", "页码", "number", { default: 1, min: 1 }),
                    f("pageSize", "每页条数", "number", {
                        default: 50,
                        min: 1,
                    }),
                ],
            },
            {
                label: "流量重置历史",
                endpoint: "traffic-reset/user/{id}/history",
                method: "get",
                result: true,
            },
            {
                label: "重置订阅密钥",
                endpoint: "user/resetSecret",
                danger: true,
                confirm: "现有订阅链接和 UUID 将失效，确认重置？",
            },
            {
                label: "设置邀请人",
                endpoint: "user/setInviteUser",
                fields: [
                    f("invite_user_id", "邀请人用户 ID", "number", {
                        hint: "留空取消邀请关系",
                    }),
                ],
            },
            {
                label: "重置用户流量",
                endpoint: "traffic-reset/reset-user",
                idKey: "user_id",
                fields: [f("reason", "重置原因", "textarea")],
                confirm: "确认清零该用户本周期流量？",
            },
            drop("user/destroy"),
        ],
        bulk: [
            {
                label: "导出选中用户",
                endpoint: "user/dumpCSV",
                download: true,
                extra: { scope: "selected" },
                idsKey: "user_ids",
            },
            {
                label: "封禁选中用户",
                endpoint: "user/ban",
                extra: { scope: "selected" },
                idsKey: "user_ids",
                danger: true,
                confirm: "仅封禁已选用户，并注销其会话。",
            },
            {
                label: "发送邮件",
                endpoint: "user/sendMail",
                extra: { scope: "selected" },
                idsKey: "user_ids",
                fields: [
                    required("subject", "邮件主题"),
                    required("content", "邮件内容", "textarea"),
                ],
                confirm: "邮件将发送给所有已选用户。",
            },
        ],
    },
    {
        id: "plans",
        title: "套餐管理",
        description: "配置套餐权益、销售周期和价格",
        group: "订阅与订单",
        endpoint: "plan/fetch",
        columns: [
            col("id", "ID"),
            col("name", "套餐名称"),
            col("transfer_enable", "流量 / GiB"),
            col("group.name", "权限组"),
            col("users_count", "订阅用户"),
            col("active_users_count", "有效用户"),
            col("show", "展示", "boolean"),
            col("sell", "销售", "boolean"),
            col("renew", "续费", "boolean"),
        ],
        fields: planFields,
        save: "plan/save",
        sort: "plan/sort",
        savePayload: (v) => ({
            ...v,
            prices: Object.fromEntries(
                Object.entries(v.prices || {}).filter(
                    ([, n]) => n !== null && n !== "",
                ),
            ),
            group_id: v.group_id || null,
            speed_limit: v.speed_limit || null,
            device_limit: v.device_limit || null,
        }),
        actions: [
            {
                label: "销售与展示",
                endpoint: "plan/update",
                fields: [
                    f("show", "展示套餐", "visibility"),
                    f("sell", "允许购买", "boolean"),
                    f("renew", "允许续费", "boolean"),
                ],
            },
            drop("plan/drop"),
        ],
    },
    {
        id: "orders",
        title: "订单管理",
        description: "查看交易、开通状态和订单详情",
        group: "订阅与订单",
        endpoint: "order/fetch",
        method: "post",
        remote: true,
        filterMode: "structured",
        searchKey: "trade_no",
        columns: [
            col("trade_no", "订单号"),
            col("user_id", "用户 ID"),
            col("plan.name", "套餐"),
            col("total_amount", "金额", "money"),
            { key: "period", label: "周期", options: periods },
            {
                key: "status",
                label: "状态",
                options: {
                    "0": "待支付",
                    "1": "开通中",
                    "2": "已取消",
                    "3": "已完成",
                    "4": "已折抵",
                },
            },
            col("created_at", "创建时间", "time"),
        ],
        create: {
            label: "分配订单",
            endpoint: "order/assign",
            fields: [
                required("email", "用户邮箱"),
                f("plan_id", "套餐", "select", {
                    source: "plans",
                    required: true,
                }),
                select("period", "周期", periods, { required: true }),
                required("total_amount", "订单金额（元）", "money", { min: 0 }),
            ],
            result: true,
        },
        detailEndpoint: "order/detail",
        actions: [
            {
                label: "标记已支付",
                endpoint: "order/paid",
                idKey: "trade_no",
                visible: (r) => r.status === 0,
                danger: true,
                confirm: "此操作将按已收款处理并开通服务，请确认实际收到款项。",
            },
            {
                label: "取消订单",
                endpoint: "order/cancel",
                idKey: "trade_no",
                visible: (r) => r.status === 0,
                confirm: "确认取消此待支付订单？",
            },
        ],
    },
    {
        id: "commissions",
        title: "佣金管理",
        description: "核对邀请佣金与结算状态",
        group: "订阅与订单",
        endpoint: "order/fetch",
        method: "post",
        remote: true,
        filterMode: "structured",
        searchKey: "trade_no",
        params: { is_commission: 1 },
        columns: [
            col("trade_no", "订单号"),
            col("user_id", "购买用户"),
            col("invite_user_id", "邀请用户"),
            col("total_amount", "订单金额", "money"),
            col("commission_balance", "佣金", "money"),
            {
                key: "commission_status",
                label: "佣金状态",
                options: {
                    "0": "待确认",
                    "1": "发放中",
                    "2": "有效",
                    "3": "无效",
                },
            },
            col("created_at", "创建时间", "time"),
        ],
        detailEndpoint: "order/detail",
        actions: [
            {
                label: "审核佣金",
                endpoint: "order/update",
                idKey: "trade_no",
                fields: [
                    select(
                        "commission_status",
                        "结算状态",
                        { "0": "待确认", "1": "发放中", "3": "无效" },
                        { required: true },
                    ),
                ],
            },
        ],
    },
    {
        id: "coupons",
        title: "优惠券",
        description: "配置优惠规则、适用套餐和使用限制",
        group: "订阅与订单",
        endpoint: "coupon/fetch",
        method: "post",
        remote: true,
        filterMode: "structured",
        searchKey: "name",
        columns: [
            col("name", "名称"),
            col("code", "兑换码"),
            {
                key: "type",
                label: "类型",
                options: { "1": "金额优惠", "2": "比例优惠" },
            },
            col("value", "优惠值"),
            col("show", "启用", "boolean"),
            col("started_at", "开始时间", "time"),
            col("ended_at", "结束时间", "time"),
            col("limit_use", "剩余次数"),
        ],
        save: "coupon/generate",
        fields: [
            f("generate_count", "批量生成数量", "number", {
                min: 1,
                hint: "留空生成单张；填写 1–500 自动下载 CSV",
                show: (v) => !v.id,
            }),
            required("name", "优惠券名称"),
            select(
                "type",
                "优惠类型",
                { "1": "固定金额（分）", "2": "折扣比例（%）" },
                { required: true, default: 1 },
            ),
            required("value", "优惠值", "number", {
                min: 1,
                hint: "固定金额单位为分；比例单位为百分比",
            }),
            f("code", "兑换码", "text", { hint: "留空自动生成" }),
            required("started_at", "开始时间", "datetime"),
            required("ended_at", "结束时间", "datetime"),
            f("limit_use", "使用次数上限", "number"),
            f("limit_use_with_user", "每用户次数上限", "number"),
            f("limit_plan_ids", "适用套餐", "multi", { source: "plans" }),
            f("limit_period", "适用周期", "multi", {
                options: Object.entries({
                    monthly: "月付",
                    quarterly: "季付",
                    half_yearly: "半年付",
                    yearly: "年付",
                    two_yearly: "两年付",
                    three_yearly: "三年付",
                    onetime: "一次性",
                    reset_traffic: "重置流量",
                }).map(([value, label]) => ({ value, label })),
            }),
        ],
        actions: [toggle("coupon/show"), drop("coupon/drop")],
        bulk: [],
    },
    {
        id: "nodes",
        title: "节点管理",
        description: "管理协议配置、机器关联和订阅可见性",
        group: "节点与网络",
        endpoint: "server/manage/getNodes",
        columns: [
            col("id", "ID"),
            col("name", "节点名称"),
            { key: "type", label: "协议", options: nodeTypes },
            col("host", "地址"),
            col("port", "端口"),
            col("rate", "倍率"),
            col("is_online", "在线", "boolean"),
            col("show", "展示", "boolean"),
            col("enabled", "启用", "boolean"),
            col("online", "在线用户"),
        ],
        tools: [
            {
                label: "生成 ECH 密钥",
                endpoint: "server/manage/generateEchKey",
                method: "get",
                fields: [
                    required("public_name", "公开域名", "text", {
                        default: "ech.example.com",
                    }),
                ],
                result: true,
            },
        ],
        fields: nodeFields,
        save: "server/manage/save",
        sort: "server/manage/sort",
        editSeed: (r) => ({
            ...r,
            __protocol_extra: Object.fromEntries(
                Object.entries(r.protocol_settings || {}).filter(
                    ([key]) =>
                        !nodeFields.some(
                            (f) =>
                                f.key === `protocol_settings.${key}` &&
                                (!f.show || f.show(r)),
                        ),
                ),
            ),
        }),
        savePayload: (v, r) => {
            const { __protocol_extra, ...rest } = v;
            return {
                ...rest,
                group_ids: (v.group_ids || []).map(String),
                protocol_settings: {
                    ...r.protocol_settings,
                    ...__protocol_extra,
                    ...v.protocol_settings,
                },
            };
        },
        actions: [
            {
                label: "复制节点",
                endpoint: "server/manage/copy",
                confirm: "创建一个隐藏的新节点副本？",
            },
            {
                label: "启用与展示",
                endpoint: "server/manage/update",
                fields: [
                    f("enabled", "启用", "boolean"),
                    f("show", "订阅中显示", "visibility"),
                ],
            },
            {
                label: "重置流量",
                endpoint: "server/manage/resetTraffic",
                confirm: "确认清零节点流量统计？",
            },
            drop("server/manage/drop"),
        ],
        bulk: [
            {
                label: "批量配置",
                endpoint: "server/manage/batchUpdate",
                fields: [
                    select(
                        "show",
                        "订阅展示",
                        { "0": "隐藏", "1": "显示" },
                        { hint: "留空保持原设置" },
                    ),
                    select(
                        "enabled",
                        "运行状态",
                        { "0": "停用", "1": "启用" },
                        { hint: "留空保持原设置" },
                    ),
                    select(
                        "__machineMode",
                        "机器关联",
                        {
                            keep: "保持原设置",
                            clear: "解除关联",
                            set: "指定机器",
                        },
                        { default: "keep" },
                    ),
                    f("machine_id", "所属机器", "select", {
                        source: "machines",
                        show: (v) => v.__machineMode === "set",
                        required: true,
                    }),
                ],
                payload: ({ __machineMode, ...v }) => {
                    const p: Row = { ids: v.ids };
                    if (v.show !== "" && v.show != null) p.show = v.show;
                    if (v.enabled !== "" && v.enabled != null)
                        p.enabled = v.enabled;
                    if (__machineMode === "clear") p.machine_id = null;
                    if (__machineMode === "set") p.machine_id = v.machine_id;
                    if (Object.keys(p).length === 1)
                        throw new Error("请至少选择一项变更");
                    return p;
                },
            },
            {
                label: "重置流量",
                endpoint: "server/manage/batchResetTraffic",
                confirm: "确认清零选中节点流量？",
            },
            { ...drop("server/manage/batchDelete"), label: "删除选中节点" },
        ],
    },
    {
        id: "machines",
        title: "服务器管理",
        description: "管理节点机器、安装指令与运行状态",
        group: "节点与网络",
        endpoint: "server/machine/fetch",
        columns: [
            col("id", "ID"),
            col("name", "服务器名称"),
            col("servers_count", "节点数"),
            col("is_active", "启用", "boolean"),
            col("last_seen_at", "最近在线", "time"),
            col("notes", "备注"),
        ],
        fields: [
            required("name", "服务器名称"),
            f("notes", "备注", "textarea"),
            f("is_active", "启用", "boolean", { default: true }),
        ],
        save: "server/machine/save",
        actions: [
            {
                label: "安装命令",
                endpoint: "server/machine/installCommand",
                method: "get",
                result: true,
            },
            {
                label: "查看认证令牌",
                endpoint: "server/machine/getToken",
                method: "get",
                result: true,
            },
            {
                label: "重置认证令牌",
                endpoint: "server/machine/resetToken",
                danger: true,
                confirm: "原令牌将失效，需更新服务器配置。",
                result: true,
            },
            {
                label: "关联节点",
                endpoint: "server/machine/nodes",
                method: "get",
                idKey: "machine_id",
                result: true,
            },
            {
                label: "负载历史",
                endpoint: "server/machine/history",
                method: "get",
                idKey: "machine_id",
                extra: { range_hours: 24, limit: 100 },
                result: true,
            },
            drop("server/machine/drop"),
        ],
    },
    {
        id: "groups",
        title: "权限组",
        description: "将用户套餐与可用节点分组关联",
        group: "节点与网络",
        endpoint: "server/group/fetch",
        columns: [
            col("id", "ID"),
            col("name", "权限组名称"),
            col("users_count", "用户数"),
            col("server_count", "节点数"),
        ],
        fields: [required("name", "权限组名称")],
        save: "server/group/save",
        actions: [drop("server/group/drop")],
    },
    {
        id: "routes",
        title: "路由规则",
        description: "配置匹配规则与流量出口",
        group: "节点与网络",
        endpoint: "server/route/fetch",
        columns: [
            col("id", "ID"),
            col("remarks", "备注"),
            col("match", "匹配规则"),
            {
                key: "action",
                label: "动作",
                options: {
                    block: "阻断",
                    direct: "直连",
                    dns: "DNS",
                    proxy: "代理",
                },
            },
            col("action_value", "目标"),
        ],
        fields: [
            required("remarks", "规则名称"),
            required("match", "匹配规则", "tags"),
            select(
                "action",
                "处理方式",
                { block: "阻断", direct: "直连", dns: "DNS", proxy: "代理" },
                { default: "direct", required: true },
            ),
            f("action_value", "目标参数"),
        ],
        save: "server/route/save",
        actions: [drop("server/route/drop")],
    },
    {
        id: "notices",
        title: "公告管理",
        description: "发布站内公告和弹窗通知",
        group: "用户与服务",
        endpoint: "notice/fetch",
        columns: [
            col("id", "ID"),
            col("title", "标题"),
            col("show", "展示", "boolean"),
            col("popup", "弹窗", "boolean"),
            col("tags", "标签"),
            col("updated_at", "更新时间", "time"),
        ],
        fields: [
            required("title", "标题"),
            required("content", "内容（HTML）", "code"),
            f("img_url", "封面图片 URL"),
            f("tags", "标签", "tags", { popupTag: "弹窗" }),
            f("show", "展示公告", "visibility", { default: true }),
        ],
        save: "notice/save",
        sort: "notice/sort",
        actions: [toggle("notice/show"), drop("notice/drop")],
    },
    {
        id: "knowledge",
        title: "知识库",
        description: "维护帮助文档、分类和使用教程",
        group: "用户与服务",
        endpoint: "knowledge/fetch",
        columns: [
            col("id", "ID"),
            col("title", "标题"),
            col("category", "分类"),
            col("show", "展示", "boolean"),
            col("updated_at", "更新时间", "time"),
        ],
        fields: [
            required("title", "标题"),
            required("category", "分类"),
            select(
                "language",
                "语言",
                { "zh-CN": "简体中文", "en-US": "English", "ru-RU": "Русский" },
                { default: "zh-CN", required: true },
            ),
            required("body", "正文（HTML）", "code"),
            f("show", "展示文档", "visibility", { default: true }),
        ],
        save: "knowledge/save",
        detailEndpoint: "knowledge/fetch",
        sort: "knowledge/sort",
        actions: [toggle("knowledge/show"), drop("knowledge/drop")],
    },
    {
        id: "tickets",
        title: "工单管理",
        description: "查看用户问题，回复并跟进处理进度",
        group: "用户与服务",
        endpoint: "ticket/fetch",
        method: "post",
        remote: true,
        filterMode: "structured",
        searchKey: "email",
        columns: [
            col("id", "工单号"),
            col("subject", "主题"),
            col("user.email", "用户邮箱"),
            {
                key: "level",
                label: "优先级",
                options: { "0": "低", "1": "中", "2": "高" },
            },
            {
                key: "status",
                label: "状态",
                options: { "0": "处理中", "1": "已关闭" },
            },
            {
                key: "reply_status",
                label: "回复状态",
                options: { "0": "待回复", "1": "已回复" },
            },
            col("updated_at", "更新时间", "time"),
        ],
        filters: [select("status", "状态", { "0": "处理中", "1": "已关闭" })],
        detailEndpoint: "ticket/fetch",
        actions: [
            {
                label: "回复工单",
                endpoint: "ticket/reply",
                fields: [required("message", "回复内容", "textarea")],
            },
            {
                label: "关闭工单",
                endpoint: "ticket/close",
                visible: (r) => r.status === 0,
                confirm: "确认关闭此工单？",
            },
        ],
    },
    {
        id: "gift-templates",
        title: "礼品卡模板",
        description: "定义奖励内容、领取条件和使用限制",
        group: "订阅与订单",
        endpoint: "gift-card/templates",
        remote: true,
        filters: [
            select("type", "类型", {
                "1": "通用礼品卡",
                "2": "套餐礼品卡",
                "3": "盲盒礼品卡",
            }),
            select("status", "状态", { "0": "停用", "1": "启用" }),
        ],
        columns: [
            col("id", "ID"),
            col("name", "模板名称"),
            {
                key: "type",
                label: "类型",
                options: {
                    "1": "通用礼品卡",
                    "2": "套餐礼品卡",
                    "3": "盲盒礼品卡",
                },
            },
            col("status", "启用", "boolean"),
            col("description", "说明"),
            col("created_at", "创建时间", "time"),
        ],
        save: "gift-card/update-template",
        create: { label: "创建模板", endpoint: "gift-card/create-template" },
        fields: [
            required("name", "模板名称"),
            select(
                "type",
                "类型",
                { "1": "通用礼品卡", "2": "套餐礼品卡", "3": "盲盒礼品卡" },
                { required: true, default: 1 },
            ),
            f("description", "说明", "textarea"),
            f("status", "启用", "boolean", { default: true }),
            f("rewards.balance", "余额奖励（元）", "money", {
                group: "奖励内容",
            }),
            f("rewards.transfer_enable", "流量奖励（GiB）", "bytes", {
                group: "奖励内容",
            }),
            f("rewards.expire_days", "增加有效期（天）", "number", {
                group: "奖励内容",
            }),
            f("rewards.device_limit", "增加设备数", "number", {
                group: "奖励内容",
            }),
            f("rewards.reset_package", "重置套餐流量", "boolean", {
                group: "奖励内容",
            }),
            f("rewards.plan_id", "赠送套餐", "select", {
                source: "plans",
                group: "奖励内容",
            }),
            f("rewards.plan_validity_days", "套餐有效期（天）", "number", {
                group: "奖励内容",
            }),
            f("rewards.random_rewards", "盲盒奖励池", "json", {
                default: [],
                group: "奖励内容",
                hint: "每项包含 weight 和奖励字段；余额为分，流量为字节",
            }),
            f("conditions.new_user_only", "仅新用户", "boolean", {
                group: "领取条件",
            }),
            f("conditions.new_user_max_days", "注册天数上限", "number", {
                group: "领取条件",
            }),
            f("conditions.paid_user_only", "仅付费用户", "boolean", {
                group: "领取条件",
            }),
            f("conditions.require_invite", "需有邀请关系", "boolean", {
                group: "领取条件",
            }),
            f("conditions.allowed_plans", "允许的套餐", "multi", {
                source: "plans",
                group: "领取条件",
            }),
            f("limits.max_use_per_user", "每人使用次数", "number", {
                group: "领取条件",
            }),
            f("limits.cooldown_hours", "冷却时间（小时）", "number", {
                group: "领取条件",
            }),
            f("special_config.start_time", "活动开始", "datetime", {
                group: "活动与外观",
            }),
            f("special_config.end_time", "活动结束", "datetime", {
                group: "活动与外观",
            }),
            f("special_config.festival_bonus", "奖励倍数", "number", {
                group: "活动与外观",
            }),
            f("icon", "图标 URL", "text", { group: "活动与外观" }),
            f("background_image", "背景图片 URL", "text", {
                group: "活动与外观",
            }),
            f("theme_color", "主题颜色", "text", {
                default: "#2563eb",
                group: "活动与外观",
            }),
            f("sort", "排序", "number", { default: 0, group: "活动与外观" }),
        ],
        savePayload: giftPayload,
        actions: [drop("gift-card/delete-template")],
    },
    {
        id: "gift-codes",
        title: "礼品兑换码",
        description: "生成兑换码，查看状态与批次",
        group: "订阅与订单",
        endpoint: "gift-card/codes",
        remote: true,
        columns: [
            col("id", "ID"),
            col("code", "兑换码"),
            col("template.name", "模板"),
            {
                key: "status",
                label: "状态",
                options: {
                    "0": "未使用",
                    "1": "已使用",
                    "2": "已过期",
                    "3": "已禁用",
                },
            },
            col("usage_count", "使用次数"),
            col("max_usage", "最大使用次数"),
            col("batch_id", "批次"),
            col("expires_at", "过期时间", "time"),
        ],
        filters: [
            f("batch_id", "批次"),
            select("status", "状态", {
                "0": "未使用",
                "1": "已使用",
                "2": "已过期",
                "3": "已禁用",
            }),
        ],
        save: "gift-card/update-code",
        fields: [
            f("expires_at", "过期时间", "datetime"),
            f("max_usage", "最大使用次数", "number", { min: 1 }),
            select("status", "状态", {
                "0": "未使用",
                "1": "已使用",
                "2": "已过期",
                "3": "已禁用",
            }),
        ],
        create: {
            label: "生成兑换码",
            endpoint: "gift-card/generate-codes",
            fields: [
                f("template_id", "礼品卡模板", "select", {
                    required: true,
                    source: "templates",
                }),
                required("count", "生成数量", "number", {
                    min: 1,
                    default: 10,
                }),
                f("prefix", "前缀", "text", { default: "GC" }),
                f("expires_hours", "有效时间（小时）", "number"),
                f("max_usage", "每码使用次数", "number", {
                    default: 1,
                    min: 1,
                }),
            ],
            result: true,
        },
        actions: [
            {
                label: "启用",
                endpoint: "gift-card/toggle-code",
                extra: { action: "enable" },
            },
            {
                label: "禁用",
                endpoint: "gift-card/toggle-code",
                extra: { action: "disable" },
            },
            {
                label: "导出此批次",
                endpoint: "gift-card/export-codes",
                method: "get",
                idKey: "batch_id",
                download: true,
            },
            drop("gift-card/delete-code"),
        ],
    },
    {
        id: "gift-usages",
        title: "礼品卡使用记录",
        description: "查看兑换用户与实际发放奖励",
        group: "订阅与订单",
        endpoint: "gift-card/usages",
        remote: true,
        columns: [
            col("id", "ID"),
            col("code", "兑换码"),
            col("template_name", "模板"),
            col("user_email", "用户"),
            col("invite_user_email", "邀请人"),
            col("rewards_given", "奖励"),
            col("created_at", "兑换时间", "time"),
        ],
        filters: [
            f("user_id", "用户 ID", "number"),
            f("template_id", "模板", "select", { source: "templates" }),
        ],
    },
    {
        id: "traffic",
        title: "流量重置记录",
        description: "追踪用户流量重置来源和历史",
        group: "节点与网络",
        endpoint: "traffic-reset/logs",
        remote: true,
        columns: [
            col("id", "ID"),
            col("user_email", "用户"),
            col("reset_type_name", "重置类型"),
            col("trigger_source_name", "触发来源"),
            col("old_traffic.formatted", "重置前用量"),
            col("reset_time", "重置时间", "time"),
        ],
        searchKey: "user_email",
        filters: [
            select("reset_type", "类型", {
                monthly: "按月",
                first_day_month: "每月一日",
                yearly: "按年",
                first_day_year: "每年一月一日",
                manual: "手动",
                purchase: "购买",
            }),
            f("start_date", "开始日期", "date"),
            f("end_date", "结束日期", "date"),
        ],
        create: {
            label: "手动重置",
            endpoint: "traffic-reset/reset-user",
            fields: [
                required("user_id", "用户 ID", "number"),
                f("reason", "原因", "textarea"),
            ],
            confirm: "确认清零指定用户的周期流量？",
        },
    },
    {
        id: "audit",
        title: "操作审计",
        description: "追踪管理员操作和变更记录",
        group: "系统设置",
        endpoint: "system/getAuditLog",
        remote: true,
        searchKey: "keyword",
        columns: [
            col("id", "ID"),
            col("admin_id", "管理员 ID"),
            col("action", "操作"),
            col("uri", "路径"),
            col("ip", "IP 地址"),
            col("created_at", "时间", "time"),
        ],
        filters: [
            f("action", "操作类型"),
            f("admin_id", "管理员 ID", "number"),
        ],
    },
];
export const moduleById = (id: string) => modules.find((m) => m.id === id);
