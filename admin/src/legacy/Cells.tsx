import { canReviewCommission } from "../lib/orders";
import { Copy as CopyIcon, Check } from "lucide-react";
import type { Row, Column } from "../lib/types";
import { get, bytes, money, time } from "../lib/utils";
import VisibilitySwitch from "../components/VisibilitySwitch";
import { Value } from "../components/Value";
import { copyText } from "../components/DataView";
import { Button } from "../components/ui/button";
import { useState } from "react";
import { loadMetrics, machineState } from "../lib/metrics";
export { machineState } from "../lib/metrics";
export function Status({
    children,
    tone = "neutral",
}: {
    children: React.ReactNode;
    tone?: string;
}) {
    return <span className={`status-badge status-${tone}`}>{children}</span>;
}
export function Copy({ value }: { value: any }) {
    const [state, setState] = useState("");
    return value ? (
        <Button
            size="icon"
            variant="ghost"
            aria-label={state || "复制"}
            title={state || "复制"}
            onClick={async () => {
                try {
                    await copyText(String(value));
                    setState("已复制");
                } catch {
                    setState("复制失败，请手动选择文本");
                }
            }}
        >
            {state === "已复制" ? <Check size={14} /> : <CopyIcon size={14} />}
        </Button>
    ) : null;
}
export function Switch({
    value,
    onChange,
    label,
    disabled = false,
    pending = false,
}: {
    value: any;
    disabled?: boolean;
    pending?: boolean;
    onChange: () => void;
    label: string;
}) {
    const checked = Number(value) === 1;
    return (
        <button
            disabled={disabled}
            aria-busy={pending || undefined}
            aria-disabled={pending || undefined}
            className={`toggle ${checked ? "on" : ""}`}
            role="switch"
            aria-checked={checked}
            aria-label={label}
            onClick={pending ? undefined : onChange}
        >
            <span />
        </button>
    );
}
export function Load({ data, detail }: { data: Row; detail?: () => void }) {
    const s = loadMetrics(data || {});
    const metrics = [
        ["CPU", s.cpu],
        [
            "内存",
            s.mem_total ? (Number(s.mem_used) / s.mem_total) * 100 : undefined,
        ],
        [
            "磁盘",
            s.disk_total
                ? (Number(s.disk_used) / s.disk_total) * 100
                : undefined,
        ],
    ] as const;
    const Container = detail ? "button" : "div";
    return (
        <Container className="load-cell" onClick={detail}>
            {metrics.some(([, v]) => v != null) ? (
                metrics.map(([label, v]) => (
                    <span key={label}>
                        {label}
                        <i>
                            <b
                                style={{
                                    width: `${Math.min(100, Number(v) || 0)}%`,
                                }}
                            />
                        </i>
                        {v == null ? "—" : `${Number(v).toFixed(1)}%`}
                    </span>
                ))
            ) : (
                <span className="muted">暂无负载数据</span>
            )}
            {s.updated_at != null && (
                <small>
                    最近采样：{time(s.updated_at)}
                    {Date.now() / 1000 - s.updated_at >= 300 &&
                        "（超过 5 分钟未更新）"}
                </small>
            )}
        </Container>
    );
}
export function Reward({ value }: { value: Row }) {
    const r = value || {};
    return (
        <div className="cell-stack">
            {r.balance > 0 && <span>余额 {money(r.balance)}</span>}
            {r.transfer_enable > 0 && (
                <span>流量 {bytes(r.transfer_enable)}</span>
            )}
            {r.expire_days > 0 && <span>有效期 +{r.expire_days} 天</span>}
            {r.device_limit > 0 && <span>设备数 +{r.device_limit}</span>}
            {r.plan_id && (
                <span>
                    套餐 #{r.plan_id} · {r.plan_validity_days || "默认"} 天
                </span>
            )}
            {r.reset_package && <span>重置当月流量</span>}
            {r.random_rewards?.length > 0 && (
                <span>随机奖励池 · {r.random_rewards.length} 项</span>
            )}
        </div>
    );
}
export function Cell({
    id,
    row: r,
    column: c,
    onDetail,
    onAction,
    onToggle,
    togglePending,
    groups = [],
    machines = [],
}: {
    id: string;
    row: Row;
    column: Column;
    onDetail: (r: Row) => void;
    onAction: (name: string, r: Row) => void;
    onToggle: (r: Row, key: string) => void;
    togglePending: boolean;
    groups?: Row[];
    machines?: Row[];
}) {
    const v = get(r, c.key),
        k = c.key;
    if (
        (k === "show" &&
            ["plans", "nodes", "notices", "knowledge"].includes(id)) ||
        (id === "notices" && k === "popup")
    )
        return (
            <VisibilitySwitch
                visible={Number(v) === 1}
                label={`${id === "nodes" ? "订阅中显示" : c.label} ${r.name || r.title || r.id}`}
                pending={togglePending}
                onChange={() => onToggle(r, k)}
            />
        );
    if (
        (id === "plans" && ["sell", "renew"].includes(k)) ||
        (id === "coupons" && k === "show") ||
        (id === "payments" && k === "enable")
    )
        return (
            <Switch
                value={v}
                label={`${c.label} ${r.name || r.title || r.id}`}
                pending={togglePending}
                onChange={() => onToggle(r, k)}
            />
        );
    if (id === "users") {
        if (k === "email")
            return (
                <div className="cell-stack">
                    <div className="cell-line user-email">
                        <span
                            className={`status-dot ${Number(r.online_count) > 0 ? "green" : "gray"}`}
                            title={
                                Number(r.online_count) > 0
                                    ? "当前在线"
                                    : r.last_online_at
                                      ? `最后在线时间: ${time(r.last_online_at)}`
                                      : "从未在线"
                            }
                        />
                        <button
                            className="text-link"
                            onClick={() => onDetail(r)}
                        >
                            {v}
                        </button>
                        <Copy value={v} />
                    </div>
                </div>
            );
        if (k === "banned")
            return (
                <Status tone={v ? "red" : "green"}>
                    {v ? "封禁" : "正常"}
                </Status>
            );
        if (k === "expired_at") {
            const days = Math.ceil((Number(v) * 1000 - Date.now()) / 86400000);
            return (
                <div
                    className="cell-stack"
                    title={`下次重置时间: ${time(r.next_reset_at)}`}
                >
                    <span>{v ? time(v) : "长期有效"}</span>
                    {v && (
                        <small className={days < 0 ? "error" : ""}>
                            {days < 0
                                ? `已过期 ${-days} 天`
                                : `剩余 ${days} 天`}
                        </small>
                    )}
                </div>
            );
        }
        if (k === "online_count")
            return (
                <span
                    title={
                        r.device_limit
                            ? `最多可同时在线 ${r.device_limit} 台设备`
                            : "无设备数限制"
                    }
                >
                    {v || 0}
                    {r.device_limit ? ` / ${r.device_limit}` : ""}
                </span>
            );
        if (k === "total_used")
            return (
                <div className="cell-stack">
                    <span>{bytes(v ?? Number(r.u) + Number(r.d))}</span>
                    <progress
                        max={r.transfer_enable || 1}
                        value={Number(r.u) + Number(r.d)}
                    />
                </div>
            );
    }
    if (id === "plans") {
        if (k === "name")
            return (
                <div className="cell-stack">
                    <button
                        className="text-link"
                        onClick={() => onAction("edit", r)}
                    >
                        {v}
                    </button>
                    <small>
                        {r.transfer_enable} GB ·{" "}
                        {r.speed_limit ? `${r.speed_limit} Mbps` : "不限速"}
                    </small>
                </div>
            );
        if (k === "prices")
            return (
                <div className="price-list">
                    {Object.entries(r.prices || {}).map(([period, price]) => (
                        <span key={period}>
                            {(
                                {
                                    monthly: "月付",
                                    quarterly: "季付",
                                    half_yearly: "半年付",
                                    yearly: "年付",
                                    two_yearly: "两年付",
                                    three_yearly: "三年付",
                                    onetime: "流量包",
                                    reset_traffic: "重置包",
                                } as Row
                            )[period] || period}{" "}
                            ¥{Number(price).toFixed(2)}
                        </span>
                    ))}
                </div>
            );
        if (k === "users_count")
            return (
                <span
                    title={`活跃率 ${r.users_count ? Math.round((r.active_users_count / r.users_count) * 100) : 0}%`}
                >
                    总用户 {r.users_count || 0} / 有效{" "}
                    {r.active_users_count || 0}
                </span>
            );
    }
    if (id === "orders") {
        if (k === "trade_no")
            return (
                <button className="text-link" onClick={() => onDetail(r)}>
                    {v}
                </button>
            );
        if (k === "commission_status") {
            if (!Number(r.commission_balance) || !c.options?.[String(v)])
                return "—";
            const badge = (
                <Status tone={v === 2 ? "green" : v === 3 ? "gray" : "orange"}>
                    {c.options[String(v)]}
                </Status>
            );
            return canReviewCommission(r) ? (
                <button
                    onClick={() => onAction("commission", r)}
                    aria-label={`审核佣金 ${r.trade_no}`}
                >
                    {badge}
                </button>
            ) : (
                badge
            );
        }
    }
    if (id === "coupons") {
        if (k === "type")
            return (
                <Status>
                    {Number(r.type) === 1
                        ? `按金额优惠 · ${money(r.value)}`
                        : `按比例优惠 · ${r.value}%`}
                </Status>
            );
        if (k === "limit_use" || k === "limit_use_with_user")
            return <span>{v == null ? "无限次" : v}</span>;
        if (k === "ended_at") {
            const now = Date.now() / 1000;
            return (
                <span
                    title={`开始时间 ${time(r.started_at)}\n结束时间 ${time(r.ended_at)}`}
                    className={r.ended_at < now ? "error" : ""}
                >
                    {r.ended_at < now
                        ? `已过期${Math.ceil((now - r.ended_at) / 86400)}天`
                        : r.started_at > now
                          ? `${Math.ceil((r.started_at - now) / 86400)}天后开始`
                          : `剩余${Math.ceil((r.ended_at - now) / 86400)}天`}
                </span>
            );
        }
    }
    if (id === "tickets") {
        if (k === "subject")
            return (
                <button className="text-link" onClick={() => onDetail(r)}>
                    {v}
                </button>
            );
        if (k === "status")
            return (
                <Status
                    tone={
                        r.status === 1
                            ? "gray"
                            : r.reply_status === 0
                              ? "red"
                              : "green"
                    }
                >
                    {r.status === 1
                        ? "已关闭"
                        : r.reply_status === 0
                          ? "待回复"
                          : "已回复"}
                </Status>
            );
        if (k === "level")
            return (
                <Status
                    tone={v === 2 ? "red" : v === 1 ? "orange" : "neutral"}
                >{`${c.options?.[String(v)] || "低"}优先`}</Status>
            );
    }
    if (id === "nodes") {
        if (k === "name")
            return (
                <div className="cell-stack">
                    <div className="cell-line">
                        <button
                            onClick={() => onAction("load", r)}
                            aria-label="节点运行状态"
                        >
                            <span
                                className={`status-dot ${Number(r.available_status) === 2 ? "green" : Number(r.available_status) === 1 ? "orange" : "gray"}`}
                                title={
                                    ["未运行", "无人使用或异常", "运行正常"][
                                        Number(r.available_status) || 0
                                    ]
                                }
                            />
                        </button>
                        <button
                            className="text-link"
                            onClick={() => onAction("edit", r)}
                        >
                            {r.name}
                        </button>
                    </div>
                    <small>
                        {r.type}
                        {r.parent_id ? " · 子节点" : ""}
                    </small>
                </div>
            );
        if (k === "host")
            return (
                <div className="cell-stack">
                    <div className="cell-line">
                        {r.host}:{r.port}
                        <Copy value={`${r.host}:${r.port}`} />
                    </div>
                    {String(r.server_port) !== String(r.port) && (
                        <small>内部端口: {r.server_port}</small>
                    )}
                </div>
            );
        if (k === "machine_id") {
            const machine = machines.find((m) => m.id === v);
            return v ? (
                <div className="cell-stack">
                    <button
                        className="text-link"
                        onClick={() => onAction("machine", r)}
                    >
                        {machine?.name || r.machine?.name || `服务器 #${v}`}
                    </button>
                    <small>
                        {!r.enabled
                            ? "节点停用"
                            : machine
                              ? (
                                    {
                                        online: "服务器在线",
                                        offline: "服务器离线",
                                        inactive: "服务器未激活",
                                        never: "从未上报",
                                    } as Row
                                )[machineState(machine)]
                              : "服务器托管"}
                    </small>
                </div>
            ) : (
                <div className="cell-stack">
                    <span>
                        <Status>独立部署</Status>
                    </span>
                    {!r.enabled && <small>节点停用</small>}
                </div>
            );
        }
        if (k === "group_ids")
            return (
                <div className="tags">
                    {(v || []).map((id: any) => (
                        <Status key={id}>
                            {groups.find((g) => String(g.id) === String(id))
                                ?.name || id}
                        </Status>
                    ))}
                </div>
            );
        if (k === "traffic") {
            const used = Number(r.u || 0) + Number(r.d || 0);
            return (
                <div className="cell-stack">
                    <span>
                        {bytes(used)} /{" "}
                        {r.transfer_enable
                            ? bytes(r.transfer_enable)
                            : "无限制"}
                    </span>
                    {r.transfer_enable > 0 && (
                        <progress max={r.transfer_enable} value={used} />
                    )}
                </div>
            );
        }
    }
    if (id === "machines") {
        if (k === "name")
            return (
                <div className="cell-stack">
                    <button className="text-link" onClick={() => onDetail(r)}>
                        {v}
                    </button>
                    <small>{r.notes}</small>
                </div>
            );
        if (k === "status") {
            const status = machineState(r);
            return (
                <Status tone={status === "online" ? "green" : "gray"}>
                    {
                        {
                            online: "在线",
                            offline: "离线",
                            inactive: "已禁用",
                            never: "从未上报",
                        }[status]
                    }
                </Status>
            );
        }
        if (k === "load_status")
            return <Load data={v} detail={() => onDetail(r)} />;
        if (k === "servers_count")
            return (
                <button className="text-link" onClick={() => onDetail(r)}>
                    {v || 0} {v ? "已承载节点" : "暂无承载"}
                </button>
            );
    }
    if (id === "gift-templates" && k === "rewards") return <Reward value={v} />;
    if (id === "gift-codes") {
        if (k === "code")
            return (
                <div className="cell-line">
                    {v}
                    <Copy value={v} />
                </div>
            );
        if (k === "status")
            return (
                <button
                    className="text-link"
                    aria-label={`修改兑换码状态 ${r.id}`}
                    onClick={() => onAction("code-status", r)}
                >
                    <Status
                        tone={v === 0 ? "green" : v === 1 ? "neutral" : "gray"}
                    >
                        {["未使用", "已使用", "已过期", "已禁用"][v] || v}
                    </Status>
                </button>
            );
    }
    if (k === "code")
        return (
            <div className="cell-line">
                {v}
                <Copy value={v} />
            </div>
        );
    return <Value value={v} column={c} />;
}
