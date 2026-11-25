import ForgotPassword from "./legacy/ForgotPassword";
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
    Navigate,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Search,
    Sun,
    Moon,
    LogOut,
    Menu,
    ChevronsLeft,
    ChevronsRight,
    ChevronDown,
    Settings2,
    Languages,
    SlidersHorizontal,
} from "lucide-react";
import { auth, login, request, settings } from "./lib/api";
import { rowsOf, errorMessage } from "./lib/utils";
import { modules } from "./legacy/modules";
import { navigation, paths, pageLinks } from "./legacy/navigation";
import { Button } from "./components/ui/button";
import { Dialog } from "./components/ui/dialog";
import { Loading, ErrorState, Notice } from "./components/Feedback";
const PluginDemo = lazy(() => import("./pages/PluginDemo"));
const Dashboard = lazy(() => import("./pages/Dashboard")),
    Resource = lazy(() => import("./pages/Resource")),
    Settings = lazy(() => import("./pages/Settings")),
    Extensions = lazy(() => import("./pages/Extensions")),
    Reports = lazy(() => import("./pages/Reports")),
    Mail = lazy(() => import("./pages/Mail")),
    System = lazy(() => import("./pages/System")),
    PluginPage = lazy(() => import("./pages/PluginPage")),
    GiftCards = lazy(() => import("./pages/GiftCards"));
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
    const [forgot, setForgot] = useState(false);
    const [email, setEmail] = useState(""),
        [password, setPassword] = useState(""),
        [error, setError] = useState(""),
        [busy, setBusy] = useState(false);
    return (
        <div className="legacy-login">
            <span className="login-language">
                <span className="flag-cn">★</span> CN
            </span>
            <section>
                <div className="login-site">
                    <span className="legacy-logo">╱╱</span>
                    {settings.title}
                </div>
                <h1>登录</h1>
                <p>请输入您的邮箱和密码登录系统</p>
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
                        type="email"
                        required
                        autoComplete="username"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <div className="password-label">
                        <label htmlFor="login-password">密码</label>
                        <button type="button" onClick={() => setForgot(true)}>
                            忘记密码？
                        </button>
                    </div>
                    <input
                        id="login-password"
                        type="password"
                        required
                        autoComplete="current-password"
                        placeholder="请输入密码"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <Button type="submit" disabled={busy}>
                        {busy ? "登录中..." : "登录"}
                    </Button>
                </form>
            </section>
            {forgot && <ForgotPassword onClose={() => setForgot(false)} />}
        </div>
    );
}
function Alias({ to }: { to: string }) {
    const location = useLocation();
    return <Navigate to={to + location.search} replace />;
}
function Shell({ onLogout }: { onLogout: () => void }) {
    const [collapsed, setCollapsed] = useState(false),
        [mobile, setMobile] = useState(false),
        [command, setCommand] = useState(false),
        [term, setTerm] = useState(""),
        [theme, setTheme] = useState(
            localStorage.getItem("xboard.next.theme") || "light",
        ),
        [profile, setProfile] = useState(false),
        [themeMenu, setThemeMenu] = useState(false);
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
        const media = matchMedia("(prefers-color-scheme: dark)");
        const update = () =>
            document.documentElement.classList.toggle(
                "dark",
                theme === "dark" || (theme === "system" && media.matches),
            );
        update();
        media.addEventListener("change", update);
        localStorage.setItem("xboard.next.theme", theme);
        return () => media.removeEventListener("change", update);
    }, [theme]);
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
    useEffect(() => {
        setMobile(false);
        setProfile(false);
        setThemeMenu(false);
    }, [location.pathname]);
    const pluginLinks = rowsOf(plugin.data)
        .filter((p) => p.is_installed && p.is_enabled)
        .flatMap((p) =>
            (p.admin_menus || []).map((m: any) => ({
                id: `plugins/${p.code}/${m.path.replace(/^\/+|\/+$/g, "")}`,
                title: m.title,
                path: `/plugins/${p.code}/${m.path.replace(/^\/+|\/+$/g, "")}`,
            })),
        );
    return (
        <div
            className={`app-shell legacy-shell ${collapsed ? "sidebar-collapsed" : ""}`}
        >
            <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
                <Link
                    to="/"
                    className="brand"
                    title={settings.title}
                    aria-label={settings.title}
                >
                    <span className="legacy-logo">╱╱</span>
                    <strong>{settings.title}</strong>
                </Link>
                <nav>
                    {navigation.map((group) => {
                        const Icon = group.icon;
                        if (!("children" in group))
                            return (
                                <NavLink
                                    key={group.title}
                                    className="nav-single"
                                    to="/"
                                    end
                                >
                                    <Icon size={16} />
                                    <span>{group.title}</span>
                                </NavLink>
                            );
                        return (
                            <details
                                className="nav-section"
                                open
                                key={group.title}
                            >
                                <summary>
                                    <Icon size={16} />
                                    <span>{group.title}</span>
                                    <ChevronDown size={15} />
                                </summary>
                                <div>
                                    {group.children.map(
                                        ([id, title, ItemIcon]) => (
                                            <NavLink
                                                key={id}
                                                to={paths[id]}
                                                title={title}
                                            >
                                                <ItemIcon size={16} />
                                                <span>{title}</span>
                                            </NavLink>
                                        ),
                                    )}
                                </div>
                            </details>
                        );
                    })}
                    {pluginLinks.length > 0 && (
                        <details className="nav-section" open>
                            <summary>
                                <Settings2 size={16} />
                                <span>插件应用</span>
                                <ChevronDown size={15} />
                            </summary>
                            <div>
                                {pluginLinks.map((l: any) => (
                                    <NavLink key={l.id} to={l.path}>
                                        <Settings2 size={16} />
                                        <span>{l.title}</span>
                                    </NavLink>
                                ))}
                            </div>
                        </details>
                    )}
                </nav>
                <Button
                    className="sidebar-collapse"
                    variant="outline"
                    size="icon"
                    aria-label="切换侧边栏"
                    onClick={() => setCollapsed(!collapsed)}
                >
                    {collapsed ? (
                        <ChevronsRight size={15} />
                    ) : (
                        <ChevronsLeft size={15} />
                    )}
                </Button>
                <div className="sidebar-footer">
                    <span className="version-dot" />
                    <small>v{settings.version}</small>
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
                <header
                    className={`topbar ${location.pathname === "/" ? "dashboard-topbar" : ""}`}
                >
                    <Button
                        className="mobile-toggle"
                        variant="ghost"
                        size="icon"
                        aria-label="切换导航"
                        onClick={() => setMobile(!mobile)}
                    >
                        <Menu size={20} />
                    </Button>
                    {location.pathname === "/" && (
                        <h1 className="dashboard-title">仪表盘</h1>
                    )}
                    <button
                        className="command-trigger"
                        onClick={() => {
                            setCommand(true);
                            setTerm("");
                        }}
                    >
                        <Search size={17} />
                        <span>搜索菜单和功能...</span>
                        <kbd>⌘K</kbd>
                    </button>
                    <div className="topbar-right">
                        <div className="header-menu">
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="切换主题"
                                onClick={() => setThemeMenu(!themeMenu)}
                            >
                                {theme === "dark" ? (
                                    <Sun size={20} />
                                ) : (
                                    <Moon size={20} />
                                )}
                            </Button>
                            {themeMenu && (
                                <div className="header-menu-panel">
                                    {[
                                        ["light", "浅色"],
                                        ["dark", "深色"],
                                        ["system", "跟随系统"],
                                    ].map(([key, label]) => (
                                        <button
                                            key={key}
                                            onClick={() => {
                                                setTheme(key);
                                                setThemeMenu(false);
                                            }}
                                        >
                                            {label}
                                            {theme === key ? " ✓" : ""}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <span className="language-control" title="简体中文">
                            <span className="flag-cn">★</span> CN
                        </span>
                        <div className="header-menu">
                            <Button
                                className="avatar"
                                variant="ghost"
                                aria-label="用户菜单"
                                onClick={() => setProfile(!profile)}
                            >
                                <span>用户</span>
                            </Button>
                            {profile && (
                                <div className="header-menu-panel account-menu">
                                    <strong>
                                        {info.data?.data?.email || "管理员"}
                                    </strong>
                                    <Link to={paths.settings}>设置</Link>
                                    <button onClick={onLogout}>
                                        <LogOut size={15} />
                                        退出登录
                                    </button>
                                    <a
                                        href={`${window.location.pathname}?admin_ui=legacy`}
                                    >
                                        原版管理端
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </header>
                <main>
                    <ErrorBoundary key={location.pathname}>
                        <Suspense fallback={<Loading />}>
                            <Routes>
                                <Route path="/" element={<Dashboard />} />
                                <Route
                                    path="/dashboard"
                                    element={<Navigate to="/" replace />}
                                />
                                {modules
                                    .filter(
                                        (m) =>
                                            !m.id.startsWith("gift-") &&
                                            m.id !== "commissions",
                                    )
                                    .map((m) => (
                                        <Route
                                            key={m.id}
                                            path={paths[m.id] || `/${m.id}`}
                                            element={
                                                <Resource
                                                    key={m.id}
                                                    module={m}
                                                />
                                            }
                                        />
                                    ))}
                                <Route
                                    path="/finance/gift-card"
                                    element={<GiftCards />}
                                />
                                <Route
                                    path="/config/system/*"
                                    element={<Settings />}
                                />
                                <Route path="/reports" element={<Reports />} />
                                <Route path="/system" element={<System />} />
                                {(
                                    ["plugins", "themes", "payments"] as const
                                ).map((kind) => (
                                    <Route
                                        key={kind}
                                        path={paths[kind]}
                                        element={
                                            <Extensions
                                                key={kind}
                                                kind={kind}
                                            />
                                        }
                                    />
                                ))}
                                <Route
                                    path="/config/plugin/menu-demo"
                                    element={<PluginDemo />}
                                />
                                <Route
                                    path="/config/plugin/crud-demo"
                                    element={<PluginDemo />}
                                />
                                <Route
                                    path="/plugins/:code/*"
                                    element={<PluginPage />}
                                />
                                {Object.entries(paths)
                                    .filter(
                                        ([id, path]) =>
                                            path !== `/${id}` &&
                                            id !== "dashboard",
                                    )
                                    .map(([id, path]) => (
                                        <Route
                                            key={id}
                                            path={`/${id}`}
                                            element={<Alias to={path} />}
                                        />
                                    ))}
                                <Route
                                    path="/commissions"
                                    element={
                                        <Navigate
                                            to="/finance/order?tab=commission"
                                            replace
                                        />
                                    }
                                />
                                {[
                                    "gift-templates",
                                    "gift-codes",
                                    "gift-usages",
                                ].map((id, i) => (
                                    <Route
                                        key={id}
                                        path={`/${id}`}
                                        element={
                                            <Navigate
                                                to={`/finance/gift-card?tab=${["templates", "codes", "usages"][i]}`}
                                                replace
                                            />
                                        }
                                    />
                                ))}
                                <Route
                                    path="/sign-in"
                                    element={<Navigate to="/" replace />}
                                />
                                <Route
                                    path="*"
                                    element={
                                        <section className="state">
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
                title="搜索菜单和功能"
            >
                <div className="command-body">
                    <input
                        autoFocus
                        value={term}
                        placeholder="搜索菜单和功能..."
                        onChange={(e) => setTerm(e.target.value)}
                    />
                    <div>
                        {[...pageLinks, ...pluginLinks]
                            .filter((l) => l.title.includes(term))
                            .map((l) => (
                                <Link
                                    key={l.id}
                                    to={l.path}
                                    onClick={() => setCommand(false)}
                                >
                                    {l.title}
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
