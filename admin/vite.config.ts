import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    plugins: [react(), tailwindcss()],
    base: "/assets/admin-next/",
    build: {
        outDir: "../public/assets/admin-next",
        emptyOutDir: true,
        manifest: "manifest.json",
        chunkSizeWarningLimit: 800,
    },
    server: {
        proxy: {
            "/api": {
                target: process.env.ADMIN_API_ORIGIN || "http://127.0.0.1:7001",
                changeOrigin: true,
            },
        },
    },
});
