import { Menu as ActionMenu } from "@base-ui/react/menu";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Plus,
    Search,
    RefreshCw,
    Pencil,
    MoreHorizontal,
    ArrowUp,
    ArrowDown,
    ListOrdered,
    Eye,
} from "lucide-react";
import type { Module, Row, Action } from "../lib/types";
import { request } from "../lib/api";
import { rowsOf, countOf, get, errorMessage, time } from "../lib/utils";
import { DataTable, Pagination } from "../components/DataTable";
import { DataView } from "../components/DataView";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { Form, OptionInput } from "../components/Form";
import { Notice, Loading, ErrorState } from "../components/Feedback";
import { required } from "../modules/fields";
import { queryParams, type Condition } from "../lib/list";
import { Filters } from "../components/Filters";
export default function Resource({ module: m }: { module: Module }) {
    const qc = useQueryClient();
    const [conditions, setConditions] = useState<Condition[]>([]);
    const [page, setPage] = useState(1),
        [size, setSize] = useState(20),
        [search, setSearch] = useState(""),
        [debounced, setDebounced] = useState(""),
        [filters, setFilters] = useState<Row>({}),
        [selected, setSelected] = useState(new Set<string>()),
        [sort, setSort] = useState<{ key: string; desc: boolean } | null>(null),
        [message, setMessage] = useState(""),
        [error, setError] = useState("");
    const [edit, setEdit] = useState<{
            row: Row;
            create: boolean;
            action?: Action;
            ids?: any[];
        } | null>(null),
        [result, setResult] = useState<{ title: string; data: any } | null>(
            null,
        ),
        [order, setOrder] = useState<Row[] | null>(null),
        [busy, setBusy] = useState(false);
    useEffect(() => {
        const id = setTimeout(() => {
            setDebounced(search);
            setPage(1);
            setSelected(new Set());
        }, 300);
        return () => clearTimeout(id);
    }, [search]);
    const q = useQuery({
        queryKey: [
            "resource",
            m.id,
            page,
            size,
            debounced,
            filters,
            sort,
            conditions,
        ],
        queryFn: () =>
            request(
                m.endpoint,
                queryParams(
                    m,
                    page,
                    size,
                    debounced,
                    filters,
                    sort,
                    conditions,
                ),
                m.method || "get",
            ),
    });
    let allRows = (m.rows || rowsOf)(q.data);
    if (!m.remote) {
        if (debounced)
            allRows = allRows.filter((r) =>
                m.columns.some((c) =>
                    String(get(r, c.key) || "")
                        .toLowerCase()
                        .includes(debounced.toLowerCase()),
                ),
            );
        if (sort)
            allRows = [...allRows].sort((a, b) => {
                const av = get(a, sort.key),
                    bv = get(b, sort.key);
                const cmp =
                    typeof av === "number" && typeof bv === "number"
                        ? av - bv
                        : String(av ?? "").localeCompare(
                              String(bv ?? ""),
                              "zh-CN",
                              { numeric: true },
                          );
                return sort.desc ? -cmp : cmp;
            });
    }
    const total = m.remote ? (m.count || countOf)(q.data) : allRows.length;
    const rows = m.remote
        ? allRows
        : allRows.slice((page - 1) * size, page * size);
    function resetPage(n = 1) {
        setPage(n);
        setSelected(new Set());
    }
    async function refresh() {
        await qc.invalidateQueries({ queryKey: ["resource", m.id] });
        await qc.invalidateQueries({ queryKey: ["options"] });
        await qc.invalidateQueries({ queryKey: ["dashboard"] });
    }
    async function runAction(action: Action, row: Row, ids?: any[]) {
        setError("");
        setEdit({ row, create: false, action, ids });
    }
    async function showDetail(row: Row) {
        setBusy(true);
        setError("");
        try {
            let data = row;
            if (m.detailEndpoint) {
                const r = await request(
                    m.detailEndpoint,
                    { id: row.id },
                    m.detailEndpoint === "order/detail" ? "post" : "get",
                );
                data = r.data;
            }
            setResult({
                title: m.id === "tickets" ? `工单 #${row.id}` : "记录详情",
                data,
            });
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    }
    async function openEdit(row: Row) {
        setBusy(true);
        try {
            let data = row;
            if (m.id === "knowledge") {
                data = (await request("knowledge/fetch", { id: row.id })).data;
            }
            setEdit({
                row: m.editSeed ? m.editSeed(data) : data,
                create: false,
            });
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    }
    const activeAction = edit?.action || (edit?.create ? m.create : undefined);
    const fields = edit?.action
        ? (edit.action.fields ?? [])
        : edit?.create && m.create
          ? (m.create.fields ?? m.fields ?? [])
          : (m.fields ?? []);
    async function submit(values: Row) {
        if (!edit) return;
        const action = activeAction;
        let endpoint = (action?.endpoint || m.save!).replace(
            "{id}",
            encodeURIComponent(edit.row.id),
        );
        let payload: Row | Row[] = { ...values };
        const idKey = action?.idKey || m.key || "id";
        if (!edit.create && edit.row[idKey] !== undefined)
            payload[idKey] = edit.row[idKey];
        if (!edit.create && idKey !== "id" && edit.row[idKey] === undefined)
            payload[idKey] = edit.row.id;
        if (edit.ids) payload[action?.idsKey || "ids"] = edit.ids;
        Object.assign(payload, action?.extra || {});
        if (action?.payload) payload = action.payload(payload, edit.row);
        else if (!action && m.savePayload)
            payload = m.savePayload(payload, edit.row);
        else if (edit.create && m.savePayload)
            payload = m.savePayload(payload, {});
        let download = action?.download || false;
        if (
            (endpoint === "user/generate" && values.download_csv) ||
            (endpoint === "coupon/generate" && values.generate_count)
        )
            download = true;
        const r = await request(
            endpoint,
            payload,
            action?.method || "post",
            download,
        );
        setEdit(null);
        setSelected(new Set());
        setMessage(
            `${action?.label || "保存"}${action?.method === "get" ? "已获取" : "成功"}`,
        );
        await refresh();
        if (action?.result || (m.id === "machines" && edit.create))
            setResult({
                title: action?.label || "创建成功",
                data: r.data ?? r,
            });
    }
    return (
        <>
            <header className="page-header">
                <div>
                    <div className="eyebrow">{m.group}</div>
                    <h1>{m.title}</h1>
                    <p>{m.description}</p>
                </div>
                <div className="header-actions">
                    {m.tools?.map((a) => (
                        <Button
                            variant="outline"
                            key={a.label}
                            onClick={() => runAction(a, {})}
                        >
                            {a.label}
                        </Button>
                    ))}
                    {m.sort && (
                        <Button
                            variant="outline"
                            onClick={() =>
                                setOrder([...(m.rows || rowsOf)(q.data)])
                            }
                            disabled={q.isPending}
                        >
                            <ListOrdered size={16} />
                            调整排序
                        </Button>
                    )}
                    {m.canCreate !== false &&
                        (m.create ||
                            (m.fields &&
                                m.save &&
                                !["users", "gift-codes"].includes(m.id))) && (
                            <Button
                                onClick={() =>
                                    setEdit({ row: {}, create: true })
                                }
                            >
                                <Plus size={17} />
                                {m.create?.label || "新增"}
                            </Button>
                        )}
                </div>
            </header>
            <Notice message={message} />
            <Notice message={error} error />
            <section className="panel">
                <div className="toolbar">
                    {(!m.remote ||
                        m.searchKey ||
                        m.id.startsWith("plugin:")) && (
                        <div className="search-input">
                            <Search size={17} />
                            <input
                                placeholder={
                                    m.searchKey === "email"
                                        ? "搜索邮箱…"
                                        : m.searchKey === "trade_no"
                                          ? "搜索订单号…"
                                          : "搜索…"
                                }
                                aria-label="搜索记录"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    )}
                    {m.filters?.map((f) => (
                        <label className="inline-filter" key={f.key}>
                            <span>{f.label}</span>
                            {f.options || f.source ? (
                                <OptionInput
                                    field={f}
                                    value={filters[f.key] ?? ""}
                                    onChange={(v) => {
                                        setFilters({ ...filters, [f.key]: v });
                                        resetPage();
                                    }}
                                />
                            ) : (
                                <input
                                    type={
                                        f.kind === "date"
                                            ? "date"
                                            : f.kind === "number"
                                              ? "number"
                                              : "text"
                                    }
                                    value={filters[f.key] ?? ""}
                                    onChange={(e) => {
                                        setFilters({
                                            ...filters,
                                            [f.key]: e.target.value,
                                        });
                                        resetPage();
                                    }}
                                />
                            )}
                        </label>
                    ))}
                    <Button
                        size="icon"
                        variant="ghost"
                        aria-label="刷新列表"
                        onClick={() => q.refetch()}
                        disabled={q.isFetching}
                    >
                        <RefreshCw
                            size={17}
                            className={q.isFetching ? "spin" : ""}
                        />
                    </Button>
                </div>
                {m.filterMode === "structured" && (
                    <Filters
                        module={m}
                        value={conditions}
                        onChange={(v) => {
                            setConditions(v);
                            resetPage();
                        }}
                    />
                )}
                {m.id === "users" && (
                    <div className="toolbar">
                        <span className="muted">批量范围：</span>
                        {m.bulk?.map((a) => (
                            <Button
                                size="sm"
                                variant="outline"
                                key={a.label}
                                onClick={() =>
                                    runAction(
                                        {
                                            ...a,
                                            label: a.label.replace(
                                                "选中用户",
                                                "筛选结果",
                                            ),
                                            extra: {
                                                ...a.extra,
                                                scope: "filtered",
                                                filter: queryParams(
                                                    m,
                                                    page,
                                                    size,
                                                    debounced,
                                                    filters,
                                                    sort,
                                                    conditions,
                                                ).filter,
                                            },
                                            confirm: `将处理当前筛选的全部 ${total} 位用户（跨页），请核对范围。`,
                                        },
                                        {},
                                    )
                                }
                                disabled={
                                    !debounced &&
                                    !conditions.some((c) => c.value !== "")
                                }
                            >
                                {a.label.replace("选中用户", "筛选结果")}
                            </Button>
                        ))}
                        <details className="row-menu">
                            <summary>全部用户</summary>
                            <div>
                                {m.bulk?.map((a) => (
                                    <button
                                        key={a.label}
                                        onClick={(e) => {
                                            e.currentTarget.closest(
                                                "details",
                                            )!.open = false;
                                            runAction(
                                                {
                                                    ...a,
                                                    label: a.label.replace(
                                                        "选中用户",
                                                        "全部用户",
                                                    ),
                                                    extra: {
                                                        ...a.extra,
                                                        scope: "all",
                                                    },
                                                    confirm:
                                                        "将对系统内全部用户执行此操作，忽略当前筛选及分页，请谨慎核对。",
                                                },
                                                {},
                                            );
                                        }}
                                    >
                                        {a.label.replace(
                                            "选中用户",
                                            "全部用户",
                                        )}
                                    </button>
                                ))}
                            </div>
                        </details>
                    </div>
                )}
                {selected.size > 0 && (
                    <div className="selection-bar">
                        <strong>已选 {selected.size} 项</strong>
                        {m.bulk?.map((a) => (
                            <Button
                                key={a.label}
                                variant={a.danger ? "destructive" : "outline"}
                                size="sm"
                                onClick={() =>
                                    runAction(
                                        a,
                                        {},
                                        rows
                                            .filter((r) =>
                                                selected.has(String(r.id)),
                                            )
                                            .map((r) => r.id),
                                    )
                                }
                            >
                                {a.label}
                            </Button>
                        ))}
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelected(new Set())}
                        >
                            清空选择
                        </Button>
                    </div>
                )}
                {q.isPending ? (
                    <Loading />
                ) : q.isError ? (
                    <ErrorState
                        message={errorMessage(q.error)}
                        retry={() => q.refetch()}
                    />
                ) : (
                    <>
                        <DataTable
                            rows={rows}
                            columns={m.columns}
                            selected={selected}
                            onSelect={m.bulk?.length ? setSelected : undefined}
                            onSort={
                                !m.remote ||
                                m.filterMode === "structured" ||
                                m.id.startsWith("plugin:")
                                    ? (key) => {
                                          setSort({
                                              key,
                                              desc:
                                                  sort?.key === key
                                                      ? !sort.desc
                                                      : false,
                                          });
                                          resetPage();
                                      }
                                    : undefined
                            }
                            actions={(row) => (
                                <div className="row-actions">
                                    {m.save && m.fields && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label={`编辑 ${row.name || row.email || row.id}`}
                                            onClick={() => openEdit(row)}
                                            disabled={busy}
                                        >
                                            <Pencil size={16} />
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`查看 ${row.name || row.email || row.id}`}
                                        onClick={() => showDetail(row)}
                                        disabled={busy}
                                    >
                                        <Eye size={16} />
                                    </Button>
                                    {m.actions?.some(
                                        (a) => !a.visible || a.visible(row),
                                    ) && (
                                        <ActionMenu.Root>
                                            <ActionMenu.Trigger
                                                className="button button-ghost button-icon"
                                                aria-label="更多操作"
                                            >
                                                <MoreHorizontal size={19} />
                                            </ActionMenu.Trigger>
                                            <ActionMenu.Portal>
                                                <ActionMenu.Positioner
                                                    sideOffset={5}
                                                    align="end"
                                                >
                                                    <ActionMenu.Popup className="action-menu-popup">
                                                        {m.actions
                                                            .filter(
                                                                (a) =>
                                                                    !a.visible ||
                                                                    a.visible(
                                                                        row,
                                                                    ),
                                                            )
                                                            .map((a) => (
                                                                <ActionMenu.Item
                                                                    className={
                                                                        a.danger
                                                                            ? "error"
                                                                            : ""
                                                                    }
                                                                    key={
                                                                        a.label
                                                                    }
                                                                    onClick={() =>
                                                                        runAction(
                                                                            a,
                                                                            row,
                                                                        )
                                                                    }
                                                                >
                                                                    {a.label}
                                                                </ActionMenu.Item>
                                                            ))}
                                                    </ActionMenu.Popup>
                                                </ActionMenu.Positioner>
                                            </ActionMenu.Portal>
                                        </ActionMenu.Root>
                                    )}
                                </div>
                            )}
                        />
                        <Pagination
                            page={page}
                            size={size}
                            total={total}
                            onPage={resetPage}
                            onSize={(n) => {
                                setSize(n);
                                resetPage();
                            }}
                        />
                    </>
                )}
            </section>
            <Dialog
                open={!!edit}
                onClose={() => setEdit(null)}
                title={
                    activeAction?.label ||
                    (edit?.create ? `新增${m.title}` : `编辑${m.title}`)
                }
                description={activeAction?.confirm}
                wide={fields.length > 5}
            >
                {edit && (
                    <Form
                        key={`${edit.create}-${edit.row.id}-${activeAction?.endpoint}`}
                        fields={fields}
                        seed={
                            activeAction?.seed
                                ? activeAction.seed(edit.row)
                                : edit.row
                        }
                        onSubmit={submit}
                        onCancel={() => setEdit(null)}
                        submitLabel={activeAction?.danger ? "确认操作" : "保存"}
                    >
                        {fields.length === 0 && (
                            <p className="muted">
                                {edit.ids
                                    ? `将处理选中的 ${edit.ids.length} 条记录。`
                                    : edit.row.name ||
                                      edit.row.email ||
                                      edit.row.trade_no ||
                                      "确认执行此操作。"}
                            </p>
                        )}
                    </Form>
                )}
            </Dialog>
            <Dialog
                open={!!result}
                onClose={() => setResult(null)}
                title={result?.title || "详情"}
                wide
            >
                {result && (
                    <div className="detail-body">
                        {m.id === "tickets" && result.data?.messages ? (
                            <>
                                <dl className="ticket-info">
                                    <dt>主题</dt>
                                    <dd>{result.data.subject}</dd>
                                    <dt>用户</dt>
                                    <dd>{result.data.user?.email}</dd>
                                </dl>
                                <div className="messages">
                                    {result.data.messages.map((msg: Row) => (
                                        <article
                                            key={msg.id}
                                            className={
                                                msg.is_from_admin
                                                    ? "message-admin"
                                                    : "message-user"
                                            }
                                        >
                                            <header>
                                                <strong>
                                                    {msg.is_from_admin
                                                        ? "管理员"
                                                        : "用户"}
                                                </strong>
                                                <time>
                                                    {time(msg.created_at)}
                                                </time>
                                            </header>
                                            <p>{msg.message}</p>
                                        </article>
                                    ))}
                                </div>
                                <Form
                                    fields={[
                                        required(
                                            "message",
                                            "回复内容",
                                            "textarea",
                                        ),
                                    ]}
                                    submitLabel="发送回复"
                                    onSubmit={async (values) => {
                                        await request(
                                            "ticket/reply",
                                            { id: result.data.id, ...values },
                                            "post",
                                        );
                                        const updated = await request(
                                            "ticket/fetch",
                                            { id: result.data.id },
                                        );
                                        setResult({
                                            ...result,
                                            data: updated.data,
                                        });
                                        await refresh();
                                    }}
                                />
                            </>
                        ) : (
                            <DataView data={result.data} />
                        )}
                    </div>
                )}
            </Dialog>
            <Dialog
                open={!!order}
                onClose={() => setOrder(null)}
                title="调整显示顺序"
            >
                <div className="sort-list">
                    {order?.map((r, i) => (
                        <div key={r.id}>
                            <span>{r.name || r.title || r.id}</span>
                            <Button
                                size="icon"
                                variant="ghost"
                                aria-label="上移"
                                disabled={i === 0}
                                onClick={() => {
                                    const next = [...order];
                                    [next[i - 1], next[i]] = [
                                        next[i],
                                        next[i - 1],
                                    ];
                                    setOrder(next);
                                }}
                            >
                                <ArrowUp size={16} />
                            </Button>
                            <Button
                                size="icon"
                                variant="ghost"
                                aria-label="下移"
                                disabled={i === order.length - 1}
                                onClick={() => {
                                    const next = [...order];
                                    [next[i + 1], next[i]] = [
                                        next[i],
                                        next[i + 1],
                                    ];
                                    setOrder(next);
                                }}
                            >
                                <ArrowDown size={16} />
                            </Button>
                        </div>
                    ))}
                </div>
                <footer className="form-footer">
                    <Button
                        onClick={async () => {
                            try {
                                await request(
                                    m.sort!,
                                    m.id === "nodes"
                                        ? order!.map((r, i) => ({
                                              id: r.id,
                                              order: i + 1,
                                          }))
                                        : { ids: order!.map((r) => r.id) },
                                    "post",
                                );
                                setOrder(null);
                                await refresh();
                            } catch (e) {
                                setError(errorMessage(e));
                            }
                        }}
                    >
                        保存排序
                    </Button>
                </footer>
            </Dialog>
        </>
    );
}
