import base64
import json
import mimetypes
from decimal import Decimal, InvalidOperation
from functools import lru_cache
from typing import Any
from urllib.parse import urlparse

import httpx
from app.config import Settings, get_settings
from app.schemas.receipt import ReceiptLineItem, ReceiptOcrRequest, ReceiptOcrResponse


class ReceiptOcrService:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def extract(self, payload: ReceiptOcrRequest) -> ReceiptOcrResponse:
        if not self.settings.gms_api_key:
            raise ValueError("GMS_API_KEY is required to call Gemini OCR.")

        image_bytes, mime_type = await self._download_image(str(payload.image_url))
        gemini_payload = self._build_gemini_payload(payload, image_bytes, mime_type)
        gemini_response = await self._call_gemini(gemini_payload)
        raw_text = self._extract_response_text(gemini_response)
        parsed = self._parse_json(raw_text)
        return self._build_receipt_response(payload, parsed, raw_text)

    def _guess_merchant_name(self, file_name: str) -> str:
        stem = file_name.split(".", 1)[0].replace("-", " ").replace("_", " ").strip()
        return stem or "UNKNOWN"

    async def _download_image(self, image_url: str) -> tuple[bytes, str]:
        async with httpx.AsyncClient(timeout=self.settings.gemini_timeout_seconds) as client:
            response = await client.get(image_url)
            response.raise_for_status()

        mime_type = response.headers.get("content-type", "").split(";")[0].strip()
        if not mime_type:
            guessed_type, _ = mimetypes.guess_type(image_url)
            mime_type = guessed_type or "image/jpeg"
        return response.content, mime_type

    def _build_gemini_payload(
        self,
        payload: ReceiptOcrRequest,
        image_bytes: bytes,
        mime_type: str,
    ) -> dict[str, Any]:
        prompt = (
            "You are extracting data from a receipt image. "
            "Return only a JSON object with these fields: "
            "merchant_name string, paid_at string|null in ISO 8601 if possible, "
            "currency_code string, total_amount number, tax_amount number|null, "
            "line_items array of objects with name string, quantity number, unit_price number|null, amount number, "
            "raw_text string. "
            "If a field is missing, use null or an empty array. "
            f"The expected currency code is {payload.currency_code}. "
            f"The locale is {payload.locale}."
        )
        image_part = {
            "inline_data": {
                "mime_type": mime_type,
                "data": base64.b64encode(image_bytes).decode("ascii"),
            }
        }
        return {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        image_part,
                    ]
                }
            ],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.1,
            },
        }

    async def _call_gemini(self, payload: dict[str, Any]) -> dict[str, Any]:
        url = (
            f"{self.settings.gemini_base_url}/models/"
            f"{self.settings.gemini_model}:generateContent?key={self.settings.gms_api_key}"
        )
        async with httpx.AsyncClient(timeout=self.settings.gemini_timeout_seconds) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            return response.json()

    def _extract_response_text(self, response_json: dict[str, Any]) -> str:
        candidates = response_json.get("candidates") or []
        if not candidates:
            raise ValueError("Gemini response does not contain candidates.")

        parts = candidates[0].get("content", {}).get("parts", [])
        text_chunks = [part.get("text", "") for part in parts if part.get("text")]
        text = "".join(text_chunks).strip()
        if not text:
            raise ValueError("Gemini response did not contain text output.")
        return text

    def _parse_json(self, raw_text: str) -> dict[str, Any]:
        try:
            return json.loads(raw_text)
        except json.JSONDecodeError:
            start = raw_text.find("{")
            end = raw_text.rfind("}")
            if start == -1 or end == -1 or end <= start:
                raise ValueError("Gemini output is not valid JSON.") from None
            return json.loads(raw_text[start : end + 1])

    def _build_receipt_response(
        self,
        payload: ReceiptOcrRequest,
        parsed: dict[str, Any],
        raw_text: str,
    ) -> ReceiptOcrResponse:
        file_name = urlparse(str(payload.image_url)).path.rsplit("/", 1)[-1] or "receipt.jpg"
        merchant_name = parsed.get("merchant_name") or self._guess_merchant_name(file_name)
        line_items = [self._build_line_item(item) for item in parsed.get("line_items", []) if isinstance(item, dict)]

        return ReceiptOcrResponse(
            receipt_id=payload.receipt_id,
            merchant_name=merchant_name,
            paid_at=parsed.get("paid_at"),
            currency_code=parsed.get("currency_code") or payload.currency_code,
            total_amount=self._to_decimal(parsed.get("total_amount"), default="0"),
            tax_amount=self._to_decimal(parsed.get("tax_amount"), default=None),
            line_items=line_items,
            raw_text=parsed.get("raw_text") or raw_text,
        )

    def _build_line_item(self, item: dict[str, Any]) -> ReceiptLineItem:
        return ReceiptLineItem(
            name=str(item.get("name") or "UNKNOWN"),
            quantity=self._to_decimal(item.get("quantity"), default="1"),
            unit_price=self._to_decimal(item.get("unit_price"), default=None),
            amount=self._to_decimal(item.get("amount"), default="0"),
        )

    def _to_decimal(self, value: Any, default: str | None) -> Decimal | None:
        if value is None:
            return Decimal(default) if default is not None else None
        if isinstance(value, Decimal):
            return value
        if isinstance(value, (int, float)):
            return Decimal(str(value))

        normalized = str(value).strip().replace(",", "")
        if not normalized:
            return Decimal(default) if default is not None else None
        try:
            return Decimal(normalized)
        except InvalidOperation:
            return Decimal(default) if default is not None else None


@lru_cache
def get_receipt_ocr_service() -> ReceiptOcrService:
    return ReceiptOcrService(get_settings())
