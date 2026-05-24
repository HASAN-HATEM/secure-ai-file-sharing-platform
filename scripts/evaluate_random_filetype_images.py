import argparse
import json
import random
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import torch

from predict_filetype_image import (
    DEFAULT_MAPPING_PATH,
    DEFAULT_MODEL_PATH,
    build_model,
    load_class_mapping,
    predict_one,
)


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_ROOT = PROJECT_ROOT / "training-data" / "processed" / "test"
DEFAULT_REPORT_PATH = PROJECT_ROOT / "models" / "random_evaluation_report.txt"
DEFAULT_JSON_PATH = PROJECT_ROOT / "models" / "random_evaluation_predictions.json"
CLASS_NAMES = ["logo", "screenshot", "document_scan", "photo", "diagram"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate random images from all file-type classes.")
    parser.add_argument("--data-dir", default=str(DEFAULT_DATA_ROOT))
    parser.add_argument("--model", default=str(DEFAULT_MODEL_PATH))
    parser.add_argument("--mapping", default=str(DEFAULT_MAPPING_PATH))
    parser.add_argument("--samples-per-class", type=int, default=10)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--threshold", type=float, default=0.0)
    parser.add_argument("--output-json", default=str(DEFAULT_JSON_PATH))
    parser.add_argument("--report", default=str(DEFAULT_REPORT_PATH))
    return parser.parse_args()


def sample_images(data_dir: Path, samples_per_class: int, rng: random.Random) -> list[tuple[str, Path]]:
    selected: list[tuple[str, Path]] = []
    for class_name in CLASS_NAMES:
        class_dir = data_dir / class_name
        images = sorted(path for path in class_dir.iterdir() if path.is_file() and path.name != ".gitkeep")
        if not images:
            print(f"[warn] no images found for class={class_name}")
            continue
        sample_size = min(samples_per_class, len(images))
        sampled = rng.sample(images, sample_size)
        selected.extend((class_name, path) for path in sampled)
        print(f"[sample] {class_name}: {sample_size}/{len(images)}")
    return selected


def write_report(path: Path, payload: dict[str, Any]) -> None:
    lines = [
        "Random File-Type Classifier Evaluation",
        f"Generated: {payload['generated_at']}",
        f"Model: {payload['model']}",
        f"Data: {payload['data_dir']}",
        f"Seed: {payload['seed']}",
        f"Threshold: {payload['threshold']}",
        "",
        f"Total samples: {payload['total_samples']}",
        f"Correct: {payload['correct']}",
        f"Incorrect: {payload['incorrect']}",
        f"Uncertain: {payload['uncertain']}",
        f"Accuracy excluding uncertain: {payload['accuracy_excluding_uncertain']:.4f}",
        f"Coverage: {payload['coverage']:.4f}",
        "",
        "Per-class:",
    ]
    for class_name, stats in payload["per_class"].items():
        lines.append(
            f"  {class_name}: total={stats['total']} correct={stats['correct']} "
            f"incorrect={stats['incorrect']} uncertain={stats['uncertain']}"
        )
    lines.append("")
    lines.append("Predictions:")
    for item in payload["predictions"]:
        lines.append(
            f"  actual={item['actual_class']} predicted={item['predicted_class']} "
            f"raw={item['raw_predicted_class']} confidence={item['confidence']:.4f} image={item['image']}"
        )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    args = parse_args()
    data_dir = Path(args.data_dir)
    model_path = Path(args.model)
    mapping_path = Path(args.mapping)
    rng = random.Random(args.seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    classes = load_class_mapping(mapping_path)
    model = build_model(model_path, classes, device)

    selected = sample_images(data_dir, args.samples_per_class, rng)
    predictions = []
    per_class = {
        class_name: {"total": 0, "correct": 0, "incorrect": 0, "uncertain": 0}
        for class_name in CLASS_NAMES
    }
    predicted_counter: Counter[str] = Counter()
    for actual_class, image_path in selected:
        prediction = predict_one(model, image_path, classes, device, top_k=3, threshold=args.threshold)
        prediction["actual_class"] = actual_class
        predictions.append(prediction)

        predicted_class = prediction["predicted_class"]
        predicted_counter[predicted_class] += 1
        stats = per_class[actual_class]
        stats["total"] += 1
        if predicted_class == "uncertain":
            stats["uncertain"] += 1
        elif predicted_class == actual_class:
            stats["correct"] += 1
        else:
            stats["incorrect"] += 1
        print(
            f"[predict] actual={actual_class} predicted={predicted_class} "
            f"confidence={prediction['confidence']:.4f} image={image_path.name}"
        )

    correct = sum(stats["correct"] for stats in per_class.values())
    uncertain = sum(stats["uncertain"] for stats in per_class.values())
    total = sum(stats["total"] for stats in per_class.values())
    incorrect = total - correct - uncertain
    decided = max(1, total - uncertain)
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": str(model_path),
        "mapping": str(mapping_path),
        "data_dir": str(data_dir),
        "seed": args.seed,
        "threshold": args.threshold,
        "samples_per_class": args.samples_per_class,
        "total_samples": total,
        "correct": correct,
        "incorrect": incorrect,
        "uncertain": uncertain,
        "accuracy_excluding_uncertain": correct / decided,
        "coverage": (total - uncertain) / max(1, total),
        "prediction_counts": dict(predicted_counter),
        "per_class": per_class,
        "predictions": predictions,
    }

    output_json = Path(args.output_json)
    output_json.parent.mkdir(parents=True, exist_ok=True)
    output_json.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    write_report(Path(args.report), payload)
    print(f"Saved JSON predictions to {output_json}")
    print(f"Saved readable report to {args.report}")


if __name__ == "__main__":
    main()
