-- Table for current live offers
CREATE TABLE offers (
    id SERIAL PRIMARY KEY,
    offer_id VARCHAR(64) UNIQUE NOT NULL,
    account VARCHAR(64) NOT NULL,
    taker_gets_currency VARCHAR(16) NOT NULL,
    taker_gets_issuer VARCHAR(64),
    taker_gets_value NUMERIC(38,18) NOT NULL,
    taker_pays_currency VARCHAR(16) NOT NULL,
    taker_pays_issuer VARCHAR(64),
    taker_pays_value NUMERIC(38,18) NOT NULL,
    price NUMERIC(38,18) GENERATED ALWAYS AS (taker_pays_value / taker_gets_value) STORED,
    flags INTEGER,
    expiration TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_offers_account ON offers(account);
CREATE INDEX idx_offers_taker_gets_currency ON offers(taker_gets_currency);
CREATE INDEX idx_offers_taker_pays_currency ON offers(taker_pays_currency);
CREATE INDEX idx_offers_price ON offers(price);

-- Table for offer history (append-only)
CREATE TABLE offer_history (
    id SERIAL PRIMARY KEY,
    offer_id VARCHAR(64) NOT NULL,
    account VARCHAR(64) NOT NULL,
    taker_gets_currency VARCHAR(16) NOT NULL,
    taker_gets_issuer VARCHAR(64),
    taker_gets_value NUMERIC(38,18) NOT NULL,
    taker_pays_currency VARCHAR(16) NOT NULL,
    taker_pays_issuer VARCHAR(64),
    taker_pays_value NUMERIC(38,18) NOT NULL,
    price NUMERIC(38,18) GENERATED ALWAYS AS (taker_pays_value / taker_gets_value) STORED,
    flags INTEGER,
    expiration TIMESTAMP,
    event_type VARCHAR(16) NOT NULL, -- e.g., 'created', 'modified', 'cancelled', 'filled'
    event_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_offer_history_offer_id ON offer_history(offer_id);
CREATE INDEX idx_offer_history_account ON offer_history(account);
CREATE INDEX idx_offer_history_event_type ON offer_history(event_type);
CREATE INDEX idx_offer_history_event_time ON offer_history(event_time); 

-- Table for tracked currency/issuer pairs
CREATE TABLE IF NOT EXISTS tracked_pairs (
    id SERIAL PRIMARY KEY,
    taker_gets_currency VARCHAR(16) NOT NULL,
    taker_gets_issuer VARCHAR(64),
    taker_pays_currency VARCHAR(16) NOT NULL,
    taker_pays_issuer VARCHAR(64),
    active BOOLEAN DEFAULT TRUE
); 