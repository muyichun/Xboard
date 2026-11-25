"""Click-through acceptance. Only run against the disposable tests/Admin fixture."""

import asyncio
import io
import ipaddress
import json
import os
import re
import sys
import traceback
import uuid
import zipfile
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import expect, async_playwright

PASSWORD = "Isolated-test-only-2026!"
CASES = {}


def scenario(fn):
    CASES[fn.__name__] = fn
    return fn


def button(scope, name):
    return scope.get_by_role("button", name=name, exact=True)


class Desk:
    def __init__(self, page, origin):
        self.p = page
        self.origin = origin
        self.tag = "验收" + uuid.uuid4().hex[:7]

    @property
    def dialog(self):
        return self.p.get_by_role("dialog").last

    async def go(self, path):
        await self.p.goto(
            self.origin + "/admin-test?admin_ui=next#/" + path,
            wait_until="domcontentloaded",
        )
        await expect(self.p.locator(".workspace h1").first).to_be_visible()

    def row(self, text):
        return self.p.locator("tbody tr").filter(has_text=text).first

    async def click(self, label, scope=None):
        await button(scope or self.p, label).click()

    async def fill(self, key, value):
        await self.dialog.locator('[id="field-' + key + '"]').fill(str(value))

    async def select(self, key, value):
        await self.dialog.locator('[id="field-' + key + '"]').select_option(str(value))

    async def api(self, path, data=None):
        token = await self.p.evaluate(
            "sessionStorage.getItem('xboard.next.auth:admin-test')"
        )
        response = await self.p.request.fetch(
            self.origin + "/api/v2/admin-test/" + path,
            method="GET" if data is None else "POST",
            headers={"Authorization": token},
            **({} if data is None else {"data": data}),
        )
        assert response.ok, (path, response.status)
        return (await response.json())["data"]

    async def save(self, endpoint):
        async with self.p.expect_response(
            lambda r: r.url.split("?")[0].endswith("/" + endpoint)
            and r.request.method != "OPTIONS"
        ) as response:
            await self.dialog.locator('button[type="submit"]').click()
        r = await response.value
        assert r.ok, (endpoint, r.status, (await r.json()).get("message"))
        if "json" in r.headers.get("content-type", ""):
            data = await r.json()
            assert (
                data.get("status") != "fail" and data.get("data") is not False
            ), endpoint
        await expect(self.p.locator(".dialog .edit-form")).to_have_count(0)

    async def close(self):
        await button(self.dialog, "关闭").first.click()

    async def delete(self, row, endpoint):
        await row.get_by_role("button", name=re.compile("^删除")).first.click()
        await self.save(endpoint)

    async def menu(self, row, label):
        await row.get_by_role("button", name=re.compile("^操作|^更多操作")).click()
        await self.p.get_by_role("menuitem", name=label, exact=True).click()

    async def switch(self, widget):
        previous = await widget.get_attribute("aria-checked")
        await widget.click()
        await expect(widget).to_have_attribute(
            "aria-checked", "false" if previous == "true" else "true"
        )
        await expect(widget).to_be_enabled()

    async def sort(self, endpoint):
        await self.click("编辑排序")
        rows = self.p.locator("tbody tr")
        await expect(rows.first).to_be_visible()
        before = await rows.all_inner_texts()
        if len(before) > 1:
            await rows.nth(1).locator("td").first.drag_to(
                rows.first.locator("td").first
            )
            changed = await rows.all_inner_texts()
            assert changed[:2] == [before[1], before[0]], (
                endpoint,
                "drag did not reorder the two records",
            )
        async with self.p.expect_response(
            lambda r: r.url.endswith("/" + endpoint)
        ) as response:
            await self.click("保存排序")
        saved = await response.value
        assert saved.ok
        payload = saved.request.post_data_json
        expected = (
            [r["id"] for r in payload] if isinstance(payload, list) else payload["ids"]
        )
        fetch = endpoint.removesuffix("/sort") + (
            "/getNodes" if endpoint.startswith("server/manage/") else "/fetch"
        )
        result = records(await self.api(fetch))
        assert expected == [r["id"] for r in result], endpoint
        await expect(button(self.p, "编辑排序")).to_be_visible()


@scenario
async def hover(d):
    p = d.p
    await d.go("config/plugin")
    plugin = p.locator("article").filter(
        has=p.get_by_role("heading", name="EPay", exact=True)
    )
    await expect(plugin).to_be_visible()
    if await button(plugin, "安装").count():
        await request_click(d, "安装", "plugin/install", plugin)
    await expect(button(plugin, "安装")).to_have_count(0)
    if await button(plugin, "启用").count():
        await request_click(d, "启用", "plugin/enable", plugin)
    await expect(button(plugin, "停用")).to_be_visible()
    appearance = """e => [e, ...e.querySelectorAll('*')].map(node => {
        const s = getComputedStyle(node);
        return [s.color, s.backgroundColor, s.borderColor, s.boxShadow,
            s.opacity, s.transform, s.textDecoration, s.outline];
    })"""
    for name in ["鼠标甲", "鼠标乙"]:
        await d.api(
            "payment/save",
            {"name": d.tag + name, "payment": "EPay", "config": {"type": "alipay"}},
        )
    await d.go("config/payment")
    one = d.row(d.tag + "鼠标甲")
    two = d.row(d.tag + "鼠标乙")
    await expect(one).to_be_visible()
    for theme in ["浅色", "深色"]:
        await d.click("切换主题")
        await p.get_by_role("button", name=re.compile("^" + theme)).click()
        await p.mouse.move(0, 0)
        baseline = await one.evaluate(
            "r=>[getComputedStyle(r).backgroundColor,getComputedStyle(r.lastElementChild).backgroundColor]"
        )
        elem = await button(one, "编辑").element_handle()
        rect = await elem.bounding_box()
        region = await one.evaluate(
            """r=>{
            const box=r.getBoundingClientRect(), actions=r.lastElementChild.getBoundingClientRect();
            return {x:Math.ceil(box.left), y:Math.ceil(box.top), width:Math.floor(actions.left-box.left)-1, height:Math.floor(box.height)-1};
        }"""
        )
        outside_actions = await p.screenshot(clip=region)
        for target in [
            button(one, "编辑"),
            button(two, "删除"),
            button(one, "删除"),
            button(two, "编辑"),
        ]:
            await p.mouse.move(0, 0)
            before = await target.evaluate(appearance)
            await target.hover()
            assert await target.evaluate(appearance) == before, (
                theme,
                "button hover feedback",
            )
            row = target.locator("xpath=ancestor::tr")
            colors = await row.evaluate(
                "r=>[getComputedStyle(r).backgroundColor,getComputedStyle(r.lastElementChild).backgroundColor]"
            )
            assert colors == baseline, (
                theme,
                "unrelated row surface changed on hover",
                baseline,
                colors,
            )
            assert await p.screenshot(clip=region) == outside_actions, (
                theme,
                "pixels outside hovered controls changed",
            )
        assert (
            await elem.evaluate("e=>e.isConnected")
            and await elem.bounding_box() == rect
        )
        await p.mouse.move(0, 0)
        cta = button(p, "添加支付方式")
        before = await cta.evaluate(appearance)
        await cta.hover()
        assert before == await cta.evaluate(
            appearance
        ), "Primary button changed on hover"
        await button(one, "编辑").click()
        for target in await d.dialog.locator("button:visible:enabled").all():
            await p.mouse.move(0, 0)
            before = await target.evaluate(appearance)
            await target.hover()
            assert (
                await target.evaluate(appearance) == before
            ), "Dialog button changed on hover"
        await d.click("取消", d.dialog)
        await d.click("用户菜单")
        for target in await p.locator(".account-menu a, .account-menu button").all():
            await p.mouse.move(0, 0)
            before = await target.evaluate(appearance)
            await target.hover()
            assert (
                await target.evaluate(appearance) == before
            ), "Account menu changed on hover"
        await d.click("用户菜单")
        await d.go("server/manage")
        await p.locator("tbody tr").first.get_by_role(
            "button", name=re.compile("^操作|^更多操作")
        ).click()
        for target in await p.get_by_role("menuitem").all():
            await p.mouse.move(0, 0)
            before = await target.evaluate(appearance)
            await target.hover()
            assert (
                await target.evaluate(appearance) == before
            ), "Action menu changed on hover"
        await p.keyboard.press("Escape")
        await d.go("config/payment")
    paths = await p.locator(".sidebar nav a").evaluate_all(
        "a=>a.map(l=>l.hash.slice(2))"
    )
    assert len(set(paths)) >= 18
    for path in paths:
        await d.go(path)
        await p.wait_for_function(
            """() => {
            const main=document.querySelector('main');
            if (!main || main.querySelector('.state .spin')) return false;
            const sig=location.hash+'|'+main.innerText+'|'+main.offsetHeight;
            if(window.hoverSignature!==sig){ window.hoverSignature=sig; window.hoverSince=performance.now(); }
            return performance.now()-window.hoverSince>450;
        }"""
        )
        await p.evaluate("document.fonts.ready")
        controls = p.locator(
            "main button:visible:enabled, main summary:visible, .command-trigger:visible, .sidebar nav a:visible"
        )
        handles = await controls.element_handles()
        assert handles
        # Sweep distinct control types, including controls below the fold.
        heights = await p.locator("main").bounding_box()
        sampled = set()
        for h in handles:
            sig = await h.evaluate(
                "e=>[e.closest('tr')?'row':'page', e.getAttribute('aria-label')?.split(' ')[0]||e.innerText.trim()||e.className].join('/')"
            )
            box = await h.bounding_box()
            if sig in sampled or not box:
                continue
            sampled.add(sig)
            await h.scroll_into_view_if_needed()
            box = await h.bounding_box()
            await p.mouse.move(0, 0)
            before = await h.evaluate(appearance)
            await p.mouse.move(
                box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
            )
            assert await h.evaluate(appearance) == before, (path, sig, "hover feedback")
            assert await h.evaluate("e=>e.isConnected")
            assert await h.bounding_box() == box, (path, sig, "control moved")
        after = await p.locator("main").bounding_box()
        assert all(heights[k] == after[k] for k in ("width", "height")), (
            path,
            "page layout shifted",
            heights,
            after,
        )
        await p.evaluate("window.scrollTo(0,0)")
        await p.mouse.move(0, 0)
    await d.click("切换主题")
    await p.get_by_role("button", name=re.compile("^浅色")).click()


def records(data):
    return data["data"] if isinstance(data, dict) else data


async def edit(row):
    await row.get_by_role("button", name=re.compile("^编辑")).first.click()


async def persisted_switch(d, row, field, endpoint, fetch, name, post=None):
    widget = row.get_by_role("switch", name=re.compile("^" + name))
    for _ in range(2):
        async with d.p.expect_response(
            lambda r: r.url.endswith("/" + endpoint)
        ) as reply:
            await d.switch(widget)
        assert (await reply.value).ok
        data = records(await d.api(fetch, post))
        row_id = (await reply.value).request.post_data_json["id"]
        value = next(item[field] for item in data if item["id"] == row_id)
        assert bool(value) == (await widget.get_attribute("aria-checked") == "true")


async def download_text(p, action, suffix=".csv"):
    async with p.expect_download() as item:
        await action()
    download = await item.value
    assert download.suggested_filename.lower().endswith(
        suffix
    ), download.suggested_filename
    return (await download.path()).read_text(encoding="utf-8-sig")


@scenario
async def resources(d):
    for path, label, base, key, fields in [
        ("server/group", "添加权限组", "server/group", "name", {}),
        (
            "server/route",
            "添加路由",
            "server/route",
            "remarks",
            {"match": "domain:button.invalid\nregexp:a{1,2}"},
        ),
        (
            "config/knowledge",
            "添加知识",
            "knowledge",
            "title",
            {"category": "操作验收", "body": "第一版正文"},
        ),
        ("config/notice", "添加公告", "notice", "title", {"content": "第一版公告"}),
    ]:
        await d.go(path)
        await d.click(label)
        await d.fill(key, d.tag)
        for k, v in fields.items():
            await d.fill(k, v)
        if base in ["knowledge", "notice"]:
            for label in [
                "B",
                "I",
                "标题",
                "链接",
                "列表",
                "代码",
                "引用",
                "预览",
                "编辑",
            ]:
                await d.click(label, d.dialog.locator(".markdown-editor"))
            await d.fill(
                "body" if base == "knowledge" else "content",
                fields.get("body", fields.get("content")),
            )
        await d.save(base + "/save")
        row = d.row(d.tag)
        await edit(row)
        await d.fill(key, d.tag + "修改")
        if base == "server/route":
            await d.select("action", "dns")
            await d.fill("action_value", "192.0.2.2")
        await d.save(base + "/save")
        entry = next(
            r for r in records(await d.api(base + "/fetch")) if r[key] == d.tag + "修改"
        )
        if base == "server/route":
            assert (
                entry["match"] == fields["match"].splitlines()
                and entry["action_value"] == "192.0.2.2"
            )
        if base == "knowledge":
            await persisted_switch(
                d, row, "show", "knowledge/show", "knowledge/fetch", ""
            )
            assert (await d.api("knowledge/fetch?id=" + str(entry["id"])))[
                "body"
            ] == fields["body"]
        if base in ["notice", "knowledge"]:
            await d.api(
                base + "/save",
                {
                    **fields,
                    key: d.tag + "排序",
                    **({"language": "zh-CN"} if base == "knowledge" else {}),
                },
            )
            await d.p.reload()
            await d.sort(base + "/sort")
        await d.delete(d.row(d.tag + "修改"), base + "/drop")
        assert not any(
            r["id"] == entry["id"] for r in records(await d.api(base + "/fetch"))
        )
        print("   CRUD", path, flush=True)


@scenario
async def plans(d):
    await d.go("finance/plan")
    await d.click("添加套餐")
    await d.fill("name", d.tag)
    await d.fill("transfer_enable", 6)
    await d.select("group_id", 1)
    await d.click("＋ 添加权限组", d.dialog)
    await d.p.get_by_label("新权限组名称").fill(d.tag + "组")
    await request_click(d, "添加", "server/group/save", d.dialog)
    await d.dialog.locator("#field-group_id").select_option(label=d.tag + "组")
    await d.click("使用默认模板")
    await d.p.get_by_label("基础月价", exact=True).fill("7")
    await d.click("自动填充价格")
    await d.click("清空价格")
    await d.fill("prices.monthly", 7)
    await d.save("plan/save")
    row = d.row(d.tag)
    for field, label in [("show", "显示"), ("sell", "新购"), ("renew", "续费")]:
        await persisted_switch(d, row, field, "plan/update", "plan/fetch", label)
    plan = next(r for r in await d.api("plan/fetch") if r["name"] == d.tag)
    account = "plan" + uuid.uuid4().hex[:8]
    await d.api(
        "user/generate",
        {
            "email_prefix": account,
            "email_suffix": "admin-test.invalid",
            "plan_id": plan["id"],
        },
    )
    await edit(row)
    await d.fill("transfer_enable", 11)
    await d.dialog.locator('[id="field-force_update"]').click()
    await d.save("plan/save")
    result = next(r for r in await d.api("plan/fetch") if r["name"] == d.tag)
    assert result["transfer_enable"] == 11 and float(result["prices"]["monthly"]) == 7
    synced = next(
        r
        for r in records(
            await d.api(
                "user/fetch",
                {"filter": [{"id": "email", "value": account + "@admin-test.invalid"}]},
            )
        )
        if r["plan_id"] == plan["id"]
    )
    assert (
        synced["transfer_enable"] == 11 * 1024**3
        and synced["group_id"] == plan["group_id"]
    )
    await d.api("user/destroy", {"id": synced["id"]})
    await d.sort("plan/sort")
    await d.delete(row, "plan/drop")


@scenario
async def coupons(d):
    await d.go("finance/coupon")
    for bulk in [False, True]:
        await d.click("添加优惠券")
        await d.fill("name", d.tag)
        await d.fill("value", 7)
        for preset in ["1周", "2周", "1个月", "3个月", "6个月", "1年"]:
            await d.click(preset, d.dialog)
        if bulk:
            await d.fill("generate_count", 2)
            csv = await download_text(d.p, lambda: d.save("coupon/generate"))
            assert len(csv.strip().splitlines()) >= 3
        else:
            await d.save("coupon/generate")
            row = d.row(d.tag)
            await persisted_switch(
                d, row, "show", "coupon/update", "coupon/fetch", "", {}
            )
            await edit(row)
            await d.select("type", 2)
            await d.fill("value", 15)
            await d.save("coupon/generate")
            coupon = next(
                r
                for r in records(await d.api("coupon/fetch", {}))
                if r["name"] == d.tag
            )
            assert coupon["type"] == 2 and coupon["value"] == 15
            await d.delete(row, "coupon/drop")


@scenario
async def orders(d):
    prefix = "order" + uuid.uuid4().hex[:8]
    await d.api(
        "user/generate", {"email_prefix": prefix, "email_suffix": "admin-test.invalid"}
    )
    email = prefix + "@admin-test.invalid"
    user = next(
        r
        for r in records(
            await d.api("user/fetch", {"filter": [{"id": "email", "value": email}]})
        )
        if r["email"] == email
    )
    for label, endpoint, status in [
        ("取消订单", "order/cancel", 2),
        ("标记已支付", "order/paid", 3),
    ]:
        await d.go("finance/order")
        await d.click("添加订单")
        await d.fill("email", email)
        await d.select("plan_id", 1)
        await d.dialog.locator("#field-period").select_option(index=1)
        await d.fill("total_amount", "3.21")
        await d.save("order/assign")
        await expect(d.dialog).to_be_visible()
        await d.close()
        order = next(
            r
            for r in records(await d.api("order/fetch", {}))
            if r["user_id"] == user["id"]
            and r["total_amount"] == 321
            and r["status"] == 0
        )
        period = d.p.locator(".facet-filter").filter(
            has=d.p.locator("summary", has_text="周期")
        )
        await period.locator("summary").click()
        async with d.p.expect_response(
            lambda r: r.url.endswith("/order/fetch") and r.request.method == "POST"
        ) as query:
            await period.get_by_label("月付", exact=True).check()
        filtered = records((await (await query.value).json())["data"])
        assert order["trade_no"] in [r["trade_no"] for r in filtered]
        await d.click("清除筛选", period)
        await period.locator("summary").click()
        row = d.row(order["trade_no"])
        await row.get_by_role("button", name=order["trade_no"], exact=True).click()
        await expect(d.dialog).to_contain_text(order["trade_no"])
        await d.close()
        await d.menu(row, label)
        await d.save(endpoint)
        assert (await d.api("order/detail", {"id": order["id"]}))["status"] == status


@scenario
async def gifts(d):
    await d.go("finance/gift-card")
    await d.click("添加模板")
    await d.fill("name", d.tag)
    await d.select("type", 2)
    await d.select("rewards.plan_id", 1)
    await d.fill("rewards.plan_validity_days", 15)
    await d.save("gift-card/create-template")
    await edit(d.row(d.tag))
    await d.fill("description", d.tag + "说明")
    await d.dialog.locator("#field-status").uncheck()
    await d.save("gift-card/update-template")
    template = next(
        r for r in records(await d.api("gift-card/templates")) if r["name"] == d.tag
    )
    assert template["description"] == d.tag + "说明" and not template["status"]
    await edit(d.row(d.tag))
    await d.dialog.locator("#field-status").check()
    await d.save("gift-card/update-template")
    await d.click("兑换码管理")
    await d.click("生成兑换码")
    await d.select("template_id", template["id"])
    await d.fill("count", 2)
    await d.dialog.locator("#field-download_csv").click()
    csv = await download_text(d.p, lambda: d.save("gift-card/generate-codes"))
    codes = records(await d.api("gift-card/codes?template_id=" + str(template["id"])))
    assert len(codes) == 2 and all(c["code"] in csv for c in codes)
    row = d.row(codes[0]["code"])
    await edit(row)
    await d.fill("max_usage", 3)
    await d.save("gift-card/update-code")
    await d.menu(row, "导出此批次")
    csv = await download_text(d.p, lambda: d.save("gift-card/export-codes"), ".txt")
    assert all(c["code"] in csv for c in codes)
    for code in codes:
        await d.delete(d.row(code["code"]), "gift-card/delete-code")
    for label in ["使用记录", "统计数据", "模板管理"]:
        await d.click(label)
    await d.delete(d.row(d.tag), "gift-card/delete-template")


async def request_click(d, label, endpoint, scope=None):
    async with d.p.expect_response(
        lambda r: r.url.split("?")[0].endswith("/" + endpoint)
    ) as reply:
        await d.click(label, scope)
    r = await reply.value
    assert r.ok, (endpoint, r.status)
    data = await r.json()
    if isinstance(data, list):
        return data
    assert data.get("status") != "fail" and data.get("data") is not False, (
        endpoint,
        data.get("message"),
    )
    return data.get("data", data)


async def upload(d, label, endpoint, files):
    data = io.BytesIO()
    with zipfile.ZipFile(data, "w", zipfile.ZIP_DEFLATED) as archive:
        for key, value in files.items():
            archive.writestr(key, value)
    async with d.p.expect_file_chooser() as picker:
        await d.click(label)
    async with d.p.expect_response(lambda r: r.url.endswith("/" + endpoint)) as result:
        await (await picker.value).set_files(
            {
                "name": "buttons.zip",
                "mimeType": "application/zip",
                "buffer": data.getvalue(),
            }
        )
    r = await result.value
    assert r.ok, (endpoint, r.status, (await r.json()).get("message"))


@scenario
async def payments(d):
    await d.go("config/plugin")
    card = d.p.locator("article").filter(
        has=d.p.get_by_role("heading", name="EPay", exact=True)
    )
    await expect(card).to_be_visible()
    if await button(card, "安装").count():
        await request_click(d, "安装", "plugin/install", card)
    await expect(button(card, "安装")).to_have_count(0)
    if await button(card, "启用").count():
        await request_click(d, "启用", "plugin/enable", card)
    await expect(button(card, "停用")).to_be_visible()
    await d.p.get_by_label("搜索扩展").fill("EPay")
    await expect(d.p.locator("article")).to_have_count(1)
    await d.click("重置")
    await d.click("配置", card)
    await expect(d.dialog).to_contain_text("无需独立配置")
    await d.close()
    await d.go("config/payment")
    await d.click("添加支付方式")
    await d.select("payment", "EPay")
    await d.click("保存", d.dialog)
    await d.fill("name", d.tag)
    for key, value in [
        ("url", "https://gateway.invalid"),
        ("pid", "qa"),
        ("key", "isolated-only"),
    ]:
        await d.fill("config." + key, value)
    await d.fill("config.type", "alipay")
    await d.fill("handling_fee_fixed", "1.25")
    await d.save("payment/save")
    row = d.row(d.tag)
    await d.click("编辑", row)
    await d.fill("handling_fee_fixed", "2.35")
    await d.save("payment/save")
    channel = next(r for r in await d.api("payment/fetch") if r["name"] == d.tag)
    assert channel["handling_fee_fixed"] == 235 and channel["config"]["pid"] == "qa"
    await persisted_switch(d, row, "enable", "payment/show", "payment/fetch", "")
    await d.click("复制", row)
    await expect(row.get_by_role("button", name="已复制")).to_be_visible()
    if len(await d.api("payment/fetch")) < 2:
        await d.api(
            "payment/save",
            {"name": "排序参照", "payment": "EPay", "config": {"type": "alipay"}},
        )
        await d.p.reload()
    await d.click("调整排序")
    await expect(d.dialog.locator(".sort-list > div").first).to_be_visible()
    last = d.dialog.locator(".sort-list > div").filter(has_text=d.tag).first
    up = button(last, "上移")
    await (up if await up.is_enabled() else button(last, "下移")).click()
    order = await d.dialog.locator(".sort-list > div > span").all_text_contents()
    await request_click(d, "保存排序", "payment/sort", d.dialog)
    assert [v["name"] for v in await d.api("payment/fetch")] == order
    await request_click(d, "删除", "payment/drop", row)
    await expect(row).to_have_count(0)
    await d.go("config/plugin")
    await request_click(d, "停用", "plugin/disable", card)
    await request_click(d, "卸载", "plugin/uninstall", card)
    await expect(button(card, "安装")).to_be_visible()


@scenario
async def themes(d):
    await d.go("config/theme")
    old = (await d.api("theme/getThemes"))["active"]
    name = "Audit" + uuid.uuid4().hex[:8]
    img = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
    config = {
        "name": name,
        "description": "临时主题",
        "version": "1.0.0",
        "screenshots": [img, img],
        "configs": [
            {
                "field_name": "headline",
                "field_type": "text",
                "label": "标题",
                "default_value": "初始",
            }
        ],
    }
    await upload(
        d,
        "上传主题",
        "theme/upload",
        {"config.json": json.dumps(config), "dashboard.blade.php": "<main>验收</main>"},
    )

    def card(n):
        return d.p.locator("article").filter(
            has=d.p.get_by_role("heading", name=n, exact=True)
        )

    await d.click("配置", card(name))
    await d.fill("headline", d.tag)
    await d.save("theme/saveThemeConfig")
    assert (await d.api("theme/getThemeConfig", {"name": name}))["headline"] == d.tag
    await d.click("预览", card(name))
    for label in ["下一张", "上一张", "预览第 2 张"]:
        await d.click(label, d.dialog)
    await expect(d.dialog.get_by_alt_text("主题预览 2")).to_be_visible()
    await d.close()
    await request_click(d, "使用主题", "config/save", card(name))
    assert (await d.api("theme/getThemes"))["active"] == name
    await request_click(d, "使用主题", "config/save", card(old))
    await request_click(d, "删除", "theme/delete", card(name))
    await expect(card(name)).to_have_count(0)


@scenario
async def plugins(d):
    await d.go("config/plugin")
    pending = d.p.locator("article").filter(
        has=d.p.get_by_role("heading", name="BTCPay", exact=True)
    )
    await request_click(d, "升级", "plugin/upgrade", pending)
    await expect(button(pending, "升级")).to_have_count(0)
    await expect(button(pending, "停用")).to_be_enabled()
    code = "audit" + uuid.uuid4().hex[:8]
    classname = code.capitalize()
    name = d.tag + "插件"
    manifest = {
        "code": code,
        "type": "feature",
        "name": name,
        "version": "1.0.0",
        "description": "按钮验收",
        "author": "QA",
        "config": {
            "headline": {"type": "string", "label": "标题", "default": "初始值"}
        },
    }
    files = {
        "config.json": json.dumps(manifest),
        "Plugin.php": "<?php namespace Plugin\\"
        + classname
        + "; class Plugin extends \\App\\Services\\Plugin\\AbstractPlugin { public function boot(): void {} }",
        "README.md": "# 插件验收说明",
    }
    await upload(d, "上传插件", "plugin/upload", files)
    card = d.p.locator("article").filter(
        has=d.p.get_by_role("heading", name=name, exact=True)
    )
    await request_click(d, "安装", "plugin/install", card)
    await d.click("配置", card)
    await d.fill("headline", d.tag)
    await d.save("plugin/config")
    await d.click("配置", card)
    await expect(d.dialog.locator("#field-headline")).to_have_value(d.tag)
    await d.close()
    await d.click("查看文档", card)
    await expect(d.dialog).to_contain_text("插件验收说明")
    await d.close()
    await request_click(d, "启用", "plugin/enable", card)
    await request_click(d, "停用", "plugin/disable", card)
    manifest["version"] = "1.1.0"
    await upload(
        d, "上传插件", "plugin/upload", {**files, "config.json": json.dumps(manifest)}
    )
    await expect(button(card, "启用")).to_be_enabled()
    await request_click(d, "卸载", "plugin/uninstall", card)
    await request_click(d, "删除", "plugin/delete", card)
    await expect(card).to_have_count(0)
    await d.p.get_by_role("link", name="Menu Demo").click()
    await d.p.get_by_role("link", name="数据管理演示").click()
    await d.click("新增")
    await d.fill("name", name)
    await d.click("保存", d.dialog)
    await d.click("编辑", d.row(name))
    await d.fill("name", name + "修改")
    await d.click("保存", d.dialog)
    await d.click("删除", d.row(name + "修改"))
    await expect(d.row(name)).to_have_count(0)


@scenario
async def users(d):
    domain = "qa" + uuid.uuid4().hex[:8] + ".invalid"
    await d.go("user/manage")
    await d.click("创建用户")
    await d.select("__mode", "batch")
    await d.fill("email_suffix", domain)
    await d.select("plan_id", 1)
    await d.click("3个月", d.dialog)
    await d.fill("generate_count", 2)
    await d.dialog.locator("#field-download_csv").click()
    csv = await download_text(d.p, lambda: d.save("user/generate"))
    users = [
        r for r in records(await d.api("user/fetch", {})) if r["email"].endswith(domain)
    ]
    assert len(users) == 2 and all(r["email"] in csv for r in users)
    user = users[0]
    row = d.row(user["email"])
    await d.p.get_by_role("textbox", name="搜索记录").fill(domain)
    await expect(d.p.locator("tbody tr")).to_have_count(2)
    menu = d.p.locator("details").filter(
        has=d.p.locator("select[aria-label='操作范围']")
    )

    async def act(scope, label):
        if scope == "selected":
            await row.get_by_role("checkbox").check()
        await menu.locator("summary").click()
        await menu.locator("select").select_option(scope)
        await d.click(label, menu)

    for scope in ["selected", "filtered", "all"]:
        await act(scope, "导出用户")
        csv = await download_text(d.p, lambda: d.save("user/dumpCSV"))
        assert (users[1]["email"] in csv) == (scope != "selected") and user[
            "email"
        ] in csv
        assert ("admin@admin-test.invalid" in csv) == (scope == "all")
    for scope in ["selected", "filtered", "all"]:
        await act(scope, "发送邮件")
        await d.fill("subject", "buttons-" + domain + "-" + scope)
        await d.fill("content", "仅用于隔离验收")
        await d.save("user/sendMail")
    await d.menu(row, "复制订阅URL")
    await expect(d.p.get_by_text("订阅URL已复制", exact=True)).to_be_visible()
    await d.menu(row, "重置UUID及订阅URL")
    await d.save("user/resetSecret")
    after = next(
        r for r in records(await d.api("user/fetch", {})) if r["id"] == user["id"]
    )
    assert after["uuid"] != user["uuid"] and after["token"] != user["token"]
    for label in ["查看详情", "TA的流量记录", "重置流量"]:
        await d.menu(row, label)
        await expect(d.dialog).to_be_visible()
        if label == "重置流量":
            await d.click("重置历史", d.dialog)
            await d.click("重置流量", d.dialog)
            await d.dialog.locator("textarea").fill(d.tag)
            await request_click(d, "确认重置", "traffic-reset/reset-user", d.dialog)
            await expect(d.dialog).to_contain_text("流量重置成功")
        if await d.dialog.count():
            await d.close()
    await act("selected", "封禁用户")
    await d.save("user/ban")
    found = {r["email"]: r for r in records(await d.api("user/fetch", {}))}
    assert found[user["email"]]["banned"] and not found[users[1]["email"]]["banned"]
    await act("filtered", "封禁用户")
    await d.save("user/ban")
    assert all(
        r["banned"]
        for r in records(await d.api("user/fetch", {}))
        if r["email"].endswith(domain)
    )
    for label, fragment in [("TA的邀请", "invite_user_id"), ("TA的订单", "user_id")]:
        await d.menu(row, label)
        await expect(d.p).to_have_url(re.compile(fragment))
        await d.go("user/manage")
    await d.menu(row, "分配订单")
    await expect(d.dialog.locator("#field-email")).to_have_value(user["email"])
    await d.select("plan_id", 1)
    await d.dialog.locator("#field-period").select_option(index=1)
    await d.fill("total_amount", "2")
    await d.save("order/assign")
    await d.close()
    await d.menu(d.row(users[1]["email"]), "删除")
    await d.save("user/destroy")
    await expect(d.row(users[1]["email"])).to_have_count(0)
    await d.go("user/traffic-reset-logs")
    await d.click("统计概览")
    await expect(d.dialog).to_be_visible()
    await d.close()
    csv = await download_text(d.p, lambda: d.click("导出日志"))
    assert user["email"] in csv or str(user["id"]) in csv


@scenario
async def nodes(d):
    await d.go("server/machine")
    await d.click("添加服务器")
    await d.fill("name", d.tag)
    await d.save("server/machine/save")
    await expect(d.dialog).to_be_visible()
    await d.close()
    row = d.row(d.tag)
    await edit(row)
    await d.fill("notes", "验收备注")
    await d.dialog.locator("#field-is_active").uncheck()
    await d.save("server/machine/save")
    machine = next(
        r for r in records(await d.api("server/machine/fetch")) if r["name"] == d.tag
    )
    assert not machine["is_active"] and machine["notes"] == "验收备注"
    await edit(row)
    await d.dialog.locator("#field-is_active").check()
    await d.save("server/machine/save")
    await row.get_by_role("button", name=re.compile("^服务器详情")).click()
    await d.click("新增节点到该服务器", d.dialog)
    await expect(d.dialog.locator("#field-machine_id")).to_have_value(
        str(machine["id"])
    )
    kinds = await d.dialog.locator("#field-type option").evaluate_all(
        "a=>a.map(b=>b.value).filter(Boolean)"
    )
    assert len(kinds) == 11
    for i, kind in enumerate(kinds):
        if i:
            await d.click("添加节点")
        await d.select("type", kind)
        await d.fill("name", d.tag + kind)
        await d.fill("host", "node.invalid")
        await d.fill("port", 443)
        await d.click("同步到服务端口", d.dialog)
        if kind == "vmess":
            await d.dialog.locator("#field-rate_time_enable").check()
            await d.click("添加时间段", d.dialog)
            await d.click("删除", d.dialog)
            await d.click("添加时间段", d.dialog)
        if kind == "vless":
            await d.select("protocol_settings.tls", 2)
            await request_click(
                d, "生成密钥对", "server/manage/generateRealityKey", d.dialog
            )
            await d.click("随机生成", d.dialog)
        if kind == "anytls":
            await d.click("使用默认", d.dialog)
            await d.dialog.locator(
                '[id="field-protocol_settings.tls.ech.enabled"]'
            ).check()
            await request_click(
                d, "生成 ECH 配置和密钥", "server/manage/generateEchKey", d.dialog
            )
        await d.save("server/manage/save")
    created = [
        r
        for r in records(await d.api("server/manage/getNodes"))
        if r["name"].startswith(d.tag)
    ]
    assert {r["type"] for r in created} == set(kinds) and all(
        str(r["port"]) == "443" for r in created
    )
    mieru = next(r for r in created if r["type"] == "mieru")
    assert not mieru["protocol_settings"]["traffic_pattern"]
    await d.click(d.tag + "mieru", d.row(d.tag + "mieru"))
    await d.click("随机生成", d.dialog)
    await d.save("server/manage/save")
    verify = next(
        r
        for r in records(await d.api("server/manage/getNodes"))
        if r["id"] == mieru["id"]
    )
    assert verify["protocol_settings"]["traffic_pattern"]
    row = d.row(d.tag + kinds[0])
    await persisted_switch(
        d, row, "show", "server/manage/update", "server/manage/getNodes", "订阅中显示"
    )
    await d.click(d.tag + kinds[0], row)
    await d.fill("host", "edited.invalid")
    await d.save("server/manage/save")
    await d.menu(row, "复制节点")
    await d.save("server/manage/copy")
    await d.menu(row, "重置流量")
    await d.save("server/manage/resetTraffic")
    await d.sort("server/manage/sort")
    await d.go("server/machine")
    machine_row = d.row(d.tag)
    await machine_row.get_by_role("button", name=re.compile("^服务器详情")).click()
    node_row = d.dialog.locator("tbody tr").filter(has_text=d.tag + kinds[0]).first
    for _ in range(2):
        await d.switch(node_row.get_by_role("switch"))
    await request_click(d, "取消关联", "server/manage/update", node_row)
    await d.click("负载历史", d.dialog)
    for n in [6, 12, 24, 1]:
        await d.click(f"最近 {n} 小时", d.dialog)
        await expect(
            d.dialog.get_by_role("button", name=f"最近 {n} 小时")
        ).to_have_class("active")
    await d.close()
    await d.go("server/manage")
    created = [
        r
        for r in records(await d.api("server/manage/getNodes"))
        if r["name"].startswith(d.tag)
    ]
    assert len(created) == 12 and any(
        r["host"] == "edited.invalid" and not r["machine_id"] for r in created
    )
    row = d.row(d.tag + "anytls")
    await d.menu(row, "删除")
    await d.save("server/manage/drop")
    for r in created:
        if r["name"] != d.tag + "anytls":
            await d.api("server/manage/drop", {"id": r["id"]})
    await d.go("server/machine")
    await d.delete(machine_row, "server/machine/drop")


@scenario
async def settings(d):
    p = d.p
    for group, path, key, val in [
        ("site", "", "app_description", d.tag),
        ("safe", "/safe", "email_whitelist_enable", None),
        ("subscribe", "/subscribe", "show_protocol_to_server_enable", None),
        ("invite", "/invite", "invite_never_expire", None),
        ("frontend", "/frontend", "frontend_theme_color", "green"),
        ("server", "/server", "server_push_interval", "73"),
        ("email", "/email", "email_from_address", "qa@admin-test.invalid"),
        ("telegram", "/telegram", "telegram_bot_enable", None),
        ("app", "/APP", "windows_version", "2.3.4"),
    ]:
        await d.go("config/system" + path)
        widget = p.locator('[id="field-' + key + '"]')
        config = (await d.api("config/fetch?key=" + group))[group]
        async with p.expect_response(
            lambda r: r.url.endswith("/config/save")
        ) as result:
            if val is None:
                await widget.click()
            elif await widget.evaluate("e=>e.tagName") == "SELECT":
                await widget.select_option(val)
            else:
                await widget.fill(val)
        assert (await result.value).ok, (group, key)
        new = (await d.api("config/fetch?key=" + group))[group][key]
        assert bool(new) != bool(config[key]) if val is None else str(new) == val, (
            group,
            key,
        )
        print("   设置", group, flush=True)
    await d.go("config/system/subscribe-template")
    for key in ["singbox", "clash", "clashmeta", "stash", "surge", "surfboard"]:
        await d.click(key.upper())
        editor = p.locator(".monaco-editor").first
        await expect(editor).to_be_visible()
        # Exercise the actual code editor and read the saved template independently.
        await editor.click()
        await p.keyboard.press("Control+End")
        async with p.expect_response(
            lambda r: r.url.endswith("/config/save")
        ) as result:
            if key != "singbox":
                await p.keyboard.press("Enter")
                await p.keyboard.insert_text(
                    ("# " if key in ["clash", "clashmeta", "stash"] else "; ") + d.tag
                )
            else:
                # Monaco auto-closes quotes and braces on typed input. Paste a full JSON document.
                await p.evaluate(
                    """() => {
                    const input=document.createElement('textarea');
                    input.value=JSON.stringify({log:{level:'warn'}});
                    document.body.append(input);
                    input.select();
                    const copied=document.execCommand('copy');
                    input.remove();
                    if (!copied) throw new Error('Could not prepare clipboard');
                }"""
                )
                await editor.click()
                await p.keyboard.press("Control+a")
                await p.keyboard.press("Control+v")
        assert (await result.value).ok, key
        stored = (await d.api("config/fetch?key=subscribe_template"))[
            "subscribe_template"
        ]["subscribe_template_" + key]
        if key == "singbox":
            assert json.loads(stored) == {"log": {"level": "warn"}}
        else:
            assert d.tag in stored
    await d.go("config/system/email")
    mail = await request_click(d, "发送测试邮件", "config/testSendMail")
    assert not mail["error"], "测试邮件未交给隔离邮件驱动"
    await d.click("邮件模板")
    await p.get_by_label("邮件主题", exact=True).fill(d.tag)
    await button(p, "插入").first.click()
    await request_click(d, "保存模板", "mail/template/save")
    assert (await d.api("mail/template/get?name=verify"))["subject"] == d.tag
    await d.click("预览")
    await expect(d.dialog.locator("iframe")).to_be_visible()
    await d.close()
    await p.get_by_label("测试收件人").fill("template@admin-test.invalid")
    await request_click(d, "发送测试邮件", "mail/template/test")
    await request_click(d, "恢复默认", "mail/template/reset")
    assert (await d.api("mail/template/get?name=verify"))["subject"] != d.tag


@scenario
async def settings_actions(d):
    await d.go("config/system/server")
    await request_click(d, "随机生成", "config/save")
    key = await d.p.locator("#field-server_token").input_value()
    assert re.fullmatch(r"[0-9a-f]{32}", key)
    assert (await d.api("config/fetch?key=server"))["server"]["server_token"] == key

    await d.go("config/system/safe")
    toggle = d.p.locator("#field-captcha_enable")
    for enabled in [True, False]:
        async with d.p.expect_response(
            lambda r: r.url.endswith("/config/save")
        ) as result:
            await toggle.click()
        assert (await result.value).ok
        assert (await d.api("config/fetch?key=safe"))["safe"][
            "captcha_enable"
        ] is enabled
        if enabled:
            async with d.p.expect_response(
                lambda r: r.url.endswith("/config/save")
            ) as result:
                await d.p.locator("#field-captcha_type").select_option("turnstile")
            assert (await result.value).ok
            assert (await d.api("config/fetch?key=safe"))["safe"][
                "captcha_type"
            ] == "turnstile"

    site = (await d.api("config/fetch?key=site"))["site"]
    await d.api("config/save", {"app_url": None})
    try:
        await d.go("config/system/telegram")
        async with d.p.expect_response(
            lambda r: r.url.endswith("/config/setTelegramWebhook")
        ) as result:
            await d.click("更新 Webhook")
        assert (await result.value).status == 422
        await expect(d.p.locator("main .notice-error[role=alert]")).to_contain_text(
            "Webhook地址未配置"
        )
    finally:
        await d.api("config/save", {"app_url": site["app_url"]})


@scenario
async def read_views(d):
    p = d.p
    await d.go("")
    await d.click("数量")
    await d.click("金额")
    for ctrl in await p.locator("select.range-control, .range-control select").all():
        await ctrl.select_option("-1")
        await ctrl.locator("..").get_by_label("开始日期").fill("2026-01-01")
        await ctrl.select_option("7")
    await request_click(d, "刷新队列", "system/getQueueStats")
    for title, fragment in [
        ("待处理工单", "user/ticket"),
        ("待处理佣金", "commission_status=0"),
    ]:
        await p.locator(".metric").filter(has_text=title).get_by_role("link").click()
        await expect(p).to_have_url(re.compile(fragment))
        await d.go("")
    await d.go("user/ticket")
    ticket = next(
        t
        for t in records(await d.api("ticket/fetch"))
        if t["subject"] == "测试网络连接"
    )
    await d.click("已关闭" if ticket["status"] else "处理中")
    await d.click("测试网络连接")
    await d.click("收起工单列表", d.dialog)
    await d.click("展开工单列表", d.dialog)
    for label in ["用户信息", "流量记录"]:
        await d.click(label, d.dialog)
        detail_title = "用户信息" if label == "用户信息" else "流量使用记录"
        await expect(
            p.get_by_role("dialog", name=detail_title, exact=True)
        ).to_be_visible()
        await d.close()
        await expect(
            p.get_by_role("dialog", name="查看工单", exact=True)
        ).to_be_visible()
    await d.click("订单记录", d.dialog)
    await expect(p).to_have_url(re.compile(r"finance/order.*user_id"))
    await d.go("reports")
    ctrl = p.get_by_label("报表类型")
    for kind in await ctrl.locator("option").evaluate_all("a=>a.map(o=>o.value)"):
        await ctrl.select_option(kind)
        await expect(p.locator("main .spin")).to_have_count(0)
        if await button(p, "导出报表").count():
            assert (await download_text(p, lambda: d.click("导出报表"))).strip()
    await d.go("system")
    for label, api in [
        ("队列统计", "getQueueStats"),
        ("队列负载", "getQueueWorkload"),
        ("进程管理", "getQueueMasters"),
        ("失败任务", "getHorizonFailedJobs"),
    ]:
        await request_click(d, label, "system/" + api)
    await d.click("运行状态")
    await expect(p.locator("main .tabs .active")).to_have_text("运行状态")
    await p.locator(".command-trigger").click()
    await d.dialog.get_by_role("textbox").fill("支付配置")
    await d.dialog.get_by_role("link", name="支付配置").click()
    await expect(p).to_have_url(re.compile("config/payment"))
    await d.click("用户菜单")
    await p.locator(".account-menu").get_by_role("link", name="设置").click()
    await expect(p).to_have_url(re.compile("config/system"))
    if not await button(p, "退出登录").is_visible():
        await d.click("用户菜单")
    await d.click("退出登录")
    await expect(p.locator("#login-email")).to_be_visible()
    await p.locator("#login-email").fill("admin@admin-test.invalid")
    await p.locator("#login-password").fill(PASSWORD)
    await d.click("登录")
    await expect(p.locator(".sidebar")).to_be_visible()


@scenario
async def list_tools(d):
    p = d.p
    for path in [
        "server/machine",
        "server/manage",
        "server/group",
        "server/route",
        "config/notice",
        "config/knowledge",
        "finance/plan",
        "finance/order",
        "finance/coupon",
        "finance/gift-card",
        "finance/gift-card?tab=codes",
        "finance/gift-card?tab=usages",
        "user/manage",
        "user/ticket",
        "user/traffic-reset-logs",
    ]:
        await d.go(path)
        picker = p.locator(".column-picker")
        await picker.locator("summary").click()
        switch = picker.get_by_role("switch").first
        await d.switch(switch)
        await d.switch(switch)
        await d.click("重置显示列", picker)
        await picker.locator("summary").click()
        pager = p.locator("main .pagination").last
        await pager.get_by_role("combobox").select_option("10")
        if await button(pager, "下一页").is_enabled():
            for label in ["下一页", "上一页", "跳转到最后一页", "跳转到第一页"]:
                await d.click(label, pager)
        await expect(pager.get_by_label("页码")).to_have_value("1")
        sort_buttons = p.locator("main .column-sort")
        if await sort_buttons.count():
            await sort_buttons.first.click()
            await sort_buttons.first.click()
        for facet in await p.locator(
            "main details.facet-filter:not(.column-picker)"
        ).all():
            summary = facet.locator("summary")
            if "操作" in await summary.inner_text():
                continue
            await summary.click()
            check = facet.get_by_role("checkbox").first
            combo = facet.get_by_role("combobox")
            field = facet.locator("input:not([type=checkbox])").first
            if await check.count():
                await check.check()
            elif await combo.count() and await combo.locator("option").count() > 1:
                await combo.select_option(index=1)
            elif await field.count():
                kind = await field.get_attribute("type")
                await field.fill(
                    "2026-01-01"
                    if kind == "date"
                    else "1" if kind == "number" else "qa"
                )
            if await button(facet, "清除筛选").count():
                await d.click("清除筛选", facet)
            await summary.click()
        search = p.get_by_role("textbox", name="搜索记录")
        if await search.count():
            await search.fill(d.tag)
            await d.click("重置 ×")
            await expect(search).to_have_value("")
        await expect(p.locator("main .state.error")).to_have_count(0)
        print("   列表", path, flush=True)


@scenario
async def legacy_controls(d):
    expected = {
        "": "金额",
        "config/system": "",
        "config/plugin": "上传插件",
        "config/theme": "上传主题",
        "config/payment": "添加支付方式",
        "config/knowledge": "添加知识",
        "config/notice": "添加公告",
        "server/machine": "添加服务器",
        "server/manage": "添加节点",
        "server/group": "添加权限组",
        "server/route": "添加路由",
        "finance/order": "添加订单",
        "finance/plan": "添加套餐",
        "finance/coupon": "添加优惠券",
        "finance/gift-card": "模板管理",
        "user/manage": "高级筛选",
        "user/ticket": "已关闭",
        "user/traffic-reset-logs": "导出日志",
        "config/system/email": "发送测试邮件",
        "config/system/subscribe-template": "Sing-box",
    }
    ctx = await d.p.context.browser.new_context(
        locale="zh-CN", viewport={"width": 1440, "height": 900}
    )
    try:
        await ctx.add_init_script("localStorage.setItem('i18nextLng','zh-CN')")
        old = await ctx.new_page()
        base = d.origin + "/admin-test?admin_ui=legacy"
        await old.goto(base, wait_until="domcontentloaded", timeout=60000)
        await old.locator("input[type=password]").wait_for(timeout=60000)
        await old.locator("input").first.fill("admin@admin-test.invalid")
        await old.locator("input[type=password]").fill(PASSWORD)
        await old.locator("input[type=password]").press("Enter")
        await old.locator("input[type=password]").wait_for(
            state="detached", timeout=60000
        )
        for path, primary in expected.items():
            await old.goto(base + "#/" + path, wait_until="domcontentloaded")
            if primary:
                await expect(
                    old.get_by_text(primary, exact=True).filter(visible=True).first
                ).to_be_visible(timeout=20000)
            else:
                await expect(old.locator("input:visible").first).to_be_visible()
        print("   旧版中文菜单及设置子页", len(expected), flush=True)
    finally:
        await ctx.close()


@scenario
async def ban_all(d):
    # Run last: this action invalidates the disposable administrator's own session.
    await d.go("user/manage")
    menu = d.p.locator("details").filter(has=d.p.get_by_label("操作范围"))
    await menu.locator("summary").click()
    await menu.locator("select").select_option("all")
    await d.click("封禁用户", menu)
    await expect(d.dialog).to_contain_text("系统全部用户")
    await request_click(d, "确认操作", "user/ban", d.dialog)
    await expect(d.p.locator("#login-email")).to_be_visible()


async def main():
    origin = os.environ["ADMIN_TEST_ORIGIN"].rstrip("/")
    output = Path(os.getenv("ADMIN_TEST_OUTPUT", "/tmp/xboard-admin-qa"))
    output.mkdir(exist_ok=True, parents=True)
    assert ipaddress.ip_address(urlparse(origin).hostname).is_private
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            executable_path=os.getenv("CHROMIUM_PATH", "/usr/bin/chromium"),
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        ctx = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            locale="zh-CN",
            accept_downloads=True,
        )
        page = await ctx.new_page()
        page.set_default_timeout(12000)
        page.set_default_navigation_timeout(60000)
        expect.set_options(timeout=10000)
        await page.goto(
            origin + "/admin-test?admin_ui=next", wait_until="domcontentloaded"
        )
        assert "隔离验收" in await page.title()
        await page.locator("#login-email").fill("admin@admin-test.invalid")
        await page.locator("#login-password").fill(PASSWORD)
        await button(page, "登录").click()
        await expect(page.locator(".sidebar")).to_be_visible(timeout=30000)
        page.on("dialog", lambda dialog: dialog.accept())
        errors = []
        page.on("pageerror", lambda err: errors.append(str(err)))
        failed = []
        for name in sys.argv[1:] or CASES:
            try:
                d = Desk(page, origin)
                await CASES[name](d)
                print("PASS", name, flush=True)
            except Exception as exc:
                print("FAIL", name, str(exc)[:1000], flush=True)
                traceback.print_exc(limit=3)
                print(
                    "DIALOG",
                    await page.locator(
                        ".dialog h2,.dialog label,.dialog footer button,main [role=alert],.dialog [role=alert]"
                    ).all_text_contents(),
                    flush=True,
                )
                await page.screenshot(path=output / ("buttons-" + name + ".png"))
                failed.append(name)
                await page.goto(
                    origin + "/admin-test?admin_ui=next", wait_until="domcontentloaded"
                )
        await browser.close()
        if failed or errors:
            raise AssertionError((failed, errors))


if __name__ == "__main__":
    asyncio.run(main())
