import { mieruPattern, legacyPrices } from "../lib/protocols";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseFormReturn } from "react-hook-form";
import type { Field, Row } from "../lib/types";
import { request } from "../lib/api";
import { get, rowsOf, errorMessage } from "../lib/utils";
import { Button } from "../components/ui/button";
import { paddingDefault, networkTemplates, randomHex } from "./FormControls";
export function ParentInput({
    value,
    onChange,
    values,
}: {
    value: any;
    onChange: (v: any, rate?: number) => void;
    values: Row;
}) {
    const q = useQuery({
        queryKey: ["node-parent-options"],
        queryFn: () => request("server/manage/getNodes"),
    });
    return (
        <select
            id="field-parent_id"
            value={value || ""}
            onChange={(e) =>
                onChange(
                    e.target.value ? Number(e.target.value) : null,
                    rowsOf(q.data).find((r) => String(r.id) === e.target.value)
                        ?.rate,
                )
            }
        >
            <option value="">无父节点</option>
            {rowsOf(q.data)
                .filter(
                    (r) =>
                        r.type === values.type &&
                        !r.parent_id &&
                        r.id !== values.id,
                )
                .map((r) => (
                    <option key={r.id} value={r.id}>
                        {r.name}
                    </option>
                ))}
        </select>
    );
}
export default function FieldActions({
    field: f,
    form,
    values,
}: {
    field: Field;
    form: UseFormReturn<Row>;
    values: Row;
}) {
    const [error, setError] = useState(""),
        [busy, setBusy] = useState(false),
        [adding, setAdding] = useState(false),
        [group, setGroup] = useState(""),
        [base, setBase] = useState(""),
        [discount, setDiscount] = useState("");
    const qc = useQueryClient();
    const set = (key: string, v: any) =>
        form.setValue(key, v, { shouldDirty: true, shouldValidate: true });
    const local = (d: Date) =>
        new Date(d.getTime() - d.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
    async function run(fn: () => Promise<void>) {
        setBusy(true);
        setError("");
        try {
            await fn();
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    }
    let content: React.ReactNode = null;
    if (f.source === "groups")
        content = (
            <>
                <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setAdding(!adding)}
                >
                    ＋ 添加权限组
                </Button>
                {adding && (
                    <div className="toolbar">
                        <input
                            aria-label="新权限组名称"
                            placeholder="权限组名称"
                            value={group}
                            onChange={(e) => setGroup(e.target.value)}
                        />
                        <Button
                            type="button"
                            size="sm"
                            disabled={busy || !group.trim()}
                            onClick={() =>
                                run(async () => {
                                    await request(
                                        "server/group/save",
                                        { name: group.trim() },
                                        "post",
                                    );
                                    await qc.invalidateQueries({
                                        queryKey: ["options", "groups"],
                                    });
                                    setAdding(false);
                                    setGroup("");
                                })
                            }
                        >
                            添加
                        </Button>
                    </div>
                )}
            </>
        );
    if (f.key === "port")
        content = (
            <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => set("server_port", values.port)}
            >
                同步到服务端口
            </Button>
        );
    if (f.key === "expired_at")
        content = (
            <div className="quick-options">
                {[
                    ["永久", 0],
                    ["1个月", 30],
                    ["3个月", 90],
                    ["今天结束", -1],
                ].map(([label, days]) => (
                    <Button
                        key={label}
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            const d = new Date();
                            if (days === -1) d.setHours(23, 59, 0, 0);
                            else d.setDate(d.getDate() + Number(days));
                            set(f.key, days === 0 ? "" : local(d));
                        }}
                    >
                        {label}
                    </Button>
                ))}
            </div>
        );
    if (f.key === "ended_at")
        content = (
            <div className="quick-options">
                {[
                    ["1周", 7],
                    ["2周", 14],
                    ["1个月", 30],
                    ["3个月", 90],
                    ["6个月", 180],
                    ["1年", 365],
                ].map(([label, days]) => (
                    <Button
                        key={label}
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                            const start = values.started_at
                                ? new Date(values.started_at)
                                : new Date();
                            start.setDate(start.getDate() + Number(days));
                            set(f.key, local(start));
                        }}
                    >
                        {label}
                    </Button>
                ))}
            </div>
        );
    if (f.key === "content" && values.prices)
        content = (
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                    if (
                        !values.content ||
                        window.confirm("将覆盖当前套餐说明，确定使用默认模板？")
                    )
                        set(
                            "content",
                            "## 套餐权益\n- 高速流量\n- 多设备支持\n- 全平台客户端\n",
                        );
                }}
            >
                使用默认模板
            </Button>
        );
    if (f.key === "prices.monthly")
        content = (
            <div className="price-tools">
                <label>
                    基础月价
                    <input
                        aria-label="基础月价"
                        type="number"
                        min={0}
                        value={base}
                        onChange={(e) => setBase(e.target.value)}
                    />
                </label>
                <label>
                    自定义折扣 (%)
                    <input
                        aria-label="多月折扣"
                        placeholder="旧版默认"
                        type="number"
                        min={0}
                        max={100}
                        value={discount}
                        onChange={(e) => setDiscount(e.target.value)}
                    />
                </label>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        if (
                            base === "" ||
                            Number(base) < 0 ||
                            Number(discount) < 0 ||
                            Number(discount) > 100
                        )
                            return;
                        Object.entries(
                            legacyPrices(
                                Number(base),
                                discount === "" ? undefined : Number(discount),
                            ),
                        ).forEach(([key, price]) =>
                            set(`prices.${key}`, price),
                        );
                    }}
                >
                    自动填充价格
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                        Object.keys(values.prices || {}).forEach((key) =>
                            set(`prices.${key}`, ""),
                        )
                    }
                >
                    清空价格
                </Button>
            </div>
        );
    if (f.key.endsWith(".padding_scheme"))
        content = (
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => set(f.key, paddingDefault.join("\n"))}
            >
                使用默认
            </Button>
        );
    if (f.key.endsWith(".network_settings"))
        content = (
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                    set(
                        f.key,
                        JSON.stringify(
                            networkTemplates[
                                values.protocol_settings?.network
                            ] || {},
                            null,
                            2,
                        ),
                    )
                }
            >
                使用 {values.protocol_settings?.network} 模板
            </Button>
        );
    if (f.key.endsWith(".private_key"))
        content = (
            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                    run(async () => {
                        const r = (
                            await request("server/manage/generateRealityKey")
                        ).data;
                        const prefix = f.key.slice(0, -12);
                        set(`${prefix}.private_key`, r.private_key);
                        set(`${prefix}.public_key`, r.public_key);
                    })
                }
            >
                生成密钥对
            </Button>
        );
    if (
        f.key.endsWith(".short_id") ||
        f.key.endsWith(".obfs.password") ||
        f.key === "server_token"
    )
        content = (
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                    set(f.key, randomHex(f.key.endsWith(".short_id") ? 8 : 16))
                }
            >
                随机生成
            </Button>
        );
    if (f.key.endsWith(".traffic_pattern"))
        content = (
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => set(f.key, mieruPattern())}
            >
                随机生成
            </Button>
        );
    if (f.key.endsWith(".ech.config"))
        content = (
            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                    run(async () => {
                        const r = (
                            await request("server/manage/generateEchKey")
                        ).data;
                        set(f.key, r.config);
                        set(f.key.replace(/\.config$/, ".key"), r.key);
                    })
                }
            >
                生成 ECH 配置和密钥
            </Button>
        );
    return content ? (
        <div className="field-actions">
            {content}
            {error && <small className="error">{error}</small>}
        </div>
    ) : null;
}
