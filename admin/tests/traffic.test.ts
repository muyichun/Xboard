import { describe, it, expect } from "vitest";
import { bytes } from "../src/lib/utils";
import { trafficDate, trafficUsage } from "../src/lib/traffic";

describe("用户流量明细", () => {
    it("使用熟悉的单位且保持1024换算", () => {
        expect([0, 1024, 1024 ** 2, 1.5 * 1024 ** 3].map(bytes)).toEqual([
            "0 B",
            "1 KB",
            "1 MB",
            "1.5 GB",
        ]);
    });
    it("历史倍率折算不足1字节时仍使用B单位", () => {
        expect(bytes(0.5)).toBe("0.5 B");
    });
    it("新明细的实际用量不除倍率，计费量不重复乘倍率", () => {
        expect(
            trafficUsage(
                {
                    u: 112,
                    d: 216,
                    billed_u: 167,
                    billed_d: 323,
                    server_rate: 1.5,
                },
                true,
            ),
        ).toEqual({ upload: 112, download: 216, billed: 490 });
        expect(
            trafficUsage(
                { u: 4096, d: 8192, billed_u: 0, billed_d: 0, server_rate: 0 },
                true,
            ),
        ).toEqual({ upload: 4096, download: 8192, billed: 0 });
    });
    it("旧记录按倍率折算，无法还原的零倍率不伪造实际用量", () => {
        expect(trafficUsage({ u: 300, d: 600, server_rate: 3 }, false)).toEqual(
            { upload: 100, download: 200, billed: 900 },
        );
        expect(
            trafficUsage({ u: 0, d: 0, server_rate: 0 }, false).upload,
        ).toBeNull();
    });
    it("日期和秒级时间按统计时区展示，不受浏览器时区影响", () => {
        const timestamp = Date.parse("2026-11-26T16:00:09Z") / 1000;
        expect(trafficDate(timestamp, "Asia/Shanghai")).toBe("2026-11-27");
        expect(trafficDate(timestamp, "Asia/Shanghai", true)).toBe("00:00:09");
    });
});
