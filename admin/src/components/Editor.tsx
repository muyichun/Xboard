import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/editor/editor.api.js";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import JsonWorker from "monaco-editor/language/json/json.worker?worker";
(self as any).MonacoEnvironment = {
    getWorker: (_: string, label: string) =>
        label === "json" ? new JsonWorker() : new EditorWorker(),
};
loader.config({ monaco });
export default function CodeEditor({
    value,
    onChange,
    language = "json",
}: {
    value: string;
    onChange: (v: string) => void;
    language?: string;
}) {
    return (
        <Editor
            height="320px"
            language={language}
            value={value}
            onChange={(v) => onChange(v || "")}
            theme={
                document.documentElement.classList.contains("dark")
                    ? "vs-dark"
                    : "light"
            }
            options={{
                folding: false,
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
            }}
        />
    );
}
