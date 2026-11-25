import {
    BarChart3,
    CreditCard,
    FileText,
    Gauge,
    Package,
    Settings2,
    Shield,
    Users,
    type LucideIcon,
} from "lucide-react";

export const pluginMenuIcons: Record<
    string,
    { label: string; icon: LucideIcon }
> = {
    dashboard: { label: "仪表盘", icon: Gauge },
    "bar-chart-3": { label: "图表", icon: BarChart3 },
    "credit-card": { label: "支付", icon: CreditCard },
    "file-text": { label: "文档", icon: FileText },
    package: { label: "组件", icon: Package },
    settings: { label: "设置", icon: Settings2 },
    shield: { label: "安全", icon: Shield },
    users: { label: "用户", icon: Users },
};

export type PluginMenuDeclaration = {
    id?: string;
    title?: string;
    path?: string;
    icon?: string;
    label?: string;
};

export function normalizePluginPath(path?: string) {
    return path?.trim().replace(/^\/+|\/+$/g, "") || "";
}

export function pluginMenuItems(
    code: string,
    declarations: PluginMenuDeclaration[],
) {
    return declarations.flatMap((menu) => {
        const segment = normalizePluginPath(menu.path);
        if (!segment) return [];
        const path = `/plugins/${code}/${segment}`;
        return [
            {
                id: `${code}:${menu.id || segment}`,
                path,
                title: menu.title?.trim() || segment,
                label: menu.label,
                Icon: pluginMenuIcons[menu.icon || ""]?.icon || Settings2,
            },
        ];
    });
}
