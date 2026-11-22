import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, settings } from "../lib/api";
import { configGroups, configFields } from "../modules/settings";
import { Form } from "../components/Form";
import { Button } from "../components/ui/button";
import { Notice, Loading, ErrorState } from "../components/Feedback";
import { errorMessage } from "../lib/utils";
export default function Settings() {
    const [group, setGroup] = useState("site"),
        [message, setMessage] = useState(""),
        [error, setError] = useState("");
    const qc = useQueryClient();
    const q = useQuery({
        queryKey: ["settings", group],
        queryFn: () => request("config/fetch", { key: group }),
    });
    const values = q.data?.data?.[group];
    return (
        <>
            <header className="page-header">
                <div>
                    <div className="eyebrow">系统设置</div>
                    <h1>系统配置</h1>
                    <p>按业务分组管理站点配置，修改后统一保存</p>
                </div>
            </header>
            <div className="settings-layout">
                <aside className="settings-tabs">
                    {Object.entries(configGroups).map(([key, label]) => (
                        <button
                            key={key}
                            className={key === group ? "active" : ""}
                            onClick={() => {
                                setGroup(key);
                                setMessage("");
                                setError("");
                            }}
                        >
                            {String(label)}
                        </button>
                    ))}
                </aside>
                <section className="panel settings-panel">
                    <header className="section-header">
                        <h2>{configGroups[group]}</h2>
                    </header>
                    <Notice message={message} />
                    <Notice message={error} error />
                    {q.isPending ? (
                        <Loading />
                    ) : q.isError ? (
                        <ErrorState
                            message={errorMessage(q.error)}
                            retry={() => q.refetch()}
                        />
                    ) : (
                        values && (
                            <Form
                                key={`${group}-${q.dataUpdatedAt}`}
                                fields={configFields(group, values)}
                                seed={values}
                                submitLabel="保存设置"
                                onSubmit={async (v) => {
                                    await request("config/save", v, "post");
                                    setMessage(
                                        v.secure_path &&
                                            v.secure_path !==
                                                settings.secure_path
                                            ? "已保存。后台路径变更需重新加载应用后生效，请保留当前入口。"
                                            : "设置已保存",
                                    );
                                    await qc.invalidateQueries({
                                        queryKey: ["settings", group],
                                    });
                                }}
                            />
                        )
                    )}
                    {["email", "telegram"].includes(group) && (
                        <div className="panel-tools">
                            <Button
                                variant="outline"
                                onClick={async () => {
                                    if (
                                        !window.confirm(
                                            group === "email"
                                                ? "向当前管理员发送测试邮件？"
                                                : "根据已保存配置更新 Telegram Webhook？",
                                        )
                                    )
                                        return;
                                    setError("");
                                    try {
                                        const result = await request(
                                            group === "email"
                                                ? "config/testSendMail"
                                                : "config/setTelegramWebhook",
                                            group === "telegram"
                                                ? {
                                                      telegram_bot_token:
                                                          values.telegram_bot_token,
                                                  }
                                                : {},
                                            "post",
                                        );
                                        if (result.data?.error)
                                            throw new Error(
                                                String(result.data.error),
                                            );
                                        setMessage("操作成功");
                                    } catch (e) {
                                        setError(errorMessage(e));
                                    }
                                }}
                            >
                                {group === "email"
                                    ? "发送测试邮件"
                                    : "更新 Webhook"}
                            </Button>
                        </div>
                    )}
                </section>
            </div>
        </>
    );
}
