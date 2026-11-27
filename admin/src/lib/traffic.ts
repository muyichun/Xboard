import type { Row } from "./types";

export function trafficUsage(row: Row, detail: boolean) {
    const rate = Number(row.server_rate);
    return {
        upload: detail ? Number(row.u) : rate > 0 ? Number(row.u) / rate : null,
        download: detail
            ? Number(row.d)
            : rate > 0
              ? Number(row.d) / rate
              : null,
        billed: detail
            ? Number(row.billed_u) + Number(row.billed_d)
            : Number(row.u) + Number(row.d),
    };
}

export function trafficDate(value: number, timezone: string, clock = false) {
    const date = new Date(value * 1000);
    return clock
        ? date.toLocaleTimeString("zh-CN", {
              timeZone: timezone,
              hourCycle: "h23",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
          })
        : date.toLocaleDateString("sv-SE", { timeZone: timezone });
}
