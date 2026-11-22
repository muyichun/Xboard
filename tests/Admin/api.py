"""Mutation/response contracts against the disposable test fixture only."""

import os, json, time, ipaddress, urllib.request, urllib.error, urllib.parse

BASE = os.environ.get("ADMIN_TEST_ORIGIN", "http://172.19.0.2:7001").rstrip("/")
assert ipaddress.ip_address(urllib.parse.urlparse(BASE).hostname).is_private
assert (
    "Xboard 隔离验收"
    in urllib.request.urlopen(BASE + "/admin-test?admin_ui=next").read().decode()
)
headers = {"Accept": "application/json", "Content-Type": "application/json"}


def call(path, data=None, method=None, raw=False):
    url = (
        BASE
        + "/api/v2/"
        + ("admin-test/" + path if not path.startswith("@") else path[1:])
    )
    req = urllib.request.Request(
        url,
        json.dumps(data).encode() if data is not None else None,
        headers,
        method=method or ("POST" if data is not None else "GET"),
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            body = response.read()
            if raw:
                return body
            result = json.loads(body) if body else None
            assert not isinstance(result, dict) or result.get("status") != "fail", (
                path,
                result.get("message"),
            )
            return result
    except urllib.error.HTTPError as e:
        raise AssertionError((path, e.code, e.read().decode()[:250])) from None


def rows(r):
    v = r.get("data", []) if isinstance(r, dict) else r
    return v.get("data", []) if isinstance(v, dict) else v


headers["Authorization"] = call(
    "@passport/auth/login",
    {"email": "admin@admin-test.invalid", "password": "Isolated-test-only-2026!"},
)["data"]["auth_data"]
# Business writes stay in the isolated SQLite; no external network is available.
call("server/group/save", {"name": "API 权限组"})
group = next(x for x in rows(call("server/group/fetch")) if x["name"] == "API 权限组")
call("server/group/save", {"id": group["id"], "name": "API 修改权限组"})
call(
    "server/route/save",
    {
        "remarks": "API 路由",
        "match": ["domain:example.invalid"],
        "action": "direct",
        "action_value": "",
    },
)
route = next(x for x in rows(call("server/route/fetch")) if x["remarks"] == "API 路由")
machine = call("server/machine/save", {"name": "API 机器", "is_active": True})["data"]
assert machine["install_command"] and machine["token"]
assert call("server/machine/getToken?id=" + str(machine["id"]))["data"]
assert call("server/machine/installCommand?id=" + str(machine["id"]))["data"]
call("server/machine/resetToken", {"id": machine["id"]})
call("server/machine/nodes?machine_id=" + str(machine["id"]))
call("server/machine/history?machine_id=" + str(machine["id"]) + "&range_hours=24")
print(
    "PASS group/route/machine create-edit and credentials endpoints (values not logged)",
    flush=True,
)
protocols = {
    "shadowsocks": {"cipher": "aes-128-gcm"},
    "vmess": {"network": "tcp", "tls": 1},
    "vless": {"network": "tcp", "tls": 1},
    "trojan": {"network": "tcp", "tls": 1},
    "hysteria": {"version": 2, "tls": {}, "bandwidth": {"up": 100, "down": 100}},
    "tuic": {"version": 5, "tls": {}, "congestion_control": "bbr", "alpn": ["h3"]},
    "socks": {"tls": 0},
    "http": {"tls": 0},
    "naive": {"tls": 1},
    "mieru": {"transport": "TCP"},
    "anytls": {"tls": {}},
}
for kind, settings in protocols.items():
    call(
        "server/manage/save",
        {
            "name": "API " + kind,
            "type": kind,
            "host": "test.invalid",
            "port": "443",
            "server_port": "443",
            "rate": 1,
            "group_ids": [str(group["id"])],
            "route_ids": [route["id"]],
            "machine_id": machine["id"],
            "protocol_settings": settings,
            "show": 1,
            "enabled": True,
        },
    )
nodes = [
    x for x in rows(call("server/manage/getNodes")) if x["name"].startswith("API ")
]
assert len(nodes) == 11
ids = [x["id"] for x in nodes]
call("server/manage/batchUpdate", {"ids": ids, "show": 0})
updated = [x for x in rows(call("server/manage/getNodes")) if x["id"] in ids]
assert all(
    not x["show"] and x["enabled"] and x["machine_id"] == machine["id"] for x in updated
)
call("server/manage/batchResetTraffic", {"ids": ids})
call(
    "server/manage/sort",
    [
        {"id": x["id"], "order": n + 1}
        for n, x in enumerate(rows(call("server/manage/getNodes")))
    ],
)
assert call("server/manage/generateEchKey?public_name=ech.example.invalid")["data"]
print("PASS 11 protocols, batch preserves enabled/machine, sort/reset/ECH", flush=True)
now = int(time.time())
coupon = {
    "name": "API 优惠券",
    "type": 1,
    "value": 100,
    "started_at": now - 60,
    "ended_at": now + 3600,
    "limit_plan_ids": [1],
    "limit_period": ["monthly"],
}
call("coupon/generate", coupon)
cp = next(x for x in rows(call("coupon/fetch", {})) if x["name"] == coupon["name"])
assert cp["limit_period"] == ["monthly"]
call("coupon/show", {"id": cp["id"]})
assert len(call("coupon/generate", {**coupon, "generate_count": 2}, raw=True)) > 50
print("PASS coupon create/toggle and CSV batch", flush=True)
call(
    "order/assign",
    {
        "email": "member@admin-test.invalid",
        "plan_id": 1,
        "period": "month_price",
        "total_amount": 999,
    },
)
orders = rows(call("order/fetch", {"filter": [{"id": "user_id", "value": "eq:3"}]}))
assert orders
order = orders[0]
assert order["total_amount"] == 999 and order["period"] == "month_price"
assert call("order/detail", {"id": order["id"]})["data"]["user"]["id"] == 3
call("order/cancel", {"trade_no": order["trade_no"]})
call(
    "order/assign",
    {
        "email": "member@admin-test.invalid",
        "plan_id": 1,
        "period": "month_price",
        "total_amount": 100,
    },
)
order = rows(call("order/fetch", {"filter": [{"id": "status", "value": "eq:0"}]}))[0]
call("order/paid", {"trade_no": order["trade_no"]})
print("PASS order assignment/detail/cancel/paid", flush=True)
for kind, rewards in [
    (1, {"balance": 100}),
    (2, {"plan_id": 1, "plan_validity_days": 30}),
    (3, {"random_rewards": [{"weight": 1, "balance": 100}]}),
]:
    gift = call(
        "gift-card/create-template",
        {
            "name": "API 礼品 " + str(kind),
            "type": kind,
            "status": True,
            "rewards": rewards,
        },
    )["data"]
    call(
        "gift-card/update-template", {"id": gift["id"], "description": "隔离 API 验收"}
    )
    call(
        "gift-card/generate-codes",
        {"template_id": gift["id"], "count": 2, "prefix": "QA", "max_usage": 1},
    )
    codes = rows(call("gift-card/codes?template_id=" + str(gift["id"])))
    assert len(codes) == 2
    code = codes[0]
    call("gift-card/toggle-code", {"id": code["id"], "action": "disable"})
    call("gift-card/toggle-code", {"id": code["id"], "action": "enable"})
    call("gift-card/update-code", {"id": code["id"], "max_usage": 2})
    assert call(
        "gift-card/export-codes?batch_id=" + urllib.parse.quote(code["batch_id"]),
        raw=True,
    )
    for code in codes:
        call("gift-card/delete-code", {"id": code["id"]})
    call("gift-card/delete-template", {"id": gift["id"]})
print("PASS gift templates/codes CRUD, toggles, batch exports", flush=True)
for scope, extra in [
    ("selected", {"user_ids": [3]}),
    ("filtered", {"filter": [{"id": "email", "value": "member@admin-test.invalid"}]}),
    ("all", {}),
]:
    csv = call("user/dumpCSV", {"scope": scope, **extra}, raw=True).decode("utf-8-sig")
    assert "member@admin-test.invalid" in csv
    if scope != "all":
        assert "admin@admin-test.invalid" not in csv
call("traffic-reset/reset-user", {"user_id": 3, "reason": "隔离验收"})
assert call("traffic-reset/user/3/history")["data"]
call("stat/getStatUser?user_id=3&page=1&pageSize=20")
print("PASS selected/filtered/all exports and traffic reset history", flush=True)
call(
    "notice/save",
    {"title": "API 公告", "content": "<p>隔离验收</p>", "show": True, "tags": ["测试"]},
)
notice = next(x for x in rows(call("notice/fetch")) if x["title"] == "API 公告")
call("notice/show", {"id": notice["id"]})
call("notice/drop", {"id": notice["id"]})
call(
    "knowledge/save",
    {
        "title": "API 知识",
        "category": "测试",
        "language": "zh-CN",
        "body": "<p>说明</p>",
        "show": True,
    },
)
knowledge = next(x for x in rows(call("knowledge/fetch")) if x["title"] == "API 知识")
assert (
    call("knowledge/fetch?id=" + str(knowledge["id"]))["data"]["body"] == "<p>说明</p>"
)
call("knowledge/drop", {"id": knowledge["id"]})
print("PASS notices/knowledge create/detail/toggle/delete", flush=True)
# Clean only test-created records. Container destruction removes all remaining fixtures.
call("server/manage/batchDelete", {"ids": ids})
call("server/machine/drop", {"id": machine["id"]})
call("server/route/drop", {"id": route["id"]})
call("server/group/drop", {"id": group["id"]})
print("PASS cleanup; all API contracts passed", flush=True)
# Payment/plugin lifecycle and templates use only local schemas, never a gateway call.
call("plugin/install", {"code": "epay"})
call("plugin/enable", {"code": "epay"})
assert "EPay" in call("payment/getPaymentMethods")["data"]
schema = call("payment/getPaymentForm", {"payment": "EPay"})["data"]
assert all(k in schema for k in ["url", "pid", "key"])
for name in ["API 支付一", "API 支付二"]:
    call(
        "payment/save",
        {
            "name": name,
            "payment": "EPay",
            "handling_fee_fixed": 99,
            "handling_fee_percent": 1,
            "config": {
                "url": "https://gateway.invalid",
                "pid": "test",
                "key": "test-only",
                "type": "alipay",
            },
        },
    )
payments = rows(call("payment/fetch"))
ids = [x["id"] for x in payments if x["name"].startswith("API 支付")]
assert len(ids) == 2 and payments[0]["handling_fee_fixed"] == 99
call("payment/sort", {"ids": list(reversed(ids))})
assert rows(call("payment/fetch"))[0]["id"] == ids[-1]
for id in ids:
    call("payment/show", {"id": id})
    call("payment/drop", {"id": id})
call("plugin/disable", {"code": "epay"})
call("plugin/uninstall", {"code": "epay"})
print("PASS payment schema/create/sort/toggle/delete and plugin lifecycle", flush=True)
mail = call("mail/template/get?name=verify")["data"]
call(
    "mail/template/save",
    {"name": "verify", "subject": "隔离验收主题", "content": mail["content"]},
)
assert call("mail/template/get?name=verify")["data"]["subject"] == "隔离验收主题"
call("mail/template/reset", {"name": "verify"})
assert not call("mail/template/get?name=verify")["data"]["customized"]
themes = call("theme/getThemes")["data"]["themes"]
assert themes
name = next(iter(themes))
theme = call("theme/getThemeConfig", {"name": name})["data"]
if theme:
    call("theme/saveThemeConfig", {"name": name, "config": theme})
print("PASS mail templates save/reset and theme configuration read/write", flush=True)
