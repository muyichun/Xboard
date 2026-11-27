"""Traffic API + Chromium acceptance. Only the disposable run.sh fixture is supported."""

import asyncio
import ipaddress
import os
import pathlib
import re
from urllib.parse import urlencode, urlparse
from playwright.async_api import async_playwright, expect

ORIGIN = os.environ["ADMIN_TEST_ORIGIN"].rstrip("/")
assert ipaddress.ip_address(urlparse(ORIGIN).hostname).is_private
OUT = pathlib.Path(os.environ.get("ADMIN_TEST_OUTPUT", "/tmp/xboard-admin-qa"))
OUT.mkdir(parents=True, exist_ok=True)
expect.set_options(timeout=30000)


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"),
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = await browser.new_context(
            viewport={"width": 1440, "height": 1000},
            locale="zh-CN",
            timezone_id="America/Los_Angeles",
        )
        page = await context.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(ORIGIN + "/admin-test?admin_ui=next")
        assert "隔离验收" in await page.title()
        await page.locator("#login-email").fill("admin@admin-test.invalid")
        await page.locator("#login-password").fill("Isolated-test-only-2026!")
        await page.get_by_role("button", name="登录", exact=True).click()
        await expect(page.locator(".sidebar")).to_be_visible()
        token = await page.evaluate(
            "sessionStorage.getItem('xboard.next.auth:admin-test')"
        )

        async def api(params, status=200, authorized=True):
            response = await context.request.get(
                ORIGIN + "/api/v2/admin-test/stat/getStatUser?" + urlencode(params),
                headers={
                    "Accept": "application/json",
                    **({"Authorization": token} if authorized else {}),
                },
            )
            assert response.status == status, (response.status, await response.text())
            return await response.json()

        query = {
            "user_id": 3,
            "detail": 1,
            "start_date": "2026-11-26",
            "end_date": "2026-11-26",
        }
        result = await api(query)
        assert result["total"] == 5
        assert int(result["summary"]["upload"]) == 6237
        assert int(result["summary"]["download"]) == 12463
        assert int(result["summary"]["billed"]) == 14223
        assert {r["server_id"] for r in result["data"]} == {9001, 9002}
        legacy = await api({**query, "detail": 0})
        assert legacy["total"] == 3 and int(legacy["summary"]["billed"]) == 14223
        partial = await api({**query, "pageSize": 1})
        assert len(partial["data"]) == 1 and partial["summary"] == result["summary"]
        assert (await api({**query, "node_name": "日本"}))["total"] == 1
        assert (await api({**query, "server_id": 9001}))["total"] == 4
        assert (await api({**query, "user_id": 2}))["total"] == 1
        assert (await api({**query, "user_id": 1}))["total"] == 0
        assert (await api({"user_id": 3, "detail": 1, "end_date": "2026-11-25"}))[
            "total"
        ] == 23
        assert (await api({"user_id": 3, "detail": 1, "start_date": "2026-11-27"}))[
            "total"
        ] == 1
        assert (
            await api(
                {"user_id": 3, "start_date": "2026-10-20", "end_date": "2026-10-20"}
            )
        )["total"] == 1
        assert (
            await api(
                {
                    "user_id": 3,
                    "detail": 1,
                    "start_date": "2026-10-20",
                    "end_date": "2026-10-20",
                }
            )
        )["total"] == 0
        combined_query = {"user_id": 3, "combined": 1, "pageSize": 100}
        combined = await api(combined_query)
        assert combined["total"] == 29
        assert int(combined["summary"]["upload"]) == 266362
        assert int(combined["summary"]["download"]) == 532705
        assert int(combined["summary"]["billed"]) == 797671
        assert combined["summary"]["actual_incomplete"] is False
        assert [r["record_at"] for r in combined["data"]] == sorted(
            [r["record_at"] for r in combined["data"]], reverse=True
        )
        legacy_rows = [r for r in combined["data"] if r["source"] == "legacy"]
        assert len(legacy_rows) == 1
        assert legacy_rows[0]["server_name"] == "历史汇总（节点未知）"
        assert legacy_rows[0]["u"] == 1024 and legacy_rows[0]["d"] == 2048
        day_26_rows = [r for r in combined["data"] if r["record_at"] == 1795622400]
        assert len(day_26_rows) == 4 and all(r["source"] == "node" for r in day_26_rows)
        merged_node = next(
            r
            for r in day_26_rows
            if r["server_id"] == 9001 and float(r["server_rate"]) == 1.5
        )
        assert merged_node["u"] == 117 and merged_node["d"] == 223
        assert merged_node["server_type"] == "shadowsocks / trojan"
        combined_page = await api(
            {"user_id": 3, "combined": 1, "pageSize": 1, "page": 2}
        )
        assert len(combined_page["data"]) == 1
        assert combined_page["summary"] == combined["summary"]
        for invalid in [
            {"pageSize": 0},
            {"pageSize": 501},
            {"page": 0},
            {"start_date": "bad"},
            {"start_date": "2026-11-28"},
            {"detail": "bad"},
            {"combined": "bad"},
        ]:
            await api({**query, **invalid}, 422)
        await api(query, 403, authorized=False)

        await page.goto(
            ORIGIN + "/admin-test?admin_ui=next#/user/manage", wait_until="networkidle"
        )
        row = page.locator("tbody tr").filter(has_text="member@admin-test.invalid")
        await row.get_by_role("button", name=re.compile("^操作|^更多操作")).click()
        await page.get_by_role("menuitem", name="TA的流量记录", exact=True).click()
        dialog = page.get_by_role("dialog")
        await expect(dialog.get_by_role("heading", name="流量使用记录")).to_be_visible()
        await expect(dialog.locator(".traffic-summary")).to_contain_text("29")
        await expect(dialog.locator(".traffic-summary")).to_contain_text("全部记录合计")
        await expect(dialog.get_by_text("每日节点用量", exact=True)).to_be_visible()
        for label in ["开始日期", "结束日期", "节点名称"]:
            await expect(dialog.get_by_label(label, exact=True)).to_have_count(0)
        for label in ["查询", "重置"]:
            await expect(
                dialog.get_by_role("button", name=label, exact=True)
            ).to_have_count(0)
        for label in ["节点明细", "按日汇总"]:
            await expect(
                dialog.get_by_role("button", name=label, exact=True)
            ).to_have_count(0)

        rows = dialog.locator(".traffic-data-row")
        await expect(rows).to_have_count(20)
        expected_first_rows = [
            ("00:00", "香港 · 测试节点"),
            ("23:58–23:59", "香港 · 测试节点"),
            ("15:00", "香港 · 测试节点"),
            ("14:00", "香港 · 测试节点"),
            ("12:34", "日本 · 测试节点"),
            ("12:00–12:30", "新加坡 · 测试节点"),
        ]
        for index, (report_times, node) in enumerate(expected_first_rows):
            await expect(rows.nth(index).locator(".traffic-date")).to_have_text(
                report_times
            )
            await expect(rows.nth(index).locator(".traffic-node > span")).to_have_text(
                node
            )
        day_rows = dialog.locator(".traffic-day-row")
        await expect(day_rows.nth(0)).to_have_text("2026-11-27")
        await expect(day_rows.nth(1)).to_have_text("2026-11-26")
        await expect(day_rows.nth(2)).to_have_text("2026-11-25")
        assert not re.search(r"\b\d{2}:\d{2}:\d{2}\b", await dialog.inner_text())
        await expect(dialog.locator(".traffic-table")).to_contain_text("0×")
        assert "iB" not in await dialog.inner_text()
        assert "已选择" not in await dialog.inner_text()
        await expect(dialog.locator(".traffic-upload")).to_have_count(20)
        await expect(dialog.locator(".traffic-download")).to_have_count(20)

        await dialog.get_by_label("流量每页条数").select_option("10")
        await expect(rows).to_have_count(10)
        await dialog.get_by_label("流量下一页").click()
        await expect(dialog.locator(".traffic-pagination")).to_contain_text("2 / 3")
        await dialog.get_by_label("流量下一页").click()
        await expect(dialog.locator(".traffic-pagination")).to_contain_text("3 / 3")
        await expect(
            dialog.locator(".traffic-node").filter(has_text="历史汇总（节点未知）")
        ).to_have_count(1)
        await expect(dialog.locator(".traffic-date").last).to_have_text("时间未知")
        await dialog.get_by_label("流量上一页").click()
        await dialog.get_by_label("流量上一页").click()
        await dialog.screenshot(path=str(OUT / "traffic-light.png"))
        await page.evaluate("document.documentElement.classList.add('dark')")
        await dialog.screenshot(path=str(OUT / "traffic-dark.png"))
        for width in [390, 320]:
            await page.set_viewport_size({"width": width, "height": 844})
            assert await dialog.evaluate(
                "e => e.getBoundingClientRect().left >= 0 && e.getBoundingClientRect().right <= window.innerWidth"
            )
            assert await dialog.locator(".traffic-toolbar").evaluate(
                "e => e.scrollWidth <= e.clientWidth"
            )
        await dialog.screenshot(path=str(OUT / "traffic-mobile.png"))
        assert not errors, errors
        await browser.close()
        print(
            "PASS unified daily node/rate ledger, residual legacy history, descending minutes, paging, no search/tabs and Chromium light/dark/mobile"
        )


asyncio.run(main())
