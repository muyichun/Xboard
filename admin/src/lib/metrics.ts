import type { Row } from "./types";
// Live node/machine reports are nested; historical samples use flat columns.
export function loadMetrics(raw: Row = {}): Row {
    const out = { ...raw };
    for (const key of ["mem", "swap", "disk"]) {
        out[`${key}_used`] = raw[key]?.used ?? raw[`${key}_used`];
        out[`${key}_total`] = raw[key]?.total ?? raw[`${key}_total`];
    }
    return out;
}
export function highLoad(raw: Row = {}) {
    const s = loadMetrics(raw);
    return (
        Number(s.cpu) >= 85 ||
        (s.mem_total > 0 && s.mem_used / s.mem_total >= 0.9) ||
        (s.disk_total > 0 && s.disk_used / s.disk_total >= 0.9)
    );
}
export function machineState(r: Row) {
    if (!r.is_active) return "inactive";
    if (!r.last_seen_at) return "never";
    return Date.now() / 1000 - Number(r.last_seen_at) < 300
        ? "online"
        : "offline";
}
