CREATE TABLE IF NOT EXISTS customer (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    place       VARCHAR(100) NOT NULL DEFAULT '',
    gstin       VARCHAR(20)  NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_name ON customer (lower(name));

CREATE TABLE IF NOT EXISTS pod_entry (
    id            BIGSERIAL PRIMARY KEY,
    pod_number    VARCHAR(11)  NOT NULL UNIQUE
                  CHECK (pod_number ~ '^[0-9]{10}[0-6]$'),
    entry_date    DATE         NOT NULL,
    destination   VARCHAR(100) NOT NULL,
    weight_grams  INTEGER      NOT NULL CHECK (weight_grams > 0),
    amount        INTEGER      NOT NULL CHECK (amount > 0),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Entries saved before customers existed keep customer_id empty.
ALTER TABLE pod_entry ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES customer (id);

-- One invoice number per customer per bill period ("yyyy-MM", or "all").
-- invoice_no is a plain running serial 1, 2, 3 ... that the server hands out.
CREATE SEQUENCE IF NOT EXISTS invoice_no_seq START 1;

CREATE TABLE IF NOT EXISTS invoice (
    id           BIGSERIAL PRIMARY KEY,
    invoice_no   BIGINT       NOT NULL UNIQUE,
    customer_id  BIGINT       NOT NULL REFERENCES customer (id) ON DELETE CASCADE,
    period       VARCHAR(7)   NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (customer_id, period)
);

CREATE INDEX IF NOT EXISTS idx_pod_entry_date ON pod_entry (entry_date);
CREATE INDEX IF NOT EXISTS idx_pod_entry_customer ON pod_entry (customer_id);
