// Build-time values injected by `define` in vite.config.ts for local-agent discovery.
interface ImportMetaEnv {
  readonly VITE_JOB_AGENT_PORT?: string;
  readonly VITE_JOB_AGENT_INSTANCE_ID?: string;
}
