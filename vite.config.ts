import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type UserConfig } from "vite";

/**
 * 临时定义的 Vite 8 配置接口，包含尚未进入官方 UserConfig 类型的属性
 */
interface Vite8UserConfig extends UserConfig {
  resolve?: UserConfig["resolve"] & {
    compilerOptions?: {
      paths?: boolean;
    };
  };
  environments?: Record<string, Record<string, unknown>>;
  server?: UserConfig["server"] & {
    consoleForwarding?: boolean;
  };
}

export default defineConfig(({ mode }): Vite8UserConfig => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [react(), tailwindcss()],
    define: {
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      // Vite 8: 优先尝试原生路径解析
      compilerOptions: {
        paths: true,
      },
    },
    // Vite 8: 开启多环境配置，为 Full Bundle Mode 开启路径
    environments: {
      client: {
        build: {
          outDir: "dist",
          rollupOptions: {
            output: {
              manualChunks: (id: string) => {
                if (id.includes("node_modules")) {
                  if (id.includes("react") || id.includes("react-dom")) return "vendor-react";
                  if (id.includes("lucide-react")) return "vendor-icons";
                  if (id.includes("highlight.js")) return "vendor-hljs";
                  return "vendor-utils";
                }
              },
            },
          },
        },
      },
    },
    server: {
      // Vite 8: 浏览器日志转发到终端
      consoleForwarding: true,
      hmr: process.env.DISABLE_HMR !== "true",
      proxy: {
        "/api": {
          target: "http://localhost:8787",
          changeOrigin: true,
        },
      },
    },
  };
});
