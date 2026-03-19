from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import get_settings
from app.consumer.receipt_consumer import ReceiptConsumer
from app.routers.health import router as health_router
from app.routers.receipt import router as receipt_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    consumer = ReceiptConsumer(settings)
    app.state.receipt_consumer = consumer

    if settings.kafka_enabled:
        await consumer.start()

    try:
        yield
    finally:
        await consumer.stop()


app = FastAPI(
    title="Yeoun Worker",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(health_router)
app.include_router(receipt_router)
