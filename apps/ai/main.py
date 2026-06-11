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
    from timm import create_model
    from torchvision import transforms
except Exception:  # pragma: no cover - optional runtime dependency
    torch = None
    create_model = None
    transforms = None

try:
    from transformers import AutoImageProcessor, AutoModel
except Exception:  # pragma: no cover - optional runtime dependency
    AutoImageProcessor = None
    AutoModel = None


TARGET_EMBEDDING_DIM = int(os.getenv("AI_TARGET_EMBEDDING_DIM", "768"))
DEFAULT_MODEL_NAME = os.getenv("AI_MODEL_NAME", "auto").strip() or "auto"
OFFLINE_MODEL_LOAD = os.getenv("AI_OFFLINE_MODEL_LOAD", "false").strip().lower() == "true"
TRANSFORMERS_MODEL_NAME = os.getenv(
    "AI_TRANSFORMERS_MODEL_NAME",
    "facebook/dinov3-vitl16-pretrain-lvd1689m",
).strip()
TIMM_MODEL_NAMES = [
    name.strip()
    for name in os.getenv(
        "AI_TIMM_MODEL_NAMES",
        os.getenv(
            "AI_TIMM_MODEL_NAME",
            "vit_base_patch16_224_dino,vit_base_patch8_224_dino",
        ),
    ).split(",")
    if name.strip()
]

RGB_RESIZE = (12, 12)
GRAY_RESIZE = (12, 12)
HISTOGRAM_BINS = 8
GRAYSCALE_HISTOGRAM_BINS = 16

COMBINED_MODEL_ALIASES = {"auto", "best", "pawsmatch"}
TRANSFORMERS_MODEL_ALIASES = {"transformers", "dinov3"}
TIMM_MODEL_ALIASES = {
    "timm",
    "dino",
    "pawsmatch-dino",
}

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


class TimmImageEmbedder:
    def __init__(self, model_id: str):
        if torch is None or create_model is None or transforms is None:
            raise RuntimeError("timm dependencies are not installed")
        if OFFLINE_MODEL_LOAD:
            raise RuntimeError("timm offline model loading is disabled")

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
def get_transformers_embedder(model_name: str) -> TransformersImageEmbedder:
    return TransformersImageEmbedder(model_name)


@lru_cache(maxsize=2)
def get_timm_embedder(model_id: str) -> TimmImageEmbedder:
    return TimmImageEmbedder(model_id)


def compute_timm_ensemble_embedding(
    image: Image.Image,
    model_names: list[str],
) -> tuple[np.ndarray | None, list[str]]:
    embeddings: list[np.ndarray] = []
    warnings: list[str] = []

    for model_name in model_names:
        try:
            embedding = get_timm_embedder(model_name).embed(image)
        except Exception as error:
            warnings.append(f"timm model {model_name} failed: {error}")
            continue

        embeddings.append(normalize_embedding(embedding))

    if not embeddings:
        return None, warnings

    return normalize_embedding(np.mean(np.stack(embeddings, axis=0), axis=0)), warnings


def compute_transformers_embedding(
    image: Image.Image,
    model_name: str,
) -> tuple[np.ndarray | None, str | None]:
    try:
        embedding = get_transformers_embedder(model_name).embed(image)
    except Exception as error:
        return None, f"transformers model failed: {error}"

    return normalize_embedding(embedding), None


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
    attempt_messages: list[str] = []

    if normalized_model in COMBINED_MODEL_ALIASES:
        embeddings: list[np.ndarray] = []
        used_transformers = False
        used_timm = False

        transformers_embedding, transformers_warning = compute_transformers_embedding(
            image,
            TRANSFORMERS_MODEL_NAME,
        )
        if transformers_embedding is not None:
            embeddings.append(transformers_embedding)
            used_transformers = True
        if transformers_warning:
            attempt_messages.append(transformers_warning)

        timm_embedding, timm_warnings = compute_timm_ensemble_embedding(
            image,
            TIMM_MODEL_NAMES,
        )
        if timm_embedding is not None:
            embeddings.append(timm_embedding)
            used_timm = True
        attempt_messages.extend(timm_warnings)

        if embeddings:
            warning = "; ".join(attempt_messages) if attempt_messages else None
            if used_transformers and used_timm:
                resolved_model_name = (
                    f"ensemble:transformers:{TRANSFORMERS_MODEL_NAME}"
                    f"+timm:{'+'.join(TIMM_MODEL_NAMES)}"
                )
            elif used_transformers:
                resolved_model_name = f"transformers:{TRANSFORMERS_MODEL_NAME}"
            else:
                resolved_model_name = f"timm:{'+'.join(TIMM_MODEL_NAMES)}"
            return (
                normalize_embedding(np.mean(np.stack(embeddings, axis=0), axis=0)),
                resolved_model_name,
                False,
                warning,
            )

    if normalized_model in TRANSFORMERS_MODEL_ALIASES:
        embedding, warning = compute_transformers_embedding(
            image,
            TRANSFORMERS_MODEL_NAME,
        )
        if embedding is not None:
            return (
                embedding,
                f"transformers:{TRANSFORMERS_MODEL_NAME}",
                False,
                None,
            )
        if warning:
            attempt_messages.append(warning)

    if normalized_model in TIMM_MODEL_ALIASES or attempt_messages:
        raw_embedding, timm_warnings = compute_timm_ensemble_embedding(image, TIMM_MODEL_NAMES)
        attempt_messages.extend(timm_warnings)
        if raw_embedding is not None:
            warning = "; ".join(attempt_messages) if attempt_messages else None
            return (
                raw_embedding,
                f"timm:{'+'.join(TIMM_MODEL_NAMES)}",
                False,
                warning,
            )

    fallback_embedding = compute_fallback_embedding(image)
    warning = "; ".join(attempt_messages) if attempt_messages else None
    return fallback_embedding, "fallback-hybrid", True, warning


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "ai",
        "defaultModel": DEFAULT_MODEL_NAME,
        "offlineModelLoad": OFFLINE_MODEL_LOAD,
        "combinedModelAliases": sorted(COMBINED_MODEL_ALIASES),
        "transformersModelName": TRANSFORMERS_MODEL_NAME,
        "timmModelIds": TIMM_MODEL_NAMES,
        "embeddingDimensions": TARGET_EMBEDDING_DIM,
        "transformersAvailable": bool(
            AutoImageProcessor is not None and AutoModel is not None
        ),
        "timmAvailable": bool(
            torch is not None and create_model is not None and transforms is not None
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
