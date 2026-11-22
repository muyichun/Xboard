import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { request } from "../lib/api";
import { rowsOf, errorMessage } from "../lib/utils";
import { Loading, ErrorState, Notice } from "../components/Feedback";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { Form } from "../components/Form";
import { required } from "../modules/fields";
export default function Mail() {
    const [name, setName] = useState("verify"),
        [preview, setPreview] = useState(false),
        [message, setMessage] = useState(""),
        [error, setError] = useState("");
    const qc = useQueryClient();
    const list = useQuery({
        queryKey: ["mail-templates"],
        queryFn: () => request("mail/template/list"),
    });
    const q = useQuery({
        queryKey: ["mail-template", name],
        queryFn: () => request("mail/template/get", { name }),
    });
    const data = q.data?.data;
    return (
        <>
            <header className="page-header">
                <div>
                    <div className="eyebrow">用户与服务</div>
                    <h1>邮件模板</h1>
                    <p>维护通知内容，保留发送所需变量</p>
                </div>
            </header>
            <div className="settings-layout">
                <aside className="settings-tabs">
                    {rowsOf(list.data).map((r) => (
                        <button
                            key={r.name}
                            className={name === r.name ? "active" : ""}
                            onClick={() => {
                                setName(r.name);
                                setMessage("");
                                setError("");
                            }}
                        >
                            {r.label}
                        </button>
                    ))}
                </aside>
                <section className="panel">
                    <header className="section-header">
                        <h2>{data?.label || "邮件内容"}</h2>
                        <div className="header-actions">
                            <Button
                                variant="outline"
                                onClick={() => setPreview(true)}
                            >
                                预览已保存内容
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={async () => {
                                    if (
                                        !window.confirm(
                                            "恢复默认模板并覆盖自定义内容？",
                                        )
                                    )
                                        return;
                                    try {
                                        await request(
                                            "mail/template/reset",
                                            { name },
                                            "post",
                                        );
                                        await qc.invalidateQueries({
                                            queryKey: ["mail-template", name],
                                        });
                                        setMessage("已恢复默认模板");
                                    } catch (e) {
                                        setError(errorMessage(e));
                                    }
                                }}
                            >
                                恢复默认
                            </Button>
                        </div>
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
                        <Form
                            key={`${name}-${q.dataUpdatedAt}`}
                            fields={[
                                required("subject", "邮件主题"),
                                required("content", "邮件 HTML", "code", {
                                    hint: `必需变量：${(data.required_vars || []).join("、")}；可选：${(data.optional_vars || []).join("、")}`,
                                }),
                            ]}
                            seed={data}
                            onSubmit={async (v) => {
                                await request(
                                    "mail/template/save",
                                    { name, ...v },
                                    "post",
                                );
                                setMessage("邮件模板已保存");
                                await qc.invalidateQueries({
                                    queryKey: ["mail-template", name],
                                });
                            }}
                        />
                    )}
                    <div className="panel-tools">
                        <Button
                            variant="outline"
                            onClick={async () => {
                                if (
                                    !window.confirm(
                                        "将向当前管理员发送测试邮件，确认发送？",
                                    )
                                )
                                    return;
                                try {
                                    await request(
                                        "mail/template/test",
                                        { name },
                                        "post",
                                    );
                                    setMessage("测试邮件已提交发送");
                                } catch (e) {
                                    setError(errorMessage(e));
                                }
                            }}
                        >
                            发送测试邮件
                        </Button>
                    </div>
                </section>
            </div>
            <Dialog
                open={preview}
                onClose={() => setPreview(false)}
                title="邮件预览"
                wide
            >
                <iframe
                    title="邮件内容预览"
                    sandbox=""
                    referrerPolicy="no-referrer"
                    className="mail-preview"
                    srcDoc={DOMPurify.sanitize(data?.content || "")}
                />
            </Dialog>
        </>
    );
}
