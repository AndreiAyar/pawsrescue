from pathlib import Path
from typing import List

from fastapi import FastAPI, HTTPException
import numpy as np
from PIL import Image
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

    embeddings = []
    for path in existing_paths:
        image = Image.open(path).convert("RGB").resize((64, 64))
        pixels = np.asarray(image, dtype=np.float32) / 255.0
        mean_rgb = pixels.mean(axis=(0, 1))
        embeddings.append(mean_rgb)

    aggregate = np.mean(np.stack(embeddings, axis=0), axis=0)

    return {
        "model": "basic-rgb-embedder",
        "embedding": aggregate.astype(float).tolist(),
    }
