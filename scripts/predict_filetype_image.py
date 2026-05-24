import argparse
import json
from pathlib import Path
from typing import Any

import torch
from PIL import Image
from torch import nn
from torchvision import transforms
from torchvision.models import resnet50


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODEL_PATH = PROJECT_ROOT / "models" / "resnet50_filetype_classifier.pt"
DEFAULT_MAPPING_PATH = PROJECT_ROOT / "models" / "class_mapping.json"
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Predict file image category with the trained ResNet50 model.")
    parser.add_argument("image_path", help="Path to an image file or a folder of images to classify.")
    parser.add_argument("--model", default=str(DEFAULT_MODEL_PATH), help="Path to .pt model checkpoint.")
    parser.add_argument("--mapping", default=str(DEFAULT_MAPPING_PATH), help="Path to class_mapping.json.")
    parser.add_argument("--top-k", type=int, default=3, help="Number of predictions to print.")
    parser.add_argument("--threshold", type=float, default=0.0, help="Return uncertain below this confidence.")
    parser.add_argument("--output-json", help="Optional path to save predictions as JSON.")
    parser.add_argument("--recursive", action="store_true", help="Recurse when image_path is a folder.")
    return parser.parse_args()


def load_class_mapping(path: Path) -> list[str]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    classes = payload.get("classes")
    if not isinstance(classes, list) or not classes:
        raise ValueError(f"Invalid class mapping: {path}")
    return [str(label) for label in classes]


def build_model(model_path: Path, classes: list[str], device: torch.device) -> nn.Module:
    checkpoint = torch.load(model_path, map_location=device)
    model = resnet50(weights=None)
    model.fc = nn.Linear(model.fc.in_features, len(classes))
    model.load_state_dict(checkpoint["model_state_dict"])
    model.to(device)
    model.eval()
    return model


def preprocess_image(path: Path) -> torch.Tensor:
    transform = transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
        ]
    )
    with Image.open(path) as image:
        image = image.convert("RGB")
        return transform(image).unsqueeze(0)


def discover_images(path: Path, recursive: bool) -> list[Path]:
    if path.is_file():
        return [path]
    iterator = path.rglob("*") if recursive else path.glob("*")
    return sorted(candidate for candidate in iterator if candidate.is_file())


def predict_one(
    model: nn.Module,
    image_path: Path,
    classes: list[str],
    device: torch.device,
    top_k: int,
    threshold: float,
) -> dict[str, Any]:
    tensor = preprocess_image(image_path).to(device)
    with torch.no_grad():
        logits = model(tensor)
        probabilities = torch.softmax(logits, dim=1)[0]

    top_k = max(1, min(top_k, len(classes)))
    values, indices = torch.topk(probabilities, top_k)
    confidence = float(values[0].item())
    raw_label = classes[int(indices[0].item())]
    predicted_class = raw_label if confidence >= threshold else "uncertain"
    top_predictions = [
        {
            "class": classes[int(index)],
            "confidence": float(value),
        }
        for value, index in zip(values.tolist(), indices.tolist())
    ]
    return {
        "image": str(image_path),
        "predicted_class": predicted_class,
        "raw_predicted_class": raw_label,
        "confidence": confidence,
        "threshold": threshold,
        "top_predictions": top_predictions,
    }


def main() -> None:
    args = parse_args()
    image_path = Path(args.image_path)
    model_path = Path(args.model)
    mapping_path = Path(args.mapping)

    if not image_path.exists():
        raise FileNotFoundError(f"Image path not found: {image_path}")
    if not model_path.exists():
        raise FileNotFoundError(f"Model not found: {model_path}")
    if not mapping_path.exists():
        raise FileNotFoundError(f"Class mapping not found: {mapping_path}")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    classes = load_class_mapping(mapping_path)
    model = build_model(model_path, classes, device)
    images = discover_images(image_path, args.recursive)
    predictions: list[dict[str, Any]] = []
    skipped: list[dict[str, str]] = []
    for candidate in images:
        try:
            prediction = predict_one(model, candidate, classes, device, args.top_k, args.threshold)
            predictions.append(prediction)
            print(
                f"{candidate}: {prediction['predicted_class']} "
                f"confidence={prediction['confidence']:.4f} raw={prediction['raw_predicted_class']}"
            )
            if len(images) == 1:
                print("Top predictions:")
                for rank, item in enumerate(prediction["top_predictions"], start=1):
                    confidence = item["confidence"]
                    print(f"  {rank}. {item['class']}: {confidence:.4f} ({confidence * 100:.2f}%)")
        except Exception as exc:
            skipped.append({"image": str(candidate), "error": str(exc)})

    result = {
        "model": str(model_path),
        "mapping": str(mapping_path),
        "threshold": args.threshold,
        "total": len(images),
        "predicted": len(predictions),
        "skipped": skipped,
        "predictions": predictions,
    }
    if args.output_json:
        output_path = Path(args.output_json)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
        print(f"Saved predictions to {output_path}")


if __name__ == "__main__":
    main()
