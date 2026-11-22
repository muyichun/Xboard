import { Dialog as Primitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./button";
export function Dialog({
    open,
    onClose,
    title,
    description,
    children,
    wide = false,
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children: ReactNode;
    wide?: boolean;
}) {
    return (
        <Primitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
            <Primitive.Portal>
                <Primitive.Backdrop className="dialog-backdrop" />
                <Primitive.Popup
                    className={`dialog ${wide ? "dialog-wide" : ""}`}
                >
                    <header className="dialog-header">
                        <div>
                            <Primitive.Title>{title}</Primitive.Title>
                            {description && (
                                <Primitive.Description>
                                    {description}
                                </Primitive.Description>
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label="关闭"
                            onClick={onClose}
                        >
                            <X size={20} />
                        </Button>
                    </header>
                    {children}
                </Primitive.Popup>
            </Primitive.Portal>
        </Primitive.Root>
    );
}
