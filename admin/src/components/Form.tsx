import VisibilitySwitch from "./VisibilitySwitch";
import Markdown from "./Markdown";
import { Tags, Rewards, TimeRanges } from "../legacy/FormControls";
import FieldActions, { ParentInput } from "../legacy/FieldActions";
import { lazy, Suspense, useMemo, useState, useRef, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import type { Field, Row, Option } from "../lib/types";
import { request } from "../lib/api";
import { get, rowsOf, errorMessage } from "../lib/utils";
import { Button } from "./ui/button";
import { Loading, Notice } from "./Feedback";
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
    id,
    field,
    value,
    onChange,
}: {
    id?: string;
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
        value = Array.isArray(value)
            ? value
            : value == null || value === ""
              ? []
              : [value];
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
            id={id}
            aria-label={id ? undefined : field.label}
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
    afterFields,
    onDraft,
    autoSave = false,
    expanded = false,
}: {
    fields: Field[];
    seed?: Row;
    onSubmit: (values: Row) => Promise<void>;
    onCancel?: () => void;
    submitLabel?: string;
    children?: React.ReactNode;
    afterFields?: React.ReactNode;
    onDraft?: (v: Row) => void;
    autoSave?: boolean;
    expanded?: boolean;
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
                        if (
                            f.max !== undefined &&
                            v !== "" &&
                            v != null &&
                            Number(v) > f.max
                        )
                            ctx.addIssue({
                                code: "custom",
                                path: f.key.split("."),
                                message: `最大值为 ${f.max}`,
                            });
                        if (
                            typeof v === "string" &&
                            ((f.minLength !== undefined &&
                                v.length < f.minLength) ||
                                (f.maxLength !== undefined &&
                                    v.length > f.maxLength))
                        )
                            ctx.addIssue({
                                code: "custom",
                                path: f.key.split("."),
                                message: `请输入 ${f.minLength || 0}–${f.maxLength || "不限"} 个字符`,
                            });
                        if (
                            (f.kind === "json" ||
                                (f.kind === "code" && f.language === "json")) &&
                            v
                        ) {
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
    const protocolDrafts = useRef<Record<string, Row>>({});
    const lastDraft = useRef("");
    const onDraftRef = useRef(onDraft);
    onDraftRef.current = onDraft;
    const saveRef = useRef(onSubmit);
    saveRef.current = onSubmit;
    const lastSaved = useRef(JSON.stringify(values));
    const saving = useRef(false);
    const [saveStatus, setSaveStatus] = useState(""),
        [saveTick, setSaveTick] = useState(0);
    const signature = JSON.stringify(values);
    useEffect(() => {
        if (signature !== lastDraft.current) {
            lastDraft.current = signature;
            onDraftRef.current?.(values);
        }
    }, [signature]);
    useEffect(() => {
        if (!autoSave || signature === lastSaved.current) return;
        setSaveStatus("等待保存");
        const timer = setTimeout(async () => {
            if (saving.current) return;
            if (!(await form.trigger())) return;
            saving.current = true;
            setSaveStatus("保存中...");
            setError("");
            try {
                await saveRef.current(
                    serializeValues(fields, JSON.parse(signature)),
                );
                lastSaved.current = signature;
                setSaveStatus("自动保存成功");
            } catch (e) {
                setError(errorMessage(e));
                setSaveStatus("保存失败，请点击保存重试");
                lastSaved.current = signature;
            } finally {
                saving.current = false;
                setSaveTick((n) => n + 1);
            }
        }, 1500);
        return () => clearTimeout(timer);
    }, [signature, autoSave, saveTick]);
    const Group = expanded ? "section" : "details";
    const Heading = expanded ? "h3" : "summary";
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
                {autoSave && (
                    <div className="autosave-status" role="status">
                        {saveStatus || "修改后自动保存"}
                    </div>
                )}
                {children}
                {groups.map((group, i) => (
                    <Group
                        className="field-group"
                        open={
                            expanded ? undefined : i === 0 || groups.length < 3
                        }
                        key={group}
                    >
                        <Heading>{group}</Heading>
                        <div className="form-grid">
                            {fields
                                .filter(
                                    (f) =>
                                        (f.group || "基本信息") === group &&
                                        (!f.show || f.show(values)),
                                )
                                .map((f) => (
                                    <div
                                        className={`field ${["textarea", "json", "code", "tags", "multi", "lines", "markdown", "rewards", "time-ranges", "env"].includes(f.kind || "") ? "field-wide" : ""}`}
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
                                                if (f.key === "parent_id")
                                                    return (
                                                        <ParentInput
                                                            value={field.value}
                                                            values={values}
                                                            onChange={(
                                                                id,
                                                                rate,
                                                            ) => {
                                                                field.onChange(
                                                                    id,
                                                                );
                                                                if (
                                                                    rate != null
                                                                )
                                                                    form.setValue(
                                                                        "rate",
                                                                        rate,
                                                                    );
                                                            }}
                                                        />
                                                    );
                                                if (f.kind === "markdown")
                                                    return (
                                                        <Markdown
                                                            id={id}
                                                            value={
                                                                field.value ||
                                                                ""
                                                            }
                                                            onChange={
                                                                field.onChange
                                                            }
                                                        />
                                                    );
                                                if (f.kind === "rewards")
                                                    return (
                                                        <Rewards
                                                            value={field.value}
                                                            onChange={
                                                                field.onChange
                                                            }
                                                        />
                                                    );
                                                if (f.kind === "time-ranges")
                                                    return (
                                                        <TimeRanges
                                                            value={field.value}
                                                            onChange={
                                                                field.onChange
                                                            }
                                                        />
                                                    );
                                                if (
                                                    f.kind === "lines" ||
                                                    f.kind === "env"
                                                )
                                                    return (
                                                        <textarea
                                                            id={id}
                                                            rows={5}
                                                            value={
                                                                field.value ||
                                                                ""
                                                            }
                                                            onChange={
                                                                field.onChange
                                                            }
                                                        />
                                                    );
                                                if (
                                                    f.kind === "select" ||
                                                    f.kind === "multi"
                                                )
                                                    return (
                                                        <div>
                                                            <OptionInput
                                                                id={id}
                                                                field={
                                                                    f.key ===
                                                                        "protocol_settings.tls" &&
                                                                    ![
                                                                        "vless",
                                                                        "trojan",
                                                                    ].includes(
                                                                        values.type,
                                                                    )
                                                                        ? {
                                                                              ...f,
                                                                              options:
                                                                                  f.options?.filter(
                                                                                      (
                                                                                          o,
                                                                                      ) =>
                                                                                          String(
                                                                                              o.value,
                                                                                          ) !==
                                                                                          "2",
                                                                                  ),
                                                                          }
                                                                        : f
                                                                }
                                                                value={
                                                                    field.value
                                                                }
                                                                onChange={(
                                                                    v,
                                                                ) => {
                                                                    if (
                                                                        f.key ===
                                                                            "type" &&
                                                                        values.protocol_settings
                                                                    )
                                                                        protocolDrafts.current[
                                                                            values.type
                                                                        ] = {
                                                                            protocol_settings:
                                                                                structuredClone(
                                                                                    values.protocol_settings,
                                                                                ),
                                                                            extra: values.__protocol_extra,
                                                                        };
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
                                                                            protocolDrafts
                                                                                .current[
                                                                                String(
                                                                                    v,
                                                                                )
                                                                            ]
                                                                                ?.protocol_settings ||
                                                                                defaults.protocol_settings ||
                                                                                {},
                                                                        );
                                                                        form.setValue(
                                                                            "__protocol_extra",
                                                                            protocolDrafts
                                                                                .current[
                                                                                String(
                                                                                    v,
                                                                                )
                                                                            ]
                                                                                ?.extra ||
                                                                                "{}",
                                                                        );
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    );
                                                if (f.kind === "visibility")
                                                    return (
                                                        <VisibilitySwitch
                                                            id={id}
                                                            visible={
                                                                Number(
                                                                    field.value,
                                                                ) === 1
                                                            }
                                                            label={f.label}
                                                            onChange={() =>
                                                                field.onChange(
                                                                    Number(
                                                                        field.value,
                                                                    ) !== 1,
                                                                )
                                                            }
                                                        />
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
                                                        <Tags
                                                            id={id}
                                                            reservedTag={
                                                                f.reservedTag
                                                            }
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
                                                        disabled={
                                                            f.key === "rate" &&
                                                            !!values.parent_id
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
                                        <FieldActions
                                            field={f}
                                            form={form}
                                            values={values}
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
                    </Group>
                ))}
                {afterFields}
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
