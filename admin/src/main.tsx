import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./style.css";
import "./legacy/style.css";
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: (count, error: any) =>
                ![401, 403, 422].includes(error?.response?.status) && count < 1,
            refetchOnWindowFocus: false,
            staleTime: 15000,
        },
        mutations: { retry: false },
    },
});
document.documentElement.lang = "zh-CN";
createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <App />
        </QueryClientProvider>
    </StrictMode>,
);
