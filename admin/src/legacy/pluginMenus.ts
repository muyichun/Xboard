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

const pluginMenuIcons: Record<string, LucideIcon> = {
    dashboard: Gauge,
    "bar-chart-3": BarChart3,
    "credit-card": CreditCard,
    "file-text": FileText,
    package: Package,
    settings: Settings2,
    shield: Shield,
    users: Users,
};

export type PluginMenuDeclaration = {
    id?: string;
    title?: string;
    path?: string;
    description?: string;
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
                Icon: pluginMenuIcons[menu.icon || ""] || Settings2,
            },
        ];
    });
}
