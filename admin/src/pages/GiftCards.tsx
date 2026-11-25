import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { request } from "../lib/api";
import { moduleById } from "../legacy/modules";
import Resource from "./Resource";
import { Loading, ErrorState } from "../components/Feedback";
import { errorMessage } from "../lib/utils";
export default function GiftCards() {
    const [params, setParams] = useSearchParams(),
        tab = params.get("tab") || "templates";
    const q = useQuery({
        queryKey: ["gift-statistics"],
        queryFn: () => request("gift-card/statistics"),
        enabled: tab === "statistics",
    });
    return (
        <>
            <header className="page-header">
                <div>
                    <h1>礼品卡管理</h1>
                    <p>管理礼品卡模板、兑换码和使用记录</p>
                </div>
            </header>
            <div className="tabs">
                {[
                    ["templates", "模板管理"],
                    ["codes", "兑换码管理"],
                    ["usages", "使用记录"],
                    ["statistics", "统计数据"],
                ].map(([key, label]) => (
                    <button
                        key={key}
                        className={tab === key ? "active" : ""}
                        onClick={() => setParams({ tab: key })}
                    >
                        {label}
                    </button>
                ))}
            </div>
            {tab === "statistics" ? (
                q.isPending ? (
                    <Loading />
                ) : q.isError ? (
                    <ErrorState message={errorMessage(q.error)} />
                ) : (
                    <div className="metric-grid">
                        {[
                            ["templates_count", "模板总数"],
                            ["active_templates_count", "启用模板"],
                            ["codes_count", "兑换码总数"],
                            ["used_codes_count", "已使用兑换码"],
                        ].map(([key, label]) => (
                            <div className="panel metric" key={key}>
                                <span>{label}</span>
                                <strong>
                                    {q.data?.data?.total_stats?.[key] ?? 0}
                                </strong>
                            </div>
                        ))}
                    </div>
                )
            ) : (
                <Resource
                    key={tab}
                    embedded
                    module={moduleById(
                        `gift-${["templates", "codes", "usages"].includes(tab) ? tab : "templates"}`,
                    )}
                />
            )}
        </>
    );
}
