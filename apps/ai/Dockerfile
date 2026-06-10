FROM python:3.11-slim

WORKDIR /service

COPY apps/ai/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/ai ./app

WORKDIR /service/app

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
