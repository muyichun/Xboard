import type { Field, Option } from "../lib/types";
export const options = (items: Record<string, string>): Option[] =>
    Object.entries(items).map(([v, label]) => ({
        value: /^-?\d+$/.test(v) ? Number(v) : v,
        label,
    }));
export const f = (
    key: string,
    label: string,
    kind: Field["kind"] = "text",
    more: Partial<Field> = {},
): Field => ({ key, label, kind, ...more });
export const required = (
    key: string,
    label: string,
    kind: Field["kind"] = "text",
    more: Partial<Field> = {},
) => f(key, label, kind, { required: true, ...more });
export const select = (
    key: string,
    label: string,
    items: Record<string, string>,
    more: Partial<Field> = {},
) => f(key, label, "select", { options: options(items), ...more });
export const periods = {
    month_price: "月付",
    quarter_price: "季付",
    half_year_price: "半年付",
    year_price: "年付",
    two_year_price: "两年付",
    three_year_price: "三年付",
    onetime_price: "一次性",
    reset_price: "重置流量",
};
export const resetMethods = {
    "0": "每月一日",
    "1": "按月重置",
    "2": "不重置",
    "3": "每年一月一日",
    "4": "按年重置",
};
export const planFields = [
    required("name", "套餐名称"),
    f("group_id", "权限组", "select", { source: "groups" }),
    required("transfer_enable", "套餐流量（GiB）", "number", { min: 1 }),
    f("speed_limit", "限速（Mbps）", "number"),
    f("device_limit", "设备数上限", "number"),
    f("capacity_limit", "库存上限", "number"),
    select("reset_traffic_method", "流量重置方式", resetMethods, {
        hint: "留空跟随系统设置",
    }),
    f("tags", "标签", "tags"),
    f("content", "套餐说明（Markdown）", "textarea"),
    ...Object.entries({
        monthly: "月付",
        quarterly: "季付",
        half_yearly: "半年付",
        yearly: "年付",
        two_yearly: "两年付",
        three_yearly: "三年付",
        onetime: "一次性",
        reset_traffic: "重置流量",
    }).map(([k, label]) =>
        f(`prices.${k}`, `${label}（元）`, "number", {
            min: 0,
            group: "销售价格",
            hint: "留空表示不开启此周期",
        }),
    ),
    f("force_update", "同步更新现有套餐用户", "boolean", {
        group: "同步设置",
        hint: "同步权限组、流量总额、限速和设备限制；请核对后开启",
    }),
];
export const userFields = [
    required("email", "邮箱"),
    f("password", "新密码", "password", { hint: "留空保持原密码；至少 8 位" }),
    f("plan_id", "套餐", "select", { source: "plans" }),
    f("expired_at", "到期时间", "datetime", { hint: "留空为长期有效" }),
    f("transfer_enable", "总流量（GiB）", "bytes"),
    f("u", "已用上传（GiB）", "bytes"),
    f("d", "已用下载（GiB）", "bytes"),
    f("balance", "余额（元）", "number"),
    f("commission_balance", "佣金余额（元）", "number"),
    f("invite_user_email", "邀请人邮箱"),
    f("speed_limit", "限速（Mbps）", "number"),
    f("device_limit", "设备上限", "number"),
    f("discount", "折扣比例（%）", "number"),
    f("commission_rate", "佣金比例（%）", "number"),
    select("commission_type", "佣金方式", {
        "0": "跟随系统",
        "1": "循环返利",
        "2": "首次返利",
    }),
    f("remarks", "备注", "textarea"),
    f("banned", "封禁账号", "boolean", { group: "账号权限" }),
    f("is_admin", "管理员", "boolean", { group: "账号权限" }),
    f("is_staff", "员工", "boolean", { group: "账号权限" }),
];
export const nodeTypes = {
    shadowsocks: "Shadowsocks",
    vmess: "VMess",
    vless: "VLESS",
    trojan: "Trojan",
    hysteria: "Hysteria",
    tuic: "TUIC",
    socks: "SOCKS",
    http: "HTTP",
    naive: "Naïve",
    mieru: "Mieru",
    anytls: "AnyTLS",
};
const protocol = (types: string[], field: Field): Field => ({
    ...field,
    group: "协议配置",
    key: `protocol_settings.${field.key}`,
    show: (v) => types.includes(v.type),
});
export const nodeFields: Field[] = [
    required("name", "节点名称"),
    select("type", "协议类型", nodeTypes, { required: true, default: "vless" }),
    required("host", "连接地址"),
    required("port", "连接端口"),
    required("server_port", "监听端口"),
    required("rate", "流量倍率", "number", { default: 1, min: 0 }),
    f("machine_id", "所属机器", "select", { source: "machines" }),
    f("group_ids", "权限组", "multi", { source: "groups" }),
    f("route_ids", "路由规则", "multi", { source: "routes" }),
    f("enabled", "启用节点", "boolean", { default: true }),
    f("show", "订阅中显示", "visibility", { default: true }),
    f("tags", "标签", "tags"),
    f("transfer_enable", "流量额度（GiB）", "bytes", { hint: "0 表示不限制" }),
    protocol(
        ["shadowsocks"],
        select(
            "cipher",
            "加密方式",
            {
                "aes-128-gcm": "aes-128-gcm",
                "aes-256-gcm": "aes-256-gcm",
                "aes-192-gcm": "aes-192-gcm",
                "2022-blake3-chacha20-poly1305":
                    "2022-blake3-chacha20-poly1305",
                "chacha20-ietf-poly1305": "chacha20-ietf-poly1305",
                "2022-blake3-aes-128-gcm": "2022-blake3-aes-128-gcm",
                "2022-blake3-aes-256-gcm": "2022-blake3-aes-256-gcm",
            },
            { default: "aes-128-gcm", required: true },
        ),
    ),
    protocol(
        ["vmess", "vless", "trojan"],
        select(
            "network",
            "传输方式",
            {
                tcp: "TCP",
                ws: "WebSocket",
                grpc: "gRPC",
                http: "HTTP",
                httpupgrade: "HTTP Upgrade",
                xhttp: "XHTTP",
            },
            { required: true, default: "tcp" },
        ),
    ),
    protocol(
        ["vmess", "vless", "trojan", "socks", "http", "naive"],
        select(
            "tls",
            "传输安全",
            { "0": "关闭", "1": "TLS", "2": "Reality" },
            { default: 1, required: true },
        ),
    ),
    protocol(
        ["hysteria"],
        select(
            "version",
            "协议版本",
            { "1": "v1", "2": "v2" },
            { default: 2, required: true },
        ),
    ),
    protocol(
        ["tuic"],
        select(
            "version",
            "协议版本",
            { "5": "v5" },
            { default: 5, required: true },
        ),
    ),
    protocol(
        ["mieru"],
        select(
            "transport",
            "传输协议",
            { TCP: "TCP", UDP: "UDP" },
            { default: "TCP", required: true },
        ),
    ),
    protocol(
        ["vless"],
        f("flow", "流控", "text", { hint: "例如 xtls-rprx-vision" }),
    ),
    protocol(
        ["vmess", "vless", "trojan"],
        f("network_settings", "传输参数", "json", {
            default: {},
            hint: "WebSocket 的 path、headers；gRPC 的 serviceName 等",
        }),
    ),
    protocol(
        ["vmess", "vless", "trojan", "socks", "http", "naive"],
        f("tls_settings", "TLS 设置", "json", {
            default: {},
            hint: "server_name、allow_insecure、ech 等",
        }),
    ),
    protocol(
        ["vless", "trojan"],
        f("reality_settings", "Reality 设置", "json", {
            default: {},
            hint: "server_name、server_port、public_key、private_key、short_id",
        }),
    ),
    protocol(
        ["hysteria", "tuic", "anytls"],
        f("tls", "TLS 设置", "json", {
            default: {},
            hint: "server_name、allow_insecure、ech",
        }),
    ),
    protocol(
        ["hysteria"],
        f("bandwidth", "上下行带宽", "json", {
            default: { up: 100, down: 100 },
        }),
    ),
    protocol(
        ["hysteria"],
        f("obfs", "混淆设置", "json", {
            default: { open: false, type: "salamander" },
        }),
    ),
    protocol(
        ["tuic"],
        f("congestion_control", "拥塞控制", "text", { default: "bbr" }),
    ),
    protocol(["tuic"], f("alpn", "ALPN", "tags", { default: ["h3"] })),
    protocol(["anytls"], f("padding_scheme", "填充方案", "tags")),
    protocol(
        ["vless"],
        f("encryption", "VLESS Encryption", "json", {
            default: { enabled: false },
        }),
    ),
    protocol(
        ["vmess", "vless", "trojan", "mieru"],
        f("multiplex", "多路复用", "json", { default: { enabled: false } }),
    ),
    protocol(
        ["vmess", "vless", "trojan"],
        f("utls", "uTLS 指纹", "json", { default: { enabled: false } }),
    ),
    f("__protocol_extra", "协议扩展配置", "json", {
        group: "高级配置",
        default: {},
        hint: "保留协议的其他扩展字段；上面的专用字段优先生效",
    }),
    f("cert_config", "证书配置", "json", {
        group: "高级配置",
        default: {},
        hint: "cert_mode、domain、dns_provider、dns_env",
    }),
    f("custom_outbounds", "自定义出站", "json", {
        group: "高级配置",
        default: [],
    }),
    f("custom_routes", "自定义路由", "json", {
        group: "高级配置",
        default: [],
    }),
    f("rate_time_enable", "分时倍率", "boolean", { group: "高级配置" }),
    f("rate_time_ranges", "分时倍率规则", "json", {
        group: "高级配置",
        default: [],
        hint: "每项包含 start、end（HH:mm）和 rate",
    }),
    f("parent_id", "父节点 ID", "number", { group: "高级配置" }),
    f("ips", "限制 IP", "tags", { group: "高级配置" }),
    f("excludes", "排除列表", "tags", { group: "高级配置" }),
    f("code", "节点代码", "text", { group: "高级配置" }),
    f("spectific_key", "专用密钥", "password", { group: "高级配置" }),
];
