import os
import asyncio
from contextlib import asynccontextmanager
from functools import lru_cache
from pathlib import Path
from typing import Any, List

import numpy as np
from fastapi import FastAPI, HTTPException
from PIL import Image, UnidentifiedImageError
from threading import Lock
from pydantic import BaseModel

try:
    import torch
    from torchvision.models.detection import (
        FasterRCNN_ResNet50_FPN_V2_Weights,
        fasterrcnn_resnet50_fpn_v2,
    )
except Exception:  # pragma: no cover - optional runtime dependency
    torch = None
    FasterRCNN_ResNet50_FPN_V2_Weights = None
    fasterrcnn_resnet50_fpn_v2 = None

try:
    from transformers import AutoImageProcessor, AutoModel
except Exception:  # pragma: no cover - optional runtime dependency
    AutoImageProcessor = None
    AutoModel = None


TARGET_EMBEDDING_DIM = int(os.getenv("AI_TARGET_EMBEDDING_DIM", "1024"))
DEFAULT_MODEL_NAME = os.getenv("AI_MODEL_NAME", "auto").strip() or "auto"
OFFLINE_MODEL_LOAD = os.getenv("AI_OFFLINE_MODEL_LOAD", "false").strip().lower() == "true"
TRANSFORMERS_MODEL_NAME = os.getenv(
    "AI_TRANSFORMERS_MODEL_NAME",
    "facebook/dinov2-small",
).strip()
CAT_DETECTION_THRESHOLD = float(os.getenv("AI_CAT_DETECTION_THRESHOLD", "0.65"))
CAT_CROP_PADDING = float(os.getenv("AI_CAT_CROP_PADDING", "0.08"))
CAT_CROP_WEIGHT = float(os.getenv("AI_CAT_CROP_WEIGHT", "0.8"))

MODEL_ALIASES = {"auto", "best", "pawsmatch", "transformers", "dinov3", "dinov2"}
MODEL_FAMILY = "dinov2" if "dinov2" in TRANSFORMERS_MODEL_NAME else "dinov3"
PIPELINE_MODEL_NAME = f"{MODEL_FAMILY}-cat-crop-v1:{TRANSFORMERS_MODEL_NAME}"

@asynccontextmanager
async def lifespan(_app):
    from worker import run_worker
    from worker_db import load_worker_env

    load_worker_env()

    stop = asyncio.Event()
    task = None
    if os.getenv("AI_WORKER_ENABLED", "true").lower() != "false":
        task = asyncio.create_task(run_worker(embed_images, stop))
    try:
        yield
    finally:
        stop.set()
        if task:
            await task


app = FastAPI(title="PawsRescue AI Service", version="0.5.0", lifespan=lifespan)
_model_lock = Lock()
_inference_lock = Lock()
_ready = False
Image.MAX_IMAGE_PIXELS = 25_000_000

if OFFLINE_MODEL_LOAD:
    os.environ["HF_HUB_OFFLINE"] = "1"


class EmbedRequest(BaseModel):
    imagePaths: List[str]


def resolve_image_path(image_path: str) -> Path:
    candidate = Path(image_path)
    upload_dir = os.getenv("UPLOAD_DIR", "").strip()
    if upload_dir:
        upload_base = Path(upload_dir).resolve()
        resolved = candidate.resolve() if candidate.is_absolute() else (upload_base / candidate).resolve()
        if not resolved.is_relative_to(upload_base):
            raise HTTPException(status_code=400, detail="Photo must be inside the uploads directory")
        return resolved
    return candidate.resolve()



class TransformersImageEmbedder:
    def __init__(self, model_name: str):
        if AutoImageProcessor is None or AutoModel is None:
            raise RuntimeError("transformers dependencies are not installed")

        self.model_name = model_name
        self.processor = AutoImageProcessor.from_pretrained(
            model_name,
            local_files_only=OFFLINE_MODEL_LOAD,
        )
        self.model = AutoModel.from_pretrained(
            model_name,
            local_files_only=OFFLINE_MODEL_LOAD,
        )
        self.model = self.model.to("cpu")
        self.model.eval()

    def embed(self, image: Image.Image) -> np.ndarray:
        inputs = self.processor(images=image, return_tensors="pt")
        inputs = {key: value.cpu() for key, value in inputs.items()}

        with torch.no_grad():
            outputs = self.model(**inputs)

        if hasattr(outputs, "last_hidden_state"):
            features = outputs.last_hidden_state
            if features.ndim == 3:
                return features[:, 0, :].squeeze(0).cpu().numpy()
            if features.ndim == 2:
                return features.squeeze(0).cpu().numpy()

        if hasattr(outputs, "pooler_output") and outputs.pooler_output is not None:
            return outputs.pooler_output.squeeze(0).cpu().numpy()

        if hasattr(outputs, "image_embeds") and outputs.image_embeds is not None:
            return outputs.image_embeds.squeeze(0).cpu().numpy()

        return np.asarray(outputs[0]).flatten()


@lru_cache(maxsize=2)
def get_transformers_embedder(model_name: str) -> TransformersImageEmbedder:
    return TransformersImageEmbedder(model_name)


@lru_cache(maxsize=1)
def get_cat_detector():
    if (
        torch is None
        or FasterRCNN_ResNet50_FPN_V2_Weights is None
        or fasterrcnn_resnet50_fpn_v2 is None
    ):
        raise RuntimeError("torchvision detection dependencies are not installed")

    weights = FasterRCNN_ResNet50_FPN_V2_Weights.DEFAULT
    model = fasterrcnn_resnet50_fpn_v2(weights=weights)
    model = model.to("cpu")
    model.eval()
    return model, weights


def crop_detected_cat(image: Image.Image) -> tuple[Image.Image | None, str | None]:
    try:
        detector, weights = get_cat_detector()
        tensor = weights.transforms()(image)
        with torch.no_grad():
            prediction = detector([tensor])[0]

        categories = weights.meta["categories"]
        cat_label = categories.index("cat")
        best_box = None
        best_score = 0.0

        for box, label, score in zip(
            prediction["boxes"], prediction["labels"], prediction["scores"]
        ):
            numeric_score = float(score.item())
            if numeric_score < CAT_DETECTION_THRESHOLD:
                continue
            if int(label.item()) == cat_label and numeric_score > best_score:
                best_box = box.tolist()
                best_score = numeric_score

        if best_box is None:
            return None, "cat detector did not find a confident cat"

        left, top, right, bottom = best_box
        width = right - left
        height = bottom - top
        pad_x = width * CAT_CROP_PADDING
        pad_y = height * CAT_CROP_PADDING
        crop_box = (
            max(0, int(left - pad_x)),
            max(0, int(top - pad_y)),
            min(image.width, int(right + pad_x)),
            min(image.height, int(bottom + pad_y)),
        )
        return image.crop(crop_box), None
    except Exception as error:
        return None, f"cat detector failed: {error}"


def compute_transformers_embedding(
    image: Image.Image,
    model_name: str,
) -> tuple[np.ndarray | None, str | None]:
    try:
        embedding = get_transformers_embedder(model_name).embed(image)
    except Exception as error:
        return None, f"transformers model failed: {error}"

    return normalize_embedding(embedding), None


def compute_cat_focused_embedding(
    image: Image.Image,
) -> tuple[np.ndarray | None, str | None]:
    original_embedding, model_warning = compute_transformers_embedding(
        image,
        TRANSFORMERS_MODEL_NAME,
    )
    if original_embedding is None:
        return None, model_warning

    cat_crop, detector_warning = crop_detected_cat(image)
    if cat_crop is None:
        return original_embedding, detector_warning

    crop_embedding, crop_warning = compute_transformers_embedding(
        cat_crop,
        TRANSFORMERS_MODEL_NAME,
    )
    if crop_embedding is None:
        return original_embedding, crop_warning

    combined = (
        CAT_CROP_WEIGHT * crop_embedding
        + (1.0 - CAT_CROP_WEIGHT) * original_embedding
    )
    return normalize_embedding(combined), None


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


def compute_image_embedding(
    image: Image.Image,
    requested_model: str,
) -> tuple[np.ndarray, str, bool, str | None]:
    normalized_model = requested_model.strip().lower() or "auto"
    warning: str | None = None

    if normalized_model in MODEL_ALIASES:
        embedding, warning = compute_cat_focused_embedding(image)
        if embedding is not None:
            return (
                embedding,
                PIPELINE_MODEL_NAME,
                False,
                warning,
            )

    raise HTTPException(status_code=503, detail="Photo search is temporarily unavailable")


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "ai",
        "defaultModel": DEFAULT_MODEL_NAME,
        "offlineModelLoad": OFFLINE_MODEL_LOAD,
        "modelAliases": sorted(MODEL_ALIASES),
        "transformersModelName": TRANSFORMERS_MODEL_NAME,
        "pipelineModelName": PIPELINE_MODEL_NAME,
        "embeddingDimensions": TARGET_EMBEDDING_DIM,
        "transformersAvailable": bool(
            AutoImageProcessor is not None and AutoModel is not None
        ),
        "catDetectorAvailable": bool(
            torch is not None
            and FasterRCNN_ResNet50_FPN_V2_Weights is not None
            and fasterrcnn_resnet50_fpn_v2 is not None
        ),
    }


@app.get("/ready")
def ready() -> dict[str, Any]:
    global _ready
    with _model_lock:
        if not _ready:
            try:
                # Load actual weights and run the feature extractor, not just imports.
                get_cat_detector()
                probe = get_transformers_embedder(TRANSFORMERS_MODEL_NAME).embed(Image.new("RGB", (224, 224)))
                if not np.all(np.isfinite(probe)) or not np.any(probe):
                    raise RuntimeError("Invalid model output")
                _ready = True
            except Exception as error:
                raise HTTPException(status_code=503, detail="Photo search is warming up or unavailable") from error
    return {"status": "ready", "service": "ai", "model": PIPELINE_MODEL_NAME}


@app.post("/embed")
def embed(payload: EmbedRequest) -> dict[str, Any]:
    return embed_images(payload.imagePaths)


def embed_images(image_paths: list[str]) -> dict[str, Any]:
    # Scan and queued uploads share the same models safely.
    with _inference_lock:
        return _embed_images(image_paths)


def _embed_images(image_paths: list[str]) -> dict[str, Any]:
    if not 1 <= len(image_paths) <= 4:
        raise HTTPException(status_code=400, detail="Upload between one and four photos")

    existing_paths = [resolve_image_path(image_path) for image_path in image_paths]
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
        try:
            with Image.open(path) as image_file:
                if image_file.format not in {"JPEG", "PNG", "GIF", "WEBP"}:
                    raise ValueError("Unsupported photo format")
                if image_file.width * image_file.height > 25_000_000:
                    raise ValueError("Photo is too large")
                image = image_file.convert("RGB")
                embedding, model_name, used_fallback, warning = compute_image_embedding(image, DEFAULT_MODEL_NAME)
        except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as error:
            raise HTTPException(status_code=400, detail="Use a readable JPG, PNG, GIF or WebP photo under 25 megapixels") from error

        embeddings.append(embedding)
        resolved_model_name = model_name
        fallback_used = fallback_used or used_fallback
        if warning:
            warning_messages.append(warning)

    aggregate = normalize_embedding(np.mean(np.stack(embeddings, axis=0), axis=0))

    response: dict[str, Any] = {
        "model": resolved_model_name or "fallback-hybrid",
        "embeddingDimensions": TARGET_EMBEDDING_DIM,
        "fallbackUsed": fallback_used,
        "embedding": aggregate.astype(float).tolist(),
    }

    if warning_messages:
        response["warning"] = warning_messages[0]
    else:
        response["warning"] = None

    return response
