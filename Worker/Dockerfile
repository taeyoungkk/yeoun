# syntax=docker/dockerfile:1

FROM python:3.11-slim
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY . .

RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi

EXPOSE 8000

CMD ["sh", "-c", "if [ -f app/main.py ]; then python -m uvicorn app.main:app --host 0.0.0.0 --port 8000; else python -m http.server 8000 --directory /app; fi"]
