-- Public disposable PostgreSQL lab for GimmeJob database testing.
-- The strong shared lab password is stored only as a SCRAM verifier, never plaintext.

CREATE ROLE gimmejob_lab
  LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  CONNECTION LIMIT 12
  PASSWORD 'SCRAM-SHA-256$4096:nNGGxra+RtkCqZ67LPUTTw==$bOhRl2pJuBug3jTVadF66aOf0zSc9mP0KbBuqrt1V40=:egRqxuyZBG0+YC21nlIhy6ajIV0OGRfHMxNnWjSCF44=';

CREATE DATABASE gimmejob_lab;
GRANT CONNECT, TEMPORARY ON DATABASE gimmejob_lab TO gimmejob_lab;

\connect gimmejob_lab

GRANT ALL ON SCHEMA public TO gimmejob_lab;
SET ROLE gimmejob_lab;

CREATE TABLE users (
  id BIGINT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  region VARCHAR(32) NOT NULL,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMP NOT NULL
);

CREATE TABLE products (
  id BIGINT PRIMARY KEY,
  sku VARCHAR(40) NOT NULL UNIQUE,
  category VARCHAR(40) NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  active BOOLEAN NOT NULL
);

CREATE TABLE orders (
  id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL,
  channel VARCHAR(20) NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP NOT NULL
);

INSERT INTO users (id, email, region, status, created_at)
SELECT
  n,
  'user' || LPAD(n::text, 5, '0') || '@example.test',
  (ARRAY['EU', 'UA', 'US', 'APAC', 'LATAM'])[((n - 1) % 5) + 1],
  (ARRAY['active', 'active', 'active', 'inactive'])[((n - 1) % 4) + 1],
  TIMESTAMP '2025-01-01 08:00:00' + (((n - 1) % 600) * INTERVAL '1 day')
FROM generate_series(1, 10000) AS n;

INSERT INTO products (id, sku, category, price, active)
SELECT
  n,
  'SKU-' || LPAD(n::text, 4, '0'),
  (ARRAY['hardware', 'software', 'books', 'office', 'training'])[((n - 1) % 5) + 1],
  ROUND((5 + (((n - 1) * 137) % 49500) / 100.0)::numeric, 2),
  ((n - 1) % 10) <> 0
FROM generate_series(1, 200) AS n;

INSERT INTO orders (id, user_id, product_id, status, channel, total_amount, created_at)
SELECT
  n,
  (((n - 1) * 17) % 10000) + 1,
  (((n - 1) * 13) % 200) + 1,
  (ARRAY['new', 'paid', 'paid', 'shipped', 'cancelled'])[((n - 1) % 5) + 1],
  (ARRAY['web', 'mobile', 'api', 'partner'])[((n - 1) % 4) + 1],
  ROUND((10 + (((n - 1) * 37) % 99000) / 100.0)::numeric, 2),
  TIMESTAMP '2026-01-01 09:00:00' + (((n - 1) % 240) * INTERVAL '1 day')
FROM generate_series(1, 50000) AS n;

RESET ROLE;
