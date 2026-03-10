-- V1: 인증 도메인 초기 스키마
-- users, user_auth_accounts 테이블과 핵심 제약/인덱스를 생성한다.

CREATE TABLE users (
    user_id UUID PRIMARY KEY,
    email VARCHAR(320) NOT NULL,
    nickname VARCHAR(20) NOT NULL,
    profile_image_url VARCHAR(2048),
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Seoul',
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE user_auth_accounts (
    auth_account_id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    provider VARCHAR(20) NOT NULL,
    provider_user_id VARCHAR(191),
    login_email VARCHAR(320),
    password_hash VARCHAR(255),
    password_changed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_user_auth_accounts_user_id
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE
);

ALTER TABLE users
    ADD CONSTRAINT chk_users_status
        CHECK (status IN ('ACTIVE', 'INACTIVE', 'DELETED'));

ALTER TABLE user_auth_accounts
    ADD CONSTRAINT chk_user_auth_accounts_provider
        CHECK (provider IN ('LOCAL', 'GOOGLE'));

CREATE UNIQUE INDEX ux_users_email_active
    ON users (email)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX ux_users_nickname_active
    ON users (nickname)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX ux_user_auth_accounts_provider_user_id
    ON user_auth_accounts (provider, provider_user_id);

CREATE UNIQUE INDEX ux_user_auth_accounts_provider_login_email
    ON user_auth_accounts (provider, login_email);

CREATE INDEX ix_user_auth_accounts_user_id
    ON user_auth_accounts (user_id);
