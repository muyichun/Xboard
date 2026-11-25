import { useState } from "react";
import { Form } from "../components/Form";
import { Notice } from "../components/Feedback";
import { MarkdownView } from "../components/Markdown";
import { dynamicValues } from "../modules/settings";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { request } from "../lib/api";
import { rowsOf, errorMessage } from "../lib/utils";
import { dynamicFields } from "../modules/settings";
import type { Module, Row } from "../lib/types";
import Resource from "./Resource";
import { Loading, ErrorState } from "../components/Feedback";
import {
    normalizePluginPath,
    pluginMenuItems,
    type PluginMenuDeclaration,
} from "../legacy/pluginMenus";

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
    const normalized = normalizePluginPath(path);
    const menu = plugin.admin_menus?.find(
        (m: PluginMenuDeclaration) =>
            normalizePluginPath(m.path) === normalized,
    );
    const schema = plugin.admin_crud?.[normalized];
    const hasConfig = Object.keys(plugin.config || {}).length > 0;
    if (
        !menu &&
        !schema &&
        normalized &&
        normalized !== "overview" &&
        !(normalized === "settings" && hasConfig)
    )
        return <ErrorState message="插件页面不存在" />;
    if (!schema)
        return (
            <PluginInfo
                plugin={plugin}
                page={normalized}
                menu={menu}
                hasConfig={hasConfig}
            />
        );
    const m: Module = {
        id: `plugin:${code}:${normalized}`,
        title: schema.title || menu?.title || plugin.name,
        description: schema.description || "",
        group: plugin.name,
        endpoint: schema.api.list,
        remote: true,
        searchKey: schema.columns?.some((column: Row) => column.searchable)
            ? "search"
            : undefined,
        canCreate: !!schema.actions?.create,
        key: schema.id_field || "id",
        columns: (schema.columns || []).map((c: Row) => ({
            key: c.key,
            label: c.title,
            sortable: !!c.sortable,
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
                      deletesRecord: true,
                      confirm: "确认删除此记录？",
                  },
              ]
            : undefined,
    };
    return <Resource key={m.id} module={m} />;
}

function PluginInfo({
    plugin,
    page,
    menu,
    hasConfig,
}: {
    plugin: Row;
    page: string;
    menu?: PluginMenuDeclaration;
    hasConfig: boolean;
}) {
    const [message, setMessage] = useState("");
    const overviewPath = `/plugins/${plugin.code}`;
    const isSettings = !menu && page === "settings";
    const q = useQuery({
        queryKey: ["plugin-config", plugin.code],
        queryFn: () => request("plugin/config", { code: plugin.code }),
        enabled: isSettings,
    });
    return (
        <>
            <header className="page-header">
                <div>
                    <h1>{menu?.title || plugin.name}</h1>
                    <p>{menu?.description || plugin.description}</p>
                </div>
                <div className="header-actions">
                    {menu || isSettings ? (
                        <Link
                            className="button button-outline"
                            to={overviewPath}
                        >
                            返回概览
                        </Link>
                    ) : (
                        hasConfig && (
                            <Link
                                className="button button-outline"
                                to={`${overviewPath}/settings`}
                            >
                                配置插件
                            </Link>
                        )
                    )}
                    <Link className="button button-outline" to="/config/plugin">
                        插件管理
                    </Link>
                </div>
            </header>
            <Notice message={message} />
            {isSettings ? (
                q.isPending ? (
                    <Loading />
                ) : q.isError ? (
                    <ErrorState message={errorMessage(q.error)} />
                ) : (
                    <Form
                        fields={dynamicFields(q.data?.data || {})}
                        seed={dynamicValues(q.data?.data || {})}
                        onSubmit={async (config) => {
                            await request(
                                "plugin/config",
                                { code: plugin.code, config },
                                "post",
                            );
                            await q.refetch();
                            setMessage("配置已保存");
                        }}
                    />
                )
            ) : (
                <section className="panel detail-body">
                    <p>
                        {plugin.code} · 版本 {plugin.version} · 作者{" "}
                        {plugin.author || "—"} · 已启用
                    </p>
                    <MarkdownView
                        value={
                            plugin.readme || plugin.description || "暂无说明"
                        }
                    />
                    {pluginMenuItems(plugin.code, plugin.admin_menus || []).map(
                        (menu) => (
                            <Link
                                className="button button-outline"
                                key={menu.id}
                                to={menu.path}
                            >
                                {menu.title}
                            </Link>
                        ),
                    )}
                </section>
            )}
        </>
    );
}
