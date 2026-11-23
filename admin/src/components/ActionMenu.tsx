import { Menu } from "@base-ui/react/menu";
import { MoreHorizontal } from "lucide-react";
export function ActionMenu({
    label,
    items,
}: {
    label: string;
    items: { label: string; onClick: () => void; danger?: boolean }[];
}) {
    return (
        <Menu.Root>
            <Menu.Trigger
                className="button button-ghost button-icon"
                aria-label={label}
            >
                <MoreHorizontal size={18} />
            </Menu.Trigger>
            <Menu.Portal>
                <Menu.Positioner sideOffset={4} align="end">
                    <Menu.Popup className="action-menu-popup">
                        {items.map((item) => (
                            <Menu.Item
                                key={item.label}
                                className={item.danger ? "error" : ""}
                                onClick={item.onClick}
                            >
                                {item.label}
                            </Menu.Item>
                        ))}
                    </Menu.Popup>
                </Menu.Positioner>
            </Menu.Portal>
        </Menu.Root>
    );
}
