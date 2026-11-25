import VisibilitySwitch from "../components/VisibilitySwitch";
import { select } from "../modules/fields";
import { highLoad } from "../lib/metrics";
import { downloadBlob, time } from "../lib/utils";
import { ActionMenu } from "../components/ActionMenu";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Plus,
    Search,
    RefreshCw,
    ListOrdered,
    Eye,
    Pencil,
    Trash2,
    X,
} from "lucide-react";
import type { Module, Row, Action } from "../lib/types";
import { request } from "../lib/api";
import { rowsOf, countOf, get, errorMessage } from "../lib/utils";
import { DataTable, Pagination } from "../components/DataTable";
import { DataView, copyText } from "../components/DataView";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { Form, OptionInput } from "../components/Form";
import { Notice, Loading, ErrorState } from "../components/Feedback";
import { hasFilterValue, queryParams, type Condition } from "../lib/list";
import { Filters } from "../components/Filters";
import { Cell, machineState } from "../legacy/Cells";
import {
    UserDetails,
    OrderDetails,
    TrafficRecords,
    UserReset,
    ResetStats,
    NodeLoad,
} from "../legacy/Details";
import TicketDesk from "../legacy/TicketDesk";
import MachineCredentials from "../legacy/MachineCredentials";
import MachineDesk from "../legacy/MachineDesk";
export default function Resource({
    module: m,
    embedded = false,
}: {
    module: Module;
    embedded?: boolean;
}) {
    const qc = useQueryClient(),
        navigate = useNavigate(),
        [params, setParams] = useSearchParams();
    const [page, setPage] = useState(1),
        [size, setSize] = useState(m.id === "nodes" ? 500 : 20),
        [search, setSearch] = useState(""),
        [debounced, setDebounced] = useState(""),
        [filters, setFilters] = useState<Row>({}),
        [conditions, setConditions] = useState<Condition[]>([]),
        [selected, setSelected] = useState(new Set<string>()),
        [sort, setSort] = useState<{ key: string; desc: boolean } | null>(null),
        [hidden, setHidden] = useState(
            new Set<string>(m.id === "users" ? ["is_admin", "is_staff"] : []),
        ),
        [message, setMessage] = useState(""),
        [error, setError] = useState(""),
        [busy, setBusy] = useState(false),
        [ticketStatus, setTicketStatus] = useState(0),
        [scope, setScope] = useState("filtered");
    const [edit, setEdit] = useState<{
            row: Row;
            create: boolean;
            action?: Action;
            ids?: any[];
        } | null>(null),
        [detail, setDetail] = useState<{ kind: string; row: Row } | null>(null),
        [order, setOrder] = useState<string[] | null>(null);
    useEffect(() => {
        if (search === debounced) return;
        const id = setTimeout(() => {
            setDebounced(search);
            setPage(1);
            setSelected(new Set());
        }, 300);
        return () => clearTimeout(id);
    }, [search, debounced]);
    useEffect(() => {
        const next: Condition[] = [];
        for (const key of [
            "user_id",
            "invite_user_id",
            "commission_status",
            "status",
            "commission_balance",
        ]) {
            const value = params.get(key);
            if (value != null) {
                const match = value.match(/^(eq|gt|gte|lt|lte|like):(.*)$/);
                next.push({
                    key,
                    operator: match?.[1] || "eq",
                    value: match?.[2] || value,
                });
            }
        }
        setConditions(next);
        setFilters(
            params.has("machine_id")
                ? { machine_id: params.get("machine_id") }
                : {},
        );
        setPage(1);
        setSelected(new Set());
        if (m.id === "nodes" && params.get("open_create")) {
            setEdit({
                row: { machine_id: Number(params.get("machine_id")) || null },
                create: true,
            });
            const next = new URLSearchParams(params);
            next.delete("open_create");
            setParams(next, { replace: true });
        }
    }, [params.toString(), m.id]);
    const effective = {
        ...m,
        params: {
            ...m.params,
            ...(m.id === "tickets" ? { status: ticketStatus } : {}),
        },
    };
    const query = queryParams(
        effective,
        page,
        size,
        debounced,
        filters,
        sort,
        conditions,
    );
    const q = useQuery({
        queryKey: ["resource", m.id, query],
        queryFn: () => request(m.endpoint, query, m.method || "get"),
        refetchInterval: m.id === "machines" ? 15000 : false,
    });
    const groups = useQuery({
            queryKey: ["options", "groups"],
            queryFn: () => request("server/group/fetch"),
            enabled: m.id === "nodes",
        }),
        machines = useQuery({
            queryKey: ["options", "machines"],
            queryFn: () => request("server/machine/fetch"),
            enabled: m.id === "nodes",
        });
    let allRows = (m.rows || rowsOf)(q.data);
    const originalRows = allRows;
    if (!m.remote) {
        allRows = allRows.filter((r) => {
            if (
                debounced &&
                !JSON.stringify([
                    r.name,
                    r.title,
                    r.email,
                    r.code,
                    r.notes,
                    r.sid,
                ])
                    .toLowerCase()
                    .includes(debounced.toLowerCase())
            )
                return false;
            return Object.entries(filters).every(([k, v]) => {
                if (!hasFilterValue(v)) return true;
                const choices = Array.isArray(v) ? v : [v];
                if (k === "status" && m.id === "machines")
                    return choices.includes(machineState(r));
                if (k === "node_filter")
                    return choices.some((choice) =>
                        choice === "with_nodes"
                            ? r.servers_count > 0
                            : choice === "idle_nodes"
                              ? !r.servers_count
                              : highLoad(r.load_status || {}),
                    );
                if (
                    k === "machine_id" &&
                    choices.includes("standalone") &&
                    !r.machine_id
                )
                    return true;
                const rv = get(r, k);
                return Array.isArray(rv)
                    ? rv.some((x) => choices.map(String).includes(String(x)))
                    : choices.map(String).includes(String(rv));
            });
        });
        if (sort)
            allRows = [...allRows].sort((a, b) => {
                const av = get(a, sort.key),
                    bv = get(b, sort.key);
                const n =
                    typeof av === "number" && typeof bv === "number"
                        ? av - bv
                        : String(av ?? "").localeCompare(
                              String(bv ?? ""),
                              "zh-CN",
                              { numeric: true },
                          );
                return sort.desc ? -n : n;
            });
    }
    const total = m.remote ? (m.count || countOf)(q.data) : allRows.length;
    let rows = m.remote
        ? allRows
        : allRows.slice((page - 1) * size, page * size);
    if (order) {
        const rank = new Map(order.map((id, i) => [id, i]));
        rows = [...originalRows].sort(
            (a, b) =>
                (rank.get(String(a.id)) ?? order.length) -
                (rank.get(String(b.id)) ?? order.length),
        );
    }
    useEffect(() => {
        if (m.id === "machines" && params.get("machine_id") && q.data) {
            const row = originalRows.find(
                (r) => String(r.id) === params.get("machine_id"),
            );
            if (row) setDetail({ kind: "machine", row });
        }
    }, [!!q.data, params.toString()]);
    useEffect(() => {
        if (m.id !== "machines" || detail?.kind !== "result") return;
        const timeout = setTimeout(() => setDetail(null), 180000);
        return () => clearTimeout(timeout);
    }, [detail, m.id]);
    function resetPage() {
        setPage(1);
        setSelected(new Set());
    }
    async function refresh() {
        await Promise.all([
            qc.invalidateQueries({ queryKey: ["resource", m.id] }),
            qc.invalidateQueries({ queryKey: ["options"] }),
            qc.invalidateQueries({ queryKey: ["dashboard"] }),
        ]);
    }
    function clearFilters() {
        setSearch("");
        setFilters({});
        setConditions([]);
        setSort(null);
        if (!embedded) setParams({});
        resetPage();
    }
    async function action(a: Action, r: Row, ids?: any[]) {
        setError("");
        if (a.endpoint.startsWith("#")) {
            const kind = a.endpoint.slice(1);
            if (kind === "copy-subscription") {
                try {
                    let url = r.subscribe_url;
                    if (!url)
                        url = (
                            await request(
                                "user/fetch",
                                {
                                    filter: [{ id: "id", value: `eq:${r.id}` }],
                                    pageSize: 1,
                                },
                                "post",
                            )
                        ).data?.[0]?.subscribe_url;
                    if (!url) throw new Error("未获取到订阅链接");
                    await copyText(url);
                    setMessage("订阅URL已复制");
                } catch (e) {
                    setError(errorMessage(e));
                }
                return;
            }
            if (kind === "export-reset-logs") {
                setBusy(true);
                try {
                    const result = await request(m.endpoint, {
                        ...query,
                        page: 1,
                        per_page: 10000,
                    });
                    const records = rowsOf(result);
                    const escape = (v: any) =>
                        '"' +
                        String(v ?? "")
                            .replace(/^[=+@-]/, "'$&")
                            .replace(/"/g, '""') +
                        '"';
                    const csv = [
                        m.columns.map((c) => c.label),
                        ...records.map((r) =>
                            m.columns.map((c) =>
                                c.format === "time"
                                    ? time(get(r, c.key))
                                    : get(r, c.key),
                            ),
                        ),
                    ]
                        .map((row) => row.map(escape).join(","))
                        .join("\r\n");
                    downloadBlob(
                        new Blob(["\ufeff" + csv], {
                            type: "text/csv;charset=utf-8",
                        }),
                        "traffic-reset-logs.csv",
                    );
                    setMessage(
                        `已导出 ${records.length} 条记录${countOf(result) > 10000 ? "（达到一万条上限，请缩小日期范围继续导出）" : ""}`,
                    );
                } catch (e) {
                    setError(errorMessage(e));
                } finally {
                    setBusy(false);
                }
                return;
            }
            if (kind === "user-orders") {
                navigate(`/finance/order?user_id=eq:${r.id}`);
                return;
            }
            if (kind === "user-invites") {
                navigate(`/user/manage?invite_user_id=eq:${r.id}`);
                return;
            }
            setDetail({ kind, row: r });
            return;
        }
        if (m.id === "tickets" && a.endpoint === "ticket/reply") {
            setDetail({ kind: "ticket", row: r });
            return;
        }
        setEdit({ row: r, create: false, action: a, ids });
    }
    async function showDetail(r: Row) {
        if (m.id === "tickets") {
            setDetail({ kind: "ticket", row: r });
            return;
        }
        if (m.id === "machines") {
            setDetail({ kind: "machine", row: r });
            return;
        }
        setBusy(true);
        try {
            let data = r;
            if (m.detailEndpoint)
                data = (
                    await request(
                        m.detailEndpoint,
                        { id: r.id },
                        m.id === "orders" ? "post" : "get",
                    )
                ).data;
            setDetail({ kind: m.id, row: data });
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    }
    async function openEdit(r: Row) {
        setBusy(true);
        try {
            let data = r;
            if (m.id === "knowledge")
                data = (await request("knowledge/fetch", { id: r.id })).data;
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
    async function toggle(r: Row, key: string) {
        if (busy) return;
        setBusy(true);
        setError("");
        try {
            const endpoint: Row = {
                plans: "plan/update",
                nodes: "server/manage/update",
                coupons: "coupon/update",
                notices: "notice/show",
                knowledge: "knowledge/show",
            };
            await request(
                endpoint[m.id],
                {
                    id: r.id,
                    [key]: Number(r[key]) === 1 ? 0 : 1,
                },
                "post",
            );
            await refresh();
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    }
    const activeAction = edit?.action || (edit?.create ? m.create : undefined),
        fields = edit?.action
            ? edit.action.fields || []
            : edit?.create
              ? m.create?.fields || m.fields || []
              : m.fields || [];
    async function submit(values: Row) {
        if (!edit) return;
        const a = activeAction,
            endpoint = (a?.endpoint || m.save!).replace(
                "{id}",
                encodeURIComponent(edit.row.id),
            );
        let payload: Row | Row[] = { ...values };
        const idKey = a?.idKey || m.key || "id";
        if (!edit.create && edit.row[idKey] !== undefined)
            payload[idKey] = edit.row[idKey];
        else if (!edit.create && idKey !== "id") payload[idKey] = edit.row.id;
        if (edit.ids) payload[a?.idsKey || "ids"] = edit.ids;
        Object.assign(payload, a?.extra || {});
        if (a?.payload) payload = a.payload(payload, edit.row);
        else if (m.savePayload && (!a || edit.create))
            payload = m.savePayload(payload, edit.create ? {} : edit.row);
        const download =
            a?.download ||
            (endpoint === "user/generate" && values.download_csv) ||
            (endpoint === "coupon/generate" && values.generate_count) ||
            (endpoint === "gift-card/generate-codes" && values.download_csv);
        const result = await request(
            endpoint,
            payload,
            a?.method || "post",
            !!download,
        );
        setEdit(null);
        setSelected(new Set());
        setMessage(`${a?.label || "保存"}成功`);
        await refresh();
        if (!download && (a?.result || (m.id === "machines" && edit.create)))
            setDetail({ kind: "result", row: result.data ?? result });
    }
    async function saveOrder() {
        try {
            await request(
                m.sort!,
                m.id === "nodes"
                    ? rows.map((r, i) => ({ id: r.id, order: i + 1 }))
                    : { ids: rows.map((r) => r.id) },
                "post",
            );
            setOrder(null);
            setMessage("排序已保存");
            await refresh();
        } catch (e) {
            setError(errorMessage(e));
        }
    }
    function bulk(a: Action) {
        if (m.id !== "users" || scope === "selected") {
            action(
                a,
                {},
                originalRows
                    .filter((r) => selected.has(String(r.id)))
                    .map((r) => r.id),
            );
            return;
        }
        action(
            {
                ...a,
                extra: {
                    ...a.extra,
                    scope,
                    ...(scope === "filtered"
                        ? { filter: query.filter || [] }
                        : {}),
                },
                confirm: `将处理${scope === "all" ? "系统全部用户" : `符合当前筛选的 ${total} 位用户`}，请核对范围。`,
            },
            {},
        );
    }
    return (
        <>
            <header
                className={`page-header ${embedded ? "embedded-header" : ""}`}
            >
                <div>
                    <h1>{m.title}</h1>
                    <p>{m.description}</p>
                </div>
            </header>
            <Notice message={message} />
            <Notice message={error} error />
            {m.id === "machines" && (
                <div className="machine-summary">
                    {[
                        ["服务器总数", originalRows.length],
                        [
                            "在线",
                            originalRows.filter(
                                (r) => machineState(r) === "online",
                            ).length,
                        ],
                        [
                            "离线 / 失联",
                            originalRows.filter(
                                (r) => machineState(r) !== "online",
                            ).length,
                        ],
                        [
                            "高负载",
                            originalRows.filter((r) =>
                                highLoad(r.load_status || {}),
                            ).length,
                        ],
                        [
                            "承载节点",
                            originalRows.reduce(
                                (n, r) => n + Number(r.servers_count || 0),
                                0,
                            ),
                        ],
                    ].map(([label, value]) => (
                        <div className="panel" key={label}>
                            <span>{label}</span>
                            <strong>{value}</strong>
                        </div>
                    ))}
                </div>
            )}
            {m.id === "nodes" && params.get("machine_id") && (
                <div className="context-banner">
                    当前服务器：
                    {rowsOf(machines.data).find(
                        (r) => String(r.id) === params.get("machine_id"),
                    )?.name || params.get("machine_id")}
                    <Button size="sm" variant="ghost" onClick={clearFilters}>
                        清除筛选
                    </Button>
                </div>
            )}
            <div className="toolbar list-toolbar">
                {" "}
                {m.id === "tickets" && (
                    <div className="tabs">
                        {["处理中", "已关闭"].map((label, i) => (
                            <button
                                key={label}
                                className={ticketStatus === i ? "active" : ""}
                                onClick={() => {
                                    setTicketStatus(i);
                                    resetPage();
                                }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                )}
                <div className="header-actions">
                    {m.canCreate !== false &&
                        (m.create ||
                            (m.fields &&
                                m.save &&
                                !["users", "gift-codes"].includes(m.id))) && (
                            <Button
                                onClick={() =>
                                    setEdit({
                                        row:
                                            m.id === "nodes"
                                                ? {
                                                      machine_id: Array.isArray(
                                                          filters.machine_id,
                                                      )
                                                          ? filters.machine_id
                                                                .length === 1 &&
                                                            filters
                                                                .machine_id[0] !==
                                                                "standalone"
                                                              ? Number(
                                                                    filters
                                                                        .machine_id[0],
                                                                )
                                                              : null
                                                          : filters.machine_id ===
                                                              "standalone"
                                                            ? null
                                                            : filters.machine_id,
                                                  }
                                                : m.id === "coupons"
                                                  ? {
                                                        started_at: Math.floor(
                                                            Date.now() / 1000,
                                                        ),
                                                        ended_at:
                                                            Math.floor(
                                                                Date.now() /
                                                                    1000,
                                                            ) +
                                                            86400 * 7,
                                                    }
                                                  : {},
                                        create: true,
                                    })
                                }
                            >
                                <Plus size={16} />
                                {m.create?.label || "添加"}
                            </Button>
                        )}
                </div>
                {m.id !== "tickets" &&
                    (!m.remote ||
                        m.searchKey ||
                        m.id.startsWith("plugin:")) && (
                        <div className="search-input">
                            <Search size={16} />
                            <input
                                placeholder={
                                    m.searchKey === "email"
                                        ? "搜索邮箱..."
                                        : m.searchKey === "trade_no"
                                          ? "搜索订单号..."
                                          : m.id === "nodes"
                                            ? "搜索节点名称..."
                                            : "搜索..."
                                }
                                aria-label="搜索记录"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    )}
                {m.filterMode === "structured" && m.id === "users" && (
                    <Filters
                        module={m}
                        value={conditions}
                        onChange={(v) => {
                            setConditions(v);
                            resetPage();
                        }}
                    />
                )}
                {(debounced ||
                    conditions.length ||
                    Object.values(filters).some(hasFilterValue)) && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                        重置 ×
                    </Button>
                )}
                <div className="toolbar-spacer" />
                {m.id !== "users" &&
                    m.tools?.map((a) => (
                        <Button
                            key={a.label}
                            variant="outline"
                            disabled={busy}
                            onClick={() => action(a, {})}
                        >
                            {a.label}
                        </Button>
                    ))}
                {m.sort &&
                    (order ? (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => setOrder(null)}
                            >
                                取消排序
                            </Button>
                            <Button onClick={saveOrder}>保存排序</Button>
                        </>
                    ) : (
                        <Button
                            variant="outline"
                            onClick={() =>
                                setOrder(originalRows.map((r) => String(r.id)))
                            }
                            disabled={q.isPending}
                        >
                            <ListOrdered size={16} />
                            编辑排序
                        </Button>
                    ))}
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="刷新列表"
                    onClick={() => q.refetch()}
                >
                    <RefreshCw
                        size={16}
                        className={q.isFetching ? "spin" : ""}
                    />
                </Button>
            </div>
            <div className="list-options">
                {[
                    ...(m.filters || []),
                    ...(m.id === "knowledge"
                        ? [
                              {
                                  key: "category",
                                  label: "分类",
                                  source: undefined,
                                  kind: "select" as const,
                                  options: [
                                      ...new Set(
                                          originalRows
                                              .map((r) => r.category)
                                              .filter(Boolean),
                                      ),
                                  ].map((value) => ({ value, label: value })),
                              },
                          ]
                        : []),
                ].map((f) => (
                    <section
                        className="facet-filter"
                        key={f.key}
                        aria-label={f.label}
                    >
                        <h3>
                            {f.label}
                            {hasFilterValue(filters[f.key]) &&
                                (Array.isArray(filters[f.key])
                                    ? ` · ${filters[f.key].length}`
                                    : " · 已筛选")}
                        </h3>
                        <div>
                            {f.options || f.source ? (
                                <OptionInput
                                    field={{
                                        ...f,
                                        kind:
                                            m.filterMode === "structured" ||
                                            !m.remote
                                                ? "multi"
                                                : "select",
                                    }}
                                    value={filters[f.key] ?? ""}
                                    onChange={(v) => {
                                        setFilters({ ...filters, [f.key]: v });
                                        resetPage();
                                    }}
                                />
                            ) : (
                                <input
                                    aria-label={f.label}
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
                            {hasFilterValue(filters[f.key]) && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                        setFilters({
                                            ...filters,
                                            [f.key]: null,
                                        });
                                        resetPage();
                                    }}
                                >
                                    清除筛选
                                </Button>
                            )}
                        </div>
                    </section>
                ))}
                {(m.bulk?.length || 0) > 0 && (
                    <section
                        className="facet-filter bulk-actions"
                        aria-label="批量操作"
                    >
                        <h3>
                            {m.id === "nodes"
                                ? `批量操作（${selected.size}）`
                                : "批量操作"}
                        </h3>
                        <div>
                            {m.id === "users" && (
                                <select
                                    aria-label="操作范围"
                                    value={scope}
                                    onChange={(e) => setScope(e.target.value)}
                                >
                                    <option value="filtered">
                                        当前筛选结果（{total}）
                                    </option>
                                    <option value="selected">
                                        已选用户（{selected.size}）
                                    </option>
                                    <option value="all">全部用户</option>
                                </select>
                            )}
                            {m.id === "users" &&
                                m.tools?.map((a) => (
                                    <Button
                                        variant="ghost"
                                        key={a.label}
                                        onClick={() => action(a, {})}
                                    >
                                        {a.label}
                                    </Button>
                                ))}
                            {m.bulk!.map((a) => (
                                <Button
                                    key={a.label}
                                    variant="ghost"
                                    disabled={
                                        (m.id !== "users" ||
                                            scope === "selected") &&
                                        !selected.size
                                    }
                                    onClick={() => bulk(a)}
                                >
                                    {a.label.replace("选中用户", "用户")}
                                </Button>
                            ))}
                        </div>
                    </section>
                )}
                <section
                    className="facet-filter column-picker"
                    aria-label="显示列"
                >
                    <h3>显示列</h3>
                    <div>
                        {m.columns.map((c) => (
                            <label key={c.key}>
                                <VisibilitySwitch
                                    label={`显示列 ${c.label}`}
                                    visible={!hidden.has(c.key)}
                                    onChange={() => {
                                        const next = new Set(hidden);
                                        next.has(c.key)
                                            ? next.delete(c.key)
                                            : next.add(c.key);
                                        setHidden(next);
                                    }}
                                />
                                {c.label}
                            </label>
                        ))}
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setHidden(new Set())}
                        >
                            重置显示列
                        </Button>
                    </div>
                </section>
            </div>
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
                        columns={m.columns.filter((c) => !hidden.has(c.key))}
                        selected={selected}
                        onSelect={m.bulk?.length ? setSelected : undefined}
                        sort={sort}
                        onSort={
                            !order &&
                            (!m.remote ||
                                m.filterMode === "structured" ||
                                m.id.startsWith("plugin:"))
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
                        onMove={
                            order
                                ? (from, to) => {
                                      const next = rows.map((r) =>
                                          String(r.id),
                                      );
                                      next.splice(
                                          to,
                                          0,
                                          next.splice(from, 1)[0],
                                      );
                                      setOrder(next);
                                  }
                                : undefined
                        }
                        renderCell={(row, column) => (
                            <Cell
                                id={m.id}
                                row={row}
                                column={column}
                                groups={rowsOf(groups.data)}
                                machines={rowsOf(machines.data)}
                                onDetail={showDetail}
                                onToggle={toggle}
                                onAction={(name, r) => {
                                    if (name === "edit") openEdit(r);
                                    else if (name === "machine")
                                        navigate(
                                            `/server/machine?machine_id=${r.machine_id}`,
                                        );
                                    else if (name === "code-status")
                                        action(
                                            {
                                                label: "修改兑换码状态",
                                                endpoint:
                                                    "gift-card/update-code",
                                                fields: [
                                                    select(
                                                        "status",
                                                        "状态",
                                                        {
                                                            "0": "未使用",
                                                            "1": "已使用",
                                                            "2": "已过期",
                                                            "3": "已禁用",
                                                        },
                                                        { required: true },
                                                    ),
                                                ],
                                            },
                                            r,
                                        );
                                    else if (name === "commission")
                                        action(
                                            m.actions!.find(
                                                (a) =>
                                                    a.endpoint ===
                                                    "order/update",
                                            )!,
                                            r,
                                        );
                                    else setDetail({ kind: name, row: r });
                                }}
                            />
                        )}
                        actions={(r) =>
                            m.id === "tickets" ? (
                                <div className="cell-line">
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        aria-label={`查看工单 ${r.id}`}
                                        onClick={() => showDetail(r)}
                                    >
                                        <Eye size={15} />
                                    </Button>
                                    {r.status === 0 && (
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            aria-label={`关闭工单 ${r.id}`}
                                            onClick={() =>
                                                action(
                                                    m.actions!.find(
                                                        (a) =>
                                                            a.endpoint ===
                                                            "ticket/close",
                                                    )!,
                                                    r,
                                                )
                                            }
                                        >
                                            <X size={15} />
                                        </Button>
                                    )}
                                </div>
                            ) : [
                                  "plans",
                                  "coupons",
                                  "machines",
                                  "groups",
                                  "routes",
                                  "notices",
                                  "knowledge",
                                  "gift-templates",
                                  "gift-codes",
                              ].includes(m.id) ? (
                                <div className="cell-line">
                                    {m.id === "machines" && (
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            aria-label={`服务器详情 ${r.name}`}
                                            onClick={() => showDetail(r)}
                                        >
                                            <Eye size={15} />
                                        </Button>
                                    )}
                                    {m.save && m.fields && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label={`编辑 ${r.name || r.title || r.code || r.id}`}
                                            onClick={() => openEdit(r)}
                                        >
                                            <Pencil size={15} />
                                        </Button>
                                    )}
                                    {m.actions
                                        ?.filter((a) => a.deletesRecord)
                                        .map((a) => (
                                            <Button
                                                key={a.label}
                                                variant="ghost"
                                                size="icon"
                                                aria-label={`删除 ${r.name || r.title || r.code || r.id}`}
                                                onClick={() => action(a, r)}
                                            >
                                                <Trash2 size={15} />
                                            </Button>
                                        ))}
                                    {m.actions?.some(
                                        (a) =>
                                            !a.deletesRecord &&
                                            (!a.visible || a.visible(r)),
                                    ) && (
                                        <ActionMenu
                                            label="更多操作"
                                            items={m.actions
                                                .filter(
                                                    (a) =>
                                                        !a.deletesRecord &&
                                                        (!a.visible ||
                                                            a.visible(r)),
                                                )
                                                .map((a) => ({
                                                    label: a.label,
                                                    danger: a.danger,
                                                    onClick: () => {
                                                        action(a, r);
                                                    },
                                                }))}
                                        />
                                    )}
                                </div>
                            ) : (
                                <ActionMenu
                                    label={`操作 ${r.name || r.email || r.id}`}
                                    items={[
                                        ...(m.save && m.fields
                                            ? [
                                                  {
                                                      label: "编辑",
                                                      onClick: () => {
                                                          openEdit(r);
                                                      },
                                                  },
                                              ]
                                            : []),
                                        {
                                            label: "查看详情",
                                            onClick: () => {
                                                showDetail(r);
                                            },
                                        },
                                        ...(m.actions || [])
                                            .filter(
                                                (a) =>
                                                    (!a.visible ||
                                                        a.visible(r)) &&
                                                    (a.endpoint !==
                                                        "order/update" ||
                                                        hidden.has(
                                                            "commission_status",
                                                        ) ||
                                                        m.id !== "orders"),
                                            )
                                            .map((a) => ({
                                                label: a.label,
                                                danger: a.danger,
                                                onClick: () => {
                                                    action(a, r);
                                                },
                                            })),
                                    ]}
                                />
                            )
                        }
                    />
                    {!order && (
                        <Pagination
                            page={page}
                            size={size}
                            total={total}
                            selected={selected.size}
                            onPage={(n) => {
                                setPage(n);
                                if (m.id !== "nodes") setSelected(new Set());
                            }}
                            onSize={(n) => {
                                setSize(n);
                                setPage(1);
                                if (m.id !== "nodes") setSelected(new Set());
                            }}
                        />
                    )}
                </>
            )}
            <Dialog
                open={!!edit}
                onClose={() => setEdit(null)}
                title={
                    activeAction?.label ||
                    (m.id === "machines" && !edit?.create
                        ? "编辑服务器"
                        : edit?.create
                          ? `添加${m.title}`
                          : `编辑${m.title}`)
                }
                description={activeAction?.confirm}
                wide={fields.length > 5}
            >
                {edit && (
                    <Form
                        key={`${edit.create}-${edit.row.id}-${activeAction?.endpoint}`}
                        fields={fields}
                        afterFields={
                            m.id === "machines" &&
                            !edit.create &&
                            !edit.action && (
                                <MachineCredentials id={edit.row.id} />
                            )
                        }
                        seed={
                            activeAction?.seed
                                ? activeAction.seed(edit.row)
                                : edit.row
                        }
                        onSubmit={submit}
                        onCancel={() => setEdit(null)}
                        submitLabel={activeAction?.danger ? "确认操作" : "保存"}
                    >
                        {!fields.length && (
                            <p>
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
            {detail?.kind === "ticket" ? (
                <TicketDesk
                    ticket={detail.row}
                    onClose={() => setDetail(null)}
                />
            ) : detail?.kind === "machine" ? (
                <MachineDesk
                    machine={
                        originalRows.find((r) => r.id === detail.row.id) ||
                        detail.row
                    }
                    onClose={() => {
                        setDetail(null);
                        if (params.has("machine_id"))
                            setParams({}, { replace: true });
                    }}
                    onChanged={refresh}
                />
            ) : (
                <Dialog
                    open={!!detail}
                    onClose={() => setDetail(null)}
                    title={
                        detail?.kind === "users"
                            ? "用户详情"
                            : detail?.kind === "orders"
                              ? "订单详情"
                              : detail?.kind === "user-traffic"
                                ? "TA的流量记录"
                                : detail?.kind === "user-reset"
                                  ? "重置流量"
                                  : detail?.kind === "reset-stats"
                                    ? "流量重置统计"
                                    : "详情"
                    }
                    wide
                >
                    {detail &&
                        (detail.kind === "users" ? (
                            <UserDetails user={detail.row} />
                        ) : detail.kind === "orders" ? (
                            <OrderDetails order={detail.row} />
                        ) : detail.kind === "user-traffic" ? (
                            <TrafficRecords userId={detail.row.id} />
                        ) : detail.kind === "user-reset" ? (
                            <UserReset user={detail.row} onDone={refresh} />
                        ) : detail.kind === "reset-stats" ? (
                            <ResetStats />
                        ) : detail.kind === "load" ? (
                            <NodeLoad node={detail.row} />
                        ) : (
                            <div className="detail-body">
                                <DataView data={detail.row} />
                            </div>
                        ))}
                </Dialog>
            )}
        </>
    );
}
