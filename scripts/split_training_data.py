import argparse
import json
import random
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image, UnidentifiedImageError


PROJECT_ROOT = Path(__file__).resolve().parents[1]
TRAINING_ROOT = PROJECT_ROOT / "training-data"
RAW_ROOT = TRAINING_ROOT / "raw"
PROCESSED_ROOT = TRAINING_ROOT / "processed"
CLASS_NAMES = ["logo", "screenshot", "document_scan", "photo", "diagram"]
SPLITS = {
    "train": 0.70,
    "val": 0.15,
    "test": 0.15,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Split raw training images into train/val/test folders.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducible splits.")
    parser.add_argument("--clean", action="store_true", help="Remove old processed split data before copying.")
    parser.add_argument(
        "--summary",
        default=str(TRAINING_ROOT / "split_summary.json"),
        help="Path to write split_summary.json.",
    )
    return parser.parse_args()


def validate_image(path: Path) -> bool:
    try:
        with Image.open(path) as image:
            image.verify()
        with Image.open(path) as image:
            image.load()
        return True
    except (UnidentifiedImageError, OSError, ValueError):
        return False


def ensure_processed_dirs() -> None:
    for split in SPLITS:
        for class_name in CLASS_NAMES:
            target_dir = PROCESSED_ROOT / split / class_name
            target_dir.mkdir(parents=True, exist_ok=True)
            (target_dir / ".gitkeep").touch(exist_ok=True)


def clean_processed_dirs() -> None:
    for split in SPLITS:
        split_dir = PROCESSED_ROOT / split
        if not split_dir.exists():
            continue
        for child in split_dir.iterdir():
            if child.is_dir():
                shutil.rmtree(child)
            elif child.name != ".gitkeep":
                child.unlink()


def split_counts(total: int) -> dict[str, int]:
    train_count = int(total * SPLITS["train"])
    val_count = int(total * SPLITS["val"])
    test_count = total - train_count - val_count
    return {
        "train": train_count,
        "val": val_count,
        "test": test_count,
    }


def copy_split(files: list[Path], class_name: str, counts: dict[str, int]) -> dict[str, Any]:
    copied: dict[str, int] = {}
    examples: dict[str, list[str]] = {}
    cursor = 0
    for split, count in counts.items():
        split_files = files[cursor:cursor + count]
        cursor += count
        target_dir = PROCESSED_ROOT / split / class_name
        target_dir.mkdir(parents=True, exist_ok=True)
        (target_dir / ".gitkeep").touch(exist_ok=True)

        copied[split] = 0
        examples[split] = []
        for source in split_files:
            target = target_dir / source.name
            shutil.copy2(source, target)
            copied[split] += 1
            if len(examples[split]) < 3:
                examples[split].append(str(target.relative_to(PROJECT_ROOT)))
    return {
        "copied": copied,
        "examples": examples,
    }


def split_class(class_name: str, rng: random.Random) -> dict[str, Any]:
    source_dir = RAW_ROOT / class_name
    stats: dict[str, Any] = {
        "source": str(source_dir.relative_to(PROJECT_ROOT)),
        "source_exists": source_dir.exists(),
        "valid_images": 0,
        "invalid_images": 0,
        "splits": {},
        "examples": {},
    }
    if not source_dir.exists():
        print(f"[{class_name}] source folder missing: {source_dir}")
        return stats

    print(f"[{class_name}] validating images from {source_dir}")
    valid_files: list[Path] = []
    for source in sorted(source_dir.iterdir()):
        if not source.is_file() or source.name == ".gitkeep":
            continue
        if validate_image(source):
            valid_files.append(source)
        else:
            stats["invalid_images"] += 1

    rng.shuffle(valid_files)
    stats["valid_images"] = len(valid_files)
    counts = split_counts(len(valid_files))
    print(
        f"[{class_name}] valid={len(valid_files)} invalid={stats['invalid_images']} "
        f"train={counts['train']} val={counts['val']} test={counts['test']}"
    )
    copied = copy_split(valid_files, class_name, counts)
    stats["splits"] = copied["copied"]
    stats["examples"] = copied["examples"]
    return stats


def write_summary(path: Path, summary: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(summary, indent=2), encoding="utf-8")


def main() -> None:
    args = parse_args()
    print(f"Preparing processed dataset with seed={args.seed}")
    if args.clean:
        print(f"Cleaning old processed data from {PROCESSED_ROOT}")
        clean_processed_dirs()
    ensure_processed_dirs()

    rng = random.Random(args.seed)
    classes: dict[str, Any] = {}
    for class_name in CLASS_NAMES:
        classes[class_name] = split_class(class_name, rng)

    totals = {
        split: sum(class_stats["splits"].get(split, 0) for class_stats in classes.values())
        for split in SPLITS
    }
    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "seed": args.seed,
        "ratios": SPLITS,
        "totals": totals,
        "classes": classes,
    }
    write_summary(Path(args.summary), summary)
    print(f"Wrote summary to {args.summary}")
    print(json.dumps({"totals": totals}, indent=2))


if __name__ == "__main__":
    main()
