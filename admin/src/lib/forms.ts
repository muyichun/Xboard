import type { Field, Row } from "./types";
import { get } from "./utils";
export function set(o: Row, path: string, value: any) {
    const p = path.split(".");
    let t = o;
    p.slice(0, -1).forEach((k) => (t = t[k] ??= {}));
    t[p[p.length - 1]] = value;
}
export function initialValues(fields: Field[], seed: Row) {
    const out = structuredClone(seed);
    fields.forEach((f) => {
        if (f.show && !f.show(out)) return;
        let v = get(out, f.key);
        if (v === undefined)
            v =
                f.default ??
                (["multi", "tags"].includes(f.kind || "")
                    ? []
                    : f.kind === "boolean"
                      ? false
                      : "");
        if (f.kind === "lines" && Array.isArray(v)) v = v.join("\n");
        if (f.kind === "env" && v && typeof v === "object")
            v = Object.entries(v)
                .map(([k, n]) => `${k}=${n}`)
                .join("\n");
        if (f.kind === "money" && v !== "") v = Number(v) / 100;
        if (f.kind === "bytes" && v !== "") v = Number(v) / 1024 ** 3;
        if (f.kind === "datetime" && v) {
            const d = new Date(typeof v === "number" ? v * 1000 : v);
            v = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 16);
        }
        if ((f.kind === "json" || f.kind === "code") && typeof v !== "string")
            v = JSON.stringify(v ?? {}, null, 2);
        set(out, f.key, v);
    });
    return out;
}
export function serializeValues(fields: Field[], values: Row) {
    const out: Row = {};
    for (const f of fields) {
        if (f.show && !f.show(values)) continue;
        let v = get(values, f.key);
        if (v === undefined) continue;
        if (f.kind === "password" && v === "") continue;
        if (f.kind === "money" && v !== "") v = Math.round(Number(v) * 100);
        if (f.kind === "bytes" && v !== "")
            v = Math.round(Number(v) * 1024 ** 3);
        if (f.kind === "datetime")
            v = v ? Math.floor(new Date(v).getTime() / 1000) : null;
        if (f.kind === "json") v = v ? JSON.parse(v) : null;
        if (f.kind === "lines")
            v = String(v || "")
                .split(/\r?\n/)
                .map((s) => s.trim())
                .filter(Boolean);
        if (f.kind === "env")
            v = Object.fromEntries(
                String(v || "")
                    .split(/\r?\n/)
                    .filter((s) => s.includes("="))
                    .map((s) => {
                        const i = s.indexOf("=");
                        return [s.slice(0, i).trim(), s.slice(i + 1)];
                    }),
            );
        if (
            (f.kind === "number" || f.kind === "money" || f.kind === "bytes") &&
            v === ""
        )
            v = null;
        set(out, f.key, v);
    }
    return out;
}

// Preserve unknown nested protocol keys when editing known fields.
export function mergeRecords(base: Row, patch: Row): Row {
    const out: Row = { ...base };
    for (const [key, value] of Object.entries(patch))
        out[key] =
            value &&
            typeof value === "object" &&
            !Array.isArray(value) &&
            base?.[key] &&
            typeof base[key] === "object" &&
            !Array.isArray(base[key])
                ? mergeRecords(base[key], value)
                : value;
    return out;
}
