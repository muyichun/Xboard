import { useState } from "react";
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
import { trafficDate, trafficUsage } from "../lib/traffic";
import { Button } from "../components/ui/button";
import { Loading, ErrorState } from "../components/Feedback";

const emptyFilters = { start_date: "", end_date: "", node_name: "" };
export function TrafficRecords({ userId }: { userId: number }) {
    const [detail, setDetail] = useState(true);
    const [page, setPage] = useState(1);
    const [size, setSize] = useState(20);
    const [draft, setDraft] = useState(emptyFilters);
    const [filters, setFilters] = useState(emptyFilters);
    const [validation, setValidation] = useState("");
    const q = useQuery({
        queryKey: ["user-traffic", userId, detail, page, size, filters],
        queryFn: () =>
            request("stat/getStatUser", {
                user_id: userId,
                detail: detail ? 1 : 0,
                page,
                pageSize: size,
                ...(filters.start_date && { start_date: filters.start_date }),
                ...(filters.end_date && { end_date: filters.end_date }),
                ...(detail &&
                    filters.node_name && { node_name: filters.node_name }),
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
                <div className="traffic-tabs" aria-label="统计方式">
                    {[true, false].map((value) => (
                        <button
                            key={String(value)}
                            type="button"
                            aria-pressed={detail === value}
                            onClick={() => {
                                setDetail(value);
                                setPage(1);
                            }}
                        >
                            {value ? "节点明细" : "按日汇总"}
                        </button>
                    ))}
                </div>
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
            <form
                className="traffic-filters"
                onSubmit={(e) => {
                    e.preventDefault();
                    if (
                        draft.start_date &&
                        draft.end_date &&
                        draft.start_date > draft.end_date
                    ) {
                        setValidation("结束日期不能早于开始日期");
                        return;
                    }
                    setValidation("");
                    setFilters({ ...draft, node_name: draft.node_name.trim() });
                    setPage(1);
                }}
            >
                <label>
                    开始日期
                    <input
                        type="date"
                        aria-label="开始日期"
                        value={draft.start_date}
                        onChange={(e) =>
                            setDraft({ ...draft, start_date: e.target.value })
                        }
                    />
                </label>
                <label>
                    结束日期
                    <input
                        type="date"
                        aria-label="结束日期"
                        value={draft.end_date}
                        onChange={(e) =>
                            setDraft({ ...draft, end_date: e.target.value })
                        }
                    />
                </label>
                {detail && (
                    <label className="traffic-node-filter">
                        节点名称
                        <input
                            aria-label="节点名称"
                            placeholder="搜索节点"
                            maxLength={100}
                            value={draft.node_name}
                            onChange={(e) =>
                                setDraft({
                                    ...draft,
                                    node_name: e.target.value,
                                })
                            }
                        />
                    </label>
                )}
                <Button type="submit" variant="outline" size="sm">
                    查询
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        setDraft(emptyFilters);
                        setFilters(emptyFilters);
                        setValidation("");
                        setPage(1);
                    }}
                >
                    重置
                </Button>
            </form>
            {validation && (
                <p className="traffic-note error" role="alert">
                    {validation}
                </p>
            )}
            <p className="traffic-note">
                {detail
                    ? `按日期、节点和倍率汇总；时间为首次 / 最近上报（${timezone}），并非连接起止时间。启用前的记录请查看「按日汇总」。`
                    : `按日期和倍率汇总（${timezone}）；历史记录未保存节点及准确使用时间。`}
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
                        {detail && (
                            <span>
                                实际用量{" "}
                                <strong>
                                    {bytes(
                                        Number(summary?.upload || 0) +
                                            Number(summary?.download || 0),
                                    )}
                                </strong>
                            </span>
                        )}
                        <span>
                            计费流量 <strong>{bytes(summary?.billed)}</strong>
                        </span>
                        <small>当前筛选合计</small>
                    </div>
                    <div className="traffic-table-scroll">
                        <table className="traffic-table">
                            <thead>
                                <tr>
                                    <th>
                                        {detail ? "日期 · 上报时间" : "日期"}
                                    </th>
                                    {detail && <th>节点名称</th>}
                                    <th className="traffic-number">上行流量</th>
                                    <th className="traffic-number">下行流量</th>
                                    <th className="traffic-rate-cell">倍率</th>
                                    <th className="traffic-number">计费流量</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length ? (
                                    rows.map((row) => {
                                        const usage = trafficUsage(row, detail);
                                        return (
                                            <tr key={row.id}>
                                                <td className="traffic-date">
                                                    <span>
                                                        {trafficDate(
                                                            Number(
                                                                row.record_at,
                                                            ),
                                                            timezone,
                                                        )}
                                                    </span>
                                                    {detail && (
                                                        <small>
                                                            {trafficDate(
                                                                Number(
                                                                    row.first_report_at,
                                                                ),
                                                                timezone,
                                                                true,
                                                            )}{" "}
                                                            /{" "}
                                                            {trafficDate(
                                                                Number(
                                                                    row.last_report_at,
                                                                ),
                                                                timezone,
                                                                true,
                                                            )}
                                                        </small>
                                                    )}
                                                </td>
                                                {detail && (
                                                    <td className="traffic-node">
                                                        <span
                                                            title={
                                                                row.server_name
                                                            }
                                                        >
                                                            {row.server_name}
                                                        </span>
                                                        <small>
                                                            #{row.server_id} ·{" "}
                                                            {row.server_type}
                                                        </small>
                                                    </td>
                                                )}
                                                <td className="traffic-number">
                                                    <span className="traffic-amount">
                                                        <ArrowUp
                                                            className="traffic-upload"
                                                            size={13}
                                                            aria-hidden="true"
                                                        />
                                                        {usage.upload === null
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
                                                        {usage.download === null
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
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td
                                            colSpan={detail ? 6 : 5}
                                            className="traffic-empty"
                                        >
                                            {detail
                                                ? "暂无节点明细，可调整筛选或查看按日汇总"
                                                : "暂无流量记录"}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <p className="traffic-note traffic-billing-note">
                        上下行为实际流量，计费流量已包含倍率。
                        {!detail &&
                            "历史实际流量由计费量折算，0 倍率时无法还原。"}
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
