import { Combobox } from "@base-ui/react/combobox";
import { useNavigate } from "react-router-dom";
import { Dialog } from "./ui/dialog";

export type CommandLink = {
    id: string;
    title: string;
    path: string;
};

export default function CommandSearch({
    open,
    onClose,
    links,
}: {
    open: boolean;
    onClose: () => void;
    links: CommandLink[];
}) {
    const navigate = useNavigate();
    return (
        <Dialog open={open} onClose={onClose} title="搜索菜单和功能">
            <div className="command-body">
                <Combobox.Root<CommandLink>
                    inline
                    autoHighlight
                    highlightItemOnHover={false}
                    items={links}
                    itemToStringLabel={(item) => item.title}
                    filter={(item, text) => {
                        const query = text.trim().toLowerCase();
                        return (
                            item.title.toLowerCase().includes(query) ||
                            item.path.toLowerCase().includes(query)
                        );
                    }}
                    onValueChange={(item) => {
                        if (!item) return;
                        onClose();
                        navigate(item.path);
                    }}
                >
                    <Combobox.Input
                        autoFocus
                        aria-label="搜索菜单和功能"
                        placeholder="搜索菜单和功能..."
                    />
                    <Combobox.Empty className="command-empty">
                        没有找到匹配的菜单或功能
                    </Combobox.Empty>
                    <Combobox.List className="command-results">
                        {(item: CommandLink) => (
                            <Combobox.Item key={item.id} value={item}>
                                {item.title}
                            </Combobox.Item>
                        )}
                    </Combobox.List>
                </Combobox.Root>
            </div>
        </Dialog>
    );
}
