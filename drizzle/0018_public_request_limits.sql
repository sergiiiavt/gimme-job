CREATE TABLE IF NOT EXISTS public_request_limits (
  bucket TEXT NOT NULL,
  surface TEXT NOT NULL,
  dimension TEXT NOT NULL,
  subject_hash TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (bucket, surface, dimension, subject_hash)
);

CREATE INDEX IF NOT EXISTS public_request_limits_updated_at_idx
  ON public_request_limits(updated_at);
