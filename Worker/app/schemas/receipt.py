from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, HttpUrl


class ReceiptOcrRequest(BaseModel):
    model_config = {"populate_by_name": True}

    receipt_id: str = Field(alias="receiptId", description="Backend receipt identifier")
    trip_id: str = Field(alias="tripId", description="Trip identifier")
    image_url: HttpUrl = Field(alias="imageUrl", description="Reachable image URL for OCR processing")
    currency_code: str = Field(alias="currencyCode", default="KRW", min_length=3, max_length=3)
    locale: str = Field(default="ko-KR")
    requested_at: datetime | None = Field(alias="requestedAt", default=None)
    attempt: int = Field(default=0, ge=0)


class ReceiptLineItem(BaseModel):
    model_config = {"populate_by_name": True}

    name: str
    quantity: Decimal = Decimal("1")
    unit_price: Decimal | None = Field(alias="unitPrice", default=None)
    amount: Decimal


class ReceiptOcrResponse(BaseModel):
    model_config = {"populate_by_name": True}

    receipt_id: str = Field(alias="receiptId")
    merchant_name: str = Field(alias="merchantName")
    paid_at: str | None = Field(alias="paidAt", default=None)
    currency_code: str = Field(alias="currencyCode")
    total_amount: Decimal = Field(alias="totalAmount")
    tax_amount: Decimal | None = Field(alias="taxAmount", default=None)
    line_items: list[ReceiptLineItem] = Field(alias="lineItems")
    ocr_status: str = Field(alias="ocrStatus", default="COMPLETED")
    raw_text: str = Field(alias="rawText")


class ReceiptOcrResultMessage(BaseModel):
    model_config = {"populate_by_name": True}

    receipt_id: str = Field(alias="receiptId")
    trip_id: str = Field(alias="tripId")
    image_url: HttpUrl = Field(alias="imageUrl")
    status: str
    requested_at: datetime | None = Field(alias="requestedAt", default=None)
    merchant_name: str | None = Field(alias="merchantName", default=None)
    paid_at: str | None = Field(alias="paidAt", default=None)
    currency_code: str | None = Field(alias="currencyCode", default=None)
    total_amount: Decimal | None = Field(alias="totalAmount", default=None)
    tax_amount: Decimal | None = Field(alias="taxAmount", default=None)
    line_items: list[ReceiptLineItem] = Field(alias="lineItems", default_factory=list)
    raw_text: str | None = Field(alias="rawText", default=None)
    error_code: str | None = Field(alias="errorCode", default=None)
    error_message: str | None = Field(alias="errorMessage", default=None)
    processed_at: datetime = Field(alias="processedAt")
    attempt: int = 0


class ReceiptOcrDlqMessage(BaseModel):
    model_config = {"populate_by_name": True}

    receipt_id: str | None = Field(alias="receiptId", default=None)
    trip_id: str | None = Field(alias="tripId", default=None)
    image_url: HttpUrl | None = Field(alias="imageUrl", default=None)
    requested_at: datetime | None = Field(alias="requestedAt", default=None)
    topic: str
    partition: int
    offset: int
    attempt: int
    payload: dict
    error_code: str = Field(alias="errorCode")
    error_message: str = Field(alias="errorMessage")
    failed_at: datetime = Field(alias="failedAt")
