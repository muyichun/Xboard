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


async def check_payment_pagination(page, route, api):
    for i in range(11):
        await api(
            "payment/save",
            {
                "name": f"分页渠道-{i:02}",
                "payment": "EPay",
                "config": {"type": "alipay"},
            },
            "post",
        )
    await route("config/payment")
    await page.reload()
    table = page.locator("tbody tr")
    await expect(table).to_have_count(10)
    await page.get_by_role("button", name="ID", exact=True).click()
    await expect(table.first).to_contain_text("分页渠道-00")
    await page.get_by_role("button", name="下一页", exact=True).click()
    await expect(table).to_have_count(1)
    await expect(table.first).to_contain_text("分页渠道-10")
    for channel in (await api("payment/fetch"))["data"]:
        if channel["name"].startswith("分页渠道-"):
            await api("payment/drop", {"id": channel["id"]}, "post")
    print("PASS payment table pagination and ID ordering", flush=True)


async def check_node_batch(page, route, api):
    # Eleven fixtures put the two selected nodes on different pages.
    for i in range(11):
        await api(
            "server/manage/save",
            {
                "name": f"批量验收-{i:02}",
                "type": "http",
                "host": "nodes.invalid",
                "port": "443",
                "server_port": "443",
                "rate": 1,
                "group_ids": ["1"],
                "protocol_settings": {"tls": 0},
                "show": 1,
                "enabled": True,
            },
            "post",
        )
    await route("server/manage")
    await page.get_by_label("刷新列表").click()
    await expect(page.get_by_role("columnheader", name="负载状态")).to_have_count(0)
    await page.get_by_label("搜索记录").fill("批量验收-")
    await expect(page.locator(".pagination")).to_contain_text("共 11 项")
    await page.get_by_label("每页显示").select_option("10")
    first = page.locator("tbody tr").first
    first_name = await first.locator(".text-link").first.inner_text()
    switch = first.get_by_role("switch")
    on_color = await switch.evaluate("e => getComputedStyle(e).color")
    await first.get_by_role("checkbox").check()
    await page.get_by_label("下一页", exact=True).click()
    await page.get_by_label("选择本页全部").check()
    last_name = await first.locator(".text-link").first.inner_text()
    menu = page.locator(".facet-filter").filter(
        has=page.locator("summary", has_text="批量操作")
    )
    await expect(menu.locator("summary")).to_contain_text("（2）")
    await menu.locator("summary").click()
    await menu.get_by_role("button", name="隐藏节点", exact=True).click()
    dialog = page.get_by_role("dialog", name="隐藏节点")
    await expect(dialog).to_contain_text("2 条记录")
    await dialog.get_by_role("button", name="保存", exact=True).click()
    await expect(dialog).to_have_count(0)
    await expect(switch).to_have_attribute("aria-checked", "false")
    assert await switch.evaluate("e => getComputedStyle(e).color") != on_color
    nodes = (await api("server/manage/getNodes"))["data"]
    assert {
        n["name"] for n in nodes if n["name"].startswith("批量验收-") and not n["show"]
    } == {first_name, last_name}
    await page.get_by_role("button", name="编辑排序", exact=True).click()
    row = page.locator("tbody tr").filter(
        has=page.get_by_role("button", name=last_name, exact=True)
    )
    await row.get_by_role("checkbox").check()
    await menu.locator("summary").click()
    await menu.get_by_role("button", name="显示节点", exact=True).click()
    await page.get_by_role("dialog").get_by_role(
        "button", name="保存", exact=True
    ).click()
    await expect(row.get_by_role("switch")).to_have_attribute("aria-checked", "true")

    async def run_action(label, configure=None, submit="保存"):
        await row.get_by_role("checkbox").check()
        await menu.locator("summary").click()
        await menu.get_by_role("button", name=label, exact=True).click()
        dialog = page.get_by_role("dialog", name=label, exact=True)
        if configure:
            await configure(dialog)
        await dialog.get_by_role("button", name=submit, exact=True).click()
        await expect(dialog).to_have_count(0)

    await run_action("禁用节点")
    await expect(row).to_contain_text("节点停用")
    await run_action("启用节点")
    await expect(row).not_to_contain_text("节点停用")

    async def configure(dialog):
        await dialog.get_by_label(re.compile("^订阅展示")).select_option("0")
        await dialog.get_by_label(re.compile("^运行状态")).select_option("0")

    await run_action("批量配置", configure)
    await expect(row.get_by_role("switch")).to_have_attribute("aria-checked", "false")
    await expect(row).to_contain_text("节点停用")
    await run_action("重置流量")
    await run_action("删除选中节点", submit="确认操作")
    await expect(row).to_have_count(0)
    fixtures = [
        n
        for n in (await api("server/manage/getNodes"))["data"]
        if n["name"].startswith("批量验收-")
    ]
    assert len(fixtures) == 10 and all(
        n["enabled"] and n["name"] != last_name for n in fixtures
    )
    print(
        "PASS cross-page selection, all seven node batch actions, sorting view and visibility colors",
        flush=True,
    )


async def check_notice(page, route, api, save):
    await route("config/notice")
    await page.get_by_role("button", name="添加公告").click()
    dialog = page.get_by_role("dialog")
    await dialog.get_by_label("标题", exact=False).fill("弹窗回归验收")
    await dialog.get_by_label("内容（Markdown）", exact=False).fill("弹窗正文")
    await dialog.get_by_role("switch", name="弹窗展示").click()
    await expect(dialog.get_by_role("button", name="移除 弹窗")).to_be_visible()
    await dialog.get_by_label("标签", exact=True).fill("维护")
    await dialog.get_by_label("标签", exact=True).press("Enter")
    await save()
    row = page.locator("tbody tr").filter(has_text="弹窗回归验收")
    popup = row.get_by_role("switch", name="弹窗 弹窗回归验收")
    show = row.get_by_role("switch", name="展示 弹窗回归验收")
    await expect(popup).to_have_attribute("aria-checked", "true")

    async def public_notices():
        return (await api("notice/fetch", prefix="/api/v1/user/"))["data"]

    assert any(
        n["title"] == "弹窗回归验收" and n["tags"] == ["弹窗", "维护"]
        for n in await public_notices()
    )
    await show.click()
    await expect(show).to_have_attribute("aria-checked", "false")
    assert not any(n["title"] == "弹窗回归验收" for n in await public_notices())
    await popup.click()
    await expect(popup).to_have_attribute("aria-checked", "false")
    await row.get_by_role("button", name="编辑 弹窗回归验收").click()
    await dialog.get_by_label("标签", exact=True).fill("弹窗")
    await dialog.get_by_label("标签", exact=True).press("Enter")
    await expect(dialog.get_by_role("switch", name="弹窗展示")).to_have_attribute(
        "aria-checked", "true"
    )
    await dialog.get_by_role("switch", name="展示公告").click()
    await save()
    await page.reload()
    await expect(popup).to_have_attribute("aria-checked", "true")
    saved = next(n for n in await public_notices() if n["title"] == "弹窗回归验收")
    assert saved["tags"] == ["维护", "弹窗"] and saved["content"] == "弹窗正文"
    member = await page.context.browser.new_page()
    try:
        await member.goto(ORIGIN + "/#/login")
        login_form = member.locator('[data-auth-form="login"]')
        await login_form.locator("input[name=email]").fill("member@admin-test.invalid")
        await login_form.locator("input[name=password]").fill(PASSWORD)
        await login_form.locator("button[type=submit]").click()
        modal = member.locator(".n-modal").filter(has_text="弹窗回归验收")
        await expect(modal).to_be_visible()
        await expect(modal).to_contain_text("弹窗正文")
    finally:
        await member.close()
    print(
        "PASS notice create/edit, public feed visibility, legacy popup tag and inline switches",
        flush=True,
    )


async def parity_checks(page, route, api, fill, save):
    # Inline switches have persisted values, not merely changed appearance.
    await route("finance/plan")
    switch = page.get_by_role("switch", name="显示 测试套餐", exact=True)
    before = await switch.get_attribute("aria-checked")
    await switch.click()
    await expect(switch).to_have_attribute(
        "aria-checked", "false" if before == "true" else "true"
    )
    plans = (await api("plan/fetch"))["data"]
    assert bool(next(x for x in plans if x["name"] == "测试套餐")["show"]) != (
        before == "true"
    )
    await page.get_by_role("button", name="编辑排序", exact=True).click()
    await expect(
        page.get_by_role("button", name="保存排序", exact=True)
    ).to_be_visible()
    await page.get_by_role("button", name="取消排序", exact=True).click()
    await route("user/manage")
    await page.get_by_role("button", name="高级筛选", exact=True).click()
    await page.get_by_role("button", name="添加条件", exact=True).click()
    await page.get_by_label("筛选字段 1").select_option("transfer_enable")
    await page.get_by_label("筛选值 1").fill("100")
    async with page.expect_response(
        lambda r: "user/fetch" in r.url and r.request.method == "POST"
    ) as response:
        await page.get_by_role("button", name="应用筛选", exact=True).click()
    sent = (await response.value).request.post_data_json
    assert sent["filter"] == [
        {"id": "transfer_enable", "value": f"eq:{100*1024**3}"}
    ], sent["filter"]
    await page.get_by_role("button", name="重置 ×", exact=True).click()
    row = page.locator("tbody tr").filter(has_text="member@admin-test.invalid")
    await row.get_by_role(
        "button", name="操作 member@admin-test.invalid", exact=True
    ).click()
    await page.get_by_role("menuitem", name="TA的订单", exact=True).click()
    await expect(page).to_have_url(re.compile(r"user_id=eq:3"))
    await route("finance/coupon")
    await page.get_by_role("button", name="添加优惠券", exact=True).click()
    await fill("优惠券名称", "浏览器金额券")
    await fill("优惠值", "1.25")
    await save()
    coupons = (await api("coupon/fetch", {}, "post"))["data"]
    coupon = next(x for x in coupons if x["name"] == "浏览器金额券")
    assert coupon["value"] == 125
    await route("finance/order")
    review = page.get_by_role("button", name="审核佣金 QA-COMMISSION-REVIEW")
    await review.click()
    dialog = page.get_by_role("dialog", name="审核佣金")
    await dialog.get_by_label("佣金状态", exact=False).select_option("1")
    await save()
    await expect(review).to_have_count(0)
    await expect(
        page.locator("tbody tr").filter(has_text="QA-COMMISSION-REVIEW")
    ).to_contain_text("发放中")
    await api(
        "order/update",
        {
            "trade_no": "QA-COMMISSION-REVIEW",
            "commission_status": 3,
            "review_pending": True,
        },
        "post",
        status=409,
    )
    await route("server/machine")
    machine = page.locator("tbody tr").filter(has_text="隔离负载机器")
    for label in ["服务器详情", "编辑", "删除"]:
        await expect(
            machine.get_by_role("button", name=f"{label} 隔离负载机器", exact=True)
        ).to_be_visible()
    await machine.get_by_role("button", name="编辑 隔离负载机器").click()
    await expect(
        page.get_by_role("dialog").get_by_label("服务器名称", exact=False)
    ).to_have_value("隔离负载机器")
    await page.get_by_role("dialog").get_by_role(
        "button", name="取消", exact=True
    ).click()
    await route("config/plugin")
    for tab in ["功能", "支付方式", "所有插件"]:
        await page.get_by_role("button", name=tab, exact=True).click()
    await page.get_by_role("button", name="查看文档", exact=True).first.click()
    await expect(page.get_by_role("dialog").locator(".markdown-view")).not_to_be_empty()
    await page.get_by_role("dialog").get_by_role(
        "button", name="关闭", exact=True
    ).first.click()
    await route("server/manage")
    machine_filter = page.locator(".facet-filter").filter(
        has=page.locator("summary", has_text="服务器")
    )
    await machine_filter.locator("summary").click()
    await machine_filter.get_by_label("隔离负载机器", exact=True).check()
    await machine_filter.locator("summary").click()
    await page.get_by_role("button", name="添加节点", exact=True).click()
    await expect(page.get_by_role("dialog").locator("#field-machine_id")).to_have_value(
        "1"
    )
    await page.get_by_role("dialog").get_by_role(
        "button", name="关闭", exact=True
    ).click()
    await page.get_by_role("button", name="重置 ×", exact=True).click()
    await page.get_by_role("button", name="添加节点", exact=True).click()
    await fill("节点名称", "验收 AnyTLS")
    await fill("连接地址", "test.invalid")
    await fill("连接端口", "444")
    await page.get_by_role("button", name="同步到服务端口", exact=True).click()
    await page.get_by_label("协议类型", exact=False).select_option("anytls")
    await page.get_by_text("协议配置", exact=True).click()
    await page.get_by_role("button", name="使用默认", exact=True).click()
    await save()
    nodes = (await api("server/manage/getNodes"))["data"]
    node = next(x for x in nodes if x["name"] == "验收 AnyTLS")
    assert not node["show"]
    assert (
        node["protocol_settings"]["padding_scheme"][3]
        == "2=400-500,c,500-1000,c,500-1000,c,500-1000,c,500-1000"
    )
    await route("server/machine")
    await page.get_by_role("button", name="隔离负载机器", exact=True).click()
    desk = page.get_by_role("dialog")
    await expect(desk).to_contain_text("从未上报")
    await expect(desk).to_contain_text("90.0%")
    await page.get_by_role("button", name="关联已有节点", exact=True).click()
    bind = page.get_by_role("dialog", name="关联已有节点", exact=True)
    await bind.locator("tbody tr").filter(has_text="验收 AnyTLS").get_by_role(
        "checkbox"
    ).check()
    await bind.get_by_role("button", name="关联选中的 1 个节点", exact=True).click()
    await expect(bind).not_to_be_visible()
    await expect(page.get_by_role("dialog")).to_have_count(1)
    await expect(page.get_by_role("dialog").locator("tbody")).to_contain_text(
        "验收 AnyTLS"
    )
    bound = (await api("server/machine/nodes?machine_id=1"))["data"]
    assert node["id"] in [x["id"] for x in bound], [node["id"], bound]
    await page.get_by_role("button", name="负载历史", exact=True).click()
    await expect(
        page.get_by_role("button", name="最近 24 小时", exact=True)
    ).to_be_visible()
    await page.get_by_role("button", name="安装与认证", exact=True).click()
    await page.get_by_role("dialog").get_by_role(
        "switch", name="显示机器 Token", exact=True
    ).click()
    await expect(
        page.get_by_role("dialog").get_by_role(
            "switch", name="显示机器 Token", exact=True
        )
    ).to_have_attribute("aria-checked", "true")
    await page.get_by_role("button", name="获取安装命令", exact=True).click()
    await expect(page.locator(".command-code pre")).not_to_be_empty()
    await page.get_by_role("button", name="关闭", exact=True).click()
    print(
        "PASS machine load/state, node binding, history and credential UI", flush=True
    )
    await route("finance/gift-card?tab=templates")
    await page.get_by_role("button", name="添加模板", exact=True).click()
    await fill("模板名称", "浏览器盲盒")
    await page.get_by_role("dialog").locator("#field-type").select_option("3")
    await page.get_by_role("dialog").get_by_text("奖励内容", exact=True).click()
    await page.get_by_role("button", name="添加奖励", exact=True).click()
    await page.get_by_label("余额（元） 1", exact=True).fill("2.5")
    await page.get_by_label("流量（GB） 1", exact=True).fill("1")
    await save()
    gifts = (await api("gift-card/templates"))["data"]
    gifts = gifts.get("data", []) if isinstance(gifts, dict) else gifts
    gift = next(x for x in gifts if x["name"] == "浏览器盲盒")
    assert gift["rewards"]["random_rewards"][0]["balance"] == 250
    assert gift["rewards"]["random_rewards"][0]["transfer_enable"] == 1024**3
    await route("finance/gift-card?tab=codes")
    state_filter = page.locator(".facet-filter").filter(
        has=page.locator("summary", has_text="状态")
    )
    await state_filter.locator("summary").click()
    await state_filter.locator("select").select_option("0")
    await expect(state_filter.locator("select")).to_have_value("0")
    await expect(state_filter.locator("summary")).to_contain_text("已筛选")
    await route("user/ticket")
    await page.get_by_role("button", name="测试网络连接", exact=True).click()
    await expect(
        page.get_by_role("button", name="用户信息", exact=True)
    ).to_be_visible()
    await page.get_by_role("button", name="关闭工单", exact=True).click()
    await page.get_by_role("button", name="确认关闭", exact=True).click()
    await expect(
        page.get_by_role("dialog", name="确认关闭工单", exact=True)
    ).not_to_be_visible()
    await expect(page.locator(".ticket-conversation")).to_contain_text("此工单已关闭")
    await page.get_by_role("dialog", name="查看工单", exact=True).get_by_role(
        "button", name="关闭", exact=True
    ).click()
    await page.get_by_role("button", name="已关闭", exact=True).click()
    await expect(
        page.get_by_role("button", name="测试网络连接", exact=True)
    ).to_be_visible()
    await route("config/system/subscribe-template")
    await expect(
        page.get_by_role("heading", name="订阅模板", exact=True)
    ).to_be_visible()
    for template in ["SINGBOX", "CLASH", "CLASHMETA", "STASH", "SURGE", "SURFBOARD"]:
        await expect(
            page.get_by_role("button", name=template, exact=True)
        ).to_be_visible()
    await route("config/system/email/templates")
    await page.get_by_label("邮件主题", exact=True).fill("草稿预览验收")
    await expect(
        page.get_by_role("button", name="发送测试邮件", exact=True)
    ).to_be_disabled()
    await page.get_by_role("button", name="预览", exact=True).click()
    await expect(page.get_by_role("dialog")).to_be_visible()
    await page.get_by_role("button", name="关闭", exact=True).click()
    await page.get_by_role("button", name="保存模板", exact=True).click()
    await expect(
        page.get_by_role("button", name="发送测试邮件", exact=True)
    ).to_be_enabled()
    for path, name in [
        ("finance/plan", "plans-parity"),
        ("server/manage", "nodes-parity"),
        ("user/manage", "users-parity"),
        ("user/ticket", "tickets-parity"),
    ]:
        await route(path)
        await page.screenshot(path=str(OUT / (name + ".png")), full_page=True)
    print(
        "PASS inline switches, advanced filters, linked orders, coupon units, AnyTLS lines, blind-box editor, ticket close, mail draft state",
        flush=True,
    )


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
            await page.get_by_role("button", name="登录", exact=True).click()

        async def api(
            path, payload=None, method="get", status=200, prefix="/api/v2/admin-test/"
        ):
            token = await page.evaluate(
                "sessionStorage.getItem('xboard.next.auth:admin-test')"
            )
            response = await context.request.fetch(
                ORIGIN + prefix + path,
                method=method,
                headers={"Authorization": token, "Accept": "application/json"},
                **({"data": payload} if payload is not None else {}),
            )
            assert response.status == status, (
                path,
                response.status,
                (await response.text())[:200],
            )
            return await response.json()

        async def fill(label, value):
            dialogs = page.get_by_role("dialog")
            scope = dialogs.last if await dialogs.count() else page
            await scope.get_by_label(re.compile("^" + re.escape(label))).fill(
                str(value)
            )

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
            assert await page.locator(".sidebar .brand strong").evaluate(
                """el => {
                const range = document.createRange();
                range.selectNodeContents(el);
                const lines = [...range.getClientRects()];
                const box = el.getBoundingClientRect();
                return lines.length > 1 && lines.every(line =>
                    line.left >= box.left - 1 && line.right <= box.right + 1 &&
                    line.top >= box.top - 1 && line.bottom <= box.bottom + 1);
            }"""
            ), "Long site name must wrap inside the sidebar"
            await page.screenshot(path=str(OUT / "dashboard.png"), full_page=True)
            print("PASS admin login and non-admin denial", flush=True)
            pages = {
                "users": "用户管理",
                "plans": "订阅套餐",
                "orders": "订单管理",
                "commissions": "订单管理",
                "coupons": "优惠券管理",
                "nodes": "节点管理",
                "machines": "服务器管理",
                "groups": "权限组管理",
                "routes": "路由管理",
                "notices": "公告管理",
                "knowledge": "知识库管理",
                "tickets": "工单管理",
                "gift-templates": "模板管理",
                "gift-codes": "兑换码管理",
                "gift-usages": "使用记录",
                "traffic": "流量重置日志",
                "audit": "操作审计",
                "settings": "系统配置",
                "plugins": "插件管理",
                "themes": "主题管理",
                "payments": "支付配置",
                "mail": "系统配置",
                "reports": "数据报表",
                "system": "运行状态",
            }
            for name, title in pages.items():
                await route(name)
                await expect(
                    page.get_by_role("heading", name=title, exact=True)
                ).to_be_visible()
                assert (
                    not await page.get_by_role("alert")
                    .filter(has_text=re.compile(r"\S"))
                    .count()
                ), (
                    name,
                    await page.get_by_role("alert").all_text_contents(),
                )
            for path, title in {
                "config/system/safe": "系统配置",
                "config/system/subscribe-template": "系统配置",
                "config/plugin/menu-demo": "Menu Demo",
                "config/plugin/crud-demo": "CRUD Demo",
                "finance/gift-card?tab=statistics": "礼品卡管理",
                "server/manage?machine_id=1": "节点管理",
            }.items():
                await route(path)
                await expect(
                    page.get_by_role("heading", name=title, exact=True)
                ).to_be_visible()
            print(
                "PASS canonical and compatibility routes without request/render errors",
                flush=True,
            )
            await route("plans")
            await page.get_by_role("button", name="添加套餐", exact=True).click()
            await page.get_by_role("dialog").get_by_role(
                "button", name="保存", exact=True
            ).click()
            await expect(page.get_by_role("alert").first).to_be_visible()
            await fill("套餐名称", "浏览器验收套餐")
            await fill("套餐流量（GiB）", 55)
            await page.locator("#field-group_id").select_option("1")
            await page.get_by_text("销售价格", exact=True).click()
            await page.get_by_label("基础月价", exact=True).fill("10")
            await page.get_by_role("button", name="自动填充价格", exact=True).click()
            await expect(page.get_by_label("季付（元）", exact=True)).to_have_value(
                "28.5"
            )
            await fill("月付（元）", 9.99)
            await page.get_by_label("标签", exact=True).fill("first")
            await page.get_by_label("标签", exact=True).press("Enter")
            await page.get_by_label("标签", exact=True).fill("second")
            await page.get_by_label("标签", exact=True).press("Enter")
            await save()
            plans = (await api("plan/fetch"))["data"]
            plan = next(x for x in plans if x["name"] == "浏览器验收套餐")
            assert float(plan["prices"]["monthly"]) == 9.99 and plan["tags"] == [
                "first",
                "second",
            ]
            print("PASS plan validation/create, prices and tags", flush=True)
            await route("users")
            row = page.locator("tbody tr").filter(has_text="member@admin-test.invalid")
            await row.get_by_role(
                "button", name="操作 member@admin-test.invalid", exact=True
            ).click()
            await page.get_by_role("menuitem", name="编辑", exact=True).click()
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
            await page.get_by_role("button", name="测试网络连接", exact=True).click()
            await fill("回复内容", "隔离测试已处理")
            await page.get_by_role("button", name="发送", exact=True).click()
            await expect(page.get_by_text("隔离测试已处理", exact=True)).to_be_visible()
            await page.get_by_role("button", name="关闭", exact=True).click()
            print("PASS ticket conversation and reply", flush=True)
            await route("nodes")
            await page.get_by_role("button", name="添加节点", exact=True).click()
            await fill("节点名称", "验收 VLESS")
            await fill("连接地址", "test.invalid")
            await fill("连接端口", "443")
            await page.get_by_role("button", name="同步到服务端口", exact=True).click()
            await expect(page.get_by_label("监听端口", exact=False)).to_have_value(
                "443"
            )
            await save()
            nodes = (await api("server/manage/getNodes"))["data"]
            assert any(x["name"] == "验收 VLESS" for x in nodes)
            print("PASS node create and protocol payload", flush=True)
            await route("gift-templates")
            await page.get_by_role("button", name="添加模板", exact=True).click()
            await fill("模板名称", "余额卡验收")
            await page.get_by_role("dialog").get_by_text("奖励内容", exact=True).click()
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
            await expect(page.get_by_role("status")).to_contain_text("自动保存成功")
            assert (await api("config/fetch?key=site"))["data"]["site"][
                "app_description"
            ] == "自动化隔离验收"
            print("PASS settings automatic save", flush=True)
            await parity_checks(page, route, api, fill, save)
            await check_payment_pagination(page, route, api)
            await check_notice(page, route, api, save)
            await check_node_batch(page, route, api)

            await route("users")
            await page.get_by_role("button", name="切换主题").click()
            await page.get_by_role("button", name="深色", exact=True).click()
            await expect(page.locator("html")).to_have_class("dark")
            await page.screenshot(path=str(OUT / "users-dark.png"), full_page=True)
            await page.set_viewport_size({"width": 390, "height": 844})
            await page.get_by_role("button", name="切换导航").click()
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
                page.get_by_role("button", name="登录", exact=True)
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
