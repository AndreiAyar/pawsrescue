FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /service

COPY apps/ai/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir torch==2.15.0 torchvision==0.29.2 --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

COPY apps/ai/main.py ./app/main.py

WORKDIR /service/app

RUN useradd --create-home --uid 1000 appuser \
    && mkdir -p /shared-uploads /home/appuser/.cache \
    && chown -R appuser:appuser /service /shared-uploads /home/appuser/.cache

USER appuser

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
