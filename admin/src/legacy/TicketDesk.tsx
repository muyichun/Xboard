import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Send } from "lucide-react";
import type { Row } from "../lib/types";
import { request } from "../lib/api";
import { rowsOf, time, errorMessage } from "../lib/utils";
import { Dialog } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Notice, Loading, ErrorState } from "../components/Feedback";
import { Status } from "./Cells";
import { UserDetails, TrafficRecords } from "./Details";
export default function TicketDesk({
    ticket,
    onClose,
}: {
    ticket: Row;
    onClose: () => void;
}) {
    const [id, setId] = useState(ticket.id),
        [search, setSearch] = useState(""),
        [message, setMessage] = useState(""),
        [error, setError] = useState(""),
        [busy, setBusy] = useState(false),
        [confirm, setConfirm] = useState(false),
        [related, setRelated] = useState<"user" | "traffic" | null>(null);
    const navigate = useNavigate(),
        qc = useQueryClient(),
        end = useRef<HTMLDivElement>(null);
    const list = useQuery({
        queryKey: ["ticket-desk-list", ticket.status],
        queryFn: () =>
            request(
                "ticket/fetch",
                { status: ticket.status, pageSize: 100, current: 1 },
                "post",
            ),
        refetchInterval: 5000,
    });
    const q = useQuery({
        queryKey: ["ticket-detail", id],
        queryFn: () => request("ticket/fetch", { id }),
        refetchInterval: 5000,
    });
    const r = q.data?.data;
    const user = useQuery({
        queryKey: ["ticket-user", r?.user_id],
        queryFn: async () =>
            rowsOf(
                await request(
                    "user/fetch",
                    {
                        filter: [{ id: "id", value: `eq:${r.user_id}` }],
                        pageSize: 1,
                    },
                    "post",
                ),
            )[0],
        enabled: !!r && related === "user",
    });
    useEffect(() => {
        end.current?.scrollIntoView({ block: "nearest" });
    }, [r?.messages?.length, id]);
    async function send() {
        if (!message.trim() || busy) return;
        setBusy(true);
        setError("");
        try {
            await request("ticket/reply", { id, message }, "post");
            setMessage("");
            await q.refetch();
            await qc.invalidateQueries({ queryKey: ["resource", "tickets"] });
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    }
    return (
        <>
            <Dialog
                open
                onClose={onClose}
                title="查看工单"
                wide
                className="ticket-dialog"
            >
                <div className="ticket-workspace">
                    <aside className="ticket-sidebar">
                        <input
                            aria-label="搜索工单"
                            placeholder="搜索标题或邮箱..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        {rowsOf(list.data)
                            .filter((r) =>
                                `${r.subject} ${r.user?.email}`
                                    .toLowerCase()
                                    .includes(search.toLowerCase()),
                            )
                            .map((t) => (
                                <button
                                    key={t.id}
                                    className={id === t.id ? "active" : ""}
                                    onClick={() => {
                                        setId(t.id);
                                        setMessage("");
                                    }}
                                >
                                    <strong>{t.subject}</strong>
                                    <small>{t.user?.email}</small>
                                    <span>
                                        #{t.id} · {time(t.updated_at)}
                                    </span>
                                </button>
                            ))}
                        <small>当前分组最近 100 条工单</small>
                    </aside>
                    <section className="ticket-conversation">
                        {q.isPending ? (
                            <Loading />
                        ) : q.isError ? (
                            <ErrorState message={errorMessage(q.error)} />
                        ) : (
                            r && (
                                <>
                                    <header>
                                        <div className="cell-line">
                                            <h2>{r.subject}</h2>
                                            <Status
                                                tone={
                                                    r.status === 1
                                                        ? "gray"
                                                        : r.reply_status === 0
                                                          ? "orange"
                                                          : "green"
                                                }
                                            >
                                                {r.status === 1
                                                    ? "已关闭"
                                                    : r.reply_status === 0
                                                      ? "待回复"
                                                      : "已回复"}
                                            </Status>
                                            <Status>
                                                {
                                                    [
                                                        "低优先",
                                                        "中优先",
                                                        "高优先",
                                                    ][r.level]
                                                }
                                            </Status>
                                        </div>
                                        <small>
                                            工单 #{r.id} · 创建时间{" "}
                                            {time(r.created_at)}
                                        </small>
                                        <div className="header-actions">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    setRelated("user")
                                                }
                                            >
                                                用户信息
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    setRelated("traffic")
                                                }
                                            >
                                                流量记录
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    onClose();
                                                    navigate(
                                                        `/finance/order?user_id=${r.user_id}`,
                                                    );
                                                }}
                                            >
                                                订单记录
                                            </Button>
                                            {r.status === 0 && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        setConfirm(true)
                                                    }
                                                >
                                                    关闭工单
                                                </Button>
                                            )}
                                        </div>
                                    </header>
                                    <div className="messages">
                                        {r.messages.map((msg: Row) => (
                                            <article
                                                key={msg.id}
                                                className={
                                                    msg.is_from_admin
                                                        ? "message-admin"
                                                        : "message-user"
                                                }
                                            >
                                                <header>
                                                    <strong>
                                                        {msg.is_from_admin
                                                            ? "管理员"
                                                            : r.user?.email ||
                                                              "用户"}
                                                    </strong>
                                                    <time>
                                                        {time(msg.created_at)}
                                                    </time>
                                                </header>
                                                <p>{msg.message}</p>
                                            </article>
                                        ))}
                                        <div ref={end} />
                                    </div>
                                    <footer>
                                        <Notice message={error} error />
                                        {r.status === 1 && (
                                            <small>
                                                此工单已关闭，仍可继续回复。
                                            </small>
                                        )}
                                        <textarea
                                            aria-label="回复内容"
                                            placeholder="请输入回复内容，Enter 发送，Shift + Enter 换行"
                                            value={message}
                                            onChange={(e) =>
                                                setMessage(e.target.value)
                                            }
                                            onKeyDown={(e) => {
                                                if (
                                                    e.key === "Enter" &&
                                                    !e.shiftKey &&
                                                    !e.nativeEvent.isComposing
                                                ) {
                                                    e.preventDefault();
                                                    send();
                                                }
                                            }}
                                        />
                                        <Button
                                            disabled={busy || !message.trim()}
                                            onClick={send}
                                        >
                                            <Send size={15} />
                                            {busy ? "发送中..." : "发送"}
                                        </Button>
                                    </footer>
                                </>
                            )
                        )}
                    </section>
                </div>
            </Dialog>
            <Dialog
                open={confirm}
                onClose={() => setConfirm(false)}
                title="确认关闭工单"
                description="确定要关闭这个工单吗？关闭后会移入已关闭列表，但仍可继续回复。"
            >
                <div className="form-footer">
                    <Button variant="outline" onClick={() => setConfirm(false)}>
                        取消
                    </Button>
                    <Button
                        onClick={async () => {
                            try {
                                await request("ticket/close", { id }, "post");
                                setConfirm(false);
                                await q.refetch();
                                await qc.invalidateQueries({
                                    queryKey: ["resource", "tickets"],
                                });
                            } catch (e) {
                                setError(errorMessage(e));
                                setConfirm(false);
                            }
                        }}
                    >
                        确认关闭
                    </Button>
                </div>
            </Dialog>
            <Dialog
                open={!!related}
                onClose={() => setRelated(null)}
                title={related === "user" ? "用户信息" : "流量使用记录"}
                wide
            >
                {related === "user" ? (
                    user.isPending ? (
                        <Loading />
                    ) : user.data ? (
                        <UserDetails user={user.data} />
                    ) : (
                        <ErrorState message={errorMessage(user.error)} />
                    )
                ) : (
                    related === "traffic" &&
                    r && <TrafficRecords userId={r.user_id} />
                )}
            </Dialog>
        </>
    );
}
