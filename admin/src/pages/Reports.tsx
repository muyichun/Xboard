import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { request } from "../lib/api";
import { rowsOf, errorMessage, downloadBlob } from "../lib/utils";
import { DataTable } from "../components/DataTable";
import { DataView } from "../components/DataView";
import { Loading, ErrorState } from "../components/Feedback";
import { Button } from "../components/ui/button";
import type { Row, Column } from "../lib/types";
const views: Record<
    string,
    { title: string; endpoint: string; params?: Row; columns?: Column[] }
> = {
    income: {
        title: "收入明细",
        endpoint: "stat/getOrder",
        columns: [
            { key: "date", label: "日期" },
            { key: "paid_total", label: "收入", format: "money" },
            { key: "paid_count", label: "订单数" },
            { key: "commission_total", label: "佣金支出", format: "money" },
            { key: "commission_count", label: "佣金笔数" },
        ],
    },
    users: {
        title: "用户流量排行",
        endpoint: "stat/getTrafficRank",
        params: { type: "user" },
        columns: [
            { key: "name", label: "用户" },
            { key: "value", label: "流量", format: "bytes" },
            { key: "change", label: "变化（%）" },
        ],
    },
    nodes: {
        title: "节点流量排行",
        endpoint: "stat/getTrafficRank",
        params: { type: "node" },
        columns: [
            { key: "name", label: "节点" },
            { key: "value", label: "流量", format: "bytes" },
            { key: "change", label: "变化（%）" },
        ],
    },
    gifts: { title: "礼品卡统计", endpoint: "gift-card/statistics" },
    resets: {
        title: "流量重置统计",
        endpoint: "traffic-reset/stats",
        params: { days: 30 },
    },
};
export default function Reports() {
    const [days, setDays] = useState(30);
    const [view, setView] = useState("income"),
        [start, setStart] = useState(
            new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
        ),
        [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
    const cfg = views[view];
    const q = useQuery({
        queryKey: ["reports", view, start, end, days],
        queryFn: () =>
            request(cfg.endpoint, {
                ...cfg.params,
                ...(view === "resets"
                    ? { days }
                    : ["users", "nodes"].includes(view)
                      ? {
                            start_time: Math.floor(
                                new Date(start).getTime() / 1000,
                            ),
                            end_time: Math.floor(
                                new Date(`${end}T23:59:59`).getTime() / 1000,
                            ),
                        }
                      : { start_date: start, end_date: end }),
            }),
    });
    const rows = view === "income" ? q.data?.data?.list || [] : rowsOf(q.data);
    return (
        <>
            <header className="page-header">
                <div>
                    <div className="eyebrow">经营分析</div>
                    <h1>数据报表</h1>
                    <p>查看经营趋势、流量排行与奖励使用情况</p>
                </div>
            </header>
            <section className="panel">
                <div className="toolbar">
                    <select
                        value={view}
                        aria-label="报表类型"
                        onChange={(e) => setView(e.target.value)}
                    >
                        {Object.entries(views).map(([k, v]) => (
                            <option value={k} key={k}>
                                {v.title}
                            </option>
                        ))}
                    </select>
                    {view === "resets" ? (
                        <select
                            aria-label="最近天数"
                            value={days}
                            onChange={(e) => setDays(Number(e.target.value))}
                        >
                            {[7, 30, 90].map((n) => (
                                <option value={n} key={n}>
                                    最近 {n} 天
                                </option>
                            ))}
                        </select>
                    ) : (
                        view !== "gifts" && (
                            <>
                                <label className="inline-filter">
                                    开始
                                    <input
                                        aria-label="开始日期"
                                        type="date"
                                        value={start}
                                        onChange={(e) =>
                                            setStart(e.target.value)
                                        }
                                    />
                                </label>
                                <label className="inline-filter">
                                    结束
                                    <input
                                        aria-label="结束日期"
                                        type="date"
                                        value={end}
                                        onChange={(e) => setEnd(e.target.value)}
                                    />
                                </label>
                            </>
                        )
                    )}
                    {cfg.columns && (
                        <Button
                            variant="outline"
                            onClick={() => {
                                const escape = (s: any) =>
                                    `"${String(s ?? "").replaceAll('"', '""')}"`;
                                const cols = cfg.columns!;
                                downloadBlob(
                                    new Blob(
                                        [
                                            "\ufeff" +
                                                [
                                                    cols
                                                        .map((c) =>
                                                            escape(c.label),
                                                        )
                                                        .join(","),
                                                    ...rows.map((r: Row) =>
                                                        cols
                                                            .map((c) =>
                                                                escape(
                                                                    r[c.key],
                                                                ),
                                                            )
                                                            .join(","),
                                                    ),
                                                ].join("\n"),
                                        ],
                                        { type: "text/csv;charset=utf-8" },
                                    ),
                                    "report.csv",
                                );
                            }}
                        >
                            导出报表
                        </Button>
                    )}
                </div>
                {q.isPending ? (
                    <Loading />
                ) : q.isError ? (
                    <ErrorState
                        message={errorMessage(q.error)}
                        retry={() => q.refetch()}
                    />
                ) : cfg.columns ? (
                    <DataTable columns={cfg.columns} rows={rows} />
                ) : (
                    <div className="detail-body">
                        <DataView data={q.data?.data} />
                    </div>
                )}
            </section>
        </>
    );
}
