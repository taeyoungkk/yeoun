CREATE TABLE user_finance_profiles (
    finance_profile_id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    finance_user_key VARCHAR(100) NOT NULL,
    finance_user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    synced_at TIMESTAMPTZ,
    CONSTRAINT fk_user_finance_profiles_user_id
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE,
    CONSTRAINT ux_user_finance_profiles_user_id
        UNIQUE (user_id),
    CONSTRAINT ux_user_finance_profiles_finance_user_key
        UNIQUE (finance_user_key)
);

CREATE TABLE user_finance_accounts (
    finance_account_id UUID PRIMARY KEY,
    finance_profile_id UUID NOT NULL,
    account_no VARCHAR(50) NOT NULL,
    account_name VARCHAR(255),
    raw_payload_json JSONB NOT NULL,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_user_finance_accounts_profile_id
        FOREIGN KEY (finance_profile_id)
        REFERENCES user_finance_profiles (finance_profile_id)
        ON DELETE CASCADE,
    CONSTRAINT ux_user_finance_accounts_profile_account_no
        UNIQUE (finance_profile_id, account_no)
);

CREATE INDEX ix_user_finance_accounts_profile_active
    ON user_finance_accounts (finance_profile_id, is_active);

CREATE TABLE user_finance_cards (
    finance_card_id UUID PRIMARY KEY,
    finance_profile_id UUID NOT NULL,
    card_no VARCHAR(50) NOT NULL,
    card_name VARCHAR(255),
    card_unique_no VARCHAR(100),
    cvc VARCHAR(20),
    raw_payload_json JSONB NOT NULL,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_user_finance_cards_profile_id
        FOREIGN KEY (finance_profile_id)
        REFERENCES user_finance_profiles (finance_profile_id)
        ON DELETE CASCADE,
    CONSTRAINT ux_user_finance_cards_profile_card_no
        UNIQUE (finance_profile_id, card_no)
);

CREATE INDEX ix_user_finance_cards_profile_active
    ON user_finance_cards (finance_profile_id, is_active);
