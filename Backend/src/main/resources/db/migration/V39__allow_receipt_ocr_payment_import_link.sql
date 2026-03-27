ALTER TABLE expenses
    DROP CONSTRAINT IF EXISTS ck_expenses_source_payment_import_consistency;

ALTER TABLE expenses
    ADD CONSTRAINT ck_expenses_source_payment_import_consistency
        CHECK (
            (source_type = 'MANUAL' AND payment_import_id IS NULL AND receipt_id IS NULL)
            OR (source_type = 'PAYMENT_IMPORT' AND payment_import_id IS NOT NULL AND receipt_id IS NULL)
            OR (source_type = 'RECEIPT_OCR' AND receipt_id IS NOT NULL)
        );
