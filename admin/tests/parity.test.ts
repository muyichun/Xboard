import { loadMetrics, highLoad, machineState } from "../src/lib/metrics";
import { mieruPattern, legacyPrices } from "../src/lib/protocols";
import { describe, it, expect } from "vitest";
import { moduleById } from "../src/legacy/modules";
import { initialValues, serializeValues } from "../src/lib/forms";
import { queryParams } from "../src/lib/list";
import { nodeTypes } from "../src/modules/fields";
describe("旧管理端数据契约", () => {
    it("优惠券金额按元编辑并无损往返分值", () => {
        const m = moduleById("coupons"),
            r = {
                id: 1,
                type: 1,
                value: 125,
                started_at: 1700000000,
                ended_at: 1800000000,
            };
        const values = initialValues(m.fields!, m.editSeed!(r));
        expect(values.value).toBe(1.25);
        const payload = m.savePayload!(serializeValues(m.fields!, values), r);
        expect(payload.value).toBe(125);
    });
    it("AnyTLS 和路由规则按换行分割，保留规则内部逗号", () => {
        for (const [id, key, r] of [
            [
                "nodes",
                "protocol_settings.padding_scheme",
                {
                    type: "anytls",
                    protocol_settings: {
                        padding_scheme: [
                            "2=400-500,c,500-1000",
                            "3=9-9,500-1000",
                        ],
                    },
                },
            ],
            [
                "routes",
                "match",
                { match: ["regexp:a,b", "domain:example.com"] },
            ],
        ] as const) {
            const m = moduleById(id),
                out = serializeValues(m.fields!, initialValues(m.fields!, r));
            expect(
                key === "match"
                    ? out.match
                    : out.protocol_settings.padding_scheme,
            ).toEqual(
                key === "match" ? r.match : r.protocol_settings.padding_scheme,
            );
        }
    });
    it.each(Object.keys(nodeTypes))("%s 的结构化协议字段可以序列化", (type) => {
        const m = moduleById("nodes"),
            r = {
                type,
                host: "example.invalid",
                port: "443",
                server_port: 443,
            };
        const v = serializeValues(m.fields!, initialValues(m.fields!, r));
        expect(v.type).toBe(type);
        expect(v.show).toBe(false);
        expect(v.protocol_settings).toBeTypeOf("object");
    });
    it("订单复合多选筛选传入数组且保留零状态", () => {
        expect(
            queryParams(
                moduleById("orders"),
                1,
                20,
                "",
                {
                    status: [0, 3],
                    type: [1],
                    period: ["month_price"],
                    commission_status: [0],
                },
                null,
            ).filter,
        ).toEqual([
            { id: "status", value: [0, 3] },
            { id: "type", value: [1] },
            { id: "period", value: ["month_price"] },
            { id: "commission_status", value: [0] },
        ]);
    });
    it("礼品卡留空有效时间不发送立即到期值", () => {
        const a = moduleById("gift-codes").create!;
        expect(
            a.payload!(
                {
                    template_id: 1,
                    count: 1,
                    expires_hours: null,
                    download_csv: true,
                },
                {},
            ),
        ).toEqual({ template_id: 1, count: 1, download_csv: true });
    });
});

it("Mieru 生成 protobuf 范围消息且套餐默认折扣与旧版一致", () => {
    expect(
        Array.from(atob(mieruPattern(100, 400)), (c) => c.charCodeAt(0)),
    ).toEqual([10, 5, 8, 100, 16, 144, 3]);
    expect(legacyPrices(10)).toEqual({
        monthly: 10,
        quarterly: 28.5,
        half_yearly: 54,
        yearly: 102,
        two_yearly: 192,
        three_yearly: 270,
        onetime: 10,
        reset_traffic: 10,
    });
});

it("实时嵌套负载和历史扁平数据均保留数值，内存高负载和从未上报状态正确", () => {
    expect(
        loadMetrics({
            cpu: 0,
            mem: { used: 90, total: 100 },
            disk: { used: 20, total: 100 },
        }),
    ).toMatchObject({ cpu: 0, mem_used: 90, mem_total: 100, disk_used: 20 });
    expect(loadMetrics({ mem_used: 0, mem_total: 100 })).toMatchObject({
        mem_used: 0,
        mem_total: 100,
    });
    expect(highLoad({ cpu: 20, mem: { used: 90, total: 100 } })).toBe(true);
    expect(highLoad({ cpu: 84 })).toBe(false);
    expect(machineState({ is_active: true, last_seen_at: null })).toBe("never");
});

it("编辑节点保留未知嵌套配置，切换协议不携带旧协议数据", () => {
    const module = moduleById("nodes");
    const row = {
        type: "vless",
        protocol_settings: {
            tls_settings: {
                server_name: "old.invalid",
                custom_tls_option: { enabled: true },
            },
            custom_extension: 7,
        },
    };
    const saved = module.savePayload!(
        {
            type: "vless",
            group_ids: [1],
            protocol_settings: { tls_settings: { server_name: "new.invalid" } },
        },
        row,
    );
    expect(saved.protocol_settings).toEqual({
        tls_settings: {
            server_name: "new.invalid",
            custom_tls_option: { enabled: true },
        },
        custom_extension: 7,
    });
    const changed = module.savePayload!(
        {
            type: "anytls",
            group_ids: [],
            protocol_settings: { padding_scheme: ["stop=8"] },
        },
        row,
    );
    expect(changed.protocol_settings).toEqual({ padding_scheme: ["stop=8"] });
});
