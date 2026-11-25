import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import {
    pluginMenuIcons,
    pluginMenuItems,
    type PluginMenuDeclaration,
} from "../legacy/pluginMenus";

type DemoMenu = Required<PluginMenuDeclaration>;
const initialMenus: DemoMenu[] = [
    {
        id: "overview",
        title: "插件概览",
        path: "overview",
        icon: "dashboard",
        label: "",
    },
    {
        id: "reports",
        title: "流量报表",
        path: "reports",
        icon: "bar-chart-3",
        label: "",
    },
];
const fields = { title: "标题", path: "路径", label: "徽标" } as const;

export default function PluginMenuDemo() {
    const fieldPrefix = useId();
    const [menus, setMenus] = useState(initialMenus);
    const [nextId, setNextId] = useState(1);
    const preview = pluginMenuItems("traffic-analytics", menus);
    function update(id: string, fields: Partial<DemoMenu>) {
        setMenus((items) =>
            items.map((menu) =>
                menu.id === id ? { ...menu, ...fields } : menu,
            ),
        );
    }
    return (
        <div className="plugin-menu-demo">
            <section className="panel detail-body">
                <header className="plugin-menu-demo-heading">
                    <h2>菜单声明</h2>
                    <Button
                        variant="outline"
                        onClick={() => {
                            setMenus([
                                ...menus,
                                {
                                    id: `menu-${nextId}`,
                                    title: "",
                                    path: "",
                                    icon: "settings",
                                    label: "",
                                },
                            ]);
                            setNextId(nextId + 1);
                        }}
                    >
                        添加菜单
                    </Button>
                </header>
                {menus.map((menu, index) => (
                    <fieldset key={menu.id} className="plugin-menu-fields">
                        <legend>{menu.title || `菜单 ${index + 1}`}</legend>
                        {(Object.keys(fields) as (keyof typeof fields)[]).map(
                            (key) => (
                                <label
                                    key={key}
                                    htmlFor={`${fieldPrefix}-${menu.id}-${key}`}
                                >
                                    {fields[key]}
                                    <input
                                        id={`${fieldPrefix}-${menu.id}-${key}`}
                                        value={menu[key]}
                                        onChange={(e) =>
                                            update(menu.id, {
                                                [key]: e.target.value,
                                            })
                                        }
                                    />
                                </label>
                            ),
                        )}
                        <label htmlFor={`${fieldPrefix}-${menu.id}-icon`}>
                            图标
                            <select
                                id={`${fieldPrefix}-${menu.id}-icon`}
                                value={menu.icon}
                                onChange={(e) =>
                                    update(menu.id, { icon: e.target.value })
                                }
                            >
                                {Object.entries(pluginMenuIcons).map(
                                    ([key, spec]) => (
                                        <option key={key} value={key}>
                                            {spec.label}
                                        </option>
                                    ),
                                )}
                            </select>
                        </label>
                        <Button
                            variant="outline"
                            onClick={() =>
                                setMenus(
                                    menus.filter((item) => item.id !== menu.id),
                                )
                            }
                        >
                            移除菜单
                        </Button>
                    </fieldset>
                ))}
            </section>
            <section className="panel detail-body">
                <h2>侧栏预览</h2>
                {preview.length ? (
                    <ul className="plugin-menu-preview">
                        {preview.map(({ id, title, path, label, Icon }) => (
                            <li key={id}>
                                <span>
                                    <Icon size={16} /> {title}{" "}
                                    {label && <small>{label}</small>}
                                </span>
                                <code>{path}</code>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>还没有填写路径的菜单。</p>
                )}
                <Link
                    className="button button-outline"
                    to="/config/plugin/crud-demo"
                >
                    数据管理演示
                </Link>
            </section>
        </div>
    );
}
