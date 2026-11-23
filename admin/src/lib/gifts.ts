import type { Row } from "./types";
const effective = (r: Row) =>
    [
        "balance",
        "transfer_enable",
        "expire_days",
        "device_limit",
        "plan_id",
    ].some((k) => Number(r[k]) > 0) || !!r.reset_package;
const amounts = [
    "balance",
    "transfer_enable",
    "expire_days",
    "device_limit",
    "plan_id",
    "plan_validity_days",
];
export function giftPayload(v: Row, r: Row) {
    const rewards = {
        ...(r.type == null || Number(r.type) === Number(v.type)
            ? r.rewards
            : {}),
        ...v.rewards,
    };
    for (const key of amounts) {
        const value = rewards[key];
        if (value == null || value === "" || Number(value) === 0)
            delete rewards[key];
        else if (!Number.isFinite(Number(value)) || Number(value) < 0)
            throw new Error("奖励数值必须为正数");
    }
    if (!rewards.reset_package) delete rewards.reset_package;
    if (Number(v.type) === 2 && !rewards.plan_id)
        throw new Error("套餐礼品卡必须选择赠送套餐");
    if (Number(v.type) === 3) {
        if (
            !Array.isArray(rewards.random_rewards) ||
            !rewards.random_rewards.length ||
            rewards.random_rewards.some(
                (x: Row) =>
                    !Number.isInteger(Number(x.weight)) ||
                    Number(x.weight) <= 0 ||
                    !effective(x),
            )
        )
            throw new Error(
                "盲盒至少包含一项奖励，每项必须有正整数权重和有效奖励",
            );
    } else delete rewards.random_rewards;
    if (!effective(rewards) && Number(v.type) !== 3)
        throw new Error("请至少设置一项奖励");
    return {
        ...v,
        rewards,
        conditions: {
            ...r.conditions,
            ...v.conditions,
            allowed_plans: v.conditions?.allowed_plans?.length
                ? v.conditions.allowed_plans
                : null,
        },
        limits: { ...r.limits, ...v.limits },
        special_config: { ...r.special_config, ...v.special_config },
    };
}
