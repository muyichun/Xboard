export type Row = Record<string, any>;
export type Option = { value: string | number; label: string };
export type Field = {
    key: string;
    label: string;
    kind?:
        | "text"
        | "password"
        | "number"
        | "textarea"
        | "select"
        | "multi"
        | "tags"
        | "visibility"
        | "boolean"
        | "json"
        | "datetime"
        | "date"
        | "money"
        | "bytes"
        | "code"
        | "lines"
        | "markdown"
        | "rewards"
        | "time-ranges"
        | "env";
    reservedTag?: string;
    language?: string;
    required?: boolean;
    options?: Option[];
    source?: "plans" | "groups" | "machines" | "routes" | "templates";
    default?: any;
    hint?: string;
    group?: string;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    show?: (values: Row) => boolean;
};
export type Action = {
    label: string;
    endpoint: string;
    method?: "get" | "post";
    fields?: Field[];
    danger?: boolean;
    deletesRecord?: boolean;
    confirm?: string;
    download?: boolean;
    result?: boolean;
    idKey?: string;
    extra?: Row;
    batch?: boolean;
    idsKey?: string;
    seed?: (row: Row) => Row;
    payload?: (values: Row, row: Row) => Row | Row[];
    visible?: (row: Row) => boolean;
};
export type Column = {
    sortable?: boolean;
    key: string;
    label: string;
    format?:
        | "money"
        | "yuan"
        | "bytes"
        | "time"
        | "boolean"
        | "json"
        | "status";
    options?: Record<string, string>;
};
export type Module = {
    id: string;
    title: string;
    description: string;
    group: string;
    endpoint: string;
    method?: "get" | "post";
    columns: Column[];
    fields?: Field[];
    save?: string;
    create?: Action;
    actions?: Action[];
    bulk?: Action[];
    tools?: Action[];
    canCreate?: boolean;
    remote?: boolean;
    filterMode?: "structured" | "plain";
    searchKey?: string;
    params?: Row;
    filters?: Field[];
    rows?: (response: any) => Row[];
    count?: (response: any) => number;
    key?: string;
    sort?: string;
    editSeed?: (row: Row) => Row;
    savePayload?: (values: Row, row: Row) => Row;
    detailEndpoint?: string;
};
export type Settings = {
    base_url: string;
    secure_path: string;
    title: string;
    version?: string;
    logo?: string;
};
declare global {
    interface Window {
        settings?: Settings;
    }
}
