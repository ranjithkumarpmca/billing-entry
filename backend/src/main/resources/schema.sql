CREATE TABLE IF NOT EXISTS customer (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    place       VARCHAR(100) NOT NULL DEFAULT '',
    gstin       VARCHAR(20)  NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Address lines and city, printed under the customer name on the bill.
ALTER TABLE customer ADD COLUMN IF NOT EXISTS address1 VARCHAR(150) NOT NULL DEFAULT '';
ALTER TABLE customer ADD COLUMN IF NOT EXISTS address2 VARCHAR(150) NOT NULL DEFAULT '';
ALTER TABLE customer ADD COLUMN IF NOT EXISTS city     VARCHAR(150) NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_name ON customer (lower(name));

-- Per-customer rates (rupees), typed by the owner for each customer:
--   cover_rate : cover (under 250 g)
--   rate_250   : parcel up to 250 g
--   rate_500   : parcel 251 g to 500 g
--   rate_1000  : parcel 501 g to 1000 g
-- Above 1 kg: rate_1000 + rate_250 for every extra 250 g (or part of it).
-- The old parcel_rate / parcel_extra / slab_grams columns are no longer used.
ALTER TABLE customer ADD COLUMN IF NOT EXISTS cover_rate INTEGER NOT NULL DEFAULT 25;
ALTER TABLE customer ADD COLUMN IF NOT EXISTS rate_250   INTEGER NOT NULL DEFAULT 25;
ALTER TABLE customer ADD COLUMN IF NOT EXISTS rate_500   INTEGER NOT NULL DEFAULT 32;
ALTER TABLE customer ADD COLUMN IF NOT EXISTS rate_1000  INTEGER NOT NULL DEFAULT 46;

CREATE TABLE IF NOT EXISTS pod_entry (
    id            BIGSERIAL PRIMARY KEY,
    pod_number    VARCHAR(11)  NOT NULL UNIQUE
                  CHECK (pod_number ~ '^[0-9]{10}[0-6]$'),
    entry_date    DATE         NOT NULL,
    destination   VARCHAR(100) NOT NULL,
    weight_grams  INTEGER      NOT NULL CHECK (weight_grams >= 0),
    amount        INTEGER      NOT NULL CHECK (amount > 0),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Weight 0 is allowed (a cover billed at the cover rate). Older databases had "> 0": replace that rule.
ALTER TABLE pod_entry DROP CONSTRAINT IF EXISTS pod_entry_weight_grams_check;
ALTER TABLE pod_entry ADD CONSTRAINT pod_entry_weight_grams_check CHECK (weight_grams >= 0);

-- Entries saved before customers existed keep customer_id empty.
ALTER TABLE pod_entry ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES customer (id);

-- One invoice number per customer per bill period ("yyyy-MM", or "all").
-- invoice_no is a plain running serial 1, 2, 3 ... that the server hands out.
CREATE SEQUENCE IF NOT EXISTS invoice_no_seq START 1;

CREATE TABLE IF NOT EXISTS invoice (
    id           BIGSERIAL PRIMARY KEY,
    invoice_no   BIGINT       NOT NULL UNIQUE,
    customer_id  BIGINT       NOT NULL REFERENCES customer (id) ON DELETE CASCADE,
    period       VARCHAR(40)  NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (customer_id, period)
);

-- A bill period is now a date range ("2026-09-01..2026-11-30"), so the key is longer than yyyy-MM.
ALTER TABLE invoice ALTER COLUMN period TYPE VARCHAR(40);

CREATE INDEX IF NOT EXISTS idx_pod_entry_date ON pod_entry (entry_date);
CREATE INDEX IF NOT EXISTS idx_pod_entry_customer ON pod_entry (customer_id);

-- Login PINs are stored hashed, never as plain text. Roles: ADMIN, BILLER, RECOVERY (hash of the recovery key).
CREATE TABLE IF NOT EXISTS app_auth (
    role         VARCHAR(10)   PRIMARY KEY,
    secret_hash  VARCHAR(300)  NOT NULL,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);
