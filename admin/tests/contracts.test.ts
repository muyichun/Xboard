import { describe, it, expect } from "vitest";
import { initialValues, serializeValues } from "../src/lib/forms";
import { queryParams } from "../src/lib/list";
import { giftPayload } from "../src/lib/gifts";
import { moduleById } from "../src/modules/registry";
import { nodeFields, nodeTypes } from "../src/modules/fields";
import { dynamicFields, dynamicValues } from "../src/modules/settings";
import { rowsOf, countOf } from "../src/lib/utils";
describe("金额、流量与时间接口契约", () => {
    it("用户列表余额是元，保存不再乘100，邀请关系保持", () => {
        const m = moduleById("users")!;
        const row = {
            email: "member@example.invalid",
            balance: 123.45,
            commission_balance: 6.78,
            transfer_enable: 100 * 1024 ** 3,
            u: 1024 ** 3,
            d: 2 * 1024 ** 3,
            expired_at: 1800000000,
            invite_user: { email: "inviter@example.invalid" },
        };
        const value = serializeValues(
            m.fields!,
            initialValues(m.fields!, m.editSeed!(row)),
        );
        expect(value).toMatchObject({
            balance: 123.45,
            commission_balance: 6.78,
            transfer_enable: row.transfer_enable,
            u: row.u,
            d: row.d,
            invite_user_email: "inviter@example.invalid",
        });
        expect(Math.abs(value.expired_at - row.expired_at)).toBeLessThan(60);
        expect(value.password).toBeUndefined();
    });
    it("订单金额按分提交，套餐价格按元提交", () => {
        const order = moduleById("orders")!;
        expect(
            serializeValues(order.create!.fields!, {
                email: "a@b.invalid",
                plan_id: 1,
                period: "month_price",
                total_amount: 9.9,
            }).total_amount,
        ).toBe(990);
        const m = moduleById("plans")!;
        expect(
            m.savePayload!({ prices: { monthly: 9.9, yearly: null } }, {})
                .prices,
        ).toEqual({ monthly: 9.9 });
    });
    it("单个账号不携带生成数量，批量账号保留数量", () => {
        const action = moduleById("users")!.create!;
        const seed = initialValues(action.fields!, {});
        const single = serializeValues(action.fields!, {
            ...seed,
            email_prefix: "alice",
            email_suffix: "example.invalid",
        });
        expect(action.payload!(single, {})).toMatchObject({
            email_prefix: "alice",
        });
        expect(action.payload!(single, {})).not.toHaveProperty(
            "generate_count",
        );
        expect(
            action.payload!(
                { ...single, __mode: "batch", generate_count: 3 },
                {},
            ),
        ).toHaveProperty("generate_count", 3);
    });
    it("优惠券使用新周期键，订单沿用旧周期键", () => {
        expect(
            moduleById("coupons")!
                .fields!.find((f) => f.key === "limit_period")!
                .options!.map((o) => o.value),
        ).toContain("monthly");
        expect(
            moduleById("orders")!
                .create!.fields!.find((f) => f.key === "period")!
                .options!.map((o) => o.value),
        ).toContain("month_price");
    });
});
describe("所有节点协议初始化与未知配置保留", () => {
    for (const type of Object.keys(nodeTypes))
        it(type, () => {
            const v = serializeValues(
                nodeFields,
                initialValues(nodeFields, { type }),
            );
            expect(v.type).toBe(type);
            expect(v.protocol_settings).toBeDefined();
            if (["hysteria", "tuic", "anytls"].includes(type))
                expect(v.protocol_settings.tls).toEqual({});
            if (["vless", "vmess", "trojan"].includes(type))
                expect(v.protocol_settings.tls).toBe(1);
            if (type === "tuic") expect(v.protocol_settings.version).toBe(5);
        });
    it("编辑保留扩展字段，专用字段优先且权限组转为字符串", () => {
        const m = moduleById("nodes")!;
        const row = {
            type: "vless",
            group_ids: [1, 2],
            protocol_settings: {
                network: "ws",
                tls: 2,
                custom_feature: { enabled: true },
            },
        };
        const seed = m.editSeed!(row);
        expect(seed.__protocol_extra).toEqual({
            custom_feature: { enabled: true },
        });
        const values = serializeValues(
            nodeFields,
            initialValues(nodeFields, seed),
        );
        values.protocol_settings.network = "grpc";
        expect(m.savePayload!(values, row)).toMatchObject({
            group_ids: ["1", "2"],
            protocol_settings: {
                network: "grpc",
                tls: 2,
                custom_feature: { enabled: true },
            },
        });
        expect(m.savePayload!(values, row)).not.toHaveProperty(
            "__protocol_extra",
        );
    });
});
describe("礼品卡有效奖励", () => {
    it("余额卡不携带会误触发套餐要求的空奖励", () => {
        const result = giftPayload(
            {
                type: 1,
                rewards: {
                    balance: 100,
                    reset_package: false,
                    expire_days: null,
                    transfer_enable: 0,
                },
                conditions: { allowed_plans: [] },
            },
            {},
        );
        expect(result.rewards).toEqual({ balance: 100 });
        expect(result.conditions.allowed_plans).toBeNull();
    });
    it("拒绝空奖励、负数、空套餐和无效盲盒", () => {
        for (const v of [
            { type: 1, rewards: {} },
            { type: 1, rewards: { balance: -1 } },
            { type: 2, rewards: { balance: 1 } },
            { type: 3, rewards: { random_rewards: [] } },
            {
                type: 3,
                rewards: { random_rewards: [{ weight: 0.1, balance: 5 }] },
            },
        ])
            expect(() => giftPayload(v, {})).toThrow();
    });
    it("合法盲盒保持原始金额和未知扩展", () => {
        expect(
            giftPayload(
                {
                    type: 3,
                    rewards: { random_rewards: [{ weight: 1, balance: 100 }] },
                },
                { rewards: { future_reward: 2 } },
            ).rewards,
        ).toEqual({
            future_reward: 2,
            random_rewards: [{ weight: 1, balance: 100 }],
        });
    });
});
describe("列表筛选和响应适配", () => {
    it("跨页筛选与搜索组合，不丢失零值条件", () => {
        const p = queryParams(moduleById("users")!, 2, 50, "demo", {}, null, [
            { key: "banned", operator: "eq", value: "0" },
        ]);
        expect(p).toMatchObject({
            current: 2,
            pageSize: 50,
            filter: [
                { id: "email", value: "demo" },
                { id: "banned", value: "eq:0" },
            ],
        });
    });
    it("工单邮箱是独立参数，状态0需保留", () => {
        expect(
            queryParams(
                moduleById("tickets")!,
                1,
                20,
                "a@b.invalid",
                { status: 0 },
                null,
            ),
        ).toMatchObject({ email: "a@b.invalid", status: 0 });
    });
    it("优惠券等值筛选使用数组而非操作符", () => {
        expect(
            queryParams(moduleById("coupons")!, 1, 20, "", {}, null, [
                { key: "type", operator: "eq", value: "1" },
            ]).filter,
        ).toEqual([{ id: "type", value: ["1"] }]);
    });
    it("礼品卡使用page/per_page，审计使用page_size", () => {
        expect(
            queryParams(moduleById("gift-codes")!, 2, 50, "", {}, null),
        ).toEqual({ page: 2, per_page: 50 });
        expect(queryParams(moduleById("audit")!, 2, 50, "", {}, null)).toEqual({
            current: 2,
            page_size: 50,
        });
    });
    it("适配三类列表包裹", () => {
        for (const r of [
            [{ id: 1 }],
            { data: [{ id: 1 }] },
            { data: { data: [{ id: 1 }], total: 3 } },
        ])
            expect(rowsOf(r)).toEqual([{ id: 1 }]);
        expect(countOf({ data: [{}], pagination: { total: 100 } })).toBe(100);
    });
    it("动态JSON配置以字符串编辑并保持false/0", () => {
        const schema = {
            a: { type: "json", value: { x: 1 } },
            b: { type: "boolean", value: false },
            c: { type: "number", value: 0 },
        };
        expect(dynamicValues(schema)).toEqual({
            a: '{\n  "x": 1\n}',
            b: false,
            c: 0,
        });
        expect(dynamicFields(schema).map((f) => f.kind)).toEqual([
            "code",
            "boolean",
            "number",
        ]);
    });
});

it("节点批量操作不会隐式停用或解绑", () => {
    const a = moduleById("nodes")!.bulk![0];
    expect(
        a.payload!(
            { ids: [1], show: 1, enabled: null, __machineMode: "keep" },
            {},
        ),
    ).toEqual({ ids: [1], show: 1 });
    expect(
        a.payload!(
            { ids: [1], show: null, enabled: null, __machineMode: "clear" },
            {},
        ),
    ).toEqual({ ids: [1], machine_id: null });
    expect(() =>
        a.payload!(
            { ids: [1], show: null, enabled: null, __machineMode: "keep" },
            {},
        ),
    ).toThrow();
});
it("套餐天数不算独立奖励，套餐倍率由后端仅作用于奖励数量", () => {
    expect(() =>
        giftPayload({ type: 1, rewards: { plan_validity_days: 30 } }, {}),
    ).toThrow();
    expect(
        giftPayload(
            {
                type: 2,
                rewards: { plan_id: 3 },
                special_config: { festival_bonus: 2 },
            },
            {},
        ).rewards.plan_id,
    ).toBe(3);
});
