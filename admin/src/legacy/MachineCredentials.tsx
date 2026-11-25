import { useEffect, useState } from "react";
import { Notice } from "../components/Feedback";
import { Button } from "../components/ui/button";
import { request } from "../lib/api";
import { errorMessage } from "../lib/utils";
import { Copy } from "./Cells";

export default function MachineCredentials({ id }: { id: number }) {
    const [result, setResult] = useState<{
        kind: "command" | "token";
        value: string;
    } | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!result) return;
        const timer = setTimeout(() => setResult(null), 180000);
        return () => clearTimeout(timer);
    }, [result]);

    async function run(action: "installCommand" | "getToken" | "resetToken") {
        const reset = action === "resetToken";
        const kind = action === "installCommand" ? "command" : "token";
        if (
            reset &&
            !window.confirm(
                "立即重置认证令牌？原令牌将失效，需要更新节点配置。",
            )
        )
            return;
        setError("");
        setResult(null);
        if (!reset && result?.kind === kind) return;
        setBusy(true);
        try {
            const { data } = await request(
                `server/machine/${action}`,
                { id },
                reset ? "post" : "get",
            );
            if (!data?.[kind]) throw new Error("服务器未返回安装命令或令牌");
            setResult({ kind, value: data[kind] });
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="field-group" aria-label="安装与认证">
            <h3>安装与认证</h3>
            <div className="toolbar">
                <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => run("installCommand")}
                >
                    {result?.kind === "command"
                        ? "隐藏安装命令"
                        : "查看安装命令"}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => run("getToken")}
                >
                    {result?.kind === "token" ? "隐藏认证令牌" : "查看认证令牌"}
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    className="error"
                    disabled={busy}
                    onClick={() => run("resetToken")}
                >
                    重置认证令牌
                </Button>
            </div>
            <Notice message={error} error />
            {result && (
                <>
                    <div className="command-code">
                        <pre>{result.value}</pre>
                        <Copy key={result.value} value={result.value} />
                    </div>
                    <small className="muted">180 秒后自动隐藏。</small>
                </>
            )}
        </section>
    );
}
