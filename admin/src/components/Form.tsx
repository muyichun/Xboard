import { lazy, Suspense, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import type { Field, Row, Option } from "../lib/types";
import { request } from "../lib/api";
import { get, rowsOf, errorMessage } from "../lib/utils";
import { Button } from "./ui/button";
import { Loading, Notice } from "./Feedback";
function TagsInput({
    id,
    value,
    onChange,
}: {
    id: string;
    value: any;
    onChange: (v: string[]) => void;
}) {
    const [draft, setDraft] = useState(
        Array.isArray(value) ? value.join(", ") : value || "",
    );
    return (
        <input
            id={id}
            value={draft}
            onChange={(e) => {
                setDraft(e.target.value);
                onChange(
                    e.target.value
                        .split(/[,，]/)
                        .map((s) => s.trim())
                        .filter(Boolean),
                );
            }}
            placeholder="多个值用逗号分隔"
        />
    );
}
const Editor = lazy(() => import("./Editor"));
export const sourceEndpoints = {
    plans: "plan/fetch",
    groups: "server/group/fetch",
    machines: "server/machine/fetch",
    routes: "server/route/fetch",
    templates: "gift-card/templates",
};
export { initialValues, serializeValues } from "../lib/forms";
import { initialValues, serializeValues } from "../lib/forms";
export function OptionInput({
    field,
    value,
    onChange,
}: {
    field: Field;
    value: any;
    onChange: (v: any) => void;
}) {
    const q = useQuery({
        queryKey: ["options", field.source],
        queryFn: () =>
            request(sourceEndpoints[field.source!], { per_page: 1000 }),
        enabled: !!field.source,
        staleTime: 30000,
    });
    const choices: Option[] = [
        ...(field.options || []),
        ...(field.source
            ? rowsOf(q.data).map((r) => ({
                  value: r.id,
                  label: r.name || r.remarks || String(r.id),
              }))
            : []),
    ];
    if (field.kind === "multi") {
        return (
            <div className="multi-options">
                {q.isError && <span className="error">选项加载失败</span>}
                {choices.length === 0 ? (
                    <span className="muted">暂无可选项</span>
                ) : (
                    choices.map((o) => (
                        <label key={o.value}>
                            <input
                                type="checkbox"
                                checked={(value || [])
                                    .map(String)
                                    .includes(String(o.value))}
                                onChange={(e) =>
                                    onChange(
                                        e.target.checked
                                            ? [...(value || []), o.value]
                                            : (value || []).filter(
                                                  (v: any) =>
                                                      String(v) !==
                                                      String(o.value),
                                              ),
                                    )
                                }
                            />
                            {o.label}
                        </label>
                    ))
                )}
            </div>
        );
    }
    return (
        <select
            id={`field-${field.key}`}
            value={value ?? ""}
            onChange={(e) => {
                const o = choices.find(
                    (o) => String(o.value) === e.target.value,
                );
                onChange(o?.value ?? null);
            }}
        >
            <option value="">请选择</option>
            {value != null &&
                value !== "" &&
                !choices.some((o) => String(o.value) === String(value)) && (
                    <option value={value}>{String(value)}</option>
                )}
            {choices.map((o) => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
    );
}
export function Form({
    fields,
    seed = {},
    onSubmit,
    onCancel,
    submitLabel = "保存",
    children,
}: {
    fields: Field[];
    seed?: Row;
    onSubmit: (values: Row) => Promise<void>;
    onCancel?: () => void;
    submitLabel?: string;
    children?: React.ReactNode;
}) {
    const [error, setError] = useState("");
    const schema = useMemo(
        () =>
            z
                .object({})
                .passthrough()
                .superRefine((values, ctx) => {
                    fields.forEach((f) => {
                        if (f.show && !f.show(values)) return;
                        const v = get(values, f.key);
                        if (
                            f.required &&
                            (v === undefined ||
                                v === null ||
                                v === "" ||
                                (Array.isArray(v) && !v.length))
                        )
                            ctx.addIssue({
                                code: "custom",
                                path: f.key.split("."),
                                message: `请填写${f.label}`,
                            });
                        if (
                            ["number", "money", "bytes"].includes(
                                f.kind || "",
                            ) &&
                            v !== "" &&
                            v != null &&
                            (!Number.isFinite(Number(v)) ||
                                (f.min !== undefined && Number(v) < f.min))
                        )
                            ctx.addIssue({
                                code: "custom",
                                path: f.key.split("."),
                                message: `请输入${f.min === undefined ? "有效数字" : `不小于 ${f.min} 的数字`}`,
                            });
                        if (f.kind === "json" && v) {
                            try {
                                const parsed = JSON.parse(v);
                                if (
                                    f.default !== undefined &&
                                    typeof f.default === "object" &&
                                    (parsed === null ||
                                        typeof parsed !== "object" ||
                                        Array.isArray(parsed) !==
                                            Array.isArray(f.default))
                                )
                                    throw new Error("shape");
                            } catch {
                                ctx.addIssue({
                                    code: "custom",
                                    path: f.key.split("."),
                                    message: "请输入有效的 JSON",
                                });
                            }
                        }
                    });
                }),
        [fields],
    );
    const form = useForm<Row>({
        defaultValues: initialValues(fields, seed),
        resolver: zodResolver(schema) as any,
    });
    const values = form.watch();
    const groups = [...new Set(fields.map((f) => f.group || "基本信息"))];
    return (
        <form
            onSubmit={form.handleSubmit(async (v) => {
                setError("");
                try {
                    await onSubmit(serializeValues(fields, v));
                } catch (e) {
                    const server = (e as any)?.response?.data?.errors;
                    if (server)
                        Object.entries(server).forEach(([k, v]) =>
                            form.setError(k, {
                                message: Array.isArray(v)
                                    ? v.join("；")
                                    : String(v),
                            }),
                        );
                    setError(errorMessage(e));
                }
            })}
            className="edit-form"
        >
            <div className="form-body">
                <Notice message={error} error />
                {children}
                {groups.map((group, i) => (
                    <details
                        className="field-group"
                        open={i === 0 || groups.length < 3}
                        key={group}
                    >
                        <summary>{group}</summary>
                        <div className="form-grid">
                            {fields
                                .filter(
                                    (f) =>
                                        (f.group || "基本信息") === group &&
                                        (!f.show || f.show(values)),
                                )
                                .map((f) => (
                                    <div
                                        className={`field ${["textarea", "json", "code", "tags", "multi"].includes(f.kind || "") ? "field-wide" : ""}`}
                                        key={f.key}
                                    >
                                        <label htmlFor={`field-${f.key}`}>
                                            {f.label}
                                            {f.required && (
                                                <span className="required">
                                                    {" "}
                                                    *
                                                </span>
                                            )}
                                        </label>
                                        <Controller
                                            control={form.control}
                                            name={f.key}
                                            render={({ field }) => {
                                                const id = `field-${f.key}`;
                                                if (
                                                    f.kind === "select" ||
                                                    f.kind === "multi"
                                                )
                                                    return (
                                                        <div>
                                                            <OptionInput
                                                                field={f}
                                                                value={
                                                                    field.value
                                                                }
                                                                onChange={(
                                                                    v,
                                                                ) => {
                                                                    field.onChange(
                                                                        v,
                                                                    );
                                                                    if (
                                                                        f.key ===
                                                                            "type" &&
                                                                        fields.some(
                                                                            (
                                                                                x,
                                                                            ) =>
                                                                                x.key.startsWith(
                                                                                    "protocol_settings.",
                                                                                ),
                                                                        )
                                                                    ) {
                                                                        const defaults =
                                                                            initialValues(
                                                                                fields.filter(
                                                                                    (
                                                                                        x,
                                                                                    ) =>
                                                                                        x.key ===
                                                                                            "type" ||
                                                                                        x.key.startsWith(
                                                                                            "protocol_settings.",
                                                                                        ),
                                                                                ),
                                                                                {
                                                                                    type: v,
                                                                                },
                                                                            );
                                                                        form.setValue(
                                                                            "protocol_settings",
                                                                            defaults.protocol_settings ||
                                                                                {},
                                                                        );
                                                                        form.setValue(
                                                                            "__protocol_extra",
                                                                            "{}",
                                                                        );
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    );
                                                if (f.kind === "boolean")
                                                    return (
                                                        <label className="switch-line">
                                                            <input
                                                                id={id}
                                                                type="checkbox"
                                                                role="switch"
                                                                checked={
                                                                    !!field.value
                                                                }
                                                                onChange={(e) =>
                                                                    field.onChange(
                                                                        e.target
                                                                            .checked,
                                                                    )
                                                                }
                                                            />
                                                            <span>
                                                                {field.value
                                                                    ? "已开启"
                                                                    : "已关闭"}
                                                            </span>
                                                        </label>
                                                    );
                                                if (f.kind === "tags")
                                                    return (
                                                        <TagsInput
                                                            key={f.key}
                                                            id={id}
                                                            value={field.value}
                                                            onChange={
                                                                field.onChange
                                                            }
                                                        />
                                                    );
                                                if (f.kind === "code")
                                                    return (
                                                        <Suspense
                                                            fallback={
                                                                <Loading />
                                                            }
                                                        >
                                                            <Editor
                                                                value={
                                                                    field.value ||
                                                                    ""
                                                                }
                                                                onChange={
                                                                    field.onChange
                                                                }
                                                                language={
                                                                    f.language ||
                                                                    (f.key.includes(
                                                                        "singbox",
                                                                    )
                                                                        ? "json"
                                                                        : f.key.includes(
                                                                                "content",
                                                                            ) ||
                                                                            f.key.includes(
                                                                                "body",
                                                                            )
                                                                          ? "html"
                                                                          : "yaml")
                                                                }
                                                            />
                                                        </Suspense>
                                                    );
                                                if (
                                                    f.kind === "textarea" ||
                                                    f.kind === "json"
                                                )
                                                    return (
                                                        <textarea
                                                            id={id}
                                                            rows={
                                                                f.kind ===
                                                                "json"
                                                                    ? 8
                                                                    : 4
                                                            }
                                                            className={
                                                                f.kind ===
                                                                "json"
                                                                    ? "code-input"
                                                                    : ""
                                                            }
                                                            {...field}
                                                            value={
                                                                field.value ??
                                                                ""
                                                            }
                                                        />
                                                    );
                                                return (
                                                    <input
                                                        id={id}
                                                        name={field.name}
                                                        ref={field.ref}
                                                        onBlur={field.onBlur}
                                                        type={
                                                            f.kind ===
                                                            "datetime"
                                                                ? "datetime-local"
                                                                : f.kind ===
                                                                    "date"
                                                                  ? "date"
                                                                  : f.kind ===
                                                                      "password"
                                                                    ? "password"
                                                                    : [
                                                                            "number",
                                                                            "money",
                                                                            "bytes",
                                                                        ].includes(
                                                                            f.kind ||
                                                                                "",
                                                                        )
                                                                      ? "number"
                                                                      : "text"
                                                        }
                                                        step="any"
                                                        min={f.min}
                                                        value={
                                                            field.value ?? ""
                                                        }
                                                        onChange={(e) =>
                                                            field.onChange(
                                                                [
                                                                    "number",
                                                                    "money",
                                                                    "bytes",
                                                                ].includes(
                                                                    f.kind ||
                                                                        "",
                                                                )
                                                                    ? e.target
                                                                          .value ===
                                                                      ""
                                                                        ? ""
                                                                        : Number(
                                                                              e
                                                                                  .target
                                                                                  .value,
                                                                          )
                                                                    : e.target
                                                                          .value,
                                                            )
                                                        }
                                                        autoComplete={
                                                            f.kind ===
                                                            "password"
                                                                ? "new-password"
                                                                : "off"
                                                        }
                                                    />
                                                );
                                            }}
                                        />
                                        {f.hint && <small>{f.hint}</small>}
                                        {get(form.formState.errors, f.key)
                                            ?.message && (
                                            <small
                                                role="alert"
                                                className="error"
                                            >
                                                {String(
                                                    get(
                                                        form.formState.errors,
                                                        f.key,
                                                    ).message,
                                                )}
                                            </small>
                                        )}
                                    </div>
                                ))}
                        </div>
                    </details>
                ))}
            </div>
            <footer className="form-footer">
                {onCancel && (
                    <Button type="button" variant="outline" onClick={onCancel}>
                        取消
                    </Button>
                )}
                <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "正在提交…" : submitLabel}
                </Button>
            </footer>
        </form>
    );
}
