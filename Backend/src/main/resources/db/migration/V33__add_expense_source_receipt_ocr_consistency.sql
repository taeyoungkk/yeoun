ALTER TABLE expenses
    ADD COLUMN IF NOT EXISTS receipt_id TEXT;

DO $$
BEGIN
    IF to_regclass('public.receipt_ocr_results') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE expenses DROP CONSTRAINT IF EXISTS fk_expenses_receipt_id';
        EXECUTE '
            ALTER TABLE expenses
                ADD CONSTRAINT fk_expenses_receipt_id
                    FOREIGN KEY (receipt_id)
                    REFERENCES receipt_ocr_results (receipt_id)
                    ON DELETE RESTRICT
        ';
    END IF;
END
$$;

ALTER TABLE expenses
    DROP CONSTRAINT IF EXISTS ux_expenses_receipt_id;

ALTER TABLE expenses
    ADD CONSTRAINT ux_expenses_receipt_id
        UNIQUE (receipt_id);

ALTER TABLE expenses
    DROP CONSTRAINT IF EXISTS ck_expenses_source_type;

ALTER TABLE expenses
    ADD CONSTRAINT ck_expenses_source_type
        CHECK (source_type IN ('MANUAL', 'PAYMENT_IMPORT', 'RECEIPT_OCR'));

ALTER TABLE expenses
    DROP CONSTRAINT IF EXISTS ck_expenses_source_payment_import_consistency;

ALTER TABLE expenses
    ADD CONSTRAINT ck_expenses_source_payment_import_consistency
        CHECK (
            (source_type = 'MANUAL' AND payment_import_id IS NULL AND receipt_id IS NULL)
            OR (source_type = 'PAYMENT_IMPORT' AND payment_import_id IS NOT NULL AND receipt_id IS NULL)
            OR (source_type = 'RECEIPT_OCR' AND payment_import_id IS NULL AND receipt_id IS NOT NULL)
        );

CREATE INDEX IF NOT EXISTS ix_expenses_receipt_id
    ON expenses (receipt_id);
