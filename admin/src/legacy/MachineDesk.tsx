import { useEffect, useState } from "react";
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
import { Copy, Status, Switch, Load, machineState } from "./Cells";
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
        [token, setToken] = useState(""),
        [command, setCommand] = useState(""),
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
        }),
        history = useQuery({
            queryKey: ["machine-history", r.id, hours],
            queryFn: () =>
                request("server/machine/history", {
                    machine_id: r.id,
                    range_hours: hours,
                    limit: 300,
                }),
            enabled: tab === "history",
        });
    useEffect(() => {
        if (!token && !command) return;
        const timer = setTimeout(() => {
            setToken("");
            setCommand("");
        }, 180000);
        return () => clearTimeout(timer);
    }, [token, command]);
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
        memory: row.mem_total ? (row.mem_used / row.mem_total) * 100 : 0,
        disk: row.disk_total ? (row.disk_used / row.disk_total) * 100 : 0,
        incoming: row.net_in_speed / 1024,
        outgoing: row.net_out_speed / 1024,
    }));
    return (
        <>
            <Dialog
                open
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
                            ["install", "安装与认证"],
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
                                                label={`启用节点 ${node.id}`}
                                                value={node.enabled}
                                                onChange={() =>
                                                    run(() =>
                                                        update(node, {
                                                            enabled:
                                                                !node.enabled,
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
                    ) : tab === "history" ? (
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
                                                    dot={false}
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
                                                dot={false}
                                            />
                                            <Line
                                                name="出站"
                                                dataKey="outgoing"
                                                stroke="#22c55e"
                                                dot={false}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </>
                            ) : (
                                <p className="empty">暂无负载历史</p>
                            )}
                        </>
                    ) : (
                        <>
                            <h3>机器 Token</h3>
                            <div className="toolbar">
                                <code>
                                    {token || "••••••••••••••••••••••••"}
                                </code>
                                {token && <Copy value={token} />}
                                <Button
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() =>
                                        token
                                            ? setToken("")
                                            : run(async () =>
                                                  setToken(
                                                      (
                                                          await request(
                                                              "server/machine/getToken",
                                                              { id: r.id },
                                                          )
                                                      ).data.token,
                                                  ),
                                              )
                                    }
                                >
                                    {token ? "隐藏" : "显示"}
                                </Button>
                                <Button
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() => {
                                        if (
                                            window.confirm(
                                                "重置后旧 Token 将失效，需要更新节点配置。确定继续？",
                                            )
                                        )
                                            run(async () => {
                                                setToken(
                                                    (
                                                        await request(
                                                            "server/machine/resetToken",
                                                            { id: r.id },
                                                            "post",
                                                        )
                                                    ).data.token,
                                                );
                                                setCommand("");
                                            });
                                    }}
                                >
                                    重置 Token
                                </Button>
                            </div>
                            <small>显示内容将在 180 秒后自动隐藏。</small>
                            <h3>安装命令</h3>
                            <Button
                                variant="outline"
                                disabled={busy}
                                onClick={() =>
                                    run(async () =>
                                        setCommand(
                                            (
                                                await request(
                                                    "server/machine/installCommand",
                                                    { id: r.id },
                                                )
                                            ).data.command,
                                        ),
                                    )
                                }
                            >
                                获取安装命令
                            </Button>
                            {command && (
                                <div className="command-code">
                                    <pre>{command}</pre>
                                    <Copy value={command} />
                                </div>
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
