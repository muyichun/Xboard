import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";
import type { ComponentProps } from "react";
const styles = cva("button", {
    variants: {
        variant: {
            default: "button-primary",
            outline: "button-outline",
            ghost: "button-ghost",
            destructive: "button-danger",
        },
        size: { default: "", sm: "button-sm", icon: "button-icon" },
    },
    defaultVariants: { variant: "default", size: "default" },
});
export function Button({
    className,
    variant = "default",
    size = "default",
    ...props
}: ComponentProps<typeof ButtonPrimitive> & {
    variant?: "default" | "outline" | "ghost" | "destructive";
    size?: "default" | "sm" | "icon";
}) {
    return (
        <ButtonPrimitive
            className={cn(styles({ variant, size }), className)}
            {...props}
        />
    );
}
