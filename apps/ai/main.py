import os
from functools import lru_cache
from pathlib import Path
from typing import Any, List

import numpy as np
from fastapi import FastAPI, HTTPException
from PIL import Image
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
    "facebook/dinov3-vitl16-pretrain-lvd1689m",
).strip()
CAT_DETECTION_THRESHOLD = float(os.getenv("AI_CAT_DETECTION_THRESHOLD", "0.65"))
CAT_CROP_PADDING = float(os.getenv("AI_CAT_CROP_PADDING", "0.08"))
CAT_CROP_WEIGHT = float(os.getenv("AI_CAT_CROP_WEIGHT", "0.8"))

RGB_RESIZE = (12, 12)
GRAY_RESIZE = (12, 12)
HISTOGRAM_BINS = 8
GRAYSCALE_HISTOGRAM_BINS = 16

DINOV3_MODEL_ALIASES = {"auto", "best", "pawsmatch", "transformers", "dinov3"}
PIPELINE_MODEL_NAME = f"dinov3-cat-crop-v1:{TRANSFORMERS_MODEL_NAME}"

app = FastAPI(title="PawsRescue AI Service", version="0.4.0")

if OFFLINE_MODEL_LOAD:
    os.environ["HF_HUB_OFFLINE"] = "1"


class EmbedRequest(BaseModel):
    imagePaths: List[str]


def resolve_image_path(image_path: str) -> Path:
    candidate = Path(image_path)
    if candidate.is_absolute():
        return candidate

    upload_dir = os.getenv("UPLOAD_DIR", "").strip()
    if upload_dir:
        upload_base = Path(upload_dir)
        if not upload_base.is_absolute():
            upload_base = (Path.cwd() / upload_base).resolve()
        return upload_base / candidate.name

    return (Path.cwd() / candidate).resolve()


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
    warning: str | None = None

    if normalized_model in DINOV3_MODEL_ALIASES:
        embedding, warning = compute_cat_focused_embedding(image)
        if embedding is not None:
            return (
                embedding,
                PIPELINE_MODEL_NAME,
                False,
                warning,
            )

    fallback_embedding = compute_fallback_embedding(image)
    return fallback_embedding, "fallback-hybrid", True, warning


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "ai",
        "defaultModel": DEFAULT_MODEL_NAME,
        "offlineModelLoad": OFFLINE_MODEL_LOAD,
        "modelAliases": sorted(DINOV3_MODEL_ALIASES),
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


@app.post("/embed")
def embed(payload: EmbedRequest) -> dict[str, Any]:
    if not payload.imagePaths:
        raise HTTPException(status_code=400, detail="imagePaths is required")

    existing_paths = [resolve_image_path(image_path) for image_path in payload.imagePaths]
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
        "fallbackUsed": fallback_used,
        "embedding": aggregate.astype(float).tolist(),
    }

    if warning_messages:
        response["warning"] = warning_messages[0]
    else:
        response["warning"] = None

    return response
