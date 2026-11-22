import type { Row } from "../lib/types";
import { time } from "../lib/utils";
import { Button } from "./ui/button";
import { Copy } from "lucide-react";
import { useState } from "react";
const labels: Row = {
    id: "ID",
    name: "名称",
    email: "邮箱",
    user: "用户",
    plan: "套餐",
    message: "消息",
    subject: "主题",
    status: "状态",
    created_at: "创建时间",
    updated_at: "更新时间",
    trade_no: "订单号",
    total_amount: "订单金额（分）",
    commission_balance: "佣金（分）",
    period: "周期",
    invite_user: "邀请人",
    commission_log: "佣金记录",
    surplus_orders: "折抵订单",
    token: "认证令牌",
    command: "安装命令",
    install_command: "安装命令",
    count: "数量",
    batch_id: "批次",
    cpu: "CPU 使用率",
    mem_total: "总内存",
    mem_used: "已用内存",
    disk_total: "磁盘容量",
    disk_used: "已用磁盘",
    net_in_speed: "入站速度",
    net_out_speed: "出站速度",
    recorded_at: "采样时间",
    reason: "原因",
    action: "操作",
    path: "请求路径",
    method: "方法",
    ip: "IP 地址",
    admin_id: "管理员 ID",
    request: "请求",
    response: "响应",
    payload: "变更内容",
    schedule: "定时任务",
    horizon: "队列进程",
    schedule_last_runtime: "最近调度",
    total_resets: "重置总数",
    auto_resets: "自动重置",
    manual_resets: "手动重置",
    cron_resets: "定时重置",
    key: "密钥",
    config: "配置",
    error: "错误",
    data: "数据",
    upload: "上传",
    download: "下载",
    total: "合计",
    rewards: "奖励",
    balance: "余额",
    transfer_enable: "总流量",
    expire_days: "有效天数",
    device_limit: "设备数",
    reset_package: "重置套餐",
    plan_id: "套餐 ID",
    version: "版本",
    is_online: "在线状态",
    host: "地址",
    port: "端口",
    type: "类型",
    enabled: "启用",
    show: "展示",
    load_status: "负载状态",
    online: "在线人数",
    online_conn: "在线连接",
    notes: "备注",
};
export async function copyText(text: string) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    el.remove();
    if (!ok) throw new Error("复制失败，请手动选择文本");
}
export function DataView({ data, depth = 0 }: { data: any; depth?: number }) {
    const [copied, setCopied] = useState(false);
    if (data === null || data === undefined)
        return <span className="muted">—</span>;
    if (typeof data === "boolean") return <span>{data ? "是" : "否"}</span>;
    if (typeof data !== "object") {
        const text = String(data);
        return (
            <div className="data-text">
                <pre>{text}</pre>
                {text.length > 32 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                            copyText(text)
                                .then(() => setCopied(true))
                                .catch(() => setCopied(false))
                        }
                    >
                        <Copy size={14} />
                        {copied ? "已复制" : "复制"}
                    </Button>
                )}
            </div>
        );
    }
    if (Array.isArray(data))
        return data.length ? (
            <div className="data-array">
                {data.map((r, i) => (
                    <div className="data-item" key={i}>
                        <DataView data={r} depth={depth + 1} />
                    </div>
                ))}
            </div>
        ) : (
            <span className="muted">暂无记录</span>
        );
    return (
        <dl className="data-grid">
            {Object.entries(data)
                .filter(
                    ([k]) =>
                        ![
                            "password",
                            "password_algo",
                            "password_salt",
                            "auth_data",
                        ].includes(k),
                )
                .map(([k, v]) => (
                    <div key={k}>
                        <dt>{labels[k] || k}</dt>
                        <dd>
                            {k.endsWith("_at") && typeof v === "number" ? (
                                time(v)
                            ) : (
                                <DataView data={v} depth={depth + 1} />
                            )}
                        </dd>
                    </div>
                ))}
        </dl>
    );
}
