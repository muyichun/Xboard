import {
    Gauge,
    Settings,
    SlidersHorizontal,
    Blocks,
    Monitor,
    Newspaper,
    CreditCard,
    FileText,
    Server,
    ServerCog,
    LockKeyhole,
    Route,
    WalletCards,
    Package,
    TicketPercent,
    Gift,
    Users,
    MessagesSquare,
    History,
} from "lucide-react";
export const paths: Record<string, string> = {
    dashboard: "/",
    settings: "/config/system",
    plugins: "/config/plugin",
    themes: "/config/theme",
    notices: "/config/notice",
    payments: "/config/payment",
    knowledge: "/config/knowledge",
    machines: "/server/machine",
    nodes: "/server/manage",
    groups: "/server/group",
    routes: "/server/route",
    plans: "/finance/plan",
    orders: "/finance/order",
    coupons: "/finance/coupon",
    gifts: "/finance/gift-card",
    users: "/user/manage",
    tickets: "/user/ticket",
    traffic: "/user/traffic-reset-logs",
    reports: "/reports",
    system: "/system",
    mail: "/config/system/email/templates",
    audit: "/audit",
};
export const navigation = [
    { title: "仪表盘", id: "dashboard", icon: Gauge },
    {
        title: "系统管理",
        icon: Settings,
        children: [
            ["settings", "系统配置", SlidersHorizontal],
            ["plugins", "插件管理", Blocks],
            ["themes", "主题配置", Monitor],
            ["notices", "公告管理", Newspaper],
            ["payments", "支付配置", CreditCard],
            ["knowledge", "知识库管理", FileText],
        ],
    },
    {
        title: "节点管理",
        icon: Server,
        children: [
            ["machines", "服务器管理", ServerCog],
            ["nodes", "节点管理", ServerCog],
            ["groups", "权限组管理", LockKeyhole],
            ["routes", "路由管理", Route],
        ],
    },
    {
        title: "订阅管理",
        icon: WalletCards,
        children: [
            ["plans", "套餐管理", Package],
            ["orders", "订单管理", CreditCard],
            ["coupons", "优惠券管理", TicketPercent],
            ["gifts", "礼品卡管理", Gift],
        ],
    },
    {
        title: "用户管理",
        icon: Users,
        children: [
            ["users", "用户管理", Users],
            ["tickets", "工单管理", MessagesSquare],
            ["traffic", "流量重置日志", History],
        ],
    },
] as const;
export const pageLinks = navigation.flatMap<{
    id: string;
    title: string;
    icon: typeof Gauge;
    path: string;
}>((g) =>
    "children" in g
        ? g.children.map(([id, title, icon]) => ({
              id,
              title,
              icon,
              path: paths[id],
          }))
        : [{ id: g.id, title: g.title, icon: g.icon, path: paths[g.id] }],
);
