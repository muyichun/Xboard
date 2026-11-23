import { marked } from "marked";
import { useRef, useState } from "react";
import DOMPurify from "dompurify";
import { Button } from "./ui/button";
// Markdown is never trusted HTML, including plugin-provided README content.
export function markdownHtml(text: string) {
    return DOMPurify.sanitize(
        marked.parse(text, { async: false, gfm: true, breaks: true }),
    );
}
export function MarkdownView({ value }: { value: string }) {
    return (
        <div
            className="markdown-view"
            dangerouslySetInnerHTML={{ __html: markdownHtml(value) }}
        />
    );
}
export default function Markdown({
    id,
    value,
    onChange,
}: {
    id: string;
    value: string;
    onChange: (v: string) => void;
}) {
    const [preview, setPreview] = useState(false),
        ref = useRef<HTMLTextAreaElement>(null);
    function wrap(before: string, after = "") {
        const t = ref.current,
            start = t?.selectionStart || 0,
            end = t?.selectionEnd || 0;
        onChange(
            value.slice(0, start) +
                before +
                (value.slice(start, end) || "文字") +
                after +
                value.slice(end),
        );
        setTimeout(() => ref.current?.focus(), 0);
    }
    return (
        <div className="markdown-editor">
            <div className="toolbar">
                {[
                    ["B", "**", "**"],
                    ["I", "*", "*"],
                    ["标题", "## ", ""],
                    ["链接", "[", "](https://example.com)"],
                    ["列表", "- ", ""],
                    ["代码", "`", "`"],
                    ["引用", "> ", ""],
                ].map(([label, start, end]) => (
                    <Button
                        key={label}
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={preview}
                        onClick={() => wrap(start, end)}
                    >
                        {label}
                    </Button>
                ))}
                <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setPreview(!preview)}
                >
                    {preview ? "编辑" : "预览"}
                </Button>
            </div>
            {preview ? (
                <MarkdownView value={value} />
            ) : (
                <textarea
                    ref={ref}
                    id={id}
                    rows={9}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            )}
        </div>
    );
}
