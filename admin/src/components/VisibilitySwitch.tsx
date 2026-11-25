import { Eye, EyeOff } from "lucide-react";

export default function VisibilitySwitch({
    visible,
    label,
    onChange,
    id,
    disabled,
    pending,
}: {
    visible: boolean;
    label: string;
    onChange: () => void;
    id?: string;
    disabled?: boolean;
    pending?: boolean;
}) {
    const Icon = visible ? Eye : EyeOff;
    return (
        <button
            id={id}
            type="button"
            className="visibility-switch"
            role="switch"
            aria-checked={visible}
            aria-label={label}
            title={visible ? "已显示，点击隐藏" : "已隐藏，点击显示"}
            aria-busy={pending || undefined}
            aria-disabled={pending || undefined}
            onClick={pending ? undefined : onChange}
            disabled={disabled}
        >
            <Icon size={17} aria-hidden="true" />
        </button>
    );
}
