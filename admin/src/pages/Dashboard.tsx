import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
    RefreshCw,
    ArrowDownToLine,
    BarChart3,
    Bell,
    Download,
    MessagesSquare,
    Upload,
    Users,
    Server,
    Activity,
    TrendingUp,
    TrendingDown,
} from "lucide-react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";
import { request } from "../lib/api";
import { money, bytes, rowsOf, errorMessage } from "../lib/utils";
import { Loading, ErrorState, Empty } from "../components/Feedback";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { DataTable, Pagination } from "../components/DataTable";
import { DataView } from "../components/DataView";
import type { Row } from "../lib/types";
const date = (n = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const amountAxis = new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 4,
});

function Range({
    days,
    setDays,
    start,
    setStart,
    end,
    setEnd,
    rank = false,
}: {
    days: number;
    setDays: (n: number) => void;
    start: string;
    setStart: (s: string) => void;
    end: string;
    setEnd: (s: string) => void;
    rank?: boolean;
}) {
    return (
        <div className="range-control">
            <select
                aria-label={rank ? "排行时间范围" : "收入时间范围"}
                value={days}
                onChange={(e) => {
                    const n = Number(e.target.value);
                    setDays(n);
                    if (n >= 0) {
                        setStart(date(n === 0 ? 0 : n - 1));
                        setEnd(date());
                    }
                }}
            >
                {(rank ? [0, 7, 30] : [7, 30, 90, 180, 365]).map((n) => (
                    <option key={n} value={n}>
                        {n === 0 ? "今天" : `最近 ${n} 天`}
                    </option>
                ))}
                <option value={-1}>自定义</option>
            </select>
            {days === -1 && (
                <>
                    <input
                        aria-label="开始日期"
                        type="date"
                        max={end}
                        value={start}
                        onChange={(e) => setStart(e.target.value)}
                    />
                    <span>至</span>
                    <input
                        aria-label="结束日期"
                        type="date"
                        min={start}
                        value={end}
                        onChange={(e) => setEnd(e.target.value)}
                    />
                </>
            )}
        </div>
    );
}
function Income() {
    const [days, setDays] = useState(30),
        [start, setStart] = useState(date(29)),
        [end, setEnd] = useState(date()),
        [showAmount, setShowAmount] = useState(true);
    const validRange = Boolean(start && end && start <= end);
    const q = useQuery({
        queryKey: ["dashboard-income", start, end],
        queryFn: () =>
            request("stat/getOrder", { start_date: start, end_date: end }),
        enabled: validRange,
    });
    const s = q.data?.data?.summary || {},
        rows = (q.data?.data?.list || [])
            .map((r: Row) => ({
                ...r,
                income: showAmount ? r.paid_total / 100 : r.paid_count,
                commission: showAmount
                    ? r.commission_total / 100
                    : r.commission_count,
            }))
            .sort((a: Row, b: Row) => a.date.localeCompare(b.date));
    return (
        <section className="panel dashboard-income">
            <header className="section-header income-header">
                <div>
                    <h2>收入概览</h2>
                    {validRange && (
                        <p className="tabular">
                            {start} 至 {end}
                        </p>
                    )}
                </div>
                <div className="income-controls">
                    <Range
                        {...{ days, setDays, start, setStart, end, setEnd }}
                    />
                    <div
                        className="income-mode"
                        role="group"
                        aria-label="统计单位"
                    >
                        <button
                            type="button"
                            aria-pressed={showAmount}
                            onClick={() => setShowAmount(true)}
                        >
                            金额
                        </button>
                        <button
                            type="button"
                            aria-pressed={!showAmount}
                            onClick={() => setShowAmount(false)}
                        >
                            数量
                        </button>
                    </div>
                </div>
            </header>
            <div className="chart-body">
                {!validRange ? (
                    <ErrorState message="请选择有效的开始和结束日期" />
                ) : q.isPending ? (
                    <Loading />
                ) : q.isError ? (
                    <ErrorState message={errorMessage(q.error)} />
                ) : (
                    <>
                        <div className="income-summary">
                            <div>
                                <small>总收入</small>
                                <strong>{money(s.paid_total)}</strong>
                                <small>共 {s.paid_count || 0} 笔交易</small>
                                <small>
                                    平均订单金额: {money(s.avg_paid_amount)}
                                </small>
                            </div>
                            <div>
                                <small>总佣金</small>
                                <strong>{money(s.commission_total)}</strong>
                                <small>
                                    共 {s.commission_count || 0} 笔发放
                                </small>
                                <small>
                                    佣金比例:{" "}
                                    {s.paid_total
                                        ? (
                                              (s.commission_total /
                                                  s.paid_total) *
                                              100
                                          ).toFixed(1)
                                        : 0}
                                    %
                                </small>
                            </div>
                        </div>
                        {rows.length === 0 ? (
                            <Empty text="当前时段暂无交易记录" hint={null} />
                        ) : (
                            <div className="income-chart">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={rows}>
                                        <CartesianGrid
                                            strokeDasharray="3 4"
                                            vertical={false}
                                            stroke="var(--border)"
                                        />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={(value: string) =>
                                                value.slice(5)
                                            }
                                            tickLine={false}
                                            axisLine={false}
                                            tick={{
                                                fill: "var(--muted)",
                                                fontSize: 11,
                                            }}
                                            minTickGap={20}
                                        />
                                        <YAxis
                                            width="auto"
                                            allowDecimals={showAmount}
                                            tickFormatter={
                                                showAmount
                                                    ? amountAxis.format
                                                    : undefined
                                            }
                                            tickLine={false}
                                            axisLine={false}
                                            tick={{
                                                fill: "var(--muted)",
                                                fontSize: 11,
                                            }}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor:
                                                    "var(--surface)",
                                                border: "1px solid var(--border)",
                                                borderRadius: 8,
                                            }}
                                            labelStyle={{
                                                color: "var(--text)",
                                            }}
                                            formatter={(value) =>
                                                showAmount
                                                    ? money(Number(value) * 100)
                                                    : value
                                            }
                                        />
                                        <Legend />
                                        <Area
                                            type="monotone"
                                            name={
                                                showAmount
                                                    ? "订单金额 (元)"
                                                    : "订单数量"
                                            }
                                            dataKey="income"
                                            stroke="var(--chart-income)"
                                            strokeWidth={2}
                                            fill="var(--chart-income)"
                                            fillOpacity={0.14}
                                        />
                                        <Area
                                            type="monotone"
                                            name={
                                                showAmount
                                                    ? "佣金金额 (元)"
                                                    : "佣金数量"
                                            }
                                            dataKey="commission"
                                            stroke="var(--chart-commission)"
                                            strokeWidth={2}
                                            fill="var(--chart-commission)"
                                            fillOpacity={0.1}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </>
                )}
            </div>
        </section>
    );
}
function TrafficRank({ type }: { type: "node" | "user" }) {
    const [days, setDays] = useState(0),
        [start, setStart] = useState(date()),
        [end, setEnd] = useState(date());
    const q = useQuery({
        queryKey: ["dashboard-rank", type, start, end],
        queryFn: () =>
            request("stat/getTrafficRank", {
                type,
                start_time: Math.floor(
                    new Date(`${start}T00:00:00`).getTime() / 1000,
                ),
                end_time: Math.floor(
                    new Date(`${end}T23:59:59`).getTime() / 1000,
                ),
            }),
        enabled: !!start && !!end && start <= end,
    });
    return (
        <section className="panel">
            <header className="section-header">
                <h2>{type === "node" ? "节点流量排行" : "用户流量排行"}</h2>
                <Range
                    {...{ days, setDays, start, setStart, end, setEnd }}
                    rank
                />
            </header>
            {q.isPending ? (
                <Loading />
            ) : q.isError ? (
                <ErrorState message={errorMessage(q.error)} />
            ) : !rowsOf(q.data).length ? (
                <Empty text="当前时段暂无流量数据" hint={null} />
            ) : (
                <div className="rank-list">
                    {rowsOf(q.data).map((r, i) => (
                        <div
                            key={r.id}
                            title={`本期: ${bytes(r.value)}\n上期: ${bytes(r.previousValue)}\n变化率: ${r.change}%`}
                        >
                            <span className="rank-number">{i + 1}</span>
                            <div>
                                <span>{r.name}</span>
                                <progress
                                    max={Number(rowsOf(q.data)[0]?.value) || 1}
                                    value={Number(r.value)}
                                />
                            </div>
                            <strong>{bytes(r.value)}</strong>
                            <small className={r.change > 0 ? "error" : ""}>
                                {r.change > 0 ? "+" : ""}
                                {r.change}%
                            </small>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
function Queue() {
    const [failed, setFailed] = useState(false),
        [page, setPage] = useState(1),
        [size, setSize] = useState(20),
        [job, setJob] = useState<Row | null>(null);
    const q = useQuery({
            queryKey: ["dashboard-queue"],
            queryFn: () => request("system/getQueueStats"),
            refetchInterval: 30000,
        }),
        jobs = useQuery({
            queryKey: ["dashboard-failed", page, size],
            queryFn: () =>
                request("system/getHorizonFailedJobs", {
                    current: page,
                    page_size: size,
                }),
            enabled: failed,
        });
    const s = q.data?.data || {};
    return (
        <section className="panel queue-panel">
            <header className="section-header">
                <h2>队列概览</h2>
                <Button
                    size="icon"
                    variant="ghost"
                    aria-label="刷新队列"
                    onClick={() => q.refetch()}
                >
                    <RefreshCw size={15} />
                </Button>
            </header>
            {q.isPending ? (
                <Loading />
            ) : q.isError ? (
                <ErrorState message={errorMessage(q.error)} />
            ) : (
                <div className="queue-grid">
                    {[
                        [
                            "运行状态",
                            s.status === true || s.status === "running"
                                ? "运行中"
                                : s.status === "paused" || s.pausedMasters > 0
                                  ? "已暂停"
                                  : "未运行",
                            "",
                        ],
                        [
                            "当前等待",
                            `${Object.values(s.wait || {})[0] || 0} 秒`,
                            "",
                        ],
                        [
                            "近期任务",
                            s.recentJobs,
                            `过去 ${Number(s.periods?.recentJobs || 0) / 60} 小时`,
                        ],
                        ["每分钟处理", s.jobsPerMinute, "任务 / 分钟"],
                        [
                            "失败任务",
                            s.failedJobs,
                            `保留 ${Number(s.periods?.failedJobs || 0) / 60} 小时`,
                        ],
                        ["最大吞吐队列", s.queueWithMaxThroughput || "—", ""],
                        ["最长运行队列", s.queueWithMaxRuntime || "—", ""],
                        [
                            "进程数",
                            s.processes,
                            `暂停的主进程 ${s.pausedMasters || 0}`,
                        ],
                    ].map(([label, value, hint]) => (
                        <div key={String(label)}>
                            <small>{label}</small>
                            {label === "失败任务" ? (
                                <button
                                    className="text-link"
                                    onClick={() => setFailed(true)}
                                >
                                    {value ?? 0}
                                </button>
                            ) : (
                                <strong>{value ?? 0}</strong>
                            )}
                            <small>{hint}</small>
                        </div>
                    ))}
                </div>
            )}
            <Dialog
                open={failed}
                onClose={() => setFailed(false)}
                title="失败任务"
                wide
            >
                <div className="detail-body">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => jobs.refetch()}
                    >
                        刷新
                    </Button>
                    {jobs.isPending ? (
                        <Loading />
                    ) : jobs.isError ? (
                        <ErrorState message={errorMessage(jobs.error)} />
                    ) : (
                        <>
                            <DataTable
                                rows={rowsOf(jobs.data)}
                                columns={[
                                    { key: "id", label: "任务ID" },
                                    { key: "name", label: "任务名称" },
                                    { key: "queue", label: "队列" },
                                    {
                                        key: "failed_at",
                                        label: "失败时间",
                                        format: "time",
                                    },
                                ]}
                                actions={(r) => (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setJob(r)}
                                    >
                                        详情
                                    </Button>
                                )}
                            />
                            <Pagination
                                page={page}
                                size={size}
                                total={jobs.data?.total || 0}
                                onPage={setPage}
                                onSize={(n) => {
                                    setSize(n);
                                    setPage(1);
                                }}
                            />
                        </>
                    )}
                </div>
            </Dialog>
            <Dialog
                open={!!job}
                onClose={() => setJob(null)}
                title="失败任务详情"
                wide
            >
                <div className="detail-body">
                    <h3>异常</h3>
                    <pre className="exception-text">{job?.exception}</pre>
                    <h3>任务数据</h3>
                    <DataView data={job?.payload} />
                </div>
            </Dialog>
        </section>
    );
}
export default function Dashboard() {
    const q = useQuery({
        queryKey: ["dashboard"],
        queryFn: () => request("stat/getStats"),
        refetchInterval: 60000,
    });
    const s = q.data?.data || {};
    const cards = [
        {
            label: "今日收入",
            value: money(s.todayIncome),
            hint: "较昨日",
            growth: s.dayIncomeGrowth,
            icon: ArrowDownToLine,
            tone: "green",
        },
        {
            label: "月收入",
            value: money(s.currentMonthIncome),
            hint: "较上月",
            growth: s.monthIncomeGrowth,
            icon: BarChart3,
            tone: "blue",
        },
        {
            label: "待处理工单",
            value: s.ticketPendingTotal,
            hint: s.ticketPendingTotal ? "有工单需要处理" : "无待处理工单",
            icon: MessagesSquare,
            tone: s.ticketPendingTotal > 0 ? "amber" : "neutral",
            attention: s.ticketPendingTotal > 0,
            link: "/user/ticket",
        },
        {
            label: "待处理佣金",
            value: s.commissionPendingTotal,
            hint: s.commissionPendingTotal ? "有佣金需要处理" : "无待处理佣金",
            icon: Bell,
            tone: s.commissionPendingTotal > 0 ? "amber" : "neutral",
            attention: s.commissionPendingTotal > 0,
            link: "/finance/order?commission_status=0&status=3&commission_balance=gt:0",
        },
        {
            label: "月新增用户",
            value: s.currentMonthNewUsers,
            hint: "较上月",
            growth: s.userGrowth,
            icon: Users,
            tone: "blue",
        },
        {
            label: "总用户",
            value: s.totalUsers,
            hint: `有效用户 ${s.activeUsers || 0}`,
            icon: Users,
            tone: "neutral",
        },
        {
            label: "月上传",
            value: bytes(s.monthTraffic?.upload),
            hint: `今日 ${bytes(s.todayTraffic?.upload)}`,
            icon: Upload,
            tone: "green",
        },
        {
            label: "月下载",
            value: bytes(s.monthTraffic?.download),
            hint: `今日 ${bytes(s.todayTraffic?.download)}`,
            icon: Download,
            tone: "blue",
        },
    ];
    return (
        <div className="dashboard">
            {q.isPending ? (
                <Loading />
            ) : q.isError ? (
                <ErrorState message={errorMessage(q.error)} />
            ) : (
                <div className="metric-grid">
                    {cards.map((c) => {
                        const growth = Number(c.growth);
                        const value = c.value ?? 0;
                        return (
                            <section
                                className={`panel metric${c.attention ? " metric-attention" : ""}`}
                                key={c.label}
                            >
                                <div className="metric-label">
                                    <h2>{c.label}</h2>
                                    <c.icon
                                        size={17}
                                        className={`metric-icon tone-${c.tone}`}
                                    />
                                </div>
                                <strong>
                                    {c.link ? (
                                        <Link
                                            className="metric-link"
                                            to={c.link}
                                            aria-label={`${c.label}：${value}`}
                                        >
                                            {value}
                                        </Link>
                                    ) : (
                                        value
                                    )}
                                </strong>
                                <small className="metric-hint">
                                    {c.growth != null && (
                                        <span
                                            className={`metric-trend ${growth > 0 ? "tone-green" : growth < 0 ? "error" : ""}`}
                                        >
                                            {growth > 0 && (
                                                <TrendingUp size={14} />
                                            )}
                                            {growth < 0 && (
                                                <TrendingDown size={14} />
                                            )}
                                            {growth > 0 ? "+" : ""}
                                            {growth || 0}%
                                        </span>
                                    )}
                                    <span>{c.hint}</span>
                                </small>
                            </section>
                        );
                    })}
                </div>
            )}
            <Income />
            <div className="dashboard-ranks">
                <TrafficRank type="node" />
                <TrafficRank type="user" />
            </div>
            <Queue />
        </div>
    );
}
