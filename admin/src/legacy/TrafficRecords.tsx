import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    ArrowUp,
    ArrowDown,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
} from "lucide-react";
import { request } from "../lib/api";
import { bytes, rowsOf, errorMessage } from "../lib/utils";
import { trafficDate, trafficReportTime, trafficUsage } from "../lib/traffic";
import { Button } from "../components/ui/button";
import { Loading, ErrorState } from "../components/Feedback";

export function TrafficRecords({ userId }: { userId: number }) {
    const [page, setPage] = useState(1);
    const [size, setSize] = useState(20);
    const q = useQuery({
        queryKey: ["user-traffic", userId, page, size],
        queryFn: () =>
            request("stat/getStatUser", {
                user_id: userId,
                combined: 1,
                page,
                pageSize: size,
            }),
    });
    const timezone = q.data?.timezone || "Asia/Shanghai";
    const rows = rowsOf(q.data);
    const total = Number(q.data?.total || 0);
    const pages = Math.max(1, Math.ceil(total / size));
    const summary = q.data?.summary;
    return (
        <section className="traffic-records" aria-label="用户流量记录">
            <div className="traffic-toolbar">
                <strong>每日节点用量</strong>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="刷新流量记录"
                    disabled={q.isFetching}
                    onClick={() => q.refetch()}
                >
                    <RefreshCw size={15} />
                </Button>
            </div>
            <p className="traffic-note">
                按日期倒序分组，每行汇总同一节点和倍率；时间为首次 / 最近上报（
                {timezone}），精确到分钟，并非连接起止时间。
            </p>
            {q.isPending ? (
                <Loading />
            ) : q.isError ? (
                <ErrorState message={errorMessage(q.error)} />
            ) : (
                <>
                    <div className="traffic-summary">
                        <span>
                            共 <strong>{total}</strong> 条
                        </span>
                        <span>
                            {summary?.actual_incomplete
                                ? "已记录实际用量"
                                : "实际用量"}{" "}
                            <strong>
                                {bytes(
                                    Number(summary?.upload || 0) +
                                        Number(summary?.download || 0),
                                )}
                            </strong>
                        </span>
                        <span>
                            计费流量 <strong>{bytes(summary?.billed)}</strong>
                        </span>
                        <small>全部记录合计</small>
                    </div>
                    <div className="traffic-table-scroll">
                        <table className="traffic-table">
                            <thead>
                                <tr>
                                    <th>上报时间</th>
                                    <th>使用节点</th>
                                    <th className="traffic-number">上行流量</th>
                                    <th className="traffic-number">下行流量</th>
                                    <th className="traffic-rate-cell">倍率</th>
                                    <th className="traffic-number">计费流量</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length ? (
                                    rows.map((row, index) => {
                                        const usage = trafficUsage(row, true);
                                        const date = trafficDate(
                                            Number(row.record_at),
                                            timezone,
                                        );
                                        const previousDate = index
                                            ? trafficDate(
                                                  Number(
                                                      rows[index - 1].record_at,
                                                  ),
                                                  timezone,
                                              )
                                            : null;
                                        return (
                                            <Fragment key={row.id}>
                                                {date !== previousDate && (
                                                    <tr className="traffic-day-row">
                                                        <th colSpan={6}>
                                                            {date}
                                                        </th>
                                                    </tr>
                                                )}
                                                <tr className="traffic-data-row">
                                                    <td className="traffic-date">
                                                        {trafficReportTime(
                                                            row,
                                                            timezone,
                                                        )}
                                                    </td>
                                                    <td className="traffic-node">
                                                        <span
                                                            title={
                                                                row.server_name
                                                            }
                                                        >
                                                            {row.server_name}
                                                        </span>
                                                        <small>
                                                            {row.source ===
                                                            "legacy"
                                                                ? "旧记录未保存节点"
                                                                : `#${row.server_id} · ${row.server_type}`}
                                                        </small>
                                                    </td>
                                                    <td className="traffic-number">
                                                        <span className="traffic-amount">
                                                            <ArrowUp
                                                                className="traffic-upload"
                                                                size={13}
                                                                aria-hidden="true"
                                                            />
                                                            {usage.upload ===
                                                            null
                                                                ? "—"
                                                                : bytes(
                                                                      usage.upload,
                                                                  )}
                                                        </span>
                                                    </td>
                                                    <td className="traffic-number">
                                                        <span className="traffic-amount">
                                                            <ArrowDown
                                                                className="traffic-download"
                                                                size={13}
                                                                aria-hidden="true"
                                                            />
                                                            {usage.download ===
                                                            null
                                                                ? "—"
                                                                : bytes(
                                                                      usage.download,
                                                                  )}
                                                        </span>
                                                    </td>
                                                    <td className="traffic-rate-cell">
                                                        <span className="traffic-rate">
                                                            {Number(
                                                                row.server_rate,
                                                            )}
                                                            ×
                                                        </span>
                                                    </td>
                                                    <td className="traffic-number traffic-billed">
                                                        {bytes(usage.billed)}
                                                    </td>
                                                </tr>
                                            </Fragment>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="traffic-empty"
                                        >
                                            暂无流量记录
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <p className="traffic-note traffic-billing-note">
                        上下行为实际流量，计费流量已包含倍率。旧记录没有节点信息时会单独标注，且不与节点明细重复计算。
                    </p>
                    <footer className="traffic-pagination">
                        <label>
                            每页{" "}
                            <select
                                aria-label="流量每页条数"
                                value={size}
                                onChange={(e) => {
                                    setSize(Number(e.target.value));
                                    setPage(1);
                                }}
                            >
                                {[10, 20, 50, 100].map((n) => (
                                    <option key={n}>{n}</option>
                                ))}
                            </select>{" "}
                            条
                        </label>
                        <div>
                            <span>
                                {page} / {pages} 页
                            </span>
                            <Button
                                variant="outline"
                                size="icon"
                                aria-label="流量上一页"
                                disabled={page <= 1}
                                onClick={() => setPage(page - 1)}
                            >
                                <ChevronLeft size={16} />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                aria-label="流量下一页"
                                disabled={page >= pages}
                                onClick={() => setPage(page + 1)}
                            >
                                <ChevronRight size={16} />
                            </Button>
                        </div>
                    </footer>
                </>
            )}
        </section>
    );
}
