ALTER TABLE user_finance_profiles
    ADD CONSTRAINT ux_user_finance_profiles_finance_user_id
        UNIQUE (finance_user_id);
