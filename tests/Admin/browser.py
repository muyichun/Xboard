"""Browser acceptance against the disposable admin-test fixture only.
Run: ADMIN_TEST_ORIGIN=http://<isolated-container-ip>:7001 python3 tests/Admin/browser.py
Requires playwright and Chromium. Never point this script at a real panel.
"""

import asyncio, json, os, pathlib, time, re, ipaddress
from urllib.parse import urlparse
from playwright.async_api import async_playwright, expect

ORIGIN = os.environ.get("ADMIN_TEST_ORIGIN", "http://172.19.0.2:7001").rstrip("/")
assert ipaddress.ip_address(
    urlparse(ORIGIN).hostname
).is_private, "Only disposable local test hosts allowed"
BASE = ORIGIN + "/admin-test?admin_ui=next"
OUT = pathlib.Path(os.environ.get("ADMIN_TEST_OUTPUT", "/tmp/xboard-admin-qa"))
OUT.mkdir(parents=True, exist_ok=True)
PASSWORD = "Isolated-test-only-2026!"
expect.set_options(timeout=30000)


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"),
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = await browser.new_context(
            viewport={"width": 1440, "height": 1000},
            locale="zh-CN",
            reduced_motion="reduce",
        )
        page = await context.new_page()
        page.set_default_timeout(15000)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        async def route(name):
            await page.goto(
                BASE + ("#/" + name if name else ""),
                wait_until="networkidle",
                timeout=60000,
            )

        async def signin(name):
            await page.locator("#login-email").fill(name + "@admin-test.invalid")
            await page.locator("#login-password").fill(PASSWORD)
            await page.get_by_role("button", name="登录控制台", exact=True).click()

        async def api(path, payload=None, method="get", status=200):
            token = await page.evaluate(
                "sessionStorage.getItem('xboard.next.auth:admin-test')"
            )
            response = await context.request.fetch(
                ORIGIN + "/api/v2/admin-test/" + path,
                method=method,
                headers={"Authorization": token, "Accept": "application/json"},
                **({"data": payload} if payload is not None else {})
            )
            assert response.status == status, (
                path,
                response.status,
                (await response.text())[:200],
            )
            return await response.json()

        async def fill(label, value):
            await page.get_by_label(re.compile("^" + re.escape(label))).fill(str(value))

        async def save(result=False):
            async with page.expect_response(
                lambda r: "/api/v2/admin-test/" in r.url and r.request.method == "POST"
            ) as res:
                await page.get_by_role("dialog").get_by_role(
                    "button", name="保存", exact=True
                ).click()
            r = await res.value
            assert r.ok, (r.url, r.status, (await r.text())[:250])
            if not result:
                await expect(page.get_by_role("dialog")).to_have_count(0)

        try:
            await route("")
            assert "Xboard 隔离验收" in await page.title(), "Test fixture required"
            await page.screenshot(path=str(OUT / "login.png"))
            await signin("member")
            await expect(page.get_by_role("alert")).to_contain_text("没有管理员权限")
            assert await page.evaluate("sessionStorage.length") == 0
            await signin("admin")
            await expect(
                page.get_by_role("heading", name="仪表盘", exact=True)
            ).to_be_visible()
            await page.wait_for_load_state("networkidle")
            await page.screenshot(path=str(OUT / "dashboard.png"), full_page=True)
            print("PASS admin login and non-admin denial", flush=True)
            pages = {
                "users": "用户管理",
                "plans": "套餐管理",
                "orders": "订单管理",
                "commissions": "佣金管理",
                "coupons": "优惠券",
                "nodes": "节点管理",
                "machines": "服务器管理",
                "groups": "权限组",
                "routes": "路由规则",
                "notices": "公告管理",
                "knowledge": "知识库",
                "tickets": "工单管理",
                "gift-templates": "礼品卡模板",
                "gift-codes": "礼品兑换码",
                "gift-usages": "礼品卡使用记录",
                "traffic": "流量重置记录",
                "audit": "操作审计",
                "settings": "系统配置",
                "plugins": "插件管理",
                "themes": "主题管理",
                "payments": "支付配置",
                "mail": "邮件模板",
                "reports": "数据报表",
                "system": "运行状态",
            }
            for name, title in pages.items():
                await route(name)
                await expect(
                    page.get_by_role("heading", name=title, exact=True)
                ).to_be_visible()
                assert not await page.get_by_role("alert").count(), (
                    name,
                    await page.get_by_role("alert").all_text_contents(),
                )
            print("PASS 24 pages without request/render errors", flush=True)
            await route("plans")
            await page.get_by_role("button", name="新增", exact=True).click()
            await page.get_by_role("dialog").get_by_role(
                "button", name="保存", exact=True
            ).click()
            await expect(page.get_by_role("alert").first).to_be_visible()
            await fill("套餐名称", "浏览器验收套餐")
            await fill("套餐流量（GiB）", 55)
            await page.get_by_label("权限组", exact=True).select_option("1")
            await page.get_by_text("销售价格", exact=True).click()
            await fill("月付（元）", 9.99)
            await page.get_by_label("标签", exact=True).fill("first, second")
            await save()
            plans = (await api("plan/fetch"))["data"]
            plan = next(x for x in plans if x["name"] == "浏览器验收套餐")
            assert float(plan["prices"]["monthly"]) == 9.99 and plan["tags"] == [
                "first",
                "second",
            ]
            print("PASS plan validation/create, prices and tags", flush=True)
            await route("users")
            await page.get_by_role(
                "button", name="编辑 member@admin-test.invalid", exact=True
            ).click()
            await fill("余额（元）", 88.88)
            await fill("备注", "浏览器验收")
            await save()
            users = (await api("user/fetch", {}, "post"))["data"]
            member = next(x for x in users if x["email"] == "member@admin-test.invalid")
            assert (
                member["balance"] == 88.88
                and member["invite_user_id"] == 2
                and member["transfer_enable"] == 100 * 1024**3
            )
            await page.get_by_role("button", name="创建用户", exact=True).click()
            await fill("邮箱域名", "admin-test.invalid")
            await fill("邮箱前缀", "single")
            await fill("初始密码", PASSWORD)
            await save(result=True)
            await page.get_by_role("dialog").get_by_role(
                "button", name="关闭", exact=True
            ).click()
            users = (await api("user/fetch", {}, "post"))["data"]
            assert any(x["email"] == "single@admin-test.invalid" for x in users)
            print("PASS user edit units/inviter and single create", flush=True)
            await route("tickets")
            await page.get_by_role("button", name="查看 1", exact=True).click()
            await fill("回复内容", "隔离测试已处理")
            await page.get_by_role("button", name="发送回复", exact=True).click()
            await expect(page.get_by_text("隔离测试已处理", exact=True)).to_be_visible()
            await page.get_by_role("button", name="关闭", exact=True).click()
            print("PASS ticket conversation and reply", flush=True)
            await route("nodes")
            await page.get_by_role("button", name="新增", exact=True).click()
            await fill("节点名称", "验收 VLESS")
            await fill("连接地址", "test.invalid")
            await fill("连接端口", "443")
            await fill("监听端口", "443")
            await save()
            nodes = (await api("server/manage/getNodes"))["data"]
            assert any(x["name"] == "验收 VLESS" for x in nodes)
            print("PASS node create and protocol payload", flush=True)
            await route("gift-templates")
            await page.get_by_role("button", name="创建模板", exact=True).click()
            await fill("模板名称", "余额卡验收")
            await page.get_by_text("奖励内容", exact=True).click()
            await fill("余额奖励（元）", 1)
            await save()
            gifts = (await api("gift-card/templates"))["data"]
            gifts = gifts.get("data", []) if isinstance(gifts, dict) else gifts
            gift = next(x for x in gifts if x["name"] == "余额卡验收")
            assert (
                gift["rewards"]["balance"] == 100
                and "reset_package" not in gift["rewards"]
            )
            print("PASS gift-card monetary reward", flush=True)
            await route("settings")
            await fill("站点描述", "自动化隔离验收")
            await page.get_by_role("button", name="保存设置", exact=True).click()
            await expect(page.get_by_role("status")).to_contain_text("设置已保存")
            print("PASS settings save", flush=True)
            await route("users")
            await page.get_by_role("button", name="切换深色模式").click()
            await expect(page.locator("html")).to_have_class("dark")
            await page.screenshot(path=str(OUT / "users-dark.png"), full_page=True)
            await page.set_viewport_size({"width": 390, "height": 844})
            await page.get_by_role("button", name="打开导航").click()
            await expect(page.locator(".sidebar")).to_have_class("sidebar mobile-open")
            await page.get_by_role("button", name="关闭导航").click(
                position={"x": 380, "y": 400}
            )
            assert await page.evaluate(
                "document.documentElement.scrollWidth<=window.innerWidth"
            ), "Mobile page overflow"
            await page.screenshot(path=str(OUT / "mobile.png"), full_page=True)
            print("PASS dark mode and mobile layout", flush=True)
            await page.evaluate(
                "sessionStorage.setItem('xboard.next.auth:admin-test','Bearer invalid')"
            )
            await page.reload(wait_until="networkidle")
            await expect(
                page.get_by_role("button", name="登录控制台", exact=True)
            ).to_be_visible()
            assert not await page.evaluate(
                "sessionStorage.getItem('xboard.next.auth:admin-test')"
            )
            assert not errors, errors
            print("PASS expired session and no JS errors", flush=True)
        except Exception:
            await page.screenshot(path=str(OUT / "failure.png"), full_page=True)
            print(
                "FAIL alerts:",
                await page.get_by_role("alert").all_text_contents(),
                "JS:",
                errors,
                flush=True,
            )
            raise
        finally:
            await browser.close()


asyncio.run(main())
