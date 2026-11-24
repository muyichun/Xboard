import { useState } from "react";
import type { Row } from "../lib/types";
import { Button } from "../components/ui/button";
export function Tags({
    id,
    reservedTag,
    value,
    onChange,
}: {
    id: string;
    reservedTag?: string;
    value: any;
    onChange: (v: string[]) => void;
}) {
    const [draft, setDraft] = useState("");
    const list = Array.isArray(value) ? value : [];
    function add() {
        const v = draft.trim();
        if (v && v !== reservedTag && !list.includes(v)) onChange([...list, v]);
        setDraft("");
    }
    return (
        <>
            <div className="tags-editor">
                {list.map((v: string, i: number) => (
                    <span className="badge" key={i}>
                        {v}
                        <button
                            type="button"
                            aria-label={`移除 ${v}`}
                            onClick={() =>
                                onChange(
                                    list.filter((_: any, n: number) => n !== i),
                                )
                            }
                        >
                            ×
                        </button>
                    </span>
                ))}
                <input
                    id={id}
                    placeholder="输入后按回车添加"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={add}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            add();
                        }
                    }}
                />
            </div>
        </>
    );
}
export function Rewards({
    value,
    onChange,
}: {
    value: Row[];
    onChange: (v: Row[]) => void;
}) {
    const rows = value || [];
    function update(i: number, key: string, v: number) {
        onChange(rows.map((r, n) => (n === i ? { ...r, [key]: v } : r)));
    }
    return (
        <div className="repeat-fields">
            {rows.map((r, i) => (
                <div className="reward-row" key={i}>
                    <strong>奖励 {i + 1}</strong>
                    {[
                        ["weight", "权重", 1],
                        ["balance", "余额（元）", 100],
                        ["transfer_enable", "流量（GB）", 1024 ** 3],
                        ["expire_days", "有效期（天）", 1],
                    ].map(([key, label, factor]) => (
                        <label key={key}>
                            {label}
                            <input
                                aria-label={`${label} ${i + 1}`}
                                type="number"
                                step="any"
                                min={key === "weight" ? 1 : 0}
                                value={
                                    r[key] === undefined
                                        ? ""
                                        : Number(r[key]) / Number(factor)
                                }
                                onChange={(e) =>
                                    update(
                                        i,
                                        String(key),
                                        Math.round(
                                            Number(e.target.value) *
                                                Number(factor),
                                        ),
                                    )
                                }
                            />
                        </label>
                    ))}
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onChange(rows.filter((_, n) => n !== i))}
                    >
                        删除
                    </Button>
                </div>
            ))}
            <Button
                type="button"
                variant="outline"
                onClick={() =>
                    onChange([
                        ...rows,
                        {
                            weight: 1,
                            balance: 0,
                            transfer_enable: 0,
                            expire_days: 0,
                        },
                    ])
                }
            >
                添加奖励
            </Button>
        </div>
    );
}
export function TimeRanges({
    value,
    onChange,
}: {
    value: Row[];
    onChange: (v: Row[]) => void;
}) {
    const rows = value || [];
    return (
        <div className="repeat-fields">
            {rows.map((r, i) => (
                <div className="toolbar" key={i}>
                    {[
                        ["start", "开始时间"],
                        ["end", "结束时间"],
                        ["rate", "倍率"],
                    ].map(([key, label]) => (
                        <label key={key}>
                            {label}
                            <input
                                aria-label={`${label} ${i + 1}`}
                                type={key === "rate" ? "number" : "time"}
                                step={key === "rate" ? "any" : undefined}
                                min={key === "rate" ? 0 : undefined}
                                value={r[key]}
                                onChange={(e) =>
                                    onChange(
                                        rows.map((r, n) =>
                                            n === i
                                                ? {
                                                      ...r,
                                                      [key]:
                                                          key === "rate"
                                                              ? Number(
                                                                    e.target
                                                                        .value,
                                                                )
                                                              : e.target.value,
                                                  }
                                                : r,
                                        ),
                                    )
                                }
                            />
                        </label>
                    ))}
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onChange(rows.filter((_, n) => n !== i))}
                    >
                        删除
                    </Button>
                </div>
            ))}
            <Button
                type="button"
                variant="outline"
                onClick={() =>
                    onChange([
                        ...rows,
                        { start: "00:00", end: "23:59", rate: 1 },
                    ])
                }
            >
                添加时间段
            </Button>
        </div>
    );
}
export const paddingDefault = [
    "stop=8",
    "0=30-30",
    "1=100-400",
    "2=400-500,c,500-1000,c,500-1000,c,500-1000,c,500-1000",
    "3=9-9,500-1000",
    "4=500-1000",
    "5=500-1000",
    "6=500-1000",
    "7=500-1000",
];
export const randomHex = (length: number) =>
    Array.from(crypto.getRandomValues(new Uint8Array(length)), (v) =>
        v.toString(16).padStart(2, "0"),
    ).join("");
export const networkTemplates: Row = {
    tcp: { header: { type: "none" } },
    ws: { path: "/", headers: { Host: "" } },
    grpc: { serviceName: "", multiMode: false },
    http: { path: "/", host: [] },
    httpupgrade: { path: "/", host: "" },
    xhttp: { path: "/", host: "", mode: "auto" },
};
