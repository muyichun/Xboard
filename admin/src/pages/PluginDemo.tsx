import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { Form } from "../components/Form";
import { DataTable } from "../components/DataTable";
import { required, f } from "../modules/fields";
import type { Row } from "../lib/types";
import PluginMenuDemo from "./PluginMenuDemo";
export default function PluginDemo() {
    const crud = useLocation().pathname.endsWith("crud-demo");
    const [rows, setRows] = useState<Row[]>([
            { id: 1, name: "示例项目", enabled: true },
        ]),
        [edit, setEdit] = useState<Row | null>(null),
        [search, setSearch] = useState(""),
        [sort, setSort] = useState<{ key: string; desc: boolean } | null>(null);
    const visible = rows.filter((r) => r.name.includes(search));
    if (sort)
        visible.sort((a, b) => {
            const lhs = a[sort.key],
                rhs = b[sort.key];
            const order =
                typeof lhs === "string"
                    ? lhs.localeCompare(rhs, "zh-CN")
                    : Number(lhs) - Number(rhs);
            return sort.desc ? -order : order;
        });
    return (
        <>
            <header className="page-header">
                <div>
                    <h1>{crud ? "CRUD Demo" : "Menu Demo"}</h1>
                    <p>
                        插件{crud ? "数据管理" : "菜单"}
                        演示；示例数据仅保存在当前页面，不影响业务数据。
                    </p>
                </div>
                <Link className="button button-outline" to="/config/plugin">
                    返回插件管理
                </Link>
            </header>
            {crud ? (
                <>
                    <div className="toolbar">
                        <input
                            aria-label="搜索示例"
                            placeholder="搜索名称"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <Button onClick={() => setEdit({})}>新增</Button>
                    </div>
                    <DataTable
                        rows={visible}
                        columns={[
                            { key: "id", label: "ID" },
                            { key: "name", label: "名称" },
                            {
                                key: "enabled",
                                label: "启用",
                                format: "boolean",
                            },
                        ]}
                        sort={sort}
                        onSort={(key) =>
                            setSort({
                                key,
                                desc: sort?.key === key && !sort.desc,
                            })
                        }
                        actions={(r) => (
                            <>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setEdit(r)}
                                >
                                    编辑
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                        if (window.confirm("删除此演示记录？"))
                                            setRows(
                                                rows.filter(
                                                    (x) => x.id !== r.id,
                                                ),
                                            );
                                    }}
                                >
                                    删除
                                </Button>
                            </>
                        )}
                    />
                    <Dialog
                        open={!!edit}
                        onClose={() => setEdit(null)}
                        title={edit?.id ? "编辑示例" : "新增示例"}
                    >
                        {edit && (
                            <Form
                                seed={edit}
                                fields={[
                                    required("name", "名称"),
                                    f("enabled", "启用", "boolean", {
                                        default: true,
                                    }),
                                ]}
                                onCancel={() => setEdit(null)}
                                onSubmit={async (v) => {
                                    setRows(
                                        edit.id
                                            ? rows.map((r) =>
                                                  r.id === edit.id
                                                      ? { ...v, id: edit.id }
                                                      : r,
                                              )
                                            : [
                                                  ...rows,
                                                  { ...v, id: Date.now() },
                                              ],
                                    );
                                    setEdit(null);
                                }}
                            />
                        )}
                    </Dialog>
                </>
            ) : (
                <PluginMenuDemo />
            )}
        </>
    );
}
