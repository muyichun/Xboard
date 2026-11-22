import type { Module, Row } from "./types";
export type Condition = { key: string; operator: string; value: string };
export function queryParams(
    m: Module,
    page: number,
    size: number,
    search: string,
    filters: Row,
    sort: { key: string; desc: boolean } | null,
    conditions: Condition[] = [],
) {
    const p: Row = {
        ...m.params,
        ...Object.fromEntries(
            Object.entries(filters).filter(([, v]) => v !== "" && v !== null),
        ),
    };
    if (m.id.startsWith("gift-") || m.id === "traffic") {
        p.page = page;
        p.per_page = size;
    } else {
        p.current = page;
        p[m.id === "audit" ? "page_size" : "pageSize"] = size;
    }
    const structured = conditions
        .filter((c) => c.key && c.value !== "")
        .map((c) => ({
            id: c.key,
            value: ["coupons", "tickets"].includes(m.id)
                ? c.operator === "eq"
                    ? [c.value]
                    : c.value
                : `${c.operator}:${c.value}`,
        }));
    if (search && m.searchKey) {
        if (m.filterMode === "structured" && m.id !== "tickets")
            structured.unshift({ id: m.searchKey, value: search });
        else p[m.searchKey] = search;
    }
    if (structured.length) p.filter = structured;
    if (sort && m.filterMode === "structured" && !sort.key.includes("."))
        p.sort = [{ id: sort.key, desc: sort.desc }];
    if (m.id.startsWith("plugin:")) {
        p.search = search;
        if (sort) {
            p.sort_field = sort.key;
            p.sort_order = sort.desc ? "desc" : "asc";
        }
    }
    return p;
}
