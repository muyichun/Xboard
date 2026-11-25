import {
    useMutation,
    useMutationState,
    useQueryClient,
} from "@tanstack/react-query";
import type { Row } from "./types";
import { errorMessage } from "./utils";

type Change = { id: number; field: string; value: 0 | 1 };

export function useRowToggle(
    scope: string,
    save: (change: Change) => Promise<void>,
    setError: (message: string) => void,
) {
    const client = useQueryClient();
    const mutationKey = ["row-toggle", scope];
    const pendingIds = useMutationState({
        filters: { mutationKey, status: "pending" },
        select: (mutation) => (mutation.state.variables as Change).id,
    });
    const { mutate } = useMutation({
        mutationKey,
        mutationFn: save,
        onError: (error) => setError(errorMessage(error)),
    });

    function toggle(row: Row, field: string) {
        const id = row.id;
        if (
            client.isMutating({
                mutationKey,
                predicate: (mutation) =>
                    (mutation.state.variables as Change).id === id,
            })
        )
            return;
        setError("");
        mutate({ id, field, value: Number(row[field]) === 1 ? 0 : 1 });
    }
    return { pendingIds: new Set(pendingIds), toggle };
}
