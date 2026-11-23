import { useState } from "react";
import type { Module, Field } from "../lib/types";
import type { Condition } from "../lib/list";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { OptionInput } from "./Form";
import { f, select } from "../modules/fields";
const userFilters: Field[] = [
    f("email", "邮箱"),
    f("id", "用户ID", "number"),
    f("plan_id", "订阅计划", "select", { source: "plans" }),
    f("group_id", "权限组", "select", { source: "groups" }),
    f("transfer_enable", "总流量 (GB)", "bytes"),
    f("total_used", "已用流量 (GB)", "bytes"),
    f("online_count", "在线设备数", "number"),
    f("expired_at", "到期时间", "datetime"),
    f("uuid", "UUID"),
    f("token", "Token"),
    select("banned", "状态", { "0": "正常", "1": "封禁" }),
    f("remarks", "备注"),
    f("invite_user.email", "邀请人邮箱"),
    f("invite_user_id", "邀请人ID", "number"),
    select("is_admin", "管理员", { "0": "否", "1": "是" }),
    select("is_staff", "员工", { "0": "否", "1": "是" }),
];
export function Filters({
    module: m,
    value,
    onChange,
}: {
    module: Module;
    value: Condition[];
    onChange: (v: Condition[]) => void;
}) {
    const [open, setOpen] = useState(false),
        [draft, setDraft] = useState<Condition[]>([]);
    const fields =
        m.id === "users"
            ? userFilters
            : m.columns
                  .filter((c) => !c.key.includes("."))
                  .map((c) => f(c.key, c.label));
    function convert(c: Condition, toWire: boolean) {
        const field = fields.find((f) => f.key === c.key);
        let v = c.value;
        if (v !== "") {
            if (field?.kind === "bytes")
                v = String(
                    toWire
                        ? Math.round(Number(v) * 1024 ** 3)
                        : Number(v) / 1024 ** 3,
                );
            if (field?.kind === "datetime") {
                if (toWire)
                    v = String(Math.floor(new Date(v).getTime() / 1000));
                else {
                    const d = new Date(Number(v) * 1000);
                    if (!Number.isNaN(d.getTime()))
                        v = new Date(
                            d.getTime() - d.getTimezoneOffset() * 60000,
                        )
                            .toISOString()
                            .slice(0, 16);
                }
            }
        }
        return { ...c, value: v };
    }
    const update = (i: number, patch: Partial<Condition>) =>
        setDraft(draft.map((c, n) => (n === i ? { ...c, ...patch } : c)));
    return (
        <>
            <Button
                variant="outline"
                size="sm"
                onClick={() => {
                    setDraft(value.map((c) => convert(c, false)));
                    setOpen(true);
                }}
            >
                高级筛选{value.length ? ` (${value.length})` : ""}
            </Button>
            <Dialog
                open={open}
                onClose={() => setOpen(false)}
                title="筛选用户"
                description="同时满足以下条件"
                className="filter-drawer"
            >
                <div className="detail-body">
                    {draft.map((c, i) => {
                        const field =
                            fields.find((f) => f.key === c.key) || fields[0];
                        return (
                            <div className="filter-row" key={i}>
                                <select
                                    aria-label={`筛选字段 ${i + 1}`}
                                    value={c.key}
                                    onChange={(e) =>
                                        update(i, {
                                            key: e.target.value,
                                            operator: [
                                                "email",
                                                "remarks",
                                                "invite_user.email",
                                            ].includes(e.target.value)
                                                ? "like"
                                                : "eq",
                                            value: "",
                                        })
                                    }
                                >
                                    {fields.map((f) => (
                                        <option key={f.key} value={f.key}>
                                            {f.label}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    aria-label={`筛选关系 ${i + 1}`}
                                    value={c.operator}
                                    onChange={(e) =>
                                        update(i, { operator: e.target.value })
                                    }
                                >
                                    {[
                                        ["eq", "等于"],
                                        ["like", "包含"],
                                        ["gt", "大于"],
                                        ["gte", "大于等于"],
                                        ["lt", "小于"],
                                        ["lte", "小于等于"],
                                    ].map(([v, l]) => (
                                        <option key={v} value={v}>
                                            {l}
                                        </option>
                                    ))}
                                </select>
                                {field.source || field.options ? (
                                    <OptionInput
                                        field={field}
                                        value={c.value}
                                        onChange={(v) =>
                                            update(i, {
                                                value: String(v ?? ""),
                                                operator: "eq",
                                            })
                                        }
                                    />
                                ) : (
                                    <input
                                        aria-label={`筛选值 ${i + 1}`}
                                        type={
                                            field.kind === "datetime"
                                                ? "datetime-local"
                                                : ["number", "bytes"].includes(
                                                        field.kind || "",
                                                    )
                                                  ? "number"
                                                  : "text"
                                        }
                                        value={c.value}
                                        onChange={(e) =>
                                            update(i, { value: e.target.value })
                                        }
                                    />
                                )}
                                <Button
                                    variant="ghost"
                                    onClick={() =>
                                        setDraft(
                                            draft.filter((_, n) => n !== i),
                                        )
                                    }
                                >
                                    移除
                                </Button>
                            </div>
                        );
                    })}
                    <Button
                        variant="outline"
                        onClick={() =>
                            setDraft([
                                ...draft,
                                { key: "email", operator: "like", value: "" },
                            ])
                        }
                    >
                        添加条件
                    </Button>
                </div>
                <footer className="form-footer">
                    <Button
                        variant="ghost"
                        onClick={() => {
                            setDraft([]);
                            onChange([]);
                        }}
                    >
                        重置筛选
                    </Button>
                    <Button
                        onClick={() => {
                            onChange(
                                draft
                                    .filter((c) => c.value !== "")
                                    .map((c) => convert(c, true)),
                            );
                            setOpen(false);
                        }}
                    >
                        应用筛选
                    </Button>
                </footer>
            </Dialog>
        </>
    );
}
