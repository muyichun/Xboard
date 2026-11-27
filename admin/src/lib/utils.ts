import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Row } from "./types";
export const cn = (...values: ClassValue[]) => twMerge(clsx(values));
export const get = (o: any, path: string): any =>
    path.split(".").reduce((v, k) => v?.[k], o);
export const money = (v: any) =>
    new Intl.NumberFormat("zh-CN", {
        style: "currency",
        currency: "CNY",
    }).format(Number(v || 0) / 100);
export const bytes = (v: any) => {
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return "—";
    const i = n > 0
        ? Math.max(0, Math.min(Math.floor(Math.log(n) / Math.log(1024)), 4))
        : 0;
    return `${(n / 1024 ** i).toLocaleString("zh-CN", { maximumFractionDigits: 2 })} ${["B", "KB", "MB", "GB", "TB"][i]}`;
};
export const time = (v: any) => {
    if (v === null || v === undefined || v === "") return "—";
    const d = new Date(typeof v === "number" ? v * 1000 : v);
    return Number.isNaN(d.getTime())
        ? "—"
        : d.toLocaleString("zh-CN", { hour12: false });
};
export const rowsOf = (r: any): Row[] =>
    Array.isArray(r)
        ? r
        : Array.isArray(r?.data)
          ? r.data
          : Array.isArray(r?.data?.data)
            ? r.data.data
            : [];
export const countOf = (r: any) =>
    Number(
        r?.total ?? r?.pagination?.total ?? r?.data?.total ?? rowsOf(r).length,
    );
export function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function errorMessage(e: any): string {
    return e?.response?.data?.message || e?.message || "请求失败，请稍后重试";
}
export function safeFilename(header?: string) {
    const utf = header?.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf) {
        try {
            return decodeURIComponent(utf[1]);
        } catch {}
    }
    return header?.match(/filename="?([^";]+)"?/)?.[1] || "export.csv";
}
export function jsonValue(value: any) {
    if (typeof value === "string") {
        try {
            return JSON.parse(value);
        } catch {
            throw new Error("JSON 格式不正确，请检查括号和引号");
        }
    }
    return value;
}
