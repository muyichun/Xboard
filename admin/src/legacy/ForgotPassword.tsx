import { useEffect, useState } from "react";
import { request } from "../lib/api";
import { errorMessage } from "../lib/utils";
import { Dialog } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Notice } from "../components/Feedback";
export default function ForgotPassword({ onClose }: { onClose: () => void }) {
    const [email, setEmail] = useState(""),
        [code, setCode] = useState(""),
        [password, setPassword] = useState(""),
        [busy, setBusy] = useState(false),
        [error, setError] = useState(""),
        [message, setMessage] = useState(""),
        [seconds, setSeconds] = useState(0);
    useEffect(() => {
        if (!seconds) return;
        const id = setTimeout(() => setSeconds((n) => n - 1), 1000);
        return () => clearTimeout(id);
    }, [seconds]);
    return (
        <Dialog
            open
            onClose={onClose}
            title="重置密码"
            description="通过邮箱验证码重置您的登录密码"
        >
            <form
                className="edit-form"
                onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    setError("");
                    try {
                        await request(
                            "@passport/auth/forget",
                            { email, email_code: code, password },
                            "post",
                        );
                        setMessage("密码已重置，请使用新密码登录");
                        setPassword("");
                    } catch (e) {
                        setError(errorMessage(e));
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                <div className="form-body">
                    <Notice message={error} error />
                    <Notice message={message} />
                    <div className="field">
                        <label htmlFor="reset-email">邮箱</label>
                        <input
                            id="reset-email"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="field">
                        <label htmlFor="reset-code">邮箱验证码</label>
                        <div className="toolbar">
                            <input
                                id="reset-code"
                                required
                                maxLength={6}
                                pattern="[0-9]{6}"
                                inputMode="numeric"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                disabled={busy || seconds > 0 || !email}
                                onClick={async () => {
                                    setBusy(true);
                                    setError("");
                                    try {
                                        await request(
                                            "@passport/comm/sendEmailVerify",
                                            { email },
                                            "post",
                                        );
                                        setSeconds(60);
                                        setMessage("验证码已发送");
                                    } catch (e) {
                                        setError(errorMessage(e));
                                    } finally {
                                        setBusy(false);
                                    }
                                }}
                            >
                                {seconds ? `${seconds} 秒后重试` : "发送验证码"}
                            </Button>
                        </div>
                    </div>
                    <div className="field">
                        <label htmlFor="reset-password">新密码</label>
                        <input
                            id="reset-password"
                            type="password"
                            autoComplete="new-password"
                            minLength={8}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                </div>
                <footer className="form-footer">
                    <Button type="button" variant="outline" onClick={onClose}>
                        返回登录
                    </Button>
                    <Button type="submit" disabled={busy}>
                        重置密码
                    </Button>
                </footer>
            </form>
        </Dialog>
    );
}
