ALTER TABLE expenses
    DROP CONSTRAINT IF EXISTS ck_expenses_split_type;

ALTER TABLE expenses
    ADD CONSTRAINT ck_expenses_split_type
        CHECK (split_type IN ('EQUAL'));
