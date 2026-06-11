import os
from functools import lru_cache
from pathlib import Path
from typing import Any, List

from fastapi import FastAPI, HTTPException
import numpy as np
from PIL import Image
from pydantic import BaseModel

try:
    import torch
    from timm import create_model
    from torchvision import transforms
except Exception:  # pragma: no cover - optional runtime dependency
    torch = None
    create_model = None
    transforms = None


TARGET_EMBEDDING_DIM = int(os.getenv("AI_TARGET_EMBEDDING_DIM", "768"))
DEFAULT_MODEL_NAME = os.getenv("AI_MODEL_NAME", "auto").strip() or "auto"
PAWSMATCH_MODEL_ID = os.getenv(
    "AI_TIMM_MODEL_NAME",
    "vit_base_patch16_224_dino",
).strip()

RGB_RESIZE = (12, 12)
GRAY_RESIZE = (12, 12)
HISTOGRAM_BINS = 8
GRAYSCALE_HISTOGRAM_BINS = 16

app = FastAPI(title="PawsRescue AI Service", version="0.2.0")


class EmbedRequest(BaseModel):
    imagePaths: List[str]


class TimmImageEmbedder:
    def __init__(self, model_id: str):
        if torch is None or create_model is None or transforms is None:
            raise RuntimeError("timm dependencies are not installed")

        self.model_id = model_id
        self.transform = transforms.Compose(
            [
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(
                    mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225],
                ),
            ]
        )
        self.model = create_model(model_id, pretrained=True)
        self.model = self.model.to("cpu")
        self.model.eval()

    def embed(self, image: Image.Image) -> np.ndarray:
        batch = self.transform(image).unsqueeze(0)
        with torch.no_grad():
            features = self.model.forward_features(batch)

        if isinstance(features, (tuple, list)):
            features = features[0]

        if features.ndim == 3:
            tokens = features.squeeze(0).cpu()
            prefix_token_count = getattr(self.model, "num_prefix_tokens", 1)
            prefix_tokens = tokens[:prefix_token_count]
            patch_tokens = tokens[prefix_token_count:] if tokens.shape[0] > prefix_token_count else tokens
            pooled_patches = patch_tokens.mean(dim=0)

            if prefix_tokens.numel() > 0:
                return ((prefix_tokens[0] + pooled_patches) / 2).numpy()
            return pooled_patches.numpy()

        if features.ndim == 2:
            return features.squeeze(0).cpu().numpy()

        return features.cpu().numpy().flatten()


@lru_cache(maxsize=2)
def get_timm_embedder(model_id: str) -> TimmImageEmbedder:
    return TimmImageEmbedder(model_id)


def normalize_embedding(values: np.ndarray) -> np.ndarray:
    flattened = np.asarray(values, dtype=np.float32).flatten()
    if flattened.size >= TARGET_EMBEDDING_DIM:
        embedding = flattened[:TARGET_EMBEDDING_DIM]
    else:
        embedding = np.pad(
            flattened,
            (0, TARGET_EMBEDDING_DIM - flattened.size),
            mode="constant",
        )

    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm
    return embedding.astype(np.float32)


def compute_fallback_embedding(image: Image.Image) -> np.ndarray:
    rgb_small = np.asarray(
        image.resize(RGB_RESIZE, Image.Resampling.BILINEAR),
        dtype=np.float32,
    ) / 255.0
    gray_small = np.asarray(
        image.convert("L").resize(GRAY_RESIZE, Image.Resampling.BILINEAR),
        dtype=np.float32,
    ) / 255.0

    gradient_y, gradient_x = np.gradient(gray_small)
    edge_magnitude = np.sqrt(np.square(gradient_x) + np.square(gradient_y))

    color_histograms = []
    for channel_index in range(3):
        histogram, _ = np.histogram(
            rgb_small[:, :, channel_index],
            bins=HISTOGRAM_BINS,
            range=(0.0, 1.0),
            density=True,
        )
        color_histograms.append(histogram.astype(np.float32))

    grayscale_histogram, _ = np.histogram(
        gray_small,
        bins=GRAYSCALE_HISTOGRAM_BINS,
        range=(0.0, 1.0),
        density=True,
    )

    width, height = image.size
    aspect_features = np.array(
        [
            width / max(height, 1),
            height / max(width, 1),
        ],
        dtype=np.float32,
    )

    channel_means = rgb_small.mean(axis=(0, 1)).astype(np.float32)
    channel_stds = rgb_small.std(axis=(0, 1)).astype(np.float32)

    combined = np.concatenate(
        [
            rgb_small.flatten(),
            gray_small.flatten(),
            edge_magnitude.astype(np.float32).flatten(),
            np.concatenate(color_histograms),
            channel_means,
            channel_stds,
            aspect_features,
            grayscale_histogram.astype(np.float32),
        ]
    )

    return normalize_embedding(combined)


def compute_image_embedding(
    image: Image.Image,
    requested_model: str,
) -> tuple[np.ndarray, str, bool, str | None]:
    normalized_model = requested_model.strip().lower() or "auto"

    if normalized_model in {"auto", "pawsmatch-dino", "dino"}:
        try:
            raw_embedding = get_timm_embedder(PAWSMATCH_MODEL_ID).embed(image)
            return (
                normalize_embedding(raw_embedding),
                f"pawsmatch-dino:{PAWSMATCH_MODEL_ID}",
                False,
                None,
            )
        except Exception as error:
            fallback_embedding = compute_fallback_embedding(image)
            return (
                fallback_embedding,
                "fallback-hybrid",
                True,
                str(error),
            )

    return compute_fallback_embedding(image), "fallback-hybrid", False, None


@app.get("/health")
def health() -> dict[str, str | int]:
    return {
        "status": "ok",
        "service": "ai",
        "defaultModel": DEFAULT_MODEL_NAME,
        "embeddingDimensions": TARGET_EMBEDDING_DIM,
    }


@app.post("/embed")
def embed(payload: EmbedRequest) -> dict[str, Any]:
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
    resolved_model_name: str | None = None
    fallback_used = False
    warning_messages: list[str] = []

    for path in existing_paths:
        with Image.open(path) as image_file:
            image = image_file.convert("RGB")
            embedding, model_name, used_fallback, warning = compute_image_embedding(
                image,
                DEFAULT_MODEL_NAME,
            )

        embeddings.append(embedding)
        resolved_model_name = model_name
        fallback_used = fallback_used or used_fallback
        if warning:
            warning_messages.append(warning)

    aggregate = normalize_embedding(np.mean(np.stack(embeddings, axis=0), axis=0))

    response: dict[str, Any] = {
        "model": resolved_model_name or "fallback-hybrid",
        "embeddingDimensions": TARGET_EMBEDDING_DIM,
        "embedding": aggregate.astype(float).tolist(),
    }

    if fallback_used:
        response["fallbackUsed"] = True
    if warning_messages:
        response["warning"] = warning_messages[0]

    return response
