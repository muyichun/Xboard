import type { Field, Row } from "../lib/types";
import { f, select, resetMethods } from "./fields";
export const configGroups: Row = {
    site: "站点设置",
    safe: "安全设置",
    subscribe: "订阅设置",
    invite: "邀请与佣金",
    server: "节点通信",
    email: "邮件服务",
    telegram: "Telegram",
    app: "客户端版本",
    frontend: "用户端外观",
    subscribe_template: "订阅模板",
};
const labels: Row = {
    logo: "站点标志 URL",
    force_https: "强制 HTTPS",
    stop_register: "关闭新用户注册",
    app_name: "站点名称",
    app_description: "站点描述",
    app_url: "站点网址",
    subscribe_url: "订阅域名",
    try_out_plan_id: "注册试用套餐",
    try_out_hour: "试用时长（小时）",
    tos_url: "服务条款 URL",
    currency: "货币代码",
    currency_symbol: "货币符号",
    ticket_must_wait_reply: "工单等待回复限制",
    plan_change_enable: "允许更换套餐",
    reset_traffic_method: "流量重置方式",
    surplus_enable: "开启套餐折抵",
    new_order_event_id: "新购触发事件",
    renew_order_event_id: "续费触发事件",
    change_order_event_id: "更换套餐触发事件",
    show_info_to_server_enable: "订阅中展示账户信息",
    show_protocol_to_server_enable: "节点名显示协议",
    default_remind_expire: "默认到期提醒",
    default_remind_traffic: "默认流量提醒",
    subscribe_path: "订阅路径",
    frontend_theme: "用户端主题",
    frontend_theme_sidebar: "侧边栏外观",
    frontend_theme_header: "页头外观",
    frontend_theme_color: "主题颜色",
    frontend_background_url: "背景图片 URL",
    admin_ui: "默认管理端",
    server_token: "节点通信密钥",
    server_pull_interval: "拉取间隔（秒）",
    server_push_interval: "推送间隔（秒）",
    device_limit_mode: "设备限制模式",
    server_ws_enable: "启用 WebSocket",
    server_ws_url: "WebSocket 地址",
    email_host: "SMTP 主机",
    email_port: "SMTP 端口",
    email_username: "SMTP 用户名",
    email_password: "SMTP 密码",
    email_encryption: "加密方式",
    email_from_address: "发件邮箱",
    remind_mail_enable: "启用提醒邮件",
    telegram_bot_enable: "显示 Telegram 绑定引导",
    telegram_bot_token: "机器人 Token",
    telegram_webhook_url: "Webhook 基础地址",
    telegram_discuss_link: "群组链接",
    email_verify: "注册验证邮箱",
    safe_mode_enable: "仅允许站点域名访问",
    secure_path: "后台安全路径",
    email_whitelist_enable: "启用邮箱后缀白名单",
    email_whitelist_suffix: "允许的邮箱后缀",
    email_gmail_limit_enable: "限制 Gmail 别名注册",
    captcha_enable: "启用人机验证",
    captcha_type: "验证码服务",
    recaptcha_enable: "启用 reCAPTCHA",
    recaptcha_key: "reCAPTCHA 私钥",
    recaptcha_site_key: "reCAPTCHA 站点密钥",
    recaptcha_v3_secret_key: "reCAPTCHA v3 私钥",
    recaptcha_v3_site_key: "reCAPTCHA v3 站点密钥",
    recaptcha_v3_score_threshold: "reCAPTCHA v3 分数阈值",
    turnstile_secret_key: "Turnstile 私钥",
    turnstile_site_key: "Turnstile 站点密钥",
    register_limit_by_ip_enable: "限制同 IP 注册",
    register_limit_count: "注册次数上限",
    register_limit_expire: "注册限制时长（分钟）",
    password_limit_enable: "限制密码错误次数",
    password_limit_count: "密码错误次数上限",
    password_limit_expire: "密码锁定时长（分钟）",
    invite_force: "必须使用邀请码注册",
    invite_commission: "默认佣金比例（%）",
    invite_gen_limit: "每人邀请码上限",
    invite_never_expire: "邀请码永久有效",
    commission_first_time_enable: "仅首次购买发佣金",
    commission_auto_check_enable: "自动确认佣金",
    commission_withdraw_limit: "最低提现金额（元）",
    commission_withdraw_method: "提现方式",
    withdraw_close_enable: "关闭提现",
    commission_distribution_enable: "启用三级分佣",
    commission_distribution_l1: "一级佣金比例（%）",
    commission_distribution_l2: "二级佣金比例（%）",
    commission_distribution_l3: "三级佣金比例（%）",
};
for (const os of ["windows", "macos", "android"]) {
    labels[`${os}_version`] =
        `${os === "macos" ? "macOS" : os === "windows" ? "Windows" : "Android"} 版本`;
    labels[`${os}_download_url`] =
        `${os === "macos" ? "macOS" : os === "windows" ? "Windows" : "Android"} 下载地址`;
}
const templateNames: Record<string, string> = {
    singbox: "Sing-box",
    clash: "Clash",
    clashmeta: "Clash Meta",
    stash: "Stash",
    surge: "Surge",
    surfboard: "Surfboard",
};

export function configFields(group: string, values: Row): Field[] {
    return Object.entries(values).map(([key, value]) => {
        if (key.startsWith("subscribe_template_")) {
            const template = key.slice("subscribe_template_".length);
            return f(
                key,
                templateNames[template] || template.toUpperCase(),
                "code",
            );
        }
        const label = labels[key] || key.toUpperCase();
        if (key === "try_out_plan_id")
            return f(key, label, "select", {
                source: "plans",
                options: [{ value: 0, label: "不启用试用" }],
            });
        if (key === "reset_traffic_method")
            return select(key, label, resetMethods);
        if (key.endsWith("_event_id"))
            return select(key, label, { "0": "不执行", "1": "重置流量" });
        if (key === "admin_ui")
            return select(key, label, {
                legacy: "原管理端",
                next: "新版管理端",
            });
        if (key === "captcha_type")
            return select(key, label, {
                recaptcha: "reCAPTCHA v2",
                "recaptcha-v3": "reCAPTCHA v3",
                turnstile: "Cloudflare Turnstile",
            });
        if (key === "device_limit_mode")
            return select(key, label, { "0": "宽松模式", "1": "严格模式" });
        if (["frontend_theme_sidebar", "frontend_theme_header"].includes(key))
            return select(key, label, { light: "浅色", dark: "深色" });
        if (key === "frontend_theme_color")
            return select(key, label, {
                default: "默认",
                darkblue: "深蓝",
                black: "黑色",
                green: "绿色",
            });
        if (key === "email_encryption")
            return select(key, label, { ssl: "SSL", tls: "TLS", "": "不加密" });
        if (
            [
                "show_info_to_server_enable",
                "show_protocol_to_server_enable",
                "telegram_bot_enable",
            ].includes(key)
        )
            return f(key, label, "visibility");
        if (Array.isArray(value)) return f(key, label, "tags");
        if (
            typeof value === "boolean" ||
            key.endsWith("_enable") ||
            [
                "stop_register",
                "force_https",
                "invite_force",
                "invite_never_expire",
            ].includes(key)
        )
            return f(key, label, "boolean");
        if (
            (key.includes("password") && !key.includes("limit")) ||
            key.endsWith("_token") ||
            key.includes("secret_key") ||
            key === "recaptcha_key"
        )
            return f(key, label, "password", { hint: "留空保持已有值" });
        if (
            typeof value === "number" ||
            /_interval$|_port$|_limit$|_count$|_hour$|_expire$|_commission$|_l[123]$/.test(
                key,
            )
        )
            return f(key, label, "number");
        return f(
            key,
            label,
            key === "app_description" ? "textarea" : "text",
            key === "secure_path"
                ? {
                      hint: "至少 8 位，仅字母、数字、下划线和连字符；修改后需重新加载应用路由",
                  }
                : {},
        );
    });
}
export function dynamicFields(schema: Row): Field[] {
    return Object.entries(schema || {}).map(([key, v]) =>
        f(
            key,
            v.label || key,
            v.type === "boolean"
                ? "boolean"
                : v.type === "number" || v.type === "percentage"
                  ? "number"
                  : v.type === "select"
                    ? "select"
                    : ["yaml", "json"].includes(v.type)
                      ? "code"
                      : v.type === "text"
                        ? "textarea"
                        : v.type === "password"
                          ? "password"
                          : "text",
            {
                language: v.type === "json" ? "json" : "yaml",
                required: !!v.required,
                hint: v.description,
                default:
                    ["json", "yaml"].includes(v.type) &&
                    typeof v.value === "object"
                        ? JSON.stringify(v.value, null, 2)
                        : v.value,
                options: Array.isArray(v.options)
                    ? v.options
                    : Object.entries(v.options || {}).map(([value, label]) => ({
                          value,
                          label: String(label),
                      })),
            },
        ),
    );
}
export const dynamicValues = (schema: Row) =>
    Object.fromEntries(
        Object.entries(schema || {}).map(([k, v]) => [
            k,
            ["json", "yaml"].includes(v.type) && typeof v.value === "object"
                ? JSON.stringify(v.value, null, 2)
                : (v.value ?? ""),
        ]),
    );
