import { Popover } from "@base-ui/react/popover";
import type { ReactNode } from "react";

export function HeaderPopover({
    label,
    trigger,
    triggerClassName,
    open,
    onOpenChange,
    children,
    account,
}: {
    label: string;
    trigger: ReactNode;
    triggerClassName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: ReactNode;
    account?: boolean;
}) {
    return (
        <Popover.Root open={open} onOpenChange={onOpenChange}>
            <Popover.Trigger className={triggerClassName} aria-label={label}>
                {trigger}
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Positioner
                    className="header-menu"
                    sideOffset={6}
                    align="end"
                >
                    <Popover.Popup
                        className={`header-menu-panel${account ? " account-menu" : ""}`}
                        aria-label={label}
                    >
                        {children}
                    </Popover.Popup>
                </Popover.Positioner>
            </Popover.Portal>
        </Popover.Root>
    );
}
