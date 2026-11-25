export function legacyAdminHref(
    path: string,
    search = "",
    language?: "en-US" | "ru-RU",
) {
    const url = new URL(window.location.pathname, window.location.origin);
    url.searchParams.set("admin_ui", "legacy");
    if (language) url.searchParams.set("lang", language);
    if (path === "/config/system/email/templates")
        path = "/config/system/email";
    if (["/reports", "/system", "/audit"].includes(path)) {
        path = "/";
        search = "";
    }
    url.hash = path + search;
    return `${url.pathname}${url.search}${url.hash}`;
}
