import { Eye, EyeOff } from "lucide-react";

export default function VisibilitySwitch({
    visible,
    label,
    onChange,
    id,
    disabled,
}: {
    visible: boolean;
    label: string;
    onChange: () => void;
    id?: string;
    disabled?: boolean;
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
            onClick={onChange}
            disabled={disabled}
        >
            <Icon size={17} aria-hidden="true" />
        </button>
    );
}
