CREATE TABLE IF NOT EXISTS public_api_rate_limits (
  window_start TEXT NOT NULL,
  route_group TEXT NOT NULL,
  scope TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (window_start, route_group, scope, scope_key)
);

CREATE INDEX IF NOT EXISTS public_api_rate_limits_updated_at_idx
  ON public_api_rate_limits(updated_at);
