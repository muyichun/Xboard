import { loadMetrics } from "../lib/metrics";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "../lib/api";
import type { Row } from "../lib/types";
import { get, time, bytes, money, rowsOf, errorMessage } from "../lib/utils";
import { Copy, Status, Reward } from "./Cells";
import { DataView } from "../components/DataView";
import { DataTable, Pagination } from "../components/DataTable";
import { Button } from "../components/ui/button";
import { Form } from "../components/Form";
import { f } from "../modules/fields";
import { Notice, Loading, ErrorState } from "../components/Feedback";
const periods: Row = {
    month_price: "月付",
    quarter_price: "季付",
    half_year_price: "半年付",
    year_price: "年付",
    two_year_price: "两年付",
    three_year_price: "三年付",
    onetime_price: "流量包",
    reset_price: "重置包",
};
export function DetailGrid({
    data,
    groups,
}: {
    data: Row;
    groups: Record<string, [string, string, string?][]>;
}) {
    return (
        <div className="detail-sections">
            {Object.entries(groups).map(([title, fields]) => (
                <section className="detail-section" key={title}>
                    <h3>{title}</h3>
                    <dl>
                        {fields.map(([key, label, format]) => {
                            const v = get(data, key);
                            return (
                                <div key={key}>
                                    <dt>{label}</dt>
                                    <dd>
                                        {format === "time" ? (
                                            time(v)
                                        ) : format === "bytes" ? (
                                            bytes(v)
                                        ) : format === "money" ? (
                                            money(v)
                                        ) : format === "yuan" ? (
                                            `¥${Number(v || 0).toFixed(2)}`
                                        ) : typeof v === "object" ? (
                                            <DataView data={v} />
                                        ) : (
                                            String(v ?? "—")
                                        )}
                                        {[
                                            "uuid",
                                            "token",
                                            "subscribe_url",
                                            "email",
                                            "trade_no",
                                            "callback_no",
                                        ].includes(key) && <Copy value={v} />}
                                    </dd>
                                </div>
                            );
                        })}
                    </dl>
                </section>
            ))}
        </div>
    );
}
export function UserDetails({ user }: { user: Row }) {
    const r = {
        ...user,
        total_used: Number(user.u || 0) + Number(user.d || 0),
        account_status: user.banned ? "封禁" : "正常",
        role: user.is_admin ? "管理员" : user.is_staff ? "员工" : "用户",
        commission_type_text: ["跟随系统设置", "循环返利", "首次返利"][
            user.commission_type
        ],
    };
    return (
        <DetailGrid
            data={r}
            groups={{
                基本信息: [
                    ["id", "用户ID"],
                    ["email", "邮箱"],
                    ...(user.phone
                        ? [["phone", "手机号"] as [string, string]]
                        : []),
                    ["role", "身份"],
                    ["account_status", "状态"],
                    ["uuid", "UUID"],
                    ["token", "Token"],
                    ["telegram_id", "Telegram ID"],
                    ["remarks", "备注"],
                ],
                订阅信息: [
                    ["plan.name", "订阅计划"],
                    ["group.name", "权限组"],
                    ["expired_at", "到期时间", "time"],
                    ["speed_limit", "限速 (Mbps)"],
                    ["device_limit", "设备限制"],
                ],
                流量信息: [
                    ["u", "已用上行", "bytes"],
                    ["d", "已用下行", "bytes"],
                    ["total_used", "已用流量", "bytes"],
                    ["transfer_enable", "总流量", "bytes"],
                    ["last_reset_at", "最后重置", "time"],
                    ["next_reset_at", "下次重置", "time"],
                    ["reset_count", "重置次数"],
                ],
                财务信息: [
                    ["balance", "余额", "yuan"],
                    ["commission_balance", "佣金余额", "yuan"],
                    ["commission_type_text", "佣金类型"],
                    ["commission_rate", "返利比例 (%)"],
                    ["discount", "专享折扣 (%)"],
                ],
                活动信息: [
                    ["last_login_at", "最后登录", "time"],
                    ["last_login_ip", "最后登录IP"],
                    ["last_online_at", "最后在线", "time"],
                    ["online_count", "在线设备"],
                ],
                邀请信息: [
                    ["invite_user_id", "邀请人ID"],
                    ["invite_user.email", "邀请人邮箱"],
                ],
                时间信息: [
                    ["created_at", "注册时间", "time"],
                    ["updated_at", "更新时间", "time"],
                ],
                订阅链接: [["subscribe_url", "订阅URL"]],
            }}
        />
    );
}
export function OrderDetails({ order: r }: { order: Row }) {
    return (
        <DetailGrid
            data={{
                ...r,
                period_name: periods[r.period] || r.period,
                status_name: ["待支付", "开通中", "已取消", "已完成", "已折抵"][
                    r.status
                ],
                commission_name: ["待确认", "发放中", "有效", "无效"][
                    r.commission_status
                ],
            }}
            groups={{
                基本信息: [
                    ["trade_no", "订单号"],
                    ["user.email", "用户邮箱"],
                    ["plan.name", "订阅计划"],
                    ["period_name", "周期"],
                    ["status_name", "订单状态"],
                    ["callback_no", "回调单号"],
                ],
                金额信息: [
                    ["total_amount", "支付金额", "money"],
                    ["balance_amount", "余额支付", "money"],
                    ["discount_amount", "优惠金额", "money"],
                    ["refund_amount", "退款金额", "money"],
                    ["surplus_amount", "折抵金额", "money"],
                    ["surplus_credit", "折抵余额", "money"],
                ],
                时间信息: [
                    ["created_at", "创建时间", "time"],
                    ["updated_at", "更新时间", "time"],
                    ["paid_at", "支付时间", "time"],
                ],
                佣金信息: [
                    ["commission_name", "佣金状态"],
                    ["commission_balance", "佣金金额", "money"],
                    ["actual_commission_balance", "实际佣金", "money"],
                    ["invite_user.email", "邀请人邮箱"],
                    ["invite_user_id", "邀请人ID"],
                ],
            }}
        />
    );
}
export { TrafficRecords } from "./TrafficRecords";
export function ResetStats() {
    const [days, setDays] = useState(30);
    const q = useQuery({
        queryKey: ["reset-stats", days],
        queryFn: () => request("traffic-reset/stats", { days }),
    });
    return (
        <div className="detail-body">
            <select
                aria-label="统计天数"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
            >
                {[7, 30, 90, 365].map((n) => (
                    <option key={n} value={n}>
                        最近 {n} 天
                    </option>
                ))}
            </select>
            <div className="metric-grid">
                {[
                    ["total_resets", "重置总数"],
                    ["auto_resets", "自动重置"],
                    ["manual_resets", "手动重置"],
                    ["cron_resets", "定时重置"],
                ].map(([k, l]) => (
                    <div className="panel metric" key={k}>
                        <span>{l}</span>
                        <strong>{q.data?.data?.[k] ?? "—"}</strong>
                    </div>
                ))}
            </div>
        </div>
    );
}
export function UserReset({ user, onDone }: { user: Row; onDone: () => void }) {
    const [tab, setTab] = useState("reset"),
        [message, setMessage] = useState("");
    const q = useQuery({
        queryKey: ["reset-history", user.id],
        queryFn: () =>
            request(`traffic-reset/user/${user.id}/history`, { limit: 10 }),
    });
    return (
        <>
            <div className="tabs">
                <button
                    className={tab === "reset" ? "active" : ""}
                    onClick={() => setTab("reset")}
                >
                    重置流量
                </button>
                <button
                    className={tab === "history" ? "active" : ""}
                    onClick={() => setTab("history")}
                >
                    重置历史
                </button>
            </div>
            <Notice message={message} />
            {tab === "reset" ? (
                <Form
                    fields={[
                        f("reason", "重置原因", "textarea", {
                            hint: "此字段为可选项，用于记录重置原因",
                        }),
                    ]}
                    submitLabel="确认重置"
                    onSubmit={async (v) => {
                        await request(
                            "traffic-reset/reset-user",
                            { user_id: user.id, ...v },
                            "post",
                        );
                        setMessage("流量重置成功");
                        await q.refetch();
                        onDone();
                    }}
                >
                    <p>{user.email}</p>
                    <p className="warning-text">
                        重置后用户的上传和下载流量将清零，所有重置操作都会被记录在系统日志中。
                    </p>
                </Form>
            ) : q.isPending ? (
                <Loading />
            ) : q.isError ? (
                <ErrorState message={errorMessage(q.error)} />
            ) : (
                <div className="detail-body">
                    <DetailGrid
                        data={q.data?.data?.user || {}}
                        groups={{
                            重置概览: [
                                ["reset_count", "重置次数"],
                                ["last_reset_at", "最后重置", "time"],
                                ["next_reset_at", "下次重置", "time"],
                            ],
                        }}
                    />
                    <h3>最近 10 条重置记录</h3>
                    <DataTable
                        rows={q.data?.data?.history || []}
                        columns={[
                            { key: "reset_type_name", label: "重置类型" },
                            { key: "trigger_source_name", label: "触发来源" },
                            {
                                key: "old_traffic.formatted",
                                label: "重置前流量",
                            },
                            {
                                key: "reset_time",
                                label: "重置时间",
                                format: "time",
                            },
                        ]}
                    />
                </div>
            )}
        </>
    );
}
export function NodeLoad({ node: r }: { node: Row }) {
    const s = r.load_status || {},
        metrics = s.metrics || r.metrics || {};
    return (
        <div className="detail-body">
            <h3>{r.name}</h3>
            <Status
                tone={
                    Number(r.available_status) === 2
                        ? "green"
                        : Number(r.available_status) === 1
                          ? "orange"
                          : "gray"
                }
            >
                {
                    ["未运行", "无人使用或异常", "运行正常"][
                        Number(r.available_status) || 0
                    ]
                }
            </Status>
            <DetailGrid
                data={{
                    ...loadMetrics(s),
                    ...metrics,
                    uptime:
                        metrics.uptime == null
                            ? "—"
                            : `${Math.floor(metrics.uptime / 86400)} 天 ${Math.floor((metrics.uptime % 86400) / 3600)} 小时 ${Math.floor((metrics.uptime % 3600) / 60)} 分钟`,
                    conns: `${metrics.active_connections ?? 0} / ${metrics.total_connections ?? 0}`,
                    users: `${metrics.active_users ?? 0} / ${metrics.total_users ?? 0}`,
                    inbound_speed:
                        metrics.inbound_speed == null
                            ? "—"
                            : `${bytes(metrics.inbound_speed)}/s`,
                    outbound_speed:
                        metrics.outbound_speed == null
                            ? "—"
                            : `${bytes(metrics.outbound_speed)}/s`,
                    kernel_status:
                        metrics.kernel_status == null
                            ? "—"
                            : metrics.kernel_status
                              ? "运行中"
                              : "未运行",
                    api: metrics.api
                        ? `成功 ${metrics.api.success ?? 0} / 失败 ${metrics.api.failure ?? 0}`
                        : "—",
                    gc:
                        metrics.gc?.last_pause_ms == null
                            ? "—"
                            : `${metrics.gc.last_pause_ms} ms`,
                    ws: !metrics.ws?.enabled
                        ? "未启用"
                        : metrics.ws.connected
                          ? "已连接"
                          : "已断开",
                    load: metrics.load
                        ? [
                              metrics.load.load1,
                              metrics.load.load5,
                              metrics.load.load15,
                          ]
                              .map((v) => v ?? "—")
                              .join(" / ")
                        : "—",
                    limit: `限速用户 ${metrics.speed_limiter?.limited_users ?? 0} / 设备限制事件 ${metrics.limits?.device_limit_events ?? 0}`,
                }}
                groups={{
                    系统负载: [
                        ["cpu", "CPU 使用率 (%)"],
                        ["mem_used", "已用内存", "bytes"],
                        ["mem_total", "总内存", "bytes"],
                        ["swap_used", "已用交换区", "bytes"],
                        ["swap_total", "总交换区", "bytes"],
                        ["disk_used", "已用磁盘", "bytes"],
                        ["disk_total", "总磁盘", "bytes"],
                        ["updated_at", "最后更新", "time"],
                    ],
                    运行指标: [
                        ["uptime", "运行时长"],
                        ["conns", "实时/总连接"],
                        ["inbound_speed", "入站速率"],
                        ["outbound_speed", "出站速率"],
                        ["api", "API 状态"],
                        ["kernel_status", "内核状态"],
                        ["gc", "GC 暂停"],
                        ["limit", "限速用户"],
                        ["ws", "WebSocket"],
                        ["goroutines", "并发协程"],
                        ["load", "系统负载"],
                        ["users", "在线用户"],
                    ],
                }}
            />
            <details>
                <summary>完整运行指标</summary>
                <DataView data={{ load_status: s, metrics }} />
            </details>
        </div>
    );
}
