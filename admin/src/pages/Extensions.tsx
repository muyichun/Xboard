import { useRowToggle } from "../lib/useRowToggle";
import { Link } from "react-router-dom";
import { DataTable, Pagination } from "../components/DataTable";
import { Value } from "../components/Value";
import { Copy, Switch } from "../legacy/Cells";
import { MarkdownView } from "../components/Markdown";
import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Plus,
    Upload,
    Settings2,
    Package,
    Palette,
    CreditCard,
    BookOpen,
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
    const [search, setSearch] = useState(""),
        [pluginType, setPluginType] = useState("all"),
        [installStatus, setInstallStatus] = useState("all"),
        [pictures, setPictures] = useState<string[]>([]),
        [picture, setPicture] = useState(0);
    const [paymentPage, setPaymentPage] = useState(1);
    const [paymentPageSize, setPaymentPageSize] = useState(10);
    const [paymentIdDesc, setPaymentIdDesc] = useState<boolean | null>(null);
    const draft = useRef<Row>({});
    const methods = useQuery({
        queryKey: ["payment-methods"],
        queryFn: () => request("payment/getPaymentMethods"),
        enabled: kind === "payments",
    });
    const types = useQuery({
        queryKey: ["plugin-types"],
        queryFn: () => request("plugin/types"),
        enabled: kind === "plugins",
    });
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
    const visibleRows = rows.filter(
        (row) =>
            `${row.name} ${row.description || ""} ${row.code || row.payment || ""}`
                .toLowerCase()
                .includes(search.toLowerCase()) &&
            (kind !== "plugins" ||
                ((pluginType === "all" || row.type === pluginType) &&
                    (installStatus === "all" ||
                        (installStatus === "installed" && row.is_installed) ||
                        (installStatus === "available" && !row.is_installed)))),
    );
    const currentPage = Math.min(
        paymentPage,
        Math.max(1, Math.ceil(visibleRows.length / paymentPageSize)),
    );
    if (kind === "payments" && paymentIdDesc != null)
        visibleRows.sort((a, b) => (paymentIdDesc ? b.id - a.id : a.id - b.id));
    const previewTheme = (row: Row) => {
        setPicture(0);
        setPictures(
            (row.images || row.screenshots || [])
                .map((image: any) =>
                    typeof image === "string" ? image : image.url,
                )
                .filter(Boolean),
        );
    };
    const { toggle, pendingIds } = useRowToggle(
        "payments",
        async ({ id, value }) => {
            await request("payment/show", { id, enable: value }, "post");
            const queryKey = ["extensions", "payments"];
            qc.setQueryData<{ data: Row[] }>(
                queryKey,
                (previous) =>
                    previous && {
                        ...previous,
                        data: previous.data.map((row) =>
                            row.id === id ? { ...row, enable: value } : row,
                        ),
                    },
            );
            await qc.invalidateQueries({ queryKey });
        },
        setError,
    );
    async function refresh() {
        await qc.invalidateQueries({ queryKey: ["extensions", kind] });
        if (kind === "plugins") {
            await Promise.all([
                qc.invalidateQueries({ queryKey: ["plugin-navigation"] }),
                qc.invalidateQueries({ queryKey: ["payment-methods"] }),
            ]);
        }
    }
    async function command(
        endpoint: string,
        data: Row,
        label: string,
        confirmText = `确认${label}？`,
    ) {
        if (!window.confirm(confirmText)) return;
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
                    required("name", "显示名称", "text", {
                        minLength: 2,
                        maxLength: 30,
                    }),
                    f("icon", "图标 URL"),
                    f("notify_domain", "通知域名"),
                    f("handling_fee_fixed", "固定手续费（元）", "money", {
                        min: 0,
                    }),
                    f("handling_fee_percent", "比例手续费（%）", "number", {
                        min: 0,
                        max: 100,
                    }),
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
            <div className="toolbar list-toolbar">
                <input
                    aria-label="搜索扩展"
                    placeholder={
                        kind === "plugins"
                            ? "搜索插件..."
                            : kind === "payments"
                              ? "搜索支付方式..."
                              : "搜索主题..."
                    }
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setPaymentPage(1);
                    }}
                />
                {kind === "plugins" && (
                    <select
                        aria-label="安装状态"
                        value={installStatus}
                        onChange={(e) => setInstallStatus(e.target.value)}
                    >
                        <option value="all">全部安装状态</option>
                        <option value="installed">已安装</option>
                        <option value="available">未安装</option>
                    </select>
                )}
                {(search ||
                    pluginType !== "all" ||
                    installStatus !== "all") && (
                    <Button
                        variant="ghost"
                        onClick={() => {
                            setSearch("");
                            setPluginType("all");
                            setInstallStatus("all");
                        }}
                    >
                        重置
                    </Button>
                )}
                {kind === "plugins" && (
                    <>
                        <div className="toolbar-spacer" />
                        <Link
                            to="/config/plugin/menu-demo"
                            className="button button-outline"
                        >
                            Menu Demo
                        </Link>
                        <Link
                            to="/config/plugin/crud-demo"
                            className="button button-outline"
                        >
                            CRUD Demo
                        </Link>
                    </>
                )}
            </div>
            {kind === "plugins" && (
                <div className="tabs">
                    {[
                        "all",
                        ...new Set(
                            [
                                ...rowsOf(types.data).map((t) => t.value),
                                ...rows.map((r) => r.type),
                            ].filter(Boolean),
                        ),
                    ].map((type) => (
                        <button
                            key={type}
                            className={pluginType === type ? "active" : ""}
                            onClick={() => setPluginType(type)}
                        >
                            {type === "all"
                                ? "所有插件"
                                : rowsOf(types.data).find(
                                      (t) => t.value === type,
                                  )?.label || type}
                        </button>
                    ))}
                </div>
            )}
            {q.isPending ? (
                <Loading />
            ) : q.isError ? (
                <ErrorState
                    message={errorMessage(q.error)}
                    retry={() => q.refetch()}
                />
            ) : visibleRows.length === 0 && kind !== "payments" ? (
                <section className="panel">
                    <Empty />
                </section>
            ) : kind === "payments" ? (
                <>
                    <DataTable
                        rows={visibleRows.slice(
                            (currentPage - 1) * paymentPageSize,
                            currentPage * paymentPageSize,
                        )}
                        sort={
                            paymentIdDesc == null
                                ? null
                                : { key: "id", desc: paymentIdDesc }
                        }
                        onSort={() => {
                            setPaymentIdDesc(paymentIdDesc === false);
                            setPaymentPage(1);
                        }}
                        columns={[
                            { key: "id", label: "ID" },
                            { key: "enable", label: "启用", sortable: false },
                            { key: "name", label: "显示名称", sortable: false },
                            { key: "payment", label: "接口", sortable: false },
                            {
                                key: "notify_url",
                                label: "通知地址",
                                sortable: false,
                            },
                        ]}
                        renderCell={(row, c) =>
                            c.key === "enable" ? (
                                <Switch
                                    value={row.enable}
                                    pending={pendingIds.has(row.id)}
                                    label={`启用支付 ${row.name}`}
                                    onChange={() => toggle(row, "enable")}
                                />
                            ) : c.key === "notify_url" ? (
                                <div className="cell-line">
                                    <span className="truncate">
                                        {row.notify_url}
                                    </span>
                                    <Copy value={row.notify_url} />
                                </div>
                            ) : (
                                <Value value={row[c.key]} column={c} />
                            )
                        }
                        actions={(row) => (
                            <div className="cell-line">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => configure(row)}
                                >
                                    编辑
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        command(
                                            "payment/drop",
                                            { id: row.id },
                                            "删除支付方式",
                                            `确认删除支付方式「${row.name}」？`,
                                        )
                                    }
                                >
                                    删除
                                </Button>
                            </div>
                        )}
                    />
                    <Pagination
                        page={currentPage}
                        size={paymentPageSize}
                        total={visibleRows.length}
                        onPage={setPaymentPage}
                        onSize={(n) => {
                            setPaymentPageSize(n);
                            setPaymentPage(1);
                        }}
                    />
                </>
            ) : (
                <div className="extension-grid">
                    {visibleRows.map((row) => (
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
                            {kind === "themes" && row.background_url && (
                                <img
                                    className="theme-cover"
                                    src={row.background_url}
                                    alt={`${row.name} 主题封面`}
                                />
                            )}
                            {kind === "plugins" && (
                                <div className="toolbar">
                                    <small>作者：{row.author || "—"}</small>
                                    <span className="status-badge">
                                        {row.type || "功能插件"}
                                    </span>
                                    {(row.is_protected || row.protected) && (
                                        <span className="status-badge">
                                            受保护
                                        </span>
                                    )}
                                </div>
                            )}
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
                                        {row.readme && (
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                aria-label="查看文档"
                                                title="查看文档"
                                                onClick={() =>
                                                    setResult(row.readme)
                                                }
                                            >
                                                <BookOpen size={15} />
                                            </Button>
                                        )}
                                        {row.need_upgrade && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={busy}
                                                onClick={() =>
                                                    command(
                                                        "plugin/upgrade",
                                                        { code: row.code },
                                                        "升级插件",
                                                        `确认升级插件「${row.name}」？`,
                                                    )
                                                }
                                            >
                                                升级
                                            </Button>
                                        )}
                                        {row.is_installed ? (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                disabled={
                                                    busy || row.is_enabled
                                                }
                                                title={
                                                    row.is_enabled
                                                        ? "请先停用插件"
                                                        : undefined
                                                }
                                                onClick={() =>
                                                    command(
                                                        "plugin/uninstall",
                                                        { code: row.code },
                                                        "卸载插件",
                                                        `确认卸载插件「${row.name}」？`,
                                                    )
                                                }
                                            >
                                                卸载
                                            </Button>
                                        ) : (
                                            row.can_be_deleted && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    disabled={busy}
                                                    onClick={() =>
                                                        command(
                                                            "plugin/delete",
                                                            {
                                                                code: row.code,
                                                            },
                                                            "删除插件",
                                                            `确认删除插件「${row.name}」及其文件？`,
                                                        )
                                                    }
                                                >
                                                    删除
                                                </Button>
                                            )
                                        )}
                                    </>
                                ) : (
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
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={
                                                !(
                                                    row.images?.length ||
                                                    row.screenshots?.length
                                                )
                                            }
                                            onClick={() => previewTheme(row)}
                                        >
                                            预览
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
                {edit?.mode === "payment" && (
                    <div className="gateway-selector">
                        <label>
                            支付接口
                            <select
                                aria-label="支付接口"
                                value={edit.row.payment}
                                onChange={(e) =>
                                    configure({
                                        ...edit.row,
                                        ...draft.current,
                                        handling_fee_fixed:
                                            draft.current.handling_fee_fixed ===
                                            ""
                                                ? null
                                                : Math.round(
                                                      Number(
                                                          draft.current
                                                              .handling_fee_fixed ||
                                                              0,
                                                      ) * 100,
                                                  ),
                                        payment: e.target.value,
                                        config: {},
                                    })
                                }
                            >
                                {(methods.data?.data || []).map((v: string) => (
                                    <option key={v} value={v}>
                                        {v}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                )}
                {edit && (
                    <Form
                        key={`${edit.mode}-${edit.row.code || edit.row.id || edit.row.name}-${edit.row.payment}`}
                        onDraft={(v) => {
                            draft.current = v;
                        }}
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
                    {typeof result === "string" ? (
                        <MarkdownView value={result} />
                    ) : (
                        <DataView data={result} />
                    )}
                </div>
            </Dialog>
            <Dialog
                open={pictures.length > 0}
                onClose={() => setPictures([])}
                title="主题预览"
                wide
            >
                <div className="theme-preview">
                    <img
                        src={pictures[picture]}
                        alt={`主题预览 ${picture + 1}`}
                    />
                    <div className="toolbar">
                        <Button
                            variant="outline"
                            disabled={picture === 0}
                            onClick={() => setPicture(picture - 1)}
                        >
                            上一张
                        </Button>
                        <span>
                            {picture + 1} / {pictures.length}
                        </span>
                        <Button
                            variant="outline"
                            disabled={picture === pictures.length - 1}
                            onClick={() => setPicture(picture + 1)}
                        >
                            下一张
                        </Button>
                        {pictures.map((_, i) => (
                            <button
                                key={i}
                                aria-label={`预览第 ${i + 1} 张`}
                                onClick={() => setPicture(i)}
                            >
                                {i === picture ? "●" : "○"}
                            </button>
                        ))}
                    </div>
                </div>
            </Dialog>
        </>
    );
}
