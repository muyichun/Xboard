import {
    Suspense,
    lazy,
    useEffect,
    useState,
    Component,
    type ReactNode,
} from "react";
import {
    HashRouter,
    Routes,
    Route,
    NavLink,
    Link,
    useLocation,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Activity,
    LayoutDashboard,
    Users,
    Server,
    Settings2,
    FileText,
    BarChart3,
    Search,
    Sun,
    Moon,
    LogOut,
    Menu,
    PanelLeftClose,
    ExternalLink,
    ShieldCheck,
    Command,
    ChevronRight,
} from "lucide-react";
import { auth, login, request, settings } from "./lib/api";
import { rowsOf, errorMessage } from "./lib/utils";
import { modules } from "./modules/registry";
import { Button } from "./components/ui/button";
import { Dialog } from "./components/ui/dialog";
import { Loading, ErrorState, Notice } from "./components/Feedback";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Resource = lazy(() => import("./pages/Resource"));
const Settings = lazy(() => import("./pages/Settings"));
const Extensions = lazy(() => import("./pages/Extensions"));
const Reports = lazy(() => import("./pages/Reports"));
const Mail = lazy(() => import("./pages/Mail"));
const System = lazy(() => import("./pages/System"));
const PluginPage = lazy(() => import("./pages/PluginPage"));
const extra = [
    { id: "dashboard", title: "仪表盘", group: "概览" },
    { id: "reports", title: "数据报表", group: "概览" },
    { id: "mail", title: "邮件模板", group: "用户与服务" },
    { id: "settings", title: "系统配置", group: "系统设置" },
    { id: "plugins", title: "插件管理", group: "系统设置" },
    { id: "themes", title: "主题管理", group: "系统设置" },
    { id: "payments", title: "支付配置", group: "系统设置" },
    { id: "system", title: "运行状态", group: "系统设置" },
];
const groupIcons: Record<string, any> = {
    概览: LayoutDashboard,
    用户与服务: Users,
    订阅与订单: FileText,
    节点与网络: Server,
    系统设置: Settings2,
};
const groups = ["概览", "用户与服务", "订阅与订单", "节点与网络", "系统设置"];
class ErrorBoundary extends Component<
    { children: ReactNode },
    { failed: boolean }
> {
    state = { failed: false };
    static getDerivedStateFromError() {
        return { failed: true };
    }
    render() {
        return this.state.failed ? (
            <ErrorState
                message="页面暂时无法显示，请刷新后重试"
                retry={() => window.location.reload()}
            />
        ) : (
            this.props.children
        );
    }
}
function SignIn({ onLogin }: { onLogin: () => void }) {
    const [email, setEmail] = useState(""),
        [password, setPassword] = useState(""),
        [error, setError] = useState(""),
        [busy, setBusy] = useState(false);
    return (
        <div className="login-page">
            <section className="login-brand">
                <div className="brand">
                    <div className="brand-mark">
                        <Activity size={25} />
                    </div>
                    <strong>{settings.title}</strong>
                </div>
                <div>
                    <span className="eyebrow">管理控制台</span>
                    <h1>
                        让每一项运营
                        <br />
                        清晰有序。
                    </h1>
                    <p>
                        用户、订阅与网络，
                        <br />
                        在一个工作空间中高效管理。
                    </p>
                    <div className="login-decoration">
                        <div />
                        <div />
                        <div />
                        <div />
                    </div>
                </div>
                <small>Xboard · Administration</small>
            </section>
            <section className="login-form">
                <div className="login-box">
                    <div className="login-symbol">
                        <ShieldCheck size={28} />
                    </div>
                    <h1>欢迎回来</h1>
                    <p>使用管理员账号登录控制台</p>
                    <Notice message={error} error />
                    <form
                        onSubmit={async (e) => {
                            e.preventDefault();
                            setBusy(true);
                            setError("");
                            try {
                                await login(email, password);
                                setPassword("");
                                onLogin();
                            } catch (e) {
                                setError(errorMessage(e));
                            } finally {
                                setBusy(false);
                            }
                        }}
                    >
                        <label htmlFor="login-email">邮箱地址</label>
                        <input
                            id="login-email"
                            name="email"
                            type="email"
                            autoComplete="username"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="请输入管理员邮箱"
                        />
                        <label htmlFor="login-password">密码</label>
                        <input
                            id="login-password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="请输入密码"
                        />
                        <Button type="submit" disabled={busy}>
                            {busy ? "正在登录…" : "登录控制台"}
                        </Button>
                    </form>
                    <a href={`${window.location.pathname}?admin_ui=legacy`}>
                        返回原管理端
                    </a>
                </div>
            </section>
        </div>
    );
}
function Shell({ onLogout }: { onLogout: () => void }) {
    const [collapsed, setCollapsed] = useState(false),
        [mobile, setMobile] = useState(false),
        [command, setCommand] = useState(false),
        [term, setTerm] = useState(""),
        [dark, setDark] = useState(
            localStorage.getItem("xboard.next.theme") === "dark",
        );
    const location = useLocation();
    const plugin = useQuery({
        queryKey: ["plugin-navigation"],
        queryFn: () => request("plugin/getPlugins"),
        staleTime: 30000,
    });
    const info = useQuery({
        queryKey: ["me"],
        queryFn: () => request("@user/info"),
        staleTime: 60000,
    });
    useEffect(() => {
        document.documentElement.classList.toggle("dark", dark);
        localStorage.setItem("xboard.next.theme", dark ? "dark" : "light");
    }, [dark]);
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "k") {
                e.preventDefault();
                setCommand((v) => !v);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);
    useEffect(() => setMobile(false), [location.pathname]);
    const links = [
        ...extra,
        ...modules.map(({ id, title, group }) => ({ id, title, group })),
    ];
    const current =
        links.find((l) => location.pathname === `/${l.id}`) || extra[0];
    const pluginLinks = rowsOf(plugin.data)
        .filter((p) => p.is_installed && p.is_enabled)
        .flatMap((p) =>
            (p.admin_menus || []).map((m: any) => ({
                id: `plugins/${p.code}/${m.path.replace(/^\/+|\/+$/g, "")}`,
                title: m.title,
                group: p.name,
            })),
        );
    return (
        <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
            <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
                <Link to="/" className="brand">
                    <div className="brand-mark">
                        <Activity size={23} />
                    </div>
                    <div>
                        <strong>{settings.title}</strong>
                        <small>管理控制台</small>
                    </div>
                </Link>
                <nav>
                    {groups.map((group) => (
                        <div className="nav-group" key={group}>
                            <div className="nav-heading">{group}</div>
                            {links
                                .filter((l) => l.group === group)
                                .map((l) => {
                                    const Icon = groupIcons[group];
                                    return (
                                        <NavLink
                                            key={l.id}
                                            to={
                                                l.id === "dashboard"
                                                    ? "/"
                                                    : `/${l.id}`
                                            }
                                            end
                                            title={l.title}
                                        >
                                            <Icon size={17} />
                                            <span>{l.title}</span>
                                        </NavLink>
                                    );
                                })}
                        </div>
                    ))}
                    {pluginLinks.length > 0 && (
                        <div className="nav-group">
                            <div className="nav-heading">插件扩展</div>
                            {pluginLinks.map((l: any) => (
                                <NavLink key={l.id} to={`/${l.id}`}>
                                    <Settings2 size={17} />
                                    <span>{l.title}</span>
                                </NavLink>
                            ))}
                        </div>
                    )}
                </nav>
                <div className="sidebar-footer">
                    <span className="badge">新版预览</span>
                    <a
                        href={`${window.location.pathname}?admin_ui=legacy`}
                        title="原管理端"
                    >
                        <ExternalLink size={15} />
                        <span>原管理端</span>
                    </a>
                    <small>{settings.version}</small>
                </div>
            </aside>
            {mobile && (
                <button
                    className="mobile-backdrop"
                    aria-label="关闭导航"
                    onClick={() => setMobile(false)}
                />
            )}
            <div className="workspace">
                <header className="topbar">
                    <div className="topbar-left">
                        <Button
                            className="desktop-toggle"
                            variant="ghost"
                            size="icon"
                            aria-label="收起导航"
                            onClick={() => setCollapsed(!collapsed)}
                        >
                            <PanelLeftClose size={18} />
                        </Button>
                        <Button
                            className="mobile-toggle"
                            variant="ghost"
                            size="icon"
                            aria-label="打开导航"
                            onClick={() => setMobile(!mobile)}
                        >
                            <Menu size={20} />
                        </Button>
                        <span className="breadcrumb">
                            工作空间 <ChevronRight size={14} />
                            <strong>{current.title}</strong>
                        </span>
                    </div>
                    <div className="topbar-right">
                        <button
                            className="command-trigger"
                            onClick={() => {
                                setCommand(true);
                                setTerm("");
                            }}
                        >
                            <Search size={16} />
                            <span>搜索功能…</span>
                            <kbd>⌘ K</kbd>
                        </button>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={dark ? "切换浅色模式" : "切换深色模式"}
                            onClick={() => setDark(!dark)}
                        >
                            {dark ? <Sun size={18} /> : <Moon size={18} />}
                        </Button>
                        <div className="account">
                            <div className="avatar">管</div>
                            <span>{info.data?.data?.email || "管理员"}</span>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label="退出登录"
                            onClick={onLogout}
                        >
                            <LogOut size={17} />
                        </Button>
                    </div>
                </header>
                <main>
                    <ErrorBoundary>
                        <Suspense fallback={<Loading />}>
                            <Routes>
                                <Route path="/" element={<Dashboard />} />
                                <Route
                                    path="/dashboard"
                                    element={<Dashboard />}
                                />
                                {modules.map((m) => (
                                    <Route
                                        key={m.id}
                                        path={`/${m.id}`}
                                        element={
                                            <Resource key={m.id} module={m} />
                                        }
                                    />
                                ))}
                                <Route
                                    path="/settings"
                                    element={<Settings />}
                                />
                                <Route path="/reports" element={<Reports />} />
                                <Route path="/mail" element={<Mail />} />
                                <Route path="/system" element={<System />} />
                                <Route
                                    path="/plugins"
                                    element={
                                        <Extensions
                                            key="plugins"
                                            kind="plugins"
                                        />
                                    }
                                />
                                <Route
                                    path="/themes"
                                    element={
                                        <Extensions
                                            key="themes"
                                            kind="themes"
                                        />
                                    }
                                />
                                <Route
                                    path="/payments"
                                    element={
                                        <Extensions
                                            key="payments"
                                            kind="payments"
                                        />
                                    }
                                />
                                <Route
                                    path="/plugins/:code/*"
                                    element={<PluginPage />}
                                />
                                <Route
                                    path="*"
                                    element={
                                        <section className="panel state">
                                            <h1>页面不存在</h1>
                                            <Link to="/">返回仪表盘</Link>
                                        </section>
                                    }
                                />
                            </Routes>
                        </Suspense>
                    </ErrorBoundary>
                </main>
            </div>
            <Dialog
                open={command}
                onClose={() => setCommand(false)}
                title="搜索功能"
            >
                <div className="command-body">
                    <input
                        autoFocus
                        value={term}
                        placeholder="输入功能名称…"
                        onChange={(e) => setTerm(e.target.value)}
                    />
                    <div>
                        {[...links, ...pluginLinks]
                            .filter((l) => l.title.includes(term))
                            .map((l) => (
                                <Link
                                    key={l.id}
                                    to={`/${l.id}`}
                                    onClick={() => setCommand(false)}
                                >
                                    <span>{l.title}</span>
                                    <small>{l.group}</small>
                                </Link>
                            ))}
                    </div>
                </div>
            </Dialog>
        </div>
    );
}
export default function App() {
    const [signedIn, setSignedIn] = useState(!!auth.get());
    const qc = useQueryClient();
    function logout() {
        auth.clear();
        qc.clear();
        setSignedIn(false);
    }
    useEffect(() => {
        window.addEventListener("xboard:unauthorized", logout);
        return () => window.removeEventListener("xboard:unauthorized", logout);
    }, []);
    return (
        <HashRouter>
            {signedIn ? (
                <Shell onLogout={logout} />
            ) : (
                <SignIn onLogin={() => setSignedIn(true)} />
            )}
        </HashRouter>
    );
}
