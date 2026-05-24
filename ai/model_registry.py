import io
import json
import logging
import os
import re
import threading
import zipfile
import zlib
from dataclasses import dataclass
from pathlib import Path
from typing import Any

os.environ.setdefault("HF_HOME", "/tmp/huggingface")
os.environ.setdefault("TORCH_HOME", "/tmp/torch")

import numpy as np
import tensorflow as tf
import torch
from huggingface_hub import snapshot_download
from PIL import Image, UnidentifiedImageError
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from torch import nn
from torchvision.models import ResNet50_Weights, resnet50

logger = logging.getLogger("ai-models")

DEFAULT_MALWARE_MODEL_ID = "cycloevan/malconv"
DEFAULT_TEXT_MODEL_ID = "textattack/bert-base-uncased-ag-news"
DEFAULT_URL_SECURITY_MODEL_ID = "kmack/malicious-url-detection"
AG_NEWS_LABELS = {
    0: "world",
    1: "sports",
    2: "business",
    3: "science_technology",
}
PE_HEADER_OFFSET = 0x3C
PE_SIGNATURE = b"PE\x00\x00"
OLE_SIGNATURE = bytes.fromhex("D0CF11E0A1B11AE1")
MAX_MALWARE_INPUT_BYTES = 2_000_000
MAX_URLS_TO_SCAN = 20
DEFAULT_URL_SECURITY_THRESHOLD = 0.6
URL_PATTERN = re.compile(rb"https?://[^\s<>'\"\\)\]]+|www\.[^\s<>'\"\\)\]]+", re.IGNORECASE)
PDF_DANGEROUS_PATTERNS = (
    (rb"/JavaScript\b|/JS\b", "pdf_javascript", 0.7),
    (rb"/OpenAction\b|/AA\b", "pdf_auto_action", 0.35),
    (rb"/Launch\b", "pdf_launch_action", 0.8),
    (rb"/EmbeddedFile\b|/Filespec\b", "pdf_embedded_file", 0.65),
    (rb"/RichMedia\b", "pdf_rich_media", 0.55),
    (rb"/SubmitForm\b", "pdf_submit_form", 0.45),
    (rb"/XFA\b", "pdf_xfa_form", 0.4),
)
DOCX_DANGEROUS_NAMES = (
    ("word/vbaproject.bin", "office_vba_project", 0.85),
    ("word/embeddings/", "office_embedded_object", 0.6),
    ("word/activeX/", "office_activex", 0.75),
)
DOCX_DANGEROUS_XML = (
    (rb"w:instrText[^>]*>[^<]*(?:DDEAUTO|DDE|INCLUDEPICTURE|INCLUDETEXT)", "office_dde_or_include_field", 0.7),
    (rb"TargetMode=\"External\"[^>]+(?:file:|cmd:|powershell|ms-msdt|script:)", "office_external_dangerous_target", 0.8),
    (rb"(?:AutoOpen|Document_Open|Workbook_Open|AutoExec)", "office_auto_macro_name", 0.65),
)
EMBEDDED_EXECUTABLE_PATTERNS = (
    (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1", "embedded_ole_container", 0.45),
)
IMAGE_MAGIC_PREFIXES = (
    b"\xff\xd8\xff",
    b"\x89PNG\r\n\x1a\n",
    b"GIF87a",
    b"GIF89a",
    b"BM",
    b"RIFF",
    b"II*\x00",
    b"MM\x00*",
)
IMAGE_SUSPICIOUS_PATTERNS = (
    (rb"<script\b|javascript:|vbscript:", "image_script_marker", 0.65),
    (rb"powershell|cmd\.exe|wscript|cscript|mshta", "image_command_marker", 0.7),
    (rb"eval\s*\(|fromcharcode|base64,", "image_obfuscated_script_marker", 0.45),
)
SAFE_URL_PREFIXES = (
    "http://ns.adobe.com/",
    "https://ns.adobe.com/",
    "http://purl.org/dc/",
    "https://purl.org/dc/",
    "http://www.w3.org/",
    "https://www.w3.org/",
    "http://schemas.",
    "https://schemas.",
    "http://schema.",
    "https://schema.",
    "http://purl.org/",
    "https://purl.org/",
)


class ModelLoadError(RuntimeError):
    pass


class DeCorrelationLoss(tf.keras.layers.Layer):
    def __init__(self, lambda_decov: float = 1e-4, **kwargs: Any):
        super().__init__(**kwargs)
        self.lambda_decov = lambda_decov

    def call(self, inputs: tf.Tensor) -> tf.Tensor:
        batch_size = tf.cast(tf.shape(inputs)[0], tf.float32)
        centered = inputs - tf.reduce_mean(inputs, axis=0, keepdims=True)
        covariance = tf.matmul(centered, centered, transpose_a=True) / (batch_size - 1.0)
        off_diagonal = covariance - tf.linalg.diag(tf.linalg.diag_part(covariance))
        decov_loss = 0.5 * tf.reduce_sum(tf.square(off_diagonal))
        self.add_loss(self.lambda_decov * decov_loss)
        return inputs

    def get_config(self) -> dict[str, Any]:
        config = super().get_config()
        config["lambda_decov"] = self.lambda_decov
        return config


class MalConv(tf.keras.Model):
    def __init__(
        self,
        max_input_length: int = MAX_MALWARE_INPUT_BYTES,
        embedding_size: int = 8,
        filter_size: int = 500,
        stride: int = 500,
        num_filters: int = 128,
        fc_size: int = 128,
        use_decov: bool = True,
        lambda_decov: float = 1e-4,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.max_input_length = max_input_length
        self.use_decov = use_decov
        self.embedding = tf.keras.layers.Embedding(
            input_dim=256,
            output_dim=embedding_size,
            mask_zero=False,
            name="byte_embedding",
        )
        self.conv_a = tf.keras.layers.Conv1D(
            filters=num_filters,
            kernel_size=filter_size,
            strides=stride,
            padding="valid",
            activation="relu",
            name="conv_A",
        )
        self.conv_b = tf.keras.layers.Conv1D(
            filters=num_filters,
            kernel_size=filter_size,
            strides=stride,
            padding="valid",
            activation="sigmoid",
            name="conv_B",
        )
        self.global_max_pool = tf.keras.layers.GlobalMaxPooling1D(name="global_max_pool")
        self.fc = tf.keras.layers.Dense(fc_size, activation="relu", name="fc_layer")
        self.decov_layer = DeCorrelationLoss(lambda_decov=lambda_decov)
        self.dropout = tf.keras.layers.Dropout(0.5, name="dropout")
        self.output_layer = tf.keras.layers.Dense(1, activation="sigmoid", name="output")

    def call(self, inputs: tf.Tensor, training: bool = False) -> tf.Tensor:
        x = self.embedding(inputs)
        gated = self.conv_a(x) * self.conv_b(x)
        pooled = self.global_max_pool(gated)
        hidden = self.fc(pooled)
        if self.use_decov:
            hidden = self.decov_layer(hidden)
        if training:
            hidden = self.dropout(hidden, training=training)
        return self.output_layer(hidden)


@dataclass
class TextArtifacts:
    tokenizer: Any
    model: Any
    model_version: str


@dataclass
class ImageArtifacts:
    model: torch.nn.Module
    preprocess: Any
    labels: list[str]
    model_version: str


@dataclass
class MalwareArtifacts:
    model: MalConv
    model_version: str


@dataclass
class FiletypeArtifacts:
    model: torch.nn.Module
    preprocess: Any
    labels: list[str]
    model_version: str
    threshold: float


@dataclass
class UrlSecurityArtifacts:
    tokenizer: Any
    model: Any
    model_version: str


class ModelRegistry:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._text: TextArtifacts | None = None
        self._image: ImageArtifacts | None = None
        self._malware: MalwareArtifacts | None = None
        self._filetype: FiletypeArtifacts | None = None
        self._url_security: UrlSecurityArtifacts | None = None
        self._text_error: Exception | None = None
        self._image_error: Exception | None = None
        self._malware_error: Exception | None = None
        self._filetype_error: Exception | None = None
        self._url_security_error: Exception | None = None

    def warmup(self) -> None:
        failures: list[str] = []
        for loader in (self._ensure_text, self._ensure_image, self._ensure_malware):
            try:
                loader()
            except Exception as exc:
                failures.append(str(exc))
                logger.exception("Model warmup failed")
        if failures:
            raise ModelLoadError("Model warmup failed: " + "; ".join(failures))
        try:
            self._ensure_filetype()
        except FileNotFoundError as exc:
            logger.warning("Filetype classifier unavailable: %s", exc)
        except Exception as exc:
            logger.exception("Filetype classifier warmup failed")
            self._remember_failure("_filetype", "_filetype_error", exc)
        try:
            self._ensure_url_security()
        except Exception as exc:
            logger.exception("URL security model warmup failed")
            self._remember_failure("_url_security", "_url_security_error", exc)

    def status(self) -> dict[str, Any]:
        return {
            "malware": self._model_status(self._malware, self._malware_error),
            "text": self._model_status(self._text, self._text_error),
            "image": self._model_status(self._image, self._image_error),
            "filetype": self._model_status(self._filetype, self._filetype_error),
            "url_security": self._model_status(self._url_security, self._url_security_error),
        }

    def _model_status(self, value: Any, error: Exception | None) -> dict[str, Any]:
        return {
            "loaded": value is not None,
            "error": str(error) if error else None,
        }

    def _remember_failure(self, attr_name: str, error_attr_name: str, exc: Exception) -> None:
        setattr(self, attr_name, None)
        setattr(self, error_attr_name, exc)

    def _ensure_text(self) -> TextArtifacts:
        if self._text is not None:
            return self._text
        if self._text_error is not None:
            raise ModelLoadError(f"Text model unavailable: {self._text_error}")
        with self._lock:
            if self._text is not None:
                return self._text
            if self._text_error is not None:
                raise ModelLoadError(f"Text model unavailable: {self._text_error}")
            model_id = os.getenv("TEXT_MODEL_ID", DEFAULT_TEXT_MODEL_ID)
            logger.info("Loading text model: %s", model_id)
            try:
                tokenizer = AutoTokenizer.from_pretrained(model_id)
                model = AutoModelForSequenceClassification.from_pretrained(model_id)
                model.eval()
                self._text = TextArtifacts(
                    tokenizer=tokenizer,
                    model=model,
                    model_version=model_id,
                )
                logger.info("Loaded text model: %s", model_id)
                return self._text
            except Exception as exc:
                logger.exception("Failed to load text model: %s", model_id)
                self._remember_failure("_text", "_text_error", exc)
                raise ModelLoadError(f"Text model unavailable: {exc}") from exc

    def _ensure_image(self) -> ImageArtifacts:
        if self._image is not None:
            return self._image
        if self._image_error is not None:
            raise ModelLoadError(f"Image model unavailable: {self._image_error}")
        with self._lock:
            if self._image is not None:
                return self._image
            if self._image_error is not None:
                raise ModelLoadError(f"Image model unavailable: {self._image_error}")
            custom_path = os.getenv("IMAGE_CLASSIFIER_PATH", "").strip()
            if custom_path:
                logger.info("Loading custom image classifier: %s", custom_path)
                try:
                    self._image = self._load_custom_image_classifier(Path(custom_path))
                    logger.info("Loaded custom image classifier: %s", self._image.model_version)
                    return self._image
                except Exception as exc:
                    logger.exception("Failed to load custom image classifier: %s", custom_path)
                    self._remember_failure("_image", "_image_error", exc)
                    raise ModelLoadError(f"Image model unavailable: {exc}") from exc

            logger.info("Loading image model: torchvision.models.resnet50 (%s)", ResNet50_Weights.DEFAULT.name)
            try:
                weights = ResNet50_Weights.DEFAULT
                model = resnet50(weights=weights)
                model.eval()
                self._image = ImageArtifacts(
                    model=model,
                    preprocess=weights.transforms(),
                    labels=list(weights.meta["categories"]),
                    model_version=f"resnet50-{weights.name}",
                )
                logger.info("Loaded image model: %s", self._image.model_version)
                return self._image
            except Exception as exc:
                logger.exception("Failed to load image model")
                self._remember_failure("_image", "_image_error", exc)
                raise ModelLoadError(f"Image model unavailable: {exc}") from exc

    def _load_custom_image_classifier(self, model_path: Path) -> ImageArtifacts:
        if not model_path.exists():
            raise FileNotFoundError(f"Custom image classifier not found: {model_path}")
        checkpoint = torch.load(model_path, map_location="cpu")
        labels = checkpoint.get("labels")
        if not isinstance(labels, list) or not labels:
            raise ValueError("Custom image classifier checkpoint must include a non-empty labels list")

        weights = ResNet50_Weights.DEFAULT
        model = resnet50(weights=None)
        model.fc = nn.Linear(model.fc.in_features, len(labels))
        model.load_state_dict(checkpoint["model_state_dict"])
        model.eval()
        return ImageArtifacts(
            model=model,
            preprocess=weights.transforms(),
            labels=[str(label) for label in labels],
            model_version=str(checkpoint.get("model_version") or f"custom-resnet50-{model_path.stem}"),
        )

    def _ensure_filetype(self) -> FiletypeArtifacts:
        if self._filetype is not None:
            return self._filetype
        if self._filetype_error is not None:
            raise ModelLoadError(f"Filetype model unavailable: {self._filetype_error}")
        with self._lock:
            if self._filetype is not None:
                return self._filetype
            if self._filetype_error is not None:
                raise ModelLoadError(f"Filetype model unavailable: {self._filetype_error}")
            model_path = Path(os.getenv("FILETYPE_MODEL_PATH", "/app/models/resnet50_filetype_classifier.pt"))
            mapping_path = Path(os.getenv("FILETYPE_CLASS_MAPPING_PATH", "/app/models/class_mapping.json"))
            threshold = float(os.getenv("FILETYPE_CONFIDENCE_THRESHOLD", "0.6"))
            if not model_path.exists():
                raise FileNotFoundError(f"model file missing: {model_path}")
            if not mapping_path.exists():
                raise FileNotFoundError(f"class mapping missing: {mapping_path}")

            logger.info("Loading filetype classifier: model=%s mapping=%s", model_path, mapping_path)
            try:
                mapping = json.loads(mapping_path.read_text(encoding="utf-8"))
                labels = mapping.get("classes")
                if not isinstance(labels, list) or not labels:
                    raise ValueError("class mapping must include a non-empty classes list")

                checkpoint = torch.load(model_path, map_location="cpu")
                model = resnet50(weights=None)
                model.fc = nn.Linear(model.fc.in_features, len(labels))
                model.load_state_dict(checkpoint["model_state_dict"])
                model.eval()

                self._filetype = FiletypeArtifacts(
                    model=model,
                    preprocess=None,
                    labels=[str(label) for label in labels],
                    model_version=str(checkpoint.get("model_version") or "custom-resnet50-filetype"),
                    threshold=threshold,
                )
                logger.info("Loaded filetype classifier: %s labels=%s", self._filetype.model_version, labels)
                return self._filetype
            except Exception as exc:
                self._remember_failure("_filetype", "_filetype_error", exc)
                raise

    def _ensure_malware(self) -> MalwareArtifacts:
        if self._malware is not None:
            return self._malware
        if self._malware_error is not None:
            raise ModelLoadError(f"Malware model unavailable: {self._malware_error}")
        with self._lock:
            if self._malware is not None:
                return self._malware
            if self._malware_error is not None:
                raise ModelLoadError(f"Malware model unavailable: {self._malware_error}")
            model_id = os.getenv("MALWARE_MODEL_ID", DEFAULT_MALWARE_MODEL_ID)
            logger.info("Loading malware model: %s", model_id)
            try:
                snapshot_dir = Path(
                    snapshot_download(
                        repo_id=model_id,
                        allow_patterns=["*.h5", "*.json", "*.md", "src/*", "models/*"],
                    )
                )
                model_path = self._locate_malware_weights(snapshot_dir)
                model = MalConv(max_input_length=MAX_MALWARE_INPUT_BYTES)
                model(tf.zeros((1, MAX_MALWARE_INPUT_BYTES), dtype=tf.int32))
                model.load_weights(str(model_path))
                self._malware = MalwareArtifacts(model=model, model_version=model_id)
                logger.info("Loaded malware model: %s from %s", model_id, model_path)
                return self._malware
            except Exception as exc:
                logger.exception("Failed to load malware model: %s", model_id)
                self._remember_failure("_malware", "_malware_error", exc)
                raise ModelLoadError(f"Malware model unavailable: {exc}") from exc

    def _ensure_url_security(self) -> UrlSecurityArtifacts:
        if self._url_security is not None:
            return self._url_security
        if self._url_security_error is not None:
            raise ModelLoadError(f"URL security model unavailable: {self._url_security_error}")
        with self._lock:
            if self._url_security is not None:
                return self._url_security
            if self._url_security_error is not None:
                raise ModelLoadError(f"URL security model unavailable: {self._url_security_error}")
            model_id = os.getenv("URL_SECURITY_MODEL_ID", DEFAULT_URL_SECURITY_MODEL_ID)
            logger.info("Loading URL security model: %s", model_id)
            try:
                tokenizer = AutoTokenizer.from_pretrained(model_id)
                model = AutoModelForSequenceClassification.from_pretrained(model_id)
                model.eval()
                self._url_security = UrlSecurityArtifacts(
                    tokenizer=tokenizer,
                    model=model,
                    model_version=model_id,
                )
                logger.info("Loaded URL security model: %s", model_id)
                return self._url_security
            except Exception as exc:
                logger.exception("Failed to load URL security model: %s", model_id)
                self._remember_failure("_url_security", "_url_security_error", exc)
                raise ModelLoadError(f"URL security model unavailable: {exc}") from exc

    def _locate_malware_weights(self, snapshot_dir: Path) -> Path:
        candidates = [
            snapshot_dir / "models" / "malconv_model.h5",
            snapshot_dir / "malconv_model.h5",
            snapshot_dir / "malconv.h5",
        ]
        for candidate in candidates:
            if candidate.exists():
                return candidate
        available = [str(path.relative_to(snapshot_dir)) for path in snapshot_dir.rglob("*.h5")]
        raise FileNotFoundError(f"Could not find malware weights in {snapshot_dir}. Found: {available}")

    def classify_text(self, text: str) -> dict[str, Any]:
        artifacts = self._ensure_text()
        logger.info("Text inference start: model=%s chars=%s", artifacts.model_version, len(text))
        encoded = artifacts.tokenizer(
            text,
            truncation=True,
            max_length=512,
            return_tensors="pt",
        )
        with torch.no_grad():
            output = artifacts.model(**encoded)
            probabilities = torch.softmax(output.logits, dim=-1)[0]
        index = int(torch.argmax(probabilities).item())
        raw_label = artifacts.model.config.id2label.get(index, f"LABEL_{index}")
        label = AG_NEWS_LABELS.get(index, raw_label.lower())
        confidence = float(probabilities[index].item())
        result = {
            "label": label,
            "confidence": confidence,
            "model_version": artifacts.model_version,
        }
        logger.info("Text inference result: model=%s label=%s confidence=%.4f", artifacts.model_version, label, confidence)
        return result

    def classify_image(self, data: bytes) -> dict[str, Any]:
        artifacts = self._ensure_image()
        logger.info("Image inference start: model=%s bytes=%s", artifacts.model_version, len(data))
        try:
            image = Image.open(io.BytesIO(data)).convert("RGB")
        except UnidentifiedImageError as exc:
            raise ValueError("Invalid image payload") from exc
        tensor = artifacts.preprocess(image).unsqueeze(0)
        with torch.no_grad():
            logits = artifacts.model(tensor)
            probabilities = torch.softmax(logits, dim=1)[0]
        index = int(torch.argmax(probabilities).item())
        label = artifacts.labels[index]
        confidence = float(probabilities[index].item())
        result = {
            "label": label,
            "confidence": confidence,
            "model_version": artifacts.model_version,
        }
        logger.info("Image inference result: model=%s label=%s confidence=%.4f", artifacts.model_version, label, confidence)
        return result

    def classify_filetype_image(self, data: bytes) -> dict[str, Any]:
        try:
            artifacts = self._ensure_filetype()
        except FileNotFoundError as exc:
            logger.warning("Filetype classification skipped: %s", exc)
            return {
                "available": False,
                "predicted_type": None,
                "confidence": None,
                "top_3_predictions": [],
                "uncertain": True,
                "model_version": None,
                "error": str(exc),
            }
        except ModelLoadError as exc:
            logger.warning("Filetype classification unavailable: %s", exc)
            return {
                "available": False,
                "predicted_type": None,
                "confidence": None,
                "top_3_predictions": [],
                "uncertain": True,
                "model_version": None,
                "error": str(exc),
            }

        logger.info("Filetype classification start: model=%s bytes=%s", artifacts.model_version, len(data))
        try:
            image = Image.open(io.BytesIO(data)).convert("RGB")
        except UnidentifiedImageError as exc:
            raise ValueError("Invalid image payload") from exc

        tensor = self._preprocess_filetype_image(image)
        with torch.no_grad():
            logits = artifacts.model(tensor)
            probabilities = torch.softmax(logits, dim=1)[0]

        values, indices = torch.topk(probabilities, min(3, len(artifacts.labels)))
        confidence = float(values[0].item())
        raw_label = artifacts.labels[int(indices[0].item())]
        uncertain = confidence < artifacts.threshold
        top_3 = [
            {
                "type": artifacts.labels[int(index)],
                "confidence": float(value),
            }
            for value, index in zip(values.tolist(), indices.tolist())
        ]
        result = {
            "available": True,
            "predicted_type": "uncertain" if uncertain else raw_label,
            "raw_predicted_type": raw_label,
            "confidence": confidence,
            "top_3_predictions": top_3,
            "uncertain": uncertain,
            "threshold": artifacts.threshold,
            "model_version": artifacts.model_version,
        }
        logger.info(
            "Filetype classification result: model=%s predicted=%s raw=%s confidence=%.4f uncertain=%s",
            artifacts.model_version,
            result["predicted_type"],
            raw_label,
            confidence,
            uncertain,
        )
        return result

    def _preprocess_filetype_image(self, image: Image.Image) -> torch.Tensor:
        resampling = getattr(Image, "Resampling", Image)
        resized = image.resize((224, 224), resampling.BILINEAR)
        array = np.asarray(resized).astype(np.float32) / 255.0
        mean = np.asarray([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.asarray([0.229, 0.224, 0.225], dtype=np.float32)
        normalized = (array - mean) / std
        tensor = torch.from_numpy(normalized).permute(2, 0, 1).unsqueeze(0)
        return tensor

    def scan_malware(self, data: bytes) -> dict[str, Any]:
        url_ai = self.scan_url_threats(data)
        document_ai = self.scan_document_threats(data)
        image_ai = self.scan_image_threats(data)
        if not self._is_supported_executable(data):
            logger.info("Malware inference skipped: payload is not an executable/OLE container")
            is_malicious = bool(
                url_ai.get("is_malicious")
                or document_ai.get("is_malicious")
                or image_ai.get("is_malicious")
            )
            return {
                "verdict": "malicious" if is_malicious else "not_applicable",
                "is_malicious": is_malicious,
                "score": None,
                "confidence": None,
                "model_version": os.getenv("MALWARE_MODEL_ID", DEFAULT_MALWARE_MODEL_ID),
                "applicable": False,
                "url_ai": url_ai,
                "document_ai": document_ai,
                "image_ai": image_ai,
            }

        artifacts = self._ensure_malware()
        logger.info("Malware inference start: model=%s bytes=%s", artifacts.model_version, len(data))
        byte_array = self._prepare_malware_bytes(data)
        prediction = float(artifacts.model.predict(byte_array, verbose=0)[0][0])
        malicious_score = max(0.0, min(1.0, 1.0 - prediction))
        is_malconv_malicious = malicious_score >= 0.5
        is_malicious = bool(
            is_malconv_malicious
            or url_ai.get("is_malicious")
            or document_ai.get("is_malicious")
            or image_ai.get("is_malicious")
        )
        confidence = malicious_score if is_malconv_malicious else 1.0 - malicious_score
        result = {
            "verdict": "malicious" if is_malicious else "clean",
            "is_malicious": is_malicious or bool(url_ai.get("is_malicious")),
            "score": malicious_score,
            "confidence": confidence,
            "model_version": artifacts.model_version,
            "applicable": True,
            "url_ai": url_ai,
            "document_ai": document_ai,
            "image_ai": image_ai,
        }
        if result["is_malicious"] and not is_malconv_malicious:
            result["verdict"] = "malicious"
        logger.info(
            "Malware inference result: model=%s verdict=%s malicious_score=%.4f confidence=%.4f",
            artifacts.model_version,
            result["verdict"],
            malicious_score,
            confidence,
        )
        return result

    def scan_url_threats(self, data: bytes) -> dict[str, Any]:
        try:
            artifacts = self._ensure_url_security()
        except ModelLoadError as exc:
            logger.warning("URL AI scan unavailable: %s", exc)
            return {
                "available": False,
                "model_version": None,
                "urls_found": 0,
                "scanned": 0,
                "is_malicious": False,
                "max_malware_score": None,
                "results": [],
                "error": str(exc),
            }

        all_urls = self._extract_urls(data)
        urls = [url for url in all_urls if not self._is_safe_metadata_url(url)]
        ignored_urls_count = len(all_urls) - len(urls)
        logger.info(
            "URL AI scan start: model=%s urls_found=%s scanned_candidates=%s ignored_metadata=%s",
            artifacts.model_version,
            len(all_urls),
            len(urls),
            ignored_urls_count,
        )
        results = []
        for url in urls[:MAX_URLS_TO_SCAN]:
            encoded = artifacts.tokenizer(url, truncation=True, max_length=256, return_tensors="pt")
            with torch.no_grad():
                output = artifacts.model(**encoded)
                probabilities = torch.softmax(output.logits, dim=-1)[0]
            malware_index = int(artifacts.model.config.label2id.get("MALWARE", 1))
            benign_index = int(artifacts.model.config.label2id.get("BENIGN", 0))
            malware_score = float(probabilities[malware_index].item())
            benign_score = float(probabilities[benign_index].item())
            label = "malware" if malware_score >= benign_score else "benign"
            results.append(
                {
                    "url": url,
                    "label": label,
                    "malware_score": malware_score,
                    "benign_score": benign_score,
                }
            )

        threshold = self._url_security_threshold()
        max_malware_score = max((item["malware_score"] for item in results), default=None)
        is_malicious = bool(max_malware_score is not None and max_malware_score >= threshold)
        payload = {
            "available": True,
            "model_version": artifacts.model_version,
            "urls_found": len(all_urls),
            "ignored_metadata_urls": ignored_urls_count,
            "scanned": len(results),
            "is_malicious": is_malicious,
            "max_malware_score": max_malware_score,
            "threshold": threshold,
            "results": results,
        }
        logger.info(
            "URL AI scan result: model=%s urls_found=%s scanned=%s malicious=%s max_score=%s",
            artifacts.model_version,
            len(all_urls),
            len(results),
            is_malicious,
            f"{max_malware_score:.4f}" if max_malware_score is not None else None,
        )
        return payload

    def scan_document_threats(self, data: bytes) -> dict[str, Any]:
        features: list[dict[str, Any]] = []
        file_kind = self._document_kind(data)
        if file_kind == "pdf":
            features.extend(self._scan_pdf_threat_features(data))
        elif file_kind == "office_zip":
            features.extend(self._scan_office_zip_threat_features(data))
        elif data.startswith(OLE_SIGNATURE):
            features.extend(self._scan_ole_threat_features(data))

        score = min(1.0, sum(float(item["weight"]) for item in features))
        high_risk = [item for item in features if float(item["weight"]) >= 0.7]
        is_malicious = bool(score >= 0.6 or high_risk)
        payload = {
            "available": True,
            "model_version": "document-threat-feature-ai-v1",
            "file_kind": file_kind,
            "is_malicious": is_malicious,
            "score": score,
            "features": features,
        }
        logger.info(
            "Document threat scan result: kind=%s features=%s malicious=%s score=%.4f",
            file_kind,
            len(features),
            is_malicious,
            score,
        )
        return payload

    def scan_image_threats(self, data: bytes) -> dict[str, Any]:
        features: list[dict[str, Any]] = []
        looks_like_image = self._looks_like_image(data)
        image_format: str | None = None
        dimensions: tuple[int, int] | None = None

        if not looks_like_image:
            return {
                "available": True,
                "model_version": "image-threat-feature-ai-v1",
                "applicable": False,
                "image_format": None,
                "dimensions": None,
                "is_malicious": False,
                "score": 0.0,
                "features": [],
            }

        try:
            with Image.open(io.BytesIO(data)) as image:
                image_format = image.format
                dimensions = image.size
                image.verify()
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            features.append({
                "label": "malformed_image",
                "weight": 0.8,
                "count": 1,
                "detail": str(exc)[:160],
            })

        pe_count = self._count_embedded_pe(data)
        if pe_count:
            features.append({"label": "embedded_pe_executable", "weight": 0.9, "count": pe_count})

        for signature, label, weight in EMBEDDED_EXECUTABLE_PATTERNS:
            count = data[:10_000_000].count(signature)
            if count:
                features.append({"label": label, "weight": weight, "count": count})

        for pattern, label, weight in IMAGE_SUSPICIOUS_PATTERNS:
            matches = len(re.findall(pattern, data[:5_000_000], flags=re.IGNORECASE))
            if matches:
                features.append({"label": label, "weight": weight, "count": matches})

        trailing_bytes = self._image_trailing_bytes(data)
        if len(trailing_bytes) > 4096:
            features.append({
                "label": "large_appended_data",
                "weight": 0.35,
                "count": 1,
                "bytes": len(trailing_bytes),
            })
            if self._count_embedded_pe(trailing_bytes):
                features.append({"label": "appended_pe_executable", "weight": 0.95, "count": 1})

        features = self._merge_feature_counts(features)
        score = min(1.0, sum(float(item["weight"]) for item in features))
        high_risk = [item for item in features if float(item["weight"]) >= 0.7]
        is_malicious = bool(score >= 0.75 or high_risk)
        payload = {
            "available": True,
            "model_version": "image-threat-feature-ai-v1",
            "applicable": True,
            "image_format": image_format,
            "dimensions": list(dimensions) if dimensions else None,
            "is_malicious": is_malicious,
            "score": score,
            "features": features,
        }
        logger.info(
            "Image threat scan result: format=%s features=%s malicious=%s score=%.4f",
            image_format,
            len(features),
            is_malicious,
            score,
        )
        return payload

    def _document_kind(self, data: bytes) -> str:
        if data.lstrip().startswith(b"%PDF"):
            return "pdf"
        if self._looks_like_zip(data):
            return "office_zip"
        if data.startswith(OLE_SIGNATURE):
            return "ole"
        return "other"

    def _looks_like_image(self, data: bytes) -> bool:
        return any(data.startswith(prefix) for prefix in IMAGE_MAGIC_PREFIXES)

    def _image_trailing_bytes(self, data: bytes) -> bytes:
        if data.startswith(b"\xff\xd8\xff"):
            marker = data.rfind(b"\xff\xd9")
            return data[marker + 2:] if marker >= 0 else b""
        if data.startswith(b"\x89PNG\r\n\x1a\n"):
            marker = data.rfind(b"IEND")
            return data[marker + 8:] if marker >= 0 and marker + 8 <= len(data) else b""
        if data.startswith((b"GIF87a", b"GIF89a")):
            marker = data.rfind(b"\x3b")
            return data[marker + 1:] if marker >= 0 else b""
        return b""

    def _scan_pdf_threat_features(self, data: bytes) -> list[dict[str, Any]]:
        searchable = bytearray(data[:5_000_000])
        for stream in self._extract_pdf_streams(data):
            searchable.extend(stream[:1_000_000])

        features = []
        for pattern, label, weight in PDF_DANGEROUS_PATTERNS:
            matches = len(re.findall(pattern, searchable, flags=re.IGNORECASE))
            if matches:
                features.append({"label": label, "weight": weight, "count": matches})

        pe_count = self._count_embedded_pe(bytes(searchable))
        if pe_count:
            features.append({"label": "embedded_pe_executable", "weight": 0.9, "count": pe_count})

        for signature, label, weight in EMBEDDED_EXECUTABLE_PATTERNS:
            count = searchable.count(signature)
            if count:
                features.append({"label": label, "weight": weight, "count": count})
        return features

    def _scan_office_zip_threat_features(self, data: bytes) -> list[dict[str, Any]]:
        features = []
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                names = [info.filename for info in archive.infolist()]
                lower_names = [name.lower() for name in names]
                for dangerous_name, label, weight in DOCX_DANGEROUS_NAMES:
                    count = sum(1 for name in lower_names if name.startswith(dangerous_name))
                    if count:
                        features.append({"label": label, "weight": weight, "count": count})

                for info in archive.infolist()[:500]:
                    lower_name = info.filename.lower()
                    if info.file_size > 2_000_000:
                        continue
                    if lower_name.endswith((".exe", ".dll", ".scr", ".bat", ".cmd", ".ps1", ".js", ".vbs")):
                        features.append({"label": "office_embedded_executable_name", "weight": 0.9, "count": 1})
                    if not lower_name.endswith((".xml", ".rels", ".bin", ".ole")):
                        continue
                    with archive.open(info) as handle:
                        content = handle.read(2_000_000)
                    for pattern, label, weight in DOCX_DANGEROUS_XML:
                        matches = len(re.findall(pattern, content, flags=re.IGNORECASE))
                        if matches:
                            features.append({"label": label, "weight": weight, "count": matches})
                    pe_count = self._count_embedded_pe(content)
                    if pe_count:
                        features.append({"label": "embedded_pe_executable", "weight": 0.9, "count": pe_count})
                    for signature, label, weight in EMBEDDED_EXECUTABLE_PATTERNS:
                        count = content.count(signature)
                        if count:
                            features.append({"label": label, "weight": weight, "count": count})
        except zipfile.BadZipFile:
            return features
        return self._merge_feature_counts(features)

    def _scan_ole_threat_features(self, data: bytes) -> list[dict[str, Any]]:
        features = []
        suspicious_terms = (
            (rb"VBA|Macros|Attribut\x00e VB_Name", "ole_vba_macro_markers", 0.65),
            (rb"AutoOpen|Document_Open|Workbook_Open|Shell|CreateObject|PowerShell", "ole_suspicious_macro_strings", 0.75),
        )
        for pattern, label, weight in suspicious_terms:
            matches = len(re.findall(pattern, data[:5_000_000], flags=re.IGNORECASE))
            if matches:
                features.append({"label": label, "weight": weight, "count": matches})
        return features

    def _extract_pdf_streams(self, data: bytes) -> list[bytes]:
        streams = []
        for match in re.finditer(rb"stream\r?\n(.*?)\r?\nendstream", data[:10_000_000], flags=re.DOTALL):
            stream = match.group(1).strip(b"\r\n")
            streams.append(stream)
            for wbits in (zlib.MAX_WBITS, -zlib.MAX_WBITS):
                try:
                    streams.append(zlib.decompress(stream, wbits))
                    break
                except zlib.error:
                    continue
        return streams

    def _merge_feature_counts(self, features: list[dict[str, Any]]) -> list[dict[str, Any]]:
        merged: dict[str, dict[str, Any]] = {}
        for feature in features:
            label = str(feature["label"])
            if label not in merged:
                merged[label] = dict(feature)
                continue
            merged[label]["count"] = int(merged[label].get("count", 0)) + int(feature.get("count", 0))
            merged[label]["weight"] = max(float(merged[label]["weight"]), float(feature["weight"]))
        return list(merged.values())

    def _count_embedded_pe(self, data: bytes) -> int:
        count = 0
        start = 0
        while True:
            offset = data.find(b"MZ", start)
            if offset < 0:
                break
            if self._looks_like_pe(data[offset:offset + 1_000_000]):
                count += 1
            start = offset + 2
        return count

    def _url_security_threshold(self) -> float:
        raw_threshold = os.getenv("URL_SECURITY_THRESHOLD")
        if raw_threshold is None:
            return DEFAULT_URL_SECURITY_THRESHOLD
        try:
            threshold = float(raw_threshold)
        except ValueError:
            logger.warning(
                "Invalid URL_SECURITY_THRESHOLD=%r; using default %.2f",
                raw_threshold,
                DEFAULT_URL_SECURITY_THRESHOLD,
            )
            return DEFAULT_URL_SECURITY_THRESHOLD
        return max(0.0, min(1.0, threshold))

    def _extract_urls(self, data: bytes) -> list[str]:
        candidates = set(self._extract_urls_from_bytes(data))
        if self._looks_like_zip(data):
            try:
                with zipfile.ZipFile(io.BytesIO(data)) as archive:
                    for info in archive.infolist()[:200]:
                        if info.file_size > 2_000_000:
                            continue
                        if not info.filename.lower().endswith((".xml", ".rels", ".txt", ".html", ".htm")):
                            continue
                        with archive.open(info) as handle:
                            candidates.update(self._extract_urls_from_bytes(handle.read(2_000_000)))
            except zipfile.BadZipFile:
                pass
        return sorted(candidates)

    def _is_safe_metadata_url(self, url: str) -> bool:
        normalized = url.lower().strip()
        return normalized.startswith(SAFE_URL_PREFIXES)

    def _extract_urls_from_bytes(self, data: bytes) -> list[str]:
        urls = []
        for match in URL_PATTERN.findall(data[:5_000_000]):
            url = match.decode("utf-8", errors="ignore").strip(".,;:)]}>\"'")
            if url:
                urls.append(url)
        return urls

    def _looks_like_zip(self, data: bytes) -> bool:
        return data.startswith(b"PK\x03\x04") or data.startswith(b"PK\x05\x06") or data.startswith(b"PK\x07\x08")

    def _prepare_malware_bytes(self, data: bytes) -> np.ndarray:
        limited = data[:MAX_MALWARE_INPUT_BYTES]
        array = np.frombuffer(limited, dtype=np.uint8).astype(np.int32)
        if array.size < MAX_MALWARE_INPUT_BYTES:
            padded = np.zeros(MAX_MALWARE_INPUT_BYTES, dtype=np.int32)
            padded[: array.size] = array
            array = padded
        return np.expand_dims(array, axis=0)

    def _is_supported_executable(self, data: bytes) -> bool:
        return self._looks_like_pe(data) or data.startswith(OLE_SIGNATURE)

    def _looks_like_pe(self, data: bytes) -> bool:
        if len(data) < 64 or not data.startswith(b"MZ"):
            return False
        pe_offset = int.from_bytes(data[PE_HEADER_OFFSET:PE_HEADER_OFFSET + 4], "little", signed=False)
        if pe_offset <= 0 or pe_offset + 4 > len(data):
            return False
        return data[pe_offset:pe_offset + 4] == PE_SIGNATURE


registry = ModelRegistry()
