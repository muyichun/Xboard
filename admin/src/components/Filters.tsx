import type { Module } from "../lib/types";
import type { Condition } from "../lib/list";
import { Button } from "./ui/button";
export function Filters({
    module: m,
    value,
    onChange,
}: {
    module: Module;
    value: Condition[];
    onChange: (v: Condition[]) => void;
}) {
    const columns = m.columns.filter(
        (c) => !c.key.includes(".") && c.key !== "period",
    );
    const update = (i: number, patch: Partial<Condition>) =>
        onChange(value.map((c, n) => (n === i ? { ...c, ...patch } : c)));
    return (
        <details className="advanced-filters">
            <summary>
                高级筛选{value.length ? ` · ${value.length} 项条件` : ""}
            </summary>
            <p className="muted">
                同时满足以下条件。金额条件按接口原始单位「分」，流量按「字节」，时间按
                Unix 秒。
            </p>
            {value.map((c, i) => (
                <div className="toolbar" key={i}>
                    <select
                        aria-label={`筛选字段 ${i + 1}`}
                        value={c.key}
                        onChange={(e) => update(i, { key: e.target.value })}
                    >
                        {columns.map((f) => (
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
                        <option value="like">包含</option>
                        <option value="eq">等于</option>
                        {!["coupons", "tickets"].includes(m.id) && (
                            <>
                                <option value="gt">大于</option>
                                <option value="gte">大于等于</option>
                                <option value="lt">小于</option>
                                <option value="lte">小于等于</option>
                            </>
                        )}
                    </select>
                    {columns.find((f) => f.key === c.key)?.options ? (
                        <select
                            aria-label={`筛选值 ${i + 1}`}
                            value={c.value}
                            onChange={(e) =>
                                update(i, {
                                    value: e.target.value,
                                    operator: "eq",
                                })
                            }
                        >
                            <option value="">请选择</option>
                            {Object.entries(
                                columns.find((f) => f.key === c.key)!.options!,
                            ).map(([v, l]) => (
                                <option key={v} value={v}>
                                    {l}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <input
                            aria-label={`筛选值 ${i + 1}`}
                            value={c.value}
                            onChange={(e) =>
                                update(i, { value: e.target.value })
                            }
                        />
                    )}
                    <Button
                        variant="ghost"
                        onClick={() =>
                            onChange(value.filter((_, n) => n !== i))
                        }
                    >
                        移除
                    </Button>
                </div>
            ))}
            <Button
                variant="outline"
                size="sm"
                onClick={() =>
                    onChange([
                        ...value,
                        { key: columns[0].key, operator: "eq", value: "" },
                    ])
                }
            >
                添加条件
            </Button>
            {value.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => onChange([])}>
                    清空条件
                </Button>
            )}
        </details>
    );
}
