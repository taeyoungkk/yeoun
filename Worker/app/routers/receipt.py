from fastapi import APIRouter

from app.schemas.receipt import ReceiptOcrRequest, ReceiptOcrResponse
from app.services.receipt_ocr import get_receipt_ocr_service

router = APIRouter(prefix="/api/v1/ocr/receipts", tags=["receipt-ocr"])


@router.post("/extract", response_model=ReceiptOcrResponse)
async def extract_receipt(payload: ReceiptOcrRequest) -> ReceiptOcrResponse:
    service = get_receipt_ocr_service()
    return await service.extract(payload)
