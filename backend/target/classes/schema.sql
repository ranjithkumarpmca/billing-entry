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

CREATE INDEX IF NOT EXISTS idx_pod_entry_date ON pod_entry (entry_date);
