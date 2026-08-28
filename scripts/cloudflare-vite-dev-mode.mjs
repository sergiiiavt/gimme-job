export const LOCAL_PLACEHOLDER_DATABASE_ID = "00000000-0000-4000-8000-000000000000";

export function getCloudflareViteDevMode(lifecycleEvent) {
  const isOfflineLocalWeb = lifecycleEvent === "local:web";
  const localOnlyBindingConfig = {
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

  const bindingConfig = isOfflineLocalWeb
    ? localOnlyBindingConfig
    : {
        ...localOnlyBindingConfig,
        ai: { binding: "AI" },
        vectorize: [
          {
            binding: "RAG_INDEX",
            index_name: "gimmejob-rag",
          },
        ],
      };

  return {
    bindingConfig,
    isOfflineLocalWeb,
    remoteBindings: !isOfflineLocalWeb,
  };
}
