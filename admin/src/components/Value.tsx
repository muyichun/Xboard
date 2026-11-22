import type { Column } from "../lib/types";
import { bytes, money, time } from "../lib/utils";
export function Value({ value, column }: { value: any; column?: Column }) {
    if (value === null || value === undefined || value === "")
        return <span className="muted">—</span>;
    if (column?.options)
        return (
            <span
                className={`badge ${Number(value) === 0 ? "badge-muted" : ""}`}
            >
                {column.options[String(value)] ?? String(value)}
            </span>
        );
    switch (column?.format) {
        case "money":
            return <span className="tabular">{money(value)}</span>;
        case "yuan":
            return <span className="tabular">¥{Number(value).toFixed(2)}</span>;
        case "bytes":
            return <span className="tabular">{bytes(value)}</span>;
        case "time":
            return <span className="muted nowrap">{time(value)}</span>;
        case "boolean":
            return (
                <span className={`badge ${value ? "" : "badge-muted"}`}>
                    {value ? "已启用" : "未启用"}
                </span>
            );
    }
    if (typeof value === "boolean")
        return <span className="badge">{value ? "是" : "否"}</span>;
    if (Array.isArray(value))
        return (
            <span className="tags">
                {value.map((v, i) => (
                    <span className="badge badge-muted" key={i}>
                        {typeof v === "object"
                            ? (v.name ?? v.label ?? JSON.stringify(v))
                            : String(v)}
                    </span>
                ))}
            </span>
        );
    if (typeof value === "object")
        return (
            <span className="truncate">
                {value.name ?? value.email ?? JSON.stringify(value)}
            </span>
        );
    return (
        <span className="truncate" title={String(value)}>
            {String(value)}
        </span>
    );
}
