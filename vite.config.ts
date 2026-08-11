import path from "node:path";
import { existsSync } from "node:fs";
import vinext from "vinext";
import { defineConfig } from "vite";
import { localAgentInstanceId } from "./agent/src/identity.js";

const LOCAL_PLACEHOLDER_DATABASE_ID = "00000000-0000-4000-8000-000000000000";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: [
    {
      binding: "DB",
      database_name: "gimmejob-db",
      database_id: LOCAL_PLACEHOLDER_DATABASE_ID,
    },
  ],
};

export default defineConfig(async () => {
  const environmentPath = path.join(process.cwd(), ".env");
  if (existsSync(environmentPath)) process.loadEnvFile(environmentPath);
  const localAgentPort = process.env.JOB_AGENT_PORT ?? "4317";
  const localAgentDatabase = path.resolve(
    process.cwd(),
    process.env.JOB_AGENT_DB ?? "./data/job-agent.db",
  );
  const localAgentId = process.env.JOB_AGENT_INSTANCE_ID
    ?? localAgentInstanceId(process.cwd(), localAgentDatabase);
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    define: {
      "import.meta.env.VITE_JOB_AGENT_PORT": JSON.stringify(localAgentPort),
      "import.meta.env.VITE_JOB_AGENT_INSTANCE_ID": JSON.stringify(localAgentId),
    },
    server: {
      host: "0.0.0.0",
      port: 4173,
      strictPort: true,
      allowedHosts: ["terminal.local"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: localBindingConfig,
      }),
    ],
  };
});
