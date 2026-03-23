from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import psycopg
from psycopg import Connection

from app.config import Settings
from app.schemas.receipt import ReceiptOcrRequest, ReceiptOcrResultMessage


class ReceiptResultWriter:
    def __init__(self, settings: Settings):
        self.settings = settings

    def persist_result(
        self,
        payload: ReceiptOcrRequest,
        result: ReceiptOcrResultMessage,
        *,
        connection: Connection | None = None,
    ) -> None:
        if not self.settings.worker_database_url:
            raise RuntimeError("WORKER_DATABASE_URL is required for receipt result persistence.")

        owns_connection = connection is None
        if owns_connection:
            connection = psycopg.connect(self.settings.worker_database_url)

        now = datetime.now(timezone.utc)
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO receipt_ocr_results (
                        receipt_id,
                        trip_id,
                        image_url,
                        status,
                        merchant_name,
                        paid_at_raw,
                        currency_code,
                        total_amount,
                        tax_amount,
                        raw_text,
                        error_code,
                        error_message,
                        attempt,
                        requested_at,
                        processed_at,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        %(receipt_id)s,
                        %(trip_id)s,
                        %(image_url)s,
                        %(status)s,
                        %(merchant_name)s,
                        %(paid_at_raw)s,
                        %(currency_code)s,
                        %(total_amount)s,
                        %(tax_amount)s,
                        %(raw_text)s,
                        %(error_code)s,
                        %(error_message)s,
                        %(attempt)s,
                        %(requested_at)s,
                        %(processed_at)s,
                        %(created_at)s,
                        %(updated_at)s
                    )
                    ON CONFLICT (receipt_id) DO UPDATE
                    SET trip_id = EXCLUDED.trip_id,
                        image_url = EXCLUDED.image_url,
                        status = EXCLUDED.status,
                        merchant_name = EXCLUDED.merchant_name,
                        paid_at_raw = EXCLUDED.paid_at_raw,
                        currency_code = EXCLUDED.currency_code,
                        total_amount = EXCLUDED.total_amount,
                        tax_amount = EXCLUDED.tax_amount,
                        raw_text = EXCLUDED.raw_text,
                        error_code = EXCLUDED.error_code,
                        error_message = EXCLUDED.error_message,
                        attempt = EXCLUDED.attempt,
                        requested_at = EXCLUDED.requested_at,
                        processed_at = EXCLUDED.processed_at,
                        updated_at = EXCLUDED.updated_at
                    """,
                    {
                        "receipt_id": payload.receipt_id,
                        "trip_id": payload.trip_id,
                        "image_url": str(payload.image_url),
                        "status": result.status,
                        "merchant_name": result.merchant_name,
                        "paid_at_raw": result.paid_at,
                        "currency_code": result.currency_code,
                        "total_amount": result.total_amount,
                        "tax_amount": result.tax_amount,
                        "raw_text": result.raw_text,
                        "error_code": result.error_code,
                        "error_message": result.error_message,
                        "attempt": result.attempt,
                        "requested_at": payload.requested_at,
                        "processed_at": result.processed_at,
                        "created_at": now,
                        "updated_at": now,
                    },
                )

                cursor.execute(
                    """
                    DELETE FROM receipt_ocr_line_items
                    WHERE receipt_id = %(receipt_id)s
                    """,
                    {
                        "receipt_id": payload.receipt_id,
                    },
                )

                for sort_order, item in enumerate(result.line_items):
                    cursor.execute(
                        """
                        INSERT INTO receipt_ocr_line_items (
                            receipt_ocr_line_item_row_id,
                            receipt_id,
                            sort_order,
                            name,
                            quantity,
                            unit_price,
                            amount,
                            created_at,
                            updated_at
                        )
                        VALUES (
                            %(row_id)s,
                            %(receipt_id)s,
                            %(sort_order)s,
                            %(name)s,
                            %(quantity)s,
                            %(unit_price)s,
                            %(amount)s,
                            %(created_at)s,
                            %(updated_at)s
                        )
                        """,
                        {
                            "row_id": str(uuid4()),
                            "receipt_id": payload.receipt_id,
                            "sort_order": sort_order,
                            "name": item.name,
                            "quantity": item.quantity,
                            "unit_price": item.unit_price,
                            "amount": item.amount,
                            "created_at": now,
                            "updated_at": now,
                        },
                    )

            if owns_connection:
                connection.commit()
        except Exception:
            if owns_connection:
                connection.rollback()
            raise
        finally:
            if owns_connection:
                connection.close()
