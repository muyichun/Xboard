import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
    Wallet,
    Users,
    Server,
    Activity,
    RefreshCw,
    Ticket,
    TrendingUp,
} from "lucide-react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { request } from "../lib/api";
import { money, bytes, rowsOf, errorMessage } from "../lib/utils";
import { Loading, ErrorState, Empty } from "../components/Feedback";
import { Button } from "../components/ui/button";
import { DataTable } from "../components/DataTable";
export default function Dashboard() {
    const [days, setDays] = useState(30);
    const start = new Date(Date.now() - days * 86400000)
        .toISOString()
        .slice(0, 10);
    const q = useQuery({
        queryKey: ["dashboard"],
        queryFn: () => request("stat/getStats"),
        refetchInterval: 60000,
    });
    const chart = useQuery({
        queryKey: ["income", days],
        queryFn: () => request("stat/getOrder", { start_date: start }),
    });
    const rank = useQuery({
        queryKey: ["rank", days],
        queryFn: () =>
            request("stat/getTrafficRank", {
                type: "node",
                start_time: Math.floor(Date.now() / 1000) - days * 86400,
            }),
    });
    const s = q.data?.data;
    const line = (chart.data?.data?.list || []).map((r: any) => ({
        ...r,
        income: Number(r.paid_total) / 100,
    }));
    return (
        <>
            <header className="page-header">
                <div>
                    <div className="eyebrow">运行概览</div>
                    <h1>仪表盘</h1>
                    <p>关注关键指标，快速处理今天的工作</p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => {
                        q.refetch();
                        chart.refetch();
                        rank.refetch();
                    }}
                >
                    <RefreshCw size={16} />
                    刷新数据
                </Button>
            </header>
            {q.isPending ? (
                <Loading />
            ) : q.isError ? (
                <ErrorState
                    message={errorMessage(q.error)}
                    retry={() => q.refetch()}
                />
            ) : (
                <>
                    <div className="metric-grid">
                        {[
                            {
                                label: "今日收入",
                                value: money(s.todayIncome),
                                hint: `本月 ${money(s.currentMonthIncome)}`,
                                icon: Wallet,
                            },
                            {
                                label: "总用户",
                                value: Number(s.totalUsers).toLocaleString(
                                    "zh-CN",
                                ),
                                hint: `本月新增 ${s.currentMonthNewUsers} 人`,
                                icon: Users,
                            },
                            {
                                label: "在线节点",
                                value: s.onlineNodes,
                                hint: `在线用户 ${s.onlineUsers} 人`,
                                icon: Server,
                            },
                            {
                                label: "今日流量",
                                value: bytes(s.todayTraffic?.total),
                                hint: `本月 ${bytes(s.monthTraffic?.total)}`,
                                icon: Activity,
                            },
                        ].map((c) => (
                            <article className="panel metric" key={c.label}>
                                <div>
                                    <span>{c.label}</span>
                                    <c.icon size={20} />
                                </div>
                                <strong>{c.value}</strong>
                                <small>{c.hint}</small>
                            </article>
                        ))}
                    </div>
                    <div className="dashboard-grid">
                        <section className="panel chart-panel">
                            <header className="section-header">
                                <div>
                                    <h2>收入趋势</h2>
                                    <p>已支付订单金额</p>
                                </div>
                                <select
                                    aria-label="统计时间范围"
                                    value={days}
                                    onChange={(e) =>
                                        setDays(Number(e.target.value))
                                    }
                                >
                                    <option value={7}>最近 7 天</option>
                                    <option value={30}>最近 30 天</option>
                                    <option value={90}>最近 90 天</option>
                                </select>
                            </header>
                            {chart.isPending ? (
                                <Loading />
                            ) : chart.isError ? (
                                <ErrorState
                                    message={errorMessage(chart.error)}
                                    retry={() => chart.refetch()}
                                />
                            ) : line.length ? (
                                <div className="chart">
                                    <ResponsiveContainer
                                        width="100%"
                                        height="100%"
                                    >
                                        <AreaChart data={line}>
                                            <defs>
                                                <linearGradient
                                                    id="income-fill"
                                                    x1="0"
                                                    y1="0"
                                                    x2="0"
                                                    y2="1"
                                                >
                                                    <stop
                                                        offset="0%"
                                                        stopColor="#2563eb"
                                                        stopOpacity={0.2}
                                                    />
                                                    <stop
                                                        offset="100%"
                                                        stopColor="#2563eb"
                                                        stopOpacity={0}
                                                    />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid
                                                strokeDasharray="3 3"
                                                vertical={false}
                                                stroke="var(--border)"
                                            />
                                            <XAxis
                                                dataKey="date"
                                                tickFormatter={(v) =>
                                                    v.slice(5)
                                                }
                                                tickLine={false}
                                                axisLine={false}
                                                fontSize={12}
                                            />
                                            <YAxis
                                                tickLine={false}
                                                axisLine={false}
                                                fontSize={12}
                                                width={50}
                                            />
                                            <Tooltip
                                                formatter={(v) => [
                                                    `¥${Number(v).toFixed(2)}`,
                                                    "收入",
                                                ]}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="income"
                                                stroke="#2563eb"
                                                strokeWidth={2.5}
                                                fill="url(#income-fill)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <Empty text="此时间范围暂无收入记录" />
                            )}
                        </section>
                        <section className="panel work-panel">
                            <header className="section-header">
                                <h2>待办事项</h2>
                            </header>
                            <Link to="/tickets" className="task-link">
                                <div className="task-icon">
                                    <Ticket size={20} />
                                </div>
                                <div>
                                    <strong>待处理工单</strong>
                                    <span>及时响应用户问题</span>
                                </div>
                                <b>{s.ticketPendingTotal}</b>
                            </Link>
                            <Link to="/commissions" className="task-link">
                                <div className="task-icon purple">
                                    <TrendingUp size={20} />
                                </div>
                                <div>
                                    <strong>待确认佣金</strong>
                                    <span>核对邀请奖励</span>
                                </div>
                                <b>{s.commissionPendingTotal}</b>
                            </Link>
                            <div className="work-summary">
                                <span>有效订阅用户</span>
                                <strong>{s.activeUsers}</strong>
                                <span>在线设备</span>
                                <strong>{s.onlineDevices}</strong>
                                <span>本月佣金支出</span>
                                <strong>
                                    {money(s.currentMonthCommissionPayout)}
                                </strong>
                            </div>
                        </section>
                    </div>
                    <section className="panel">
                        <header className="section-header">
                            <div>
                                <h2>节点流量排行</h2>
                                <p>最近 {days} 天</p>
                            </div>
                            <Link to="/nodes">管理节点</Link>
                        </header>
                        {rank.isPending ? (
                            <Loading />
                        ) : rank.isError ? (
                            <ErrorState
                                message={errorMessage(rank.error)}
                                retry={() => rank.refetch()}
                            />
                        ) : (
                            <DataTable
                                rows={rowsOf(rank.data)}
                                columns={[
                                    { key: "name", label: "节点名称" },
                                    {
                                        key: "value",
                                        label: "总流量",
                                        format: "bytes",
                                    },
                                    { key: "change", label: "较上期变化（%）" },
                                ]}
                            />
                        )}
                    </section>
                </>
            )}
        </>
    );
}
