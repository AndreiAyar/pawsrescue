from pathlib import Path
from typing import List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel


app = FastAPI(title="PawsRescue AI Service", version="0.1.0")


class EmbedRequest(BaseModel):
    imagePaths: List[str]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai"}


@app.post("/embed")
def embed(payload: EmbedRequest) -> dict[str, list[float] | str]:
    if not payload.imagePaths:
        raise HTTPException(status_code=400, detail="imagePaths is required")

    existing_paths = [Path(image_path) for image_path in payload.imagePaths]
    missing_paths = [str(path) for path in existing_paths if not path.exists()]

    if missing_paths:
        raise HTTPException(
            status_code=400,
            detail=f"Missing image paths: {', '.join(missing_paths)}",
        )

    sizes = [path.stat().st_size for path in existing_paths]
    total_size = float(sum(sizes))
    image_count = float(len(existing_paths))
    average_size = total_size / image_count if image_count else 0.0

    # Lightweight deterministic stub for local MVP wiring.
    return {
        "model": "lightweight-stub",
        "embedding": [image_count, total_size, average_size],
    }
