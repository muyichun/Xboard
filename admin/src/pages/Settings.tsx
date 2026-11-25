import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { request, settings } from "../lib/api";
import { configGroups, configFields } from "../modules/settings";
import { Form } from "../components/Form";
import { Button } from "../components/ui/button";
import { Notice, Loading, ErrorState } from "../components/Feedback";
import { errorMessage } from "../lib/utils";
import Mail from "./Mail";
const groupPaths: Record<string, string> = {
    site: "",
    safe: "/safe",
    subscribe: "/subscribe",
    invite: "/invite",
    frontend: "/frontend",
    server: "/server",
    email: "/email",
    telegram: "/telegram",
    app: "/app",
    subscribe_template: "/subscribe-template",
};
export default function Settings() {
    const location = useLocation(),
        navigate = useNavigate(),
        suffix = location.pathname.slice("/config/system".length).toLowerCase(),
        group =
            Object.keys(groupPaths).find(
                (k) =>
                    groupPaths[k] &&
                    (suffix === groupPaths[k] ||
                        suffix.startsWith(`${groupPaths[k]}/`)),
            ) || "site";
    const [message, setMessage] = useState(""),
        [error, setError] = useState(""),
        [template, setTemplate] = useState("singbox");
    const q = useQuery({
        queryKey: ["settings", group],
        queryFn: () => request("config/fetch", { key: group }),
        refetchOnWindowFocus: false,
    });
    const values = q.data?.data?.[group];
    const fields = values
        ? configFields(group, values).map((f) => ({
              ...f,
              language: f.key.includes("singbox")
                  ? "json"
                  : /surge|surfboard/.test(f.key)
                    ? "ini"
                    : f.language,
              show: (v: any) => {
                  if (f.key === "try_out_hour") return !!v.try_out_plan_id;
                  if (f.key.startsWith("commission_distribution_l"))
                      return !!v.commission_distribution_enable;
                  if (f.key === "email_whitelist_suffix")
                      return !!v.email_whitelist_enable;
                  if (
                      [
                          "register_limit_count",
                          "register_limit_expire",
                      ].includes(f.key)
                  )
                      return !!v.register_limit_by_ip_enable;
                  if (
                      [
                          "password_limit_count",
                          "password_limit_expire",
                      ].includes(f.key)
                  )
                      return !!v.password_limit_enable;
                  if (f.key.startsWith("recaptcha_v3_"))
                      return (
                          !!v.captcha_enable &&
                          v.captcha_type === "recaptcha-v3"
                      );
                  if (["recaptcha_key", "recaptcha_site_key"].includes(f.key))
                      return (
                          !!v.captcha_enable && v.captcha_type === "recaptcha"
                      );
                  if (f.key.startsWith("turnstile_"))
                      return (
                          !!v.captcha_enable && v.captcha_type === "turnstile"
                      );
                  if (f.key === "captcha_type") return !!v.captcha_enable;
                  return true;
              },
          }))
        : [];
    const templates = fields.filter((f) =>
        f.key.startsWith("subscribe_template_"),
    );
    const chosen =
        templates.find((f) => f.key === `subscribe_template_${template}`) ||
        templates[0];
    return (
        <>
            <header className="page-header">
                <div>
                    <h1>系统配置</h1>
                    <p>管理您的站点配置</p>
                </div>
            </header>
            <div className="settings-layout">
                <aside className="settings-tabs">
                    {Object.entries(groupPaths).map(([key, path]) => (
                        <Link
                            key={key}
                            className={key === group ? "active" : ""}
                            to={`/config/system${path}`}
                            onClick={() => {
                                setMessage("");
                                setError("");
                            }}
                        >
                            {configGroups[key]}
                        </Link>
                    ))}
                </aside>
                <section className="settings-panel">
                    <header className="section-header">
                        <h2>{configGroups[group]}</h2>
                    </header>
                    {group === "email" && (
                        <div className="tabs">
                            <button
                                className={
                                    !suffix.endsWith("/templates")
                                        ? "active"
                                        : ""
                                }
                                onClick={() => navigate("/config/system/email")}
                            >
                                邮件配置
                            </button>
                            <button
                                className={
                                    suffix.endsWith("/templates")
                                        ? "active"
                                        : ""
                                }
                                onClick={() =>
                                    navigate("/config/system/email/templates")
                                }
                            >
                                邮件模板
                            </button>
                        </div>
                    )}
                    <Notice message={message} />
                    <Notice message={error} error />
                    {group === "email" && suffix.endsWith("/templates") ? (
                        <Mail embedded />
                    ) : q.isPending ? (
                        <Loading />
                    ) : q.isError ? (
                        <ErrorState
                            message={errorMessage(q.error)}
                            retry={() => q.refetch()}
                        />
                    ) : (
                        values && (
                            <>
                                {group === "subscribe_template" && (
                                    <div className="tabs">
                                        {templates.map((f) => (
                                            <button
                                                key={f.key}
                                                className={
                                                    chosen?.key === f.key
                                                        ? "active"
                                                        : ""
                                                }
                                                onClick={() =>
                                                    setTemplate(
                                                        f.key.replace(
                                                            "subscribe_template_",
                                                            "",
                                                        ),
                                                    )
                                                }
                                            >
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <Form
                                    key={`${group}-${group === "subscribe_template" ? chosen?.key : ""}`}
                                    fields={
                                        group === "subscribe_template" && chosen
                                            ? [chosen]
                                            : fields
                                    }
                                    seed={values}
                                    autoSave
                                    submitLabel="保存设置"
                                    onSubmit={async (v) => {
                                        await request("config/save", v, "post");
                                        if (
                                            v.secure_path &&
                                            v.secure_path !==
                                                settings.secure_path
                                        )
                                            setMessage(
                                                "后台路径已更新，需重新加载应用后生效。",
                                            );
                                    }}
                                />
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
                                                try {
                                                    const result =
                                                        await request(
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
                                                            String(
                                                                result.data
                                                                    .error,
                                                            ),
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
                            </>
                        )
                    )}
                </section>
            </div>
        </>
    );
}
