import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Plus,
    Upload,
    Settings2,
    Package,
    Palette,
    CreditCard,
    MoreHorizontal,
} from "lucide-react";
import { request, client, settings } from "../lib/api";
import { rowsOf, errorMessage } from "../lib/utils";
import type { Row, Field } from "../lib/types";
import { SortDialog } from "../components/SortDialog";
import { Form } from "../components/Form";
import { dynamicFields, dynamicValues } from "../modules/settings";
import { f, required } from "../modules/fields";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { Loading, ErrorState, Notice, Empty } from "../components/Feedback";
import { DataView } from "../components/DataView";
export default function Extensions({
    kind,
}: {
    kind: "plugins" | "themes" | "payments";
}) {
    const [sorting, setSorting] = useState(false);
    const title = {
        plugins: "插件管理",
        themes: "主题管理",
        payments: "支付配置",
    }[kind];
    const qc = useQueryClient();
    const [edit, setEdit] = useState<{
            title: string;
            fields: Field[];
            values: Row;
            row: Row;
            mode: string;
        } | null>(null),
        [message, setMessage] = useState(""),
        [error, setError] = useState(""),
        [busy, setBusy] = useState(false),
        [result, setResult] = useState<any>(null);
    const upload = useRef<HTMLInputElement>(null);
    const endpoint = {
        plugins: "plugin/getPlugins",
        themes: "theme/getThemes",
        payments: "payment/fetch",
    }[kind];
    const q = useQuery({
        queryKey: ["extensions", kind],
        queryFn: () => request(endpoint),
    });
    const rows: Row[] =
        kind === "themes"
            ? Object.entries(q.data?.data?.themes || {}).map(([name, v]) => ({
                  ...(v as Row),
                  name,
              }))
            : rowsOf(q.data);
    async function refresh() {
        await qc.invalidateQueries({ queryKey: ["extensions"] });
        await qc.invalidateQueries({ queryKey: ["plugin-navigation"] });
    }
    async function command(endpoint: string, data: Row, label: string) {
        if (!window.confirm(`确认${label}？`)) return;
        setBusy(true);
        setError("");
        try {
            await request(endpoint, data, "post");
            setMessage(`${label}成功`);
            await refresh();
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    }
    async function configure(row: Row) {
        setBusy(true);
        setError("");
        try {
            if (kind === "plugins") {
                const schema = (
                    await request("plugin/config", { code: row.code })
                ).data;
                if (!Object.keys(schema || {}).length) {
                    setResult(
                        "此插件无需独立配置。支付插件请在「支付配置」中添加渠道。",
                    );
                    return;
                }
                setEdit({
                    title: `配置 ${row.name}`,
                    fields: dynamicFields(schema),
                    values: dynamicValues(schema),
                    row,
                    mode: "plugin",
                });
            } else if (kind === "themes") {
                const values = (
                    await request(
                        "theme/getThemeConfig",
                        { name: row.name },
                        "post",
                    )
                ).data;
                const fields: Field[] = (row.configs || []).map((c: Row) =>
                    f(
                        c.field_name,
                        c.label,
                        c.field_type === "textarea"
                            ? "textarea"
                            : c.field_type === "select"
                              ? "select"
                              : "text",
                        {
                            default: c.default_value,
                            hint: c.placeholder,
                            options: Object.entries(c.select_options || {}).map(
                                ([value, label]) => ({
                                    value,
                                    label: String(label),
                                }),
                            ),
                        },
                    ),
                );
                setEdit({
                    title: `配置 ${row.name}`,
                    fields,
                    values,
                    row,
                    mode: "theme",
                });
            } else {
                const schema = (
                    await request(
                        "payment/getPaymentForm",
                        { payment: row.payment, id: row.id },
                        "post",
                    )
                ).data;
                const fields = [
                    required("name", "支付名称"),
                    f("icon", "图标 URL"),
                    f("notify_domain", "通知域名"),
                    f("handling_fee_fixed", "固定手续费（元）", "money"),
                    f("handling_fee_percent", "比例手续费（%）", "number"),
                    ...dynamicFields(schema).map((f) => ({
                        ...f,
                        key: `config.${f.key}`,
                        group: "支付渠道参数",
                    })),
                ];
                setEdit({
                    title: row.id ? "编辑支付方式" : "添加支付方式",
                    fields,
                    values: {
                        ...row,
                        config: { ...dynamicValues(schema), ...row.config },
                    },
                    row,
                    mode: "payment",
                });
            }
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    }
    return (
        <>
            <header className="page-header">
                <div>
                    <div className="eyebrow">系统设置</div>
                    <h1>{title}</h1>
                    <p>
                        {kind === "plugins"
                            ? "管理功能扩展与动态配置"
                            : kind === "themes"
                              ? "管理用户端主题与个性化设置"
                              : "配置支付渠道、通知域名与手续费"}
                    </p>
                </div>
                {kind === "payments" ? (
                    <div className="header-actions">
                        <Button
                            variant="outline"
                            onClick={() => setSorting(true)}
                            disabled={!rows.length}
                        >
                            调整排序
                        </Button>
                        <Button
                            onClick={async () => {
                                try {
                                    const r = await request(
                                        "payment/getPaymentMethods",
                                    );
                                    setEdit({
                                        title: "选择支付渠道",
                                        fields: [
                                            f("payment", "支付渠道", "select", {
                                                required: true,
                                                options: (r.data || []).map(
                                                    (s: string) => ({
                                                        value: s,
                                                        label: s,
                                                    }),
                                                ),
                                            }),
                                        ],
                                        values: {},
                                        row: {},
                                        mode: "choose",
                                    });
                                } catch (e) {
                                    setError(errorMessage(e));
                                }
                            }}
                        >
                            <Plus size={16} />
                            添加支付方式
                        </Button>
                    </div>
                ) : (
                    <>
                        <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => upload.current?.click()}
                        >
                            <Upload size={16} />
                            上传{kind === "plugins" ? "插件" : "主题"}
                        </Button>
                        <input
                            hidden
                            ref={upload}
                            type="file"
                            accept=".zip"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                if (file.size > 10 * 1024 ** 2) {
                                    setError("ZIP 文件不能超过 10 MB");
                                    return;
                                }
                                setBusy(true);
                                try {
                                    const data = new FormData();
                                    data.append("file", file);
                                    await client.post(
                                        `${settings.secure_path}/${kind === "plugins" ? "plugin" : "theme"}/upload`,
                                        data,
                                    );
                                    setMessage("上传成功");
                                    await refresh();
                                } catch (e) {
                                    setError(errorMessage(e));
                                } finally {
                                    setBusy(false);
                                    e.target.value = "";
                                }
                            }}
                        />
                    </>
                )}
            </header>
            <Notice message={message} />
            <Notice message={error} error />
            {q.isPending ? (
                <Loading />
            ) : q.isError ? (
                <ErrorState
                    message={errorMessage(q.error)}
                    retry={() => q.refetch()}
                />
            ) : rows.length === 0 ? (
                <section className="panel">
                    <Empty />
                </section>
            ) : (
                <div className="extension-grid">
                    {rows.map((row) => (
                        <article
                            className="panel extension-card"
                            key={row.code || row.id || row.name}
                        >
                            <header>
                                <div className="extension-icon">
                                    {kind === "plugins" ? (
                                        <Package />
                                    ) : kind === "themes" ? (
                                        <Palette />
                                    ) : (
                                        <CreditCard />
                                    )}
                                </div>
                                <div>
                                    <h2>{row.name}</h2>
                                    <small>
                                        {row.version || row.payment || row.code}
                                    </small>
                                </div>
                                <span
                                    className={`badge ${kind === "plugins" ? (row.is_enabled ? "" : "badge-muted") : kind === "themes" ? (q.data?.data?.active === row.name ? "" : "badge-muted") : row.enable ? "" : "badge-muted"}`}
                                >
                                    {kind === "plugins"
                                        ? row.is_enabled
                                            ? "已启用"
                                            : row.is_installed
                                              ? "已安装"
                                              : "未安装"
                                        : kind === "themes"
                                          ? q.data?.data?.active === row.name
                                              ? "使用中"
                                              : "可用"
                                          : row.enable
                                            ? "已启用"
                                            : "已停用"}
                                </span>
                            </header>
                            <p>
                                {row.description ||
                                    "管理此项目的配置与运行状态"}
                            </p>
                            <footer>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={
                                        busy ||
                                        (kind === "plugins" &&
                                            !row.is_installed)
                                    }
                                    onClick={() => configure(row)}
                                >
                                    <Settings2 size={15} />
                                    配置
                                </Button>
                                {kind === "plugins" ? (
                                    <>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={busy}
                                            onClick={() =>
                                                command(
                                                    `plugin/${row.is_installed ? (row.is_enabled ? "disable" : "enable") : "install"}`,
                                                    { code: row.code },
                                                    row.is_installed
                                                        ? row.is_enabled
                                                            ? "停用插件"
                                                            : "启用插件"
                                                        : "安装插件",
                                                )
                                            }
                                        >
                                            {row.is_installed
                                                ? row.is_enabled
                                                    ? "停用"
                                                    : "启用"
                                                : "安装"}
                                        </Button>
                                        <details className="row-menu">
                                            <summary>
                                                <MoreHorizontal size={18} />
                                            </summary>
                                            <div>
                                                {row.need_upgrade && (
                                                    <button
                                                        onClick={() =>
                                                            command(
                                                                "plugin/upgrade",
                                                                {
                                                                    code: row.code,
                                                                },
                                                                "升级插件",
                                                            )
                                                        }
                                                    >
                                                        升级
                                                    </button>
                                                )}
                                                {row.is_installed &&
                                                    !row.is_enabled && (
                                                        <button
                                                            onClick={() =>
                                                                command(
                                                                    "plugin/uninstall",
                                                                    {
                                                                        code: row.code,
                                                                    },
                                                                    "卸载插件",
                                                                )
                                                            }
                                                        >
                                                            卸载
                                                        </button>
                                                    )}
                                                {row.can_be_deleted && (
                                                    <button
                                                        className="error"
                                                        onClick={() =>
                                                            command(
                                                                "plugin/delete",
                                                                {
                                                                    code: row.code,
                                                                },
                                                                "删除插件",
                                                            )
                                                        }
                                                    >
                                                        删除
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() =>
                                                        setResult(
                                                            row.readme ||
                                                                "暂无说明",
                                                        )
                                                    }
                                                >
                                                    使用说明
                                                </button>
                                            </div>
                                        </details>
                                    </>
                                ) : kind === "themes" ? (
                                    <>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={
                                                q.data?.data?.active ===
                                                    row.name || busy
                                            }
                                            onClick={() =>
                                                command(
                                                    "config/save",
                                                    {
                                                        frontend_theme:
                                                            row.name,
                                                    },
                                                    "切换用户端主题",
                                                )
                                            }
                                        >
                                            使用主题
                                        </Button>
                                        {row.can_delete && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    command(
                                                        "theme/delete",
                                                        { name: row.name },
                                                        "删除主题",
                                                    )
                                                }
                                            >
                                                删除
                                            </Button>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                                command(
                                                    "payment/show",
                                                    { id: row.id },
                                                    "切换支付状态",
                                                )
                                            }
                                        >
                                            {row.enable ? "停用" : "启用"}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                                setResult({
                                                    notify_url: row.notify_url,
                                                })
                                            }
                                        >
                                            回调地址
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                                command(
                                                    "payment/drop",
                                                    { id: row.id },
                                                    "删除支付方式",
                                                )
                                            }
                                        >
                                            删除
                                        </Button>
                                    </>
                                )}
                            </footer>
                        </article>
                    ))}
                </div>
            )}
            {sorting && (
                <SortDialog
                    rows={rows}
                    onClose={() => setSorting(false)}
                    onSave={async (order) => {
                        await request(
                            "payment/sort",
                            { ids: order.map((r) => r.id) },
                            "post",
                        );
                        await refresh();
                    }}
                />
            )}
            <Dialog
                open={!!edit}
                onClose={() => setEdit(null)}
                title={edit?.title || "配置"}
                wide
            >
                {edit && (
                    <Form
                        key={`${edit.mode}-${edit.row.code || edit.row.id || edit.row.name}`}
                        fields={edit.fields}
                        seed={edit.values}
                        onCancel={() => setEdit(null)}
                        onSubmit={async (v) => {
                            if (edit.mode === "choose") {
                                await configure(v);
                                return;
                            }
                            if (edit.mode === "plugin")
                                await request(
                                    "plugin/config",
                                    { code: edit.row.code, config: v },
                                    "post",
                                );
                            if (edit.mode === "theme")
                                await request(
                                    "theme/saveThemeConfig",
                                    { name: edit.row.name, config: v },
                                    "post",
                                );
                            if (edit.mode === "payment")
                                await request(
                                    "payment/save",
                                    {
                                        ...v,
                                        payment: edit.row.payment,
                                        ...(edit.row.id
                                            ? { id: edit.row.id }
                                            : {}),
                                        config: {
                                            ...edit.row.config,
                                            ...v.config,
                                        },
                                    },
                                    "post",
                                );
                            setEdit(null);
                            setMessage("配置已保存");
                            await refresh();
                        }}
                    />
                )}
            </Dialog>
            <Dialog
                open={result !== null}
                onClose={() => setResult(null)}
                title="详细信息"
                wide
            >
                <div className="detail-body">
                    <DataView data={result} />
                </div>
            </Dialog>
        </>
    );
}
