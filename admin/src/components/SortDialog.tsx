import { useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import type { Row } from "../lib/types";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { Notice } from "./Feedback";
import { errorMessage } from "../lib/utils";
export function SortDialog({
    rows,
    onSave,
    onClose,
}: {
    rows: Row[];
    onSave: (rows: Row[]) => Promise<void>;
    onClose: () => void;
}) {
    const [order, setOrder] = useState(rows),
        [error, setError] = useState(""),
        [busy, setBusy] = useState(false);
    function move(i: number, d: number) {
        const next = [...order];
        [next[i], next[i + d]] = [next[i + d], next[i]];
        setOrder(next);
    }
    return (
        <Dialog open onClose={onClose} title="调整显示顺序">
            <Notice error message={error} />
            <div className="sort-list">
                {order.map((r, i) => (
                    <div key={r.id}>
                        <span>{r.name || r.title || r.id}</span>
                        <Button
                            aria-label="上移"
                            variant="ghost"
                            size="icon"
                            disabled={i === 0}
                            onClick={() => move(i, -1)}
                        >
                            <ArrowUp size={16} />
                        </Button>
                        <Button
                            aria-label="下移"
                            variant="ghost"
                            size="icon"
                            disabled={i === order.length - 1}
                            onClick={() => move(i, 1)}
                        >
                            <ArrowDown size={16} />
                        </Button>
                    </div>
                ))}
            </div>
            <footer className="form-footer">
                <Button
                    disabled={busy}
                    onClick={async () => {
                        setBusy(true);
                        try {
                            await onSave(order);
                            onClose();
                        } catch (e) {
                            setError(errorMessage(e));
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    保存排序
                </Button>
            </footer>
        </Dialog>
    );
}
