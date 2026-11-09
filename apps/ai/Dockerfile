FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /service

COPY apps/ai/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/ai ./app

WORKDIR /service/app

RUN useradd --create-home --uid 1000 appuser \
    && mkdir -p /shared-uploads /home/appuser/.cache \
    && chown -R appuser:appuser /service /shared-uploads /home/appuser/.cache

USER appuser

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
