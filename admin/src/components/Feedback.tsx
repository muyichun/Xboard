import {
    AlertCircle,
    CheckCircle2,
    LoaderCircle,
    Inbox,
    RefreshCw,
} from "lucide-react";
import { Button } from "./ui/button";
export function Loading() {
    return (
        <div className="state">
            <LoaderCircle className="spin" size={24} />
            <span>正在加载…</span>
        </div>
    );
}
export function Empty({ text = "暂无数据" }: { text?: string }) {
    return (
        <div className="state">
            <Inbox size={32} />
            <strong>{text}</strong>
            <span>调整筛选条件，或添加第一条记录。</span>
        </div>
    );
}
export function ErrorState({
    message,
    retry,
}: {
    message: string;
    retry?: () => void;
}) {
    return (
        <div role="alert" className="state error">
            <AlertCircle size={28} />
            <strong>{message}</strong>
            {retry && (
                <Button variant="outline" onClick={retry}>
                    <RefreshCw size={16} />
                    重新加载
                </Button>
            )}
        </div>
    );
}
export function Notice({
    message,
    error = false,
}: {
    message: string;
    error?: boolean;
}) {
    return message ? (
        <div
            role={error ? "alert" : "status"}
            className={`notice ${error ? "notice-error" : "notice-success"}`}
        >
            {error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{message}</span>
        </div>
    ) : null;
}
