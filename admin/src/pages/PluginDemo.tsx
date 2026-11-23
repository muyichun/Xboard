import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { Form } from "../components/Form";
import { DataTable } from "../components/DataTable";
import { required, f } from "../modules/fields";
import type { Row } from "../lib/types";
export default function PluginDemo() {
    const crud = useLocation().pathname.endsWith("crud-demo");
    const [rows, setRows] = useState<Row[]>([
            { id: 1, name: "示例项目", enabled: true },
        ]),
        [edit, setEdit] = useState<Row | null>(null),
        [search, setSearch] = useState("");
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
                        rows={rows.filter((r) => r.name.includes(search))}
                        columns={[
                            { key: "id", label: "ID" },
                            { key: "name", label: "名称" },
                            {
                                key: "enabled",
                                label: "启用",
                                format: "boolean",
                            },
                        ]}
                        onSort={(key) => setRows([...rows].reverse())}
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
                <div className="panel detail-body">
                    <h2>插件菜单</h2>
                    <p>
                        已安装并启用插件声明的管理菜单显示在左侧“插件应用”中。菜单可以连接概览、配置和数据管理页面。
                    </p>
                    <div className="toolbar">
                        <Link
                            className="button button-outline"
                            to="/config/plugin"
                        >
                            插件概览与配置
                        </Link>
                        <Link
                            className="button button-outline"
                            to="/config/plugin/crud-demo"
                        >
                            数据管理演示
                        </Link>
                    </div>
                </div>
            )}
        </>
    );
}
