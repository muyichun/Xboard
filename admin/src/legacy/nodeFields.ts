import type { Field, Row } from "../lib/types";
import { f, select, nodeFields as original } from "../modules/fields";
const tlsTypes = ["vmess", "vless", "trojan", "socks", "http", "naive"];
const directTls = ["hysteria", "tuic", "anytls"];
const p = (
    types: string[],
    key: string,
    label: string,
    kind: Field["kind"] = "text",
    extra: Partial<Field> = {},
): Field =>
    f(`protocol_settings.${key}`, label, kind, {
        group: "协议配置",
        ...extra,
        show: (v) => types.includes(v.type) && (!extra.show || extra.show(v)),
    });
const options = (items: string[]) =>
    items.map((value) => ({ value, label: value }));
const removed = [
    "tls_settings",
    "reality_settings",
    "tls",
    "bandwidth",
    "obfs",
    "multiplex",
    "utls",
    "congestion_control",
];
export const legacyNodeFields: Field[] = original
    .filter(
        (x) =>
            !removed.some(
                (key) =>
                    x.key === `protocol_settings.${key}` && x.kind === "json",
            ) &&
            ![
                "show",
                "cert_config",
                "parent_id",
                "protocol_settings.congestion_control",
                "protocol_settings.padding_scheme",
                "rate_time_ranges",
                "rate_time_enable",
            ].includes(x.key),
    )
    .map((x) =>
        x.key === "protocol_settings.version" &&
        x.options?.some((o) => String(o.value) === "5")
            ? { ...x, options: options(["4", "5"]) }
            : x,
    );
legacyNodeFields.push(
    f("parent_id", "父节点", "select", {
        group: "基本信息",
        hint: "子节点的倍率跟随父节点",
    }),
    p(["shadowsocks"], "plugin", "插件", "select", {
        default: "",
        options: options([
            "",
            "obfs",
            "v2ray-plugin",
            "gost-plugin",
            "shadow-tls",
            "restls",
            "kcptun",
        ]),
    }),
    p(["shadowsocks"], "plugin_opts", "插件选项", "text", {
        show: (v) => !!v.protocol_settings?.plugin,
    }),
    p(["shadowsocks"], "tls.fingerprint", "TLS 指纹", "select", {
        options: options([
            "chrome",
            "firefox",
            "safari",
            "ios",
            "android",
            "random",
            "randomized",
        ]),
        show: (v) =>
            ["shadow-tls", "restls"].includes(v.protocol_settings?.plugin),
    }),
    p(["vmess", "vless", "trojan"], "utls.enabled", "启用 uTLS", "boolean"),
    p(["vmess", "vless", "trojan"], "utls.fingerprint", "uTLS 指纹", "select", {
        default: "chrome",
        options: options([
            "chrome",
            "firefox",
            "safari",
            "ios",
            "android",
            "edge",
            "360",
            "qq",
            "random",
            "randomized",
        ]),
        show: (v) => !!v.protocol_settings?.utls?.enabled,
    }),
    p(["tuic"], "congestion_control", "拥塞控制", "select", {
        default: "bbr",
        options: options(["bbr", "cubic", "new_reno"]),
    }),
    p(["tuic"], "udp_relay_mode", "UDP 中继模式", "select", {
        default: "native",
        options: options(["native", "quic"]),
    }),
    p(["hysteria"], "alpn", "ALPN", "tags", {
        show: (v) => Number(v.protocol_settings?.version) === 1,
    }),
    p(["hysteria"], "bandwidth.up", "上行带宽 (Mbps)", "number", {
        min: 0,
        hint: "留空使用 BBR",
    }),
    p(["hysteria"], "bandwidth.down", "下行带宽 (Mbps)", "number", {
        min: 0,
        hint: "留空使用 BBR",
    }),
    p(["hysteria"], "obfs.open", "启用混淆", "boolean"),
    p(["hysteria"], "obfs.type", "混淆类型", "text", {
        default: "salamander",
        show: (v) => !!v.protocol_settings?.obfs?.open,
    }),
    p(["hysteria"], "obfs.password", "混淆密码", "text", {
        show: (v) => !!v.protocol_settings?.obfs?.open,
    }),
    p(["anytls"], "padding_scheme", "填充方案", "lines", {
        hint: "每行一条规则，规则内逗号会完整保留",
    }),
    p(["mieru"], "traffic_pattern", "Traffic Pattern (Base64)"),
    f("rate_time_enable", "分时倍率", "boolean", { group: "分时倍率" }),
    f("rate_time_ranges", "时间段规则", "time-ranges", {
        default: [],
        group: "分时倍率",
        show: (v) => !!v.rate_time_enable,
    }),
);
// TLS object names differ between protocols; keep their wire representation intact.
for (const [types, prefix] of [
    [tlsTypes, "tls_settings"],
    [directTls, "tls"],
] as [string[], string][]) {
    const visible = (v: Row) =>
        prefix === "tls" || Number(v.protocol_settings?.tls) === 1;
    legacyNodeFields.push(
        p(types, `${prefix}.server_name`, "TLS SNI", "text", { show: visible }),
        p(types, `${prefix}.allow_insecure`, "允许不安全证书", "boolean", {
            show: visible,
        }),
        p(types, `${prefix}.ech.enabled`, "启用 ECH", "boolean", {
            show: visible,
        }),
    );
    for (const [key, label, kind] of [
        ["config", "ECH 配置", "textarea"],
        ["key", "ECH 密钥", "textarea"],
        ["query_server_name", "ECH 查询域名", "text"],
    ] as const)
        legacyNodeFields.push(
            p(types, `${prefix}.ech.${key}`, label, kind, {
                show: (v) =>
                    visible(v) && !!v.protocol_settings?.[prefix]?.ech?.enabled,
            }),
        );
}
for (const [key, label, kind, defaultValue] of [
    ["server_name", "Reality 目标域名", "text", ""],
    ["server_port", "Reality 目标端口", "number", 443],
    ["private_key", "Reality 私钥", "text", ""],
    ["public_key", "Reality 公钥", "text", ""],
    ["short_id", "Short ID", "text", ""],
    ["allow_insecure", "允许不安全证书", "boolean", false],
] as const)
    legacyNodeFields.push(
        p(["vless", "trojan"], `reality_settings.${key}`, label, kind, {
            default: defaultValue,
            show: (v) => Number(v.protocol_settings?.tls) === 2,
        }),
    );
for (const [key, label, kind, defaultValue] of [
    ["enabled", "启用多路复用", "boolean", false],
    ["protocol", "协议", "select", "smux"],
    ["max_connections", "最大连接数", "number", 4],
    ["padding", "启用填充", "boolean", false],
    ["brutal.enabled", "启用 TCP Brutal", "boolean", false],
    ["brutal.up_mbps", "Brutal 上行 (Mbps)", "number", 100],
    ["brutal.down_mbps", "Brutal 下行 (Mbps)", "number", 100],
] as const)
    legacyNodeFields.push(
        p(
            ["vmess", "vless", "trojan", "mieru"],
            `multiplex.${key}`,
            label,
            kind,
            {
                group: "多路复用",
                default: defaultValue,
                options:
                    key === "protocol"
                        ? options(["smux", "yamux", "h2mux"])
                        : undefined,
                show: (v) =>
                    key === "enabled" ||
                    !!v.protocol_settings?.multiplex?.enabled,
            },
        ),
    );
legacyNodeFields.push(
    select(
        "cert_config.cert_mode",
        "证书模式",
        {
            none: "不管理证书",
            self: "自签证书",
            http: "HTTP-01 自动申请",
            dns: "DNS-01 自动申请",
            content: "推送证书内容",
        },
        { group: "TLS 证书", default: "none" },
    ),
);
for (const [key, label, kind, modes] of [
    ["domain", "域名", "text", ["http", "dns", "self", "content"]],
    ["email", "证书申请邮箱", "text", ["http", "dns"]],
    ["http_port", "HTTP 验证端口", "number", ["http"]],
    ["dns_provider", "DNS 服务商", "text", ["dns"]],
    ["dns_env", "DNS 环境变量", "env", ["dns"]],
    ["cert_content", "证书内容", "textarea", ["content"]],
    ["key_content", "私钥内容", "textarea", ["content"]],
] as [string, string, Field["kind"], string[]][])
    legacyNodeFields.push(
        f(`cert_config.${key}`, label, kind, {
            group: "TLS 证书",
            show: (v) => modes.includes(v.cert_config?.cert_mode),
            hint:
                key === "dns_env"
                    ? "每行 KEY=VALUE，可参考 DNS 服务商的凭证文档"
                    : undefined,
        }),
    );
