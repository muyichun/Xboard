import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { request } from "../lib/api";
import { Loading, ErrorState } from "../components/Feedback";
import { DataView } from "../components/DataView";
import { DataTable, Pagination } from "../components/DataTable";
import { rowsOf, errorMessage } from "../lib/utils";
const tabs = {
    status: ["运行状态", "getSystemStatus"],
    queue: ["队列统计", "getQueueStats"],
    workload: ["队列负载", "getQueueWorkload"],
    masters: ["进程管理", "getQueueMasters"],
    failed: ["失败任务", "getHorizonFailedJobs"],
} as const;
export default function System() {
    const [tab, setTab] = useState<keyof typeof tabs>("status"),
        [page, setPage] = useState(1);
    const q = useQuery({
        queryKey: ["system", tab, page],
        queryFn: () =>
            request(`system/${tabs[tab][1]}`, { current: page, page_size: 20 }),
        refetchInterval: 30000,
    });
    return (
        <>
            <header className="page-header">
                <div>
                    <div className="eyebrow">系统设置</div>
                    <h1>运行状态</h1>
                    <p>查看调度、队列与后台任务健康状况</p>
                </div>
            </header>
            <section className="panel">
                <div className="tabs">
                    {Object.entries(tabs).map(([key, [label]]) => (
                        <button
                            key={key}
                            className={key === tab ? "active" : ""}
                            onClick={() => {
                                setTab(key as any);
                                setPage(1);
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                {q.isPending ? (
                    <Loading />
                ) : q.isError ? (
                    <ErrorState
                        message={errorMessage(q.error)}
                        retry={() => q.refetch()}
                    />
                ) : tab === "failed" ? (
                    <>
                        <DataTable
                            rows={rowsOf(q.data)}
                            columns={[
                                { key: "id", label: "任务 ID" },
                                { key: "name", label: "任务名称" },
                                { key: "queue", label: "队列" },
                                { key: "failed_at", label: "失败时间" },
                                { key: "exception", label: "异常" },
                            ]}
                        />
                        <Pagination
                            page={page}
                            size={20}
                            total={q.data?.total || 0}
                            onPage={setPage}
                            onSize={() => {}}
                        />
                    </>
                ) : (
                    <div className="detail-body">
                        <DataView data={q.data?.data ?? q.data} />
                    </div>
                )}
            </section>
        </>
    );
}
