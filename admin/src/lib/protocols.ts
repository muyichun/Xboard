// Mieru traffic_pattern is a Base64 encoded protobuf message, not arbitrary bytes.
export function mieruPattern(
    min = 100 + Math.floor(Math.random() * 101),
    max = 400 + Math.floor(Math.random() * 201),
) {
    const varint = (n: number) => {
        const out: number[] = [];
        while (n >= 128) {
            out.push((n & 127) | 128);
            n >>>= 7;
        }
        out.push(n);
        return out;
    };
    const range = [8, ...varint(min), 16, ...varint(max)];
    return btoa(String.fromCharCode(10, ...varint(range.length), ...range));
}
export function legacyPrices(base: number, discount?: number) {
    return Object.fromEntries(
        Object.entries({
            monthly: [1, 1],
            quarterly: [3, 0.95],
            half_yearly: [6, 0.9],
            yearly: [12, 0.85],
            two_yearly: [24, 0.8],
            three_yearly: [36, 0.75],
            onetime: [1, 1],
            reset_traffic: [1, 1],
        }).map(([key, [months, rate]]) => [
            key,
            Math.round(
                base *
                    months *
                    (discount === undefined
                        ? rate
                        : months === 1
                          ? 1
                          : discount / 100) *
                    100,
            ) / 100,
        ]),
    );
}
