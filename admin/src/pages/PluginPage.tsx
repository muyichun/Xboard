import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { request } from "../lib/api";
import { rowsOf, errorMessage } from "../lib/utils";
import { dynamicFields } from "../modules/settings";
import type { Module, Row } from "../lib/types";
import Resource from "./Resource";
import { Loading, ErrorState } from "../components/Feedback";
export default function PluginPage() {
    const { code, "*": path } = useParams();
    const q = useQuery({
        queryKey: ["plugin-navigation"],
        queryFn: () => request("plugin/getPlugins"),
        staleTime: 30000,
    });
    if (q.isPending) return <Loading />;
    if (q.isError) return <ErrorState message={errorMessage(q.error)} />;
    const plugin = rowsOf(q.data).find(
        (p) => p.code === code && p.is_installed && p.is_enabled,
    );
    if (!plugin) return <ErrorState message="插件未安装或未启用" />;
    const normalized = (path || "").replace(/^\/+|\/+$/g, "");
    const menu = plugin.admin_menus?.find(
        (m: Row) => m.path.replace(/^\/+|\/+$/g, "") === normalized,
    );
    const schema = plugin.admin_crud?.[normalized];
    if (
        !menu &&
        !schema &&
        normalized &&
        !["settings", "overview"].includes(normalized)
    )
        return <ErrorState message="插件页面不存在" />;
    if (!schema)
        return (
            <section className="panel detail-body">
                <h1>{menu?.title || plugin.name}</h1>
                <p>{menu?.description || plugin.description}</p>
                <Link to="/plugins">前往插件管理，查看配置与启用状态</Link>
            </section>
        );
    const m: Module = {
        id: `plugin:${code}:${normalized}`,
        title: schema.title || menu?.title || plugin.name,
        description: schema.description || "",
        group: plugin.name,
        endpoint: schema.api.list,
        remote: true,
        canCreate: !!schema.actions?.create,
        key: schema.id_field || "id",
        columns: (schema.columns || []).map((c: Row) => ({
            key: c.key,
            label: c.title,
            format:
                c.type === "datetime"
                    ? "time"
                    : c.type === "boolean"
                      ? "boolean"
                      : undefined,
            options: c.options
                ? Object.fromEntries(
                      c.options.map((o: Row) => [o.value, o.label]),
                  )
                : undefined,
        })),
        fields: schema.actions?.edit ? dynamicFields(schema.form) : undefined,
        save: schema.actions?.edit ? schema.api.save : undefined,
        create: schema.actions?.create
            ? {
                  label: "新增",
                  endpoint: schema.api.save,
                  fields: dynamicFields(schema.form),
              }
            : undefined,
        actions: schema.actions?.delete
            ? [
                  {
                      label: "删除",
                      endpoint: schema.api.delete,
                      idKey: schema.id_field || "id",
                      danger: true,
                      confirm: "确认删除此记录？",
                  },
              ]
            : undefined,
    };
    return <Resource key={m.id} module={m} />;
}
