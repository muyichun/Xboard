import type { Row } from "./types";

export function canReviewCommission(order: Row) {
    return (
        Number(order.status) === 3 &&
        Number(order.commission_balance) > 0 &&
        order.commission_status != null &&
        Number(order.commission_status) === 0
    );
}
