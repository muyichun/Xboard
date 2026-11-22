import { useMemo } from "react";
import { useTable, flexRender } from "@tanstack/react-table";
import { ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { Column, Row } from "../lib/types";
import { get } from "../lib/utils";
import { Value } from "./Value";
import { Button } from "./ui/button";
import { Empty } from "./Feedback";
export function DataTable({
    rows,
    columns,
    selected,
    onSelect,
    actions,
    onSort,
}: {
    rows: Row[];
    columns: Column[];
    selected?: Set<string>;
    onSelect?: (set: Set<string>) => void;
    actions?: (row: Row) => React.ReactNode;
    onSort?: (key: string) => void;
}) {
    const defs = useMemo(
        () =>
            columns.map((c) => ({
                id: c.key,
                accessorFn: (r: Row) => get(r, c.key),
                header: c.label,
                cell: (ctx: any) => <Value value={ctx.getValue()} column={c} />,
            })),
        [columns],
    );
    const table = useTable({ features: {}, data: rows, columns: defs });
    return (
        <div className="table-scroll">
            <table>
                <thead>
                    {table.getHeaderGroups().map((g) => (
                        <tr key={g.id}>
                            {onSelect && (
                                <th className="check-cell">
                                    <input
                                        type="checkbox"
                                        aria-label="选择本页全部"
                                        checked={
                                            rows.length > 0 &&
                                            rows.every((r, i) =>
                                                selected?.has(
                                                    String(r.id ?? i),
                                                ),
                                            )
                                        }
                                        onChange={(e) =>
                                            onSelect(
                                                e.target.checked
                                                    ? new Set(
                                                          rows.map((r, i) =>
                                                              String(r.id ?? i),
                                                          ),
                                                      )
                                                    : new Set(),
                                            )
                                        }
                                    />
                                </th>
                            )}
                            {g.headers.map((h) => (
                                <th key={h.id}>
                                    {onSort ? (
                                        <button
                                            className="column-sort"
                                            onClick={() => onSort(h.column.id)}
                                        >
                                            {flexRender(
                                                h.column.columnDef.header,
                                                h.getContext(),
                                            )}
                                            <ArrowUpDown size={13} />
                                        </button>
                                    ) : (
                                        flexRender(
                                            h.column.columnDef.header,
                                            h.getContext(),
                                        )
                                    )}
                                </th>
                            ))}
                            {actions && <th className="actions-cell">操作</th>}
                        </tr>
                    ))}
                </thead>
                <tbody>
                    {table.getRowModel().rows.map((r) => (
                        <tr key={r.id}>
                            {onSelect && (
                                <td className="check-cell">
                                    <input
                                        type="checkbox"
                                        aria-label={`选择记录 ${r.original.id ?? r.id}`}
                                        checked={
                                            selected?.has(
                                                String(r.original.id ?? r.id),
                                            ) || false
                                        }
                                        onChange={(e) => {
                                            const s = new Set(selected);
                                            if (e.target.checked)
                                                s.add(
                                                    String(
                                                        r.original.id ?? r.id,
                                                    ),
                                                );
                                            else
                                                s.delete(
                                                    String(
                                                        r.original.id ?? r.id,
                                                    ),
                                                );
                                            onSelect(s);
                                        }}
                                    />
                                </td>
                            )}
                            {r.getAllCells().map((c) => (
                                <td key={c.id}>
                                    {flexRender(
                                        c.column.columnDef.cell,
                                        c.getContext(),
                                    )}
                                </td>
                            ))}
                            {actions && (
                                <td className="actions-cell">
                                    {actions(r.original)}
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
            {rows.length === 0 && <Empty />}
        </div>
    );
}
export function Pagination({
    page,
    size,
    total,
    onPage,
    onSize,
}: {
    page: number;
    size: number;
    total: number;
    onPage: (p: number) => void;
    onSize: (n: number) => void;
}) {
    const pages = Math.max(1, Math.ceil(total / size));
    return (
        <footer className="pagination">
            <span>
                共 <strong>{total}</strong> 条记录
            </span>
            <div>
                <label>
                    每页{" "}
                    <select
                        value={size}
                        onChange={(e) => onSize(Number(e.target.value))}
                    >
                        {[10, 20, 50, 100].map((n) => (
                            <option key={n}>{n}</option>
                        ))}
                    </select>{" "}
                    条
                </label>
                <span>
                    第 {page} / {pages} 页
                </span>
                <Button
                    variant="outline"
                    size="icon"
                    aria-label="上一页"
                    disabled={page <= 1}
                    onClick={() => onPage(page - 1)}
                >
                    <ChevronLeft size={16} />
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    aria-label="下一页"
                    disabled={page >= pages}
                    onClick={() => onPage(page + 1)}
                >
                    <ChevronRight size={16} />
                </Button>
            </div>
        </footer>
    );
}
