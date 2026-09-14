-- Public disposable MySQL lab for GimmeJob database testing.
-- The lab password is intentionally not stored in plaintext in Git.
-- mysql_native_password is used here only so the strong shared lab password can be
-- represented by a one-way verifier in this public repository.

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
  PRIMARY KEY (id),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_orders_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;

-- Small deterministic learning data extends the same commerce domain instead of
-- introducing unrelated interview-only tables.
CREATE TABLE product_price_history (
  product_id BIGINT UNSIGNED NOT NULL,
  price_date DATE NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (product_id, price_date),
  CONSTRAINT fk_price_history_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;

CREATE TABLE order_processing_events (
  order_id BIGINT UNSIGNED NOT NULL,
  event_type ENUM('start', 'end') NOT NULL,
  event_at DATETIME(3) NOT NULL,
  PRIMARY KEY (order_id, event_type),
  CONSTRAINT fk_processing_event_order FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB;

-- MySQL cannot reference the same TEMPORARY table more than once in a statement
-- (ERROR 1137: Can't reopen table). A normal helper table is safe to self-join and
-- is dropped immediately after the deterministic fixture rows are generated.
CREATE TABLE __gimmejob_seed_digits (
  n TINYINT UNSIGNED NOT NULL PRIMARY KEY
) ENGINE=InnoDB;
INSERT INTO __gimmejob_seed_digits (n) VALUES (0),(1),(2),(3),(4),(5),(6),(7),(8),(9);

INSERT INTO users (id, email, region, status, created_at)
SELECT
  seq.n + 1,
  CONCAT('user', LPAD(seq.n + 1, 5, '0'), '@example.test'),
  ELT(MOD(seq.n, 5) + 1, 'EU', 'UA', 'US', 'APAC', 'LATAM'),
  ELT(MOD(seq.n, 4) + 1, 'active', 'active', 'active', 'inactive'),
  DATE_ADD('2025-01-01 08:00:00', INTERVAL MOD(seq.n, 600) DAY)
FROM (
  SELECT d0.n + d1.n * 10 + d2.n * 100 + d3.n * 1000 AS n
  FROM __gimmejob_seed_digits d0
  CROSS JOIN __gimmejob_seed_digits d1
  CROSS JOIN __gimmejob_seed_digits d2
  CROSS JOIN __gimmejob_seed_digits d3
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
  FROM __gimmejob_seed_digits d0
  CROSS JOIN __gimmejob_seed_digits d1
  CROSS JOIN __gimmejob_seed_digits d2
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
  FROM __gimmejob_seed_digits d0
  CROSS JOIN __gimmejob_seed_digits d1
  CROSS JOIN __gimmejob_seed_digits d2
  CROSS JOIN __gimmejob_seed_digits d3
  CROSS JOIN __gimmejob_seed_digits d4
) AS seq
WHERE seq.n < 50000;

-- The latest history rows intentionally match products.price for product 1 (5.00)
-- and product 2 (6.37), so the history and current product state agree.
INSERT INTO product_price_history (product_id, price_date, price) VALUES
  (1, '2026-08-25', 4.50),
  (1, '2026-08-26', 4.80),
  (1, '2026-08-27', 4.70),
  (1, '2026-08-28', 5.00),
  (2, '2026-08-25', 5.80),
  (2, '2026-08-26', 6.10),
  (2, '2026-08-27', 6.00),
  (2, '2026-08-28', 6.37);

-- Orders 4, 9, 14, 24, 29, and 34 are shipped orders from the generated fixture.
-- Two orders per channel keep the final AVG example small and deterministic.
INSERT INTO order_processing_events (order_id, event_type, event_at) VALUES
  (4,  'start', '2026-01-04 09:00:01.000'),
  (4,  'end',   '2026-01-04 09:00:01.808'),
  (24, 'start', '2026-01-24 09:00:01.000'),
  (24, 'end',   '2026-01-24 09:00:01.980'),
  (9,  'start', '2026-01-09 09:00:01.000'),
  (9,  'end',   '2026-01-09 09:00:02.000'),
  (29, 'start', '2026-01-29 09:00:01.000'),
  (29, 'end',   '2026-01-29 09:00:01.990'),
  (14, 'start', '2026-01-14 09:00:01.000'),
  (14, 'end',   '2026-01-14 09:00:01.412'),
  (34, 'start', '2026-02-03 09:00:01.000'),
  (34, 'end',   '2026-02-03 09:00:03.500');

DROP TABLE __gimmejob_seed_digits;

ANALYZE TABLE users, products, orders, product_price_history, order_processing_events;
