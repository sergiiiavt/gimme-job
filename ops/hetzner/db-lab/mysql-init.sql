-- Public disposable MySQL lab for GimmeJob database testing.
-- The lab password is intentionally not stored in plaintext in Git.
-- mysql_native_password is used here only so the strong shared lab password can be
-- represented by a one-way verifier in this public repository.
-- Intentionally no index exists on orders.user_id/product_id so EXPLAIN + CREATE INDEX
-- exercises have a real before/after plan to inspect.

CREATE DATABASE IF NOT EXISTS gimmejob_lab
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'gimmejob_lab'@'%'
  IDENTIFIED WITH mysql_native_password AS '*A0E649F08500D59743D87154BC6BBD83904C892D'
  WITH MAX_USER_CONNECTIONS 12 MAX_QUERIES_PER_HOUR 20000;

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX,
      REFERENCES, CREATE VIEW, SHOW VIEW, TRIGGER, CREATE TEMPORARY TABLES
ON gimmejob_lab.* TO 'gimmejob_lab'@'%';

USE gimmejob_lab;

CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL,
  email VARCHAR(190) NOT NULL,
  region VARCHAR(32) NOT NULL,
  status VARCHAR(20) NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE products (
  id BIGINT UNSIGNED NOT NULL,
  sku VARCHAR(40) NOT NULL,
  category VARCHAR(40) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  active BOOLEAN NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_sku (sku)
) ENGINE=InnoDB;

CREATE TABLE orders (
  id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(20) NOT NULL,
  channel VARCHAR(20) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TEMPORARY TABLE digits (n TINYINT UNSIGNED NOT NULL PRIMARY KEY);
INSERT INTO digits (n) VALUES (0),(1),(2),(3),(4),(5),(6),(7),(8),(9);

INSERT INTO users (id, email, region, status, created_at)
SELECT
  seq.n + 1,
  CONCAT('user', LPAD(seq.n + 1, 5, '0'), '@example.test'),
  ELT(MOD(seq.n, 5) + 1, 'EU', 'UA', 'US', 'APAC', 'LATAM'),
  ELT(MOD(seq.n, 4) + 1, 'active', 'active', 'active', 'inactive'),
  DATE_ADD('2025-01-01 08:00:00', INTERVAL MOD(seq.n, 600) DAY)
FROM (
  SELECT d0.n + d1.n * 10 + d2.n * 100 + d3.n * 1000 AS n
  FROM digits d0
  CROSS JOIN digits d1
  CROSS JOIN digits d2
  CROSS JOIN digits d3
) AS seq
WHERE seq.n < 10000;

INSERT INTO products (id, sku, category, price, active)
SELECT
  seq.n + 1,
  CONCAT('SKU-', LPAD(seq.n + 1, 4, '0')),
  ELT(MOD(seq.n, 5) + 1, 'hardware', 'software', 'books', 'office', 'training'),
  ROUND(5 + MOD(seq.n * 137, 49500) / 100, 2),
  MOD(seq.n, 10) <> 0
FROM (
  SELECT d0.n + d1.n * 10 + d2.n * 100 AS n
  FROM digits d0
  CROSS JOIN digits d1
  CROSS JOIN digits d2
) AS seq
WHERE seq.n < 200;

INSERT INTO orders (id, user_id, product_id, status, channel, total_amount, created_at)
SELECT
  seq.n + 1,
  MOD(seq.n * 17, 10000) + 1,
  MOD(seq.n * 13, 200) + 1,
  ELT(MOD(seq.n, 5) + 1, 'new', 'paid', 'paid', 'shipped', 'cancelled'),
  ELT(MOD(seq.n, 4) + 1, 'web', 'mobile', 'api', 'partner'),
  ROUND(10 + MOD(seq.n * 37, 99000) / 100, 2),
  DATE_ADD('2026-01-01 09:00:00', INTERVAL MOD(seq.n, 240) DAY)
FROM (
  SELECT d0.n + d1.n * 10 + d2.n * 100 + d3.n * 1000 + d4.n * 10000 AS n
  FROM digits d0
  CROSS JOIN digits d1
  CROSS JOIN digits d2
  CROSS JOIN digits d3
  CROSS JOIN digits d4
) AS seq
WHERE seq.n < 50000;

ANALYZE TABLE users, products, orders;
