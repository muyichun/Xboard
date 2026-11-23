import { useMemo } from "react";
import { useTable, flexRender } from "@tanstack/react-table";
import {
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    ArrowUp,
    ArrowDown,
    GripVertical,
} from "lucide-react";
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
    sort,
    renderCell,
    onMove,
}: {
    rows: Row[];
    columns: Column[];
    selected?: Set<string>;
    onSelect?: (set: Set<string>) => void;
    actions?: (row: Row) => React.ReactNode;
    onSort?: (key: string) => void;
    sort?: { key: string; desc: boolean } | null;
    renderCell?: (row: Row, column: Column) => React.ReactNode;
    onMove?: (from: number, to: number) => void;
}) {
    const defs = useMemo(
        () =>
            columns.map((c) => ({
                id: c.key,
                accessorFn: (r: Row) => get(r, c.key),
                header: c.label,
                cell: (ctx: any) =>
                    renderCell ? (
                        renderCell(ctx.row.original, c)
                    ) : (
                        <Value value={ctx.getValue()} column={c} />
                    ),
            })),
        [columns, renderCell],
    );
    const table = useTable({ features: {}, data: rows, columns: defs });
    return (
        <div className="table-scroll">
            <table>
                <thead>
                    {table.getHeaderGroups().map((g) => (
                        <tr key={g.id}>
                            {onMove && <th />}
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
                                    {onSort &&
                                    columns.find((c) => c.key === h.column.id)
                                        ?.sortable !== false ? (
                                        <button
                                            className="column-sort"
                                            onClick={() => onSort(h.column.id)}
                                        >
                                            {flexRender(
                                                h.column.columnDef.header,
                                                h.getContext(),
                                            )}
                                            {sort?.key === h.column.id ? (
                                                sort.desc ? (
                                                    <ArrowDown size={13} />
                                                ) : (
                                                    <ArrowUp size={13} />
                                                )
                                            ) : (
                                                <ArrowUpDown size={13} />
                                            )}
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
                        <tr
                            key={r.id}
                            draggable={!!onMove}
                            onDragStart={(e) =>
                                e.dataTransfer.setData("text/plain", r.id)
                            }
                            onDragOver={(e) => {
                                if (onMove) e.preventDefault();
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                onMove?.(
                                    Number(
                                        e.dataTransfer.getData("text/plain"),
                                    ),
                                    Number(r.id),
                                );
                            }}
                        >
                            {onMove && (
                                <td>
                                    <GripVertical size={16} />
                                </td>
                            )}
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
    selected = 0,
    onPage,
    onSize,
}: {
    page: number;
    size: number;
    total: number;
    selected?: number;
    onPage: (p: number) => void;
    onSize: (n: number) => void;
}) {
    const pages = Math.max(1, Math.ceil(total / size));
    return (
        <footer className="pagination">
            <span>
                已选择 {selected} 项，共 {total} 项
            </span>
            <div>
                <label>
                    每页显示{" "}
                    <select
                        value={size}
                        onChange={(e) => onSize(Number(e.target.value))}
                    >
                        {[10, 20, 30, 40, 50, 100, 500].map((n) => (
                            <option key={n}>{n}</option>
                        ))}
                    </select>
                </label>
                <span>
                    第{" "}
                    <input
                        aria-label="页码"
                        type="number"
                        min={1}
                        max={pages}
                        value={page}
                        onChange={(e) => {
                            const n = Number(e.target.value);
                            if (n >= 1 && n <= pages) onPage(n);
                        }}
                    />{" "}
                    页，共 {pages} 页
                </span>
                <Button
                    variant="outline"
                    size="icon"
                    aria-label="跳转到第一页"
                    disabled={page <= 1}
                    onClick={() => onPage(1)}
                >
                    <ChevronsLeft size={16} />
                </Button>
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
                <Button
                    variant="outline"
                    size="icon"
                    aria-label="跳转到最后一页"
                    disabled={page >= pages}
                    onClick={() => onPage(pages)}
                >
                    <ChevronsRight size={16} />
                </Button>
            </div>
        </footer>
    );
}
