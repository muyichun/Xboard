import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
} from "recharts";
import type { Row } from "../lib/types";
import { request } from "../lib/api";
import { rowsOf, time, errorMessage } from "../lib/utils";
import { Dialog } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Notice, Loading, ErrorState } from "../components/Feedback";
import { DataTable } from "../components/DataTable";
import { Status, Switch, Load, machineState } from "./Cells";
export default function MachineDesk({
    machine: r,
    onClose,
    onChanged,
}: {
    machine: Row;
    onClose: () => void;
    onChanged: () => void;
}) {
    const [tab, setTab] = useState("nodes"),
        [hours, setHours] = useState(6),
        [binding, setBinding] = useState(false),
        [selected, setSelected] = useState(new Set<string>()),
        [search, setSearch] = useState(""),
        [error, setError] = useState(""),
        [busy, setBusy] = useState(false);
    const navigate = useNavigate();
    const nodes = useQuery({
            queryKey: ["machine-nodes", r.id],
            queryFn: () =>
                request("server/machine/nodes", { machine_id: r.id }),
        }),
        all = useQuery({
            queryKey: ["machine-bind-options"],
            queryFn: () => request("server/manage/getNodes"),
            enabled: binding,
            staleTime: 0,
        }),
        history = useQuery({
            queryKey: ["machine-history", r.id, hours],
            queryFn: () =>
                request("server/machine/history", {
                    machine_id: r.id,
                    range_hours: hours,
                    limit: 1440,
                }),
            enabled: tab === "history",
            refetchInterval: 15000,
        });
    async function run(fn: () => Promise<void>) {
        setError("");
        setBusy(true);
        try {
            await fn();
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    }
    async function update(node: Row, patch: Row) {
        await request(
            "server/manage/update",
            { id: node.id, ...patch },
            "post",
        );
        await nodes.refetch();
        onChanged();
    }
    const metrics = rowsOf(history.data).map((row) => ({
        ...row,
        label: new Date(row.recorded_at * 1000).toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
        }),
        memory: row.mem_total ? (row.mem_used / row.mem_total) * 100 : null,
        disk: row.disk_total ? (row.disk_used / row.disk_total) * 100 : null,
        incoming: row.net_in_speed == null ? null : row.net_in_speed / 1024,
        outgoing: row.net_out_speed == null ? null : row.net_out_speed / 1024,
    }));
    return (
        <>
            <Dialog
                open={!binding}
                onClose={onClose}
                title={`服务器详情 · ${r.name}`}
                wide
            >
                <div className="detail-body">
                    <Notice message={error} error />
                    <div className="machine-overview">
                        <div>
                            <Status
                                tone={
                                    machineState(r) === "online"
                                        ? "green"
                                        : "gray"
                                }
                            >
                                {
                                    {
                                        online: "在线",
                                        offline: "离线",
                                        inactive: "已禁用",
                                        never: "从未上报",
                                    }[machineState(r)]
                                }
                            </Status>
                            <p>{r.notes || "暂无备注"}</p>
                            <small>最后心跳：{time(r.last_seen_at)}</small>
                        </div>
                        <Load data={r.load_status} />
                    </div>
                    <div className="tabs">
                        {[
                            ["nodes", "关联节点"],
                            ["history", "负载历史"],
                        ].map(([k, l]) => (
                            <button
                                key={k}
                                className={tab === k ? "active" : ""}
                                onClick={() => setTab(k)}
                            >
                                {l}
                            </button>
                        ))}
                    </div>
                    {tab === "nodes" ? (
                        <>
                            <div className="toolbar">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSelected(new Set());
                                        setBinding(true);
                                    }}
                                >
                                    关联已有节点
                                </Button>
                                <Button
                                    onClick={() => {
                                        onClose();
                                        navigate(
                                            `/server/manage?machine_id=${r.id}&open_create=1`,
                                        );
                                    }}
                                >
                                    新增节点到该服务器
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        onClose();
                                        navigate(
                                            `/server/manage?machine_id=${r.id}`,
                                        );
                                    }}
                                >
                                    前往节点管理
                                </Button>
                            </div>
                            {nodes.isPending ? (
                                <Loading />
                            ) : nodes.isError ? (
                                <ErrorState
                                    message={errorMessage(nodes.error)}
                                />
                            ) : (
                                <DataTable
                                    rows={rowsOf(nodes.data)}
                                    columns={[
                                        { key: "id", label: "ID" },
                                        { key: "name", label: "节点名称" },
                                        { key: "type", label: "类型" },
                                        { key: "host", label: "地址" },
                                        { key: "port", label: "端口" },
                                    ]}
                                    actions={(node) => (
                                        <div className="cell-line">
                                            <Switch
                                                disabled={busy}
                                                label={`启用节点 ${node.id}`}
                                                value={node.enabled}
                                                onChange={() =>
                                                    run(() =>
                                                        update(node, {
                                                            enabled:
                                                                Number(
                                                                    node.enabled,
                                                                ) !== 1,
                                                        }),
                                                    )
                                                }
                                            />
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                disabled={busy}
                                                onClick={() => {
                                                    if (
                                                        window.confirm(
                                                            `确认取消 ${node.name} 与此服务器的关联？`,
                                                        )
                                                    )
                                                        run(() =>
                                                            update(node, {
                                                                machine_id:
                                                                    null,
                                                            }),
                                                        );
                                                }}
                                            >
                                                取消关联
                                            </Button>
                                        </div>
                                    )}
                                />
                            )}
                        </>
                    ) : (
                        <>
                            <div className="tabs">
                                {[1, 6, 12, 24].map((n) => (
                                    <button
                                        key={n}
                                        className={hours === n ? "active" : ""}
                                        onClick={() => setHours(n)}
                                    >
                                        最近 {n} 小时
                                    </button>
                                ))}
                            </div>
                            {history.isPending ? (
                                <Loading />
                            ) : history.isError ? (
                                <ErrorState
                                    message={errorMessage(history.error)}
                                />
                            ) : metrics.length ? (
                                <>
                                    <h3>CPU / 内存 / 磁盘使用率 (%)</h3>
                                    <ResponsiveContainer
                                        width="100%"
                                        height={240}
                                    >
                                        <LineChart data={metrics}>
                                            <XAxis dataKey="label" />
                                            <YAxis domain={[0, 100]} />
                                            <Tooltip />
                                            <Legend />
                                            {[
                                                ["cpu", "CPU", "#2563eb"],
                                                ["memory", "内存", "#22c55e"],
                                                ["disk", "磁盘", "#f59e0b"],
                                            ].map(([key, name, color]) => (
                                                <Line
                                                    key={key}
                                                    name={name}
                                                    dataKey={key}
                                                    stroke={color}
                                                    dot={metrics.length === 1}
                                                />
                                            ))}
                                        </LineChart>
                                    </ResponsiveContainer>
                                    <h3>网络速率 (KiB/s)</h3>
                                    <ResponsiveContainer
                                        width="100%"
                                        height={220}
                                    >
                                        <LineChart data={metrics}>
                                            <XAxis dataKey="label" />
                                            <YAxis />
                                            <Tooltip />
                                            <Legend />
                                            <Line
                                                name="入站"
                                                dataKey="incoming"
                                                stroke="#2563eb"
                                                dot={metrics.length === 1}
                                            />
                                            <Line
                                                name="出站"
                                                dataKey="outgoing"
                                                stroke="#22c55e"
                                                dot={metrics.length === 1}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </>
                            ) : (
                                <p className="empty">暂无负载历史</p>
                            )}
                        </>
                    )}
                </div>
            </Dialog>
            <Dialog
                open={binding}
                onClose={() => setBinding(false)}
                title="关联已有节点"
                wide
            >
                <div className="detail-body">
                    <Notice message={error} error />
                    <input
                        aria-label="搜索待关联节点"
                        placeholder="搜索节点名称..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    {all.isError ? (
                        <ErrorState message={errorMessage(all.error)} />
                    ) : (
                        <DataTable
                            rows={rowsOf(all.data).filter(
                                (n) =>
                                    n.machine_id !== r.id &&
                                    n.name
                                        .toLowerCase()
                                        .includes(search.toLowerCase()),
                            )}
                            columns={[
                                { key: "id", label: "ID" },
                                { key: "name", label: "节点名称" },
                                { key: "type", label: "类型" },
                                { key: "machine_id", label: "当前服务器ID" },
                            ]}
                            selected={selected}
                            onSelect={setSelected}
                        />
                    )}
                    <p className="muted">
                        选择已关联其他服务器的节点，会将其迁移到当前服务器。
                    </p>
                    <Button
                        disabled={!selected.size || busy}
                        onClick={() =>
                            run(async () => {
                                await request(
                                    "server/manage/batchUpdate",
                                    {
                                        ids: [...selected].map(Number),
                                        machine_id: r.id,
                                    },
                                    "post",
                                );
                                setBinding(false);
                                await nodes.refetch();
                                onChanged();
                            })
                        }
                    >
                        关联选中的 {selected.size} 个节点
                    </Button>
                </div>
            </Dialog>
        </>
    );
}
