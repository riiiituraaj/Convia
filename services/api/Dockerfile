FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY lifeos ./lifeos
COPY tests ./tests

EXPOSE 8000

CMD ["uvicorn", "lifeos.main:app", "--host", "0.0.0.0", "--port", "8000"]
