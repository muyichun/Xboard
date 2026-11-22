import axios from "axios";
import type { Row, Settings } from "./types";
import { downloadBlob, safeFilename } from "./utils";
export const settings: Settings = window.settings || {
    base_url: "/",
    secure_path: import.meta.env.VITE_ADMIN_PATH || "admin",
    title: "Xboard",
};
const tokenKey = `xboard.next.auth:${settings.secure_path}`;
export const auth = {
    get: () => sessionStorage.getItem(tokenKey),
    set: (t: string) => sessionStorage.setItem(tokenKey, t),
    clear: () => sessionStorage.removeItem(tokenKey),
};
export const client = axios.create({
    baseURL: `${settings.base_url.replace(/\/$/, "")}/api/v2`,
    timeout: 30000,
    headers: { "Content-Language": "zh-CN", Accept: "application/json" },
});
client.interceptors.request.use((c) => {
    const token = auth.get();
    if (token) c.headers.Authorization = token;
    return c;
});
client.interceptors.response.use(
    (r) => r,
    (e) => {
        if (e.response?.status === 401 || e.response?.status === 403) {
            auth.clear();
            window.dispatchEvent(new Event("xboard:unauthorized"));
        }
        return Promise.reject(e);
    },
);
export async function request(
    endpoint: string,
    data: Row | Row[] = {},
    method: "get" | "post" = "get",
    download = false,
) {
    const url = endpoint.startsWith("@")
        ? endpoint.slice(1)
        : `${settings.secure_path}/${endpoint.replace(/^\//, "")}`;
    const r = await client.request({
        url,
        method,
        ...(method === "get" ? { params: data } : { data }),
        ...(download ? { responseType: "blob" as const } : {}),
    });
    if (download && String(r.headers["content-type"]).includes("json")) {
        const payload = JSON.parse(await r.data.text());
        throw new Error(payload.message || "下载未生成，请检查参数");
    }
    if (download) {
        downloadBlob(r.data, safeFilename(r.headers["content-disposition"]));
        return { data: true };
    }
    if (r.data?.status === "fail" || r.data?.data === false)
        throw new Error(r.data?.message || "操作未完成");
    return r.data;
}
export async function login(email: string, password: string) {
    const r = await request(
        "@passport/auth/login",
        { email, password },
        "post",
    );
    const token = r.data?.auth_data;
    if (!token) throw new Error("登录响应不完整，请重试");
    if (!r.data?.is_admin) throw new Error("此账号没有管理员权限");
    auth.set(token);
    try {
        const info = await request("@user/info");
        return info.data;
    } catch (e) {
        auth.clear();
        throw e;
    }
}
