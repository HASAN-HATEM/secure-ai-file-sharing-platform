import argparse
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image, UnidentifiedImageError


PROJECT_ROOT = Path(__file__).resolve().parents[1]
TRAINING_ROOT = PROJECT_ROOT / "training-data"

SOURCE_MAPPINGS = {
    "diagram": TRAINING_ROOT / "downloads" / "ai2d" / "images",
    "logo": TRAINING_ROOT / "downloads" / "datasetcopy",
    "document_scan": TRAINING_ROOT / "downloads" / "docs-sm",
    "photo": TRAINING_ROOT / "downloads" / "natural_images",
    "screenshot": TRAINING_ROOT / "downloads" / "unique_uis" / "combined",
}

IGNORED_PATH_PARTS = {
    "rico_dataset_v0.1_semantic_annotations",
}

IMAGE_EXTENSIONS = {
    "JPEG": ".jpg",
    "PNG": ".png",
    "WEBP": ".webp",
    "BMP": ".bmp",
    "GIF": ".gif",
    "TIFF": ".tif",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Copy and validate downloaded datasets into training-data/raw."
    )
    parser.add_argument(
        "--limit-per-class",
        type=int,
        default=1000,
        help="Maximum valid unique images to copy into each class folder.",
    )
    parser.add_argument(
        "--class-limit",
        action="append",
        default=[],
        metavar="CLASS=COUNT",
        help="Override the copy limit for one class. Can be passed more than once.",
    )
    parser.add_argument(
        "--summary",
        default=str(TRAINING_ROOT / "dataset_summary.json"),
        help="Path to write dataset_summary.json.",
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Remove existing images in training-data/raw class folders before ingesting.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and summarize without copying files.",
    )
    return parser.parse_args()


def parse_class_limits(values: list[str], default_limit: int) -> dict[str, int]:
    limits = {label: default_limit for label in SOURCE_MAPPINGS}
    for value in values:
        if "=" not in value:
            raise ValueError(f"Invalid --class-limit value: {value}. Expected CLASS=COUNT")
        label, raw_count = value.split("=", 1)
        label = label.strip()
        if label not in SOURCE_MAPPINGS:
            raise ValueError(f"Unknown class in --class-limit: {label}")
        try:
            count = int(raw_count)
        except ValueError as exc:
            raise ValueError(f"Invalid count in --class-limit: {value}") from exc
        if count <= 0:
            raise ValueError(f"--class-limit count must be greater than zero: {value}")
        limits[label] = count
    return limits


def is_ignored(path: Path) -> bool:
    return any(part in IGNORED_PATH_PARTS for part in path.parts)


def ensure_raw_dirs() -> None:
    for label in SOURCE_MAPPINGS:
        target_dir = TRAINING_ROOT / "raw" / label
        target_dir.mkdir(parents=True, exist_ok=True)
        (target_dir / ".gitkeep").touch(exist_ok=True)


def clean_raw_dirs() -> None:
    for label in SOURCE_MAPPINGS:
        target_dir = TRAINING_ROOT / "raw" / label
        if not target_dir.exists():
            continue
        for child in target_dir.iterdir():
            if child.name == ".gitkeep":
                continue
            if child.is_file():
                child.unlink()


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_image(path: Path) -> tuple[bool, str | None, tuple[int, int] | None]:
    try:
        with Image.open(path) as image:
            image.verify()
        with Image.open(path) as image:
            image.load()
            return True, image.format, image.size
    except (UnidentifiedImageError, OSError, ValueError):
        return False, None, None


def target_extension(source: Path, image_format: str | None) -> str:
    if image_format in IMAGE_EXTENSIONS:
        return IMAGE_EXTENSIONS[image_format]
    suffix = source.suffix.lower()
    return suffix if suffix else ".img"


def unique_target_path(label: str, source: Path, digest: str, image_format: str | None) -> Path:
    target_dir = TRAINING_ROOT / "raw" / label
    ext = target_extension(source, image_format)
    stem = source.stem.replace(" ", "_")[:60] or "image"
    return target_dir / f"{label}_{stem}_{digest[:12]}{ext}"


def ingest_class(
    label: str,
    source_dir: Path,
    limit: int,
    seen_hashes: set[str],
    dry_run: bool,
) -> dict[str, Any]:
    stats: dict[str, Any] = {
        "label": label,
        "source": str(source_dir.relative_to(PROJECT_ROOT)) if source_dir.exists() else str(source_dir),
        "target": str((TRAINING_ROOT / "raw" / label).relative_to(PROJECT_ROOT)),
        "source_exists": source_dir.exists(),
        "scanned_files": 0,
        "copied": 0,
        "skipped_non_image": 0,
        "skipped_duplicate": 0,
        "skipped_limit": 0,
        "formats": {},
        "examples": [],
    }
    if not source_dir.exists():
        return stats

    for source in sorted(source_dir.rglob("*")):
        if stats["copied"] >= limit:
            if source.is_file() and not is_ignored(source):
                stats["skipped_limit"] += 1
            continue
        if not source.is_file() or is_ignored(source):
            continue

        stats["scanned_files"] += 1
        valid, image_format, size = validate_image(source)
        if not valid:
            stats["skipped_non_image"] += 1
            continue

        digest = file_hash(source)
        if digest in seen_hashes:
            stats["skipped_duplicate"] += 1
            continue

        seen_hashes.add(digest)
        stats["formats"][image_format or "unknown"] = stats["formats"].get(image_format or "unknown", 0) + 1
        target = unique_target_path(label, source, digest, image_format)
        if not dry_run:
            shutil.copy2(source, target)
        stats["copied"] += 1
        if len(stats["examples"]) < 5:
            stats["examples"].append(
                {
                    "source": str(source.relative_to(PROJECT_ROOT)),
                    "target": str(target.relative_to(PROJECT_ROOT)),
                    "sha256": digest,
                    "size": size,
                    "format": image_format,
                }
            )

    return stats


def write_summary(summary_path: Path, summary: dict[str, Any]) -> None:
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")


def main() -> None:
    args = parse_args()
    if args.limit_per_class <= 0:
        raise ValueError("--limit-per-class must be greater than zero")
    class_limits = parse_class_limits(args.class_limit, args.limit_per_class)

    ensure_raw_dirs()
    if args.clean and not args.dry_run:
        clean_raw_dirs()

    seen_hashes: set[str] = set()
    classes = {}
    for label, source_dir in SOURCE_MAPPINGS.items():
        classes[label] = ingest_class(
            label=label,
            source_dir=source_dir,
            limit=class_limits[label],
            seen_hashes=seen_hashes,
            dry_run=args.dry_run,
        )

    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "limit_per_class": args.limit_per_class,
        "class_limits": class_limits,
        "dry_run": args.dry_run,
        "ignored_path_parts": sorted(IGNORED_PATH_PARTS),
        "total_copied": sum(item["copied"] for item in classes.values()),
        "classes": classes,
    }
    write_summary(Path(args.summary), summary)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
