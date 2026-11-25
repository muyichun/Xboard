import { useEffect, useState, Suspense, lazy } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { request, settings } from "../lib/api";
import { rowsOf, errorMessage } from "../lib/utils";
import { Loading, ErrorState, Notice } from "../components/Feedback";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import type { Row } from "../lib/types";
const Editor = lazy(() => import("../components/Editor"));
const variables: Row = {
    name: { label: "站点名称", example: "XBoard" },
    url: { label: "站点网址", example: "https://example.com" },
    code: { label: "邮箱验证码", example: "123456" },
    content: { label: "通知内容", example: "这是一封测试通知邮件。" },
    link: {
        label: "一次性登录链接",
        example: "https://example.com/login?token=example",
    },
};
export default function Mail({ embedded = false }: { embedded?: boolean }) {
    const [name, setName] = useState("verify"),
        [preview, setPreview] = useState(false),
        [message, setMessage] = useState(""),
        [error, setError] = useState(""),
        [subject, setSubject] = useState(""),
        [content, setContent] = useState(""),
        [email, setEmail] = useState(""),
        [busy, setBusy] = useState(false);
    const qc = useQueryClient();
    const list = useQuery({
            queryKey: ["mail-templates"],
            queryFn: () => request("mail/template/list"),
        }),
        q = useQuery({
            queryKey: ["mail-template", name],
            queryFn: () => request("mail/template/get", { name }),
            refetchOnWindowFocus: false,
        });
    const data = q.data?.data,
        dirty =
            !!data && (subject !== data.subject || content !== data.content);
    useEffect(() => {
        if (data) {
            setSubject(data.subject);
            setContent(data.content);
        }
    }, [data]);
    useEffect(() => {
        if (!dirty) return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [dirty]);
    async function run(fn: () => Promise<void>) {
        setError("");
        setBusy(true);
        try {
            await fn();
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    }
    const rendered = content.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) =>
        key === "name" ? settings.title : variables[key]?.example || match,
    );
    return (
        <>
            {!embedded && (
                <header className="page-header">
                    <div>
                        <h1>邮件模板</h1>
                        <p>自定义邮件主题和内容</p>
                    </div>
                </header>
            )}
            <div className="tabs">
                {rowsOf(list.data).map((r) => (
                    <button
                        key={r.name}
                        className={name === r.name ? "active" : ""}
                        onClick={() => {
                            if (
                                dirty &&
                                !window.confirm(
                                    "当前模板有未保存修改，确定放弃并切换？",
                                )
                            )
                                return;
                            setName(r.name);
                            setMessage("");
                            setError("");
                        }}
                    >
                        {r.label}
                        {r.customized ? " · 已自定义" : ""}
                    </button>
                ))}
            </div>
            <Notice message={message} />
            <Notice message={error} error />
            {q.isPending ? (
                <Loading />
            ) : q.isError ? (
                <ErrorState message={errorMessage(q.error)} />
            ) : (
                <>
                    <div className="toolbar">
                        <strong>{data.label}</strong>
                        <span className="muted">
                            {dirty
                                ? "有未保存的修改"
                                : data.customized
                                  ? "已自定义"
                                  : "默认模板"}
                        </span>
                        <div className="toolbar-spacer" />
                        <Button
                            variant="outline"
                            onClick={() => setPreview(true)}
                        >
                            预览
                        </Button>
                        <Button
                            variant="ghost"
                            disabled={busy}
                            onClick={() => {
                                if (
                                    window.confirm(
                                        "恢复默认模板并覆盖自定义内容？",
                                    )
                                )
                                    run(async () => {
                                        await request(
                                            "mail/template/reset",
                                            { name },
                                            "post",
                                        );
                                        await q.refetch();
                                        await qc.invalidateQueries({
                                            queryKey: ["mail-templates"],
                                        });
                                        setMessage("已恢复默认模板");
                                    });
                            }}
                        >
                            恢复默认
                        </Button>
                    </div>
                    <form
                        className="mail-editor"
                        onSubmit={(e) => {
                            e.preventDefault();
                            run(async () => {
                                await request(
                                    "mail/template/save",
                                    { name, subject, content },
                                    "post",
                                );
                                await q.refetch();
                                await qc.invalidateQueries({
                                    queryKey: ["mail-templates"],
                                });
                                setMessage("邮件模板已保存");
                            });
                        }}
                    >
                        <label htmlFor="mail-subject">邮件主题</label>
                        <input
                            id="mail-subject"
                            required
                            maxLength={255}
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                        />
                        <label>邮件内容 (HTML)</label>
                        <Suspense fallback={<Loading />}>
                            <Editor
                                language="html"
                                value={content}
                                onChange={setContent}
                            />
                        </Suspense>
                        <div className="form-footer">
                            <Button type="submit" disabled={busy || !dirty}>
                                保存模板
                            </Button>
                        </div>
                    </form>
                    <details className="mail-variables" open>
                        <summary>可用变量</summary>
                        <div className="table-scroll">
                            <table>
                                <thead>
                                    <tr>
                                        <th>变量</th>
                                        <th>说明</th>
                                        <th>示例</th>
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        ...(data.required_vars || []),
                                        ...(data.optional_vars || []),
                                    ].map((key) => (
                                        <tr key={key}>
                                            <td>
                                                <code>{`{{${key}}}`}</code>
                                                {data.required_vars.includes(
                                                    key,
                                                ) && <small> 必需</small>}
                                            </td>
                                            <td>
                                                {variables[key]?.label || key}
                                            </td>
                                            <td>
                                                {variables[key]?.example || "—"}
                                            </td>
                                            <td>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() =>
                                                        setContent(
                                                            (v) =>
                                                                v +
                                                                `{{${key}}}`,
                                                        )
                                                    }
                                                >
                                                    插入
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </details>
                    <form
                        className="toolbar"
                        onSubmit={(e) => {
                            e.preventDefault();
                            run(async () => {
                                await request(
                                    "mail/template/test",
                                    { name, ...(email ? { email } : {}) },
                                    "post",
                                );
                                setMessage("测试邮件已发送");
                            });
                        }}
                    >
                        <input
                            aria-label="测试收件人"
                            type="email"
                            placeholder="测试收件人（留空使用当前管理员邮箱）"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <Button
                            type="submit"
                            variant="outline"
                            disabled={dirty || busy}
                        >
                            发送测试邮件
                        </Button>
                        {dirty && <small>请先保存模板再发送测试邮件</small>}
                    </form>
                </>
            )}
            <Dialog
                open={preview}
                onClose={() => setPreview(false)}
                title="邮件预览（当前草稿）"
                wide
            >
                <iframe
                    title="邮件内容预览"
                    sandbox=""
                    referrerPolicy="no-referrer"
                    className="mail-preview"
                    srcDoc={DOMPurify.sanitize(rendered)}
                />
            </Dialog>
        </>
    );
}
