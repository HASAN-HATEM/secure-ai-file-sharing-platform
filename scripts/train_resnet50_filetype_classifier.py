import argparse
import csv
import json
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import torch
from torch import nn
from torch.utils.data import DataLoader
from torchvision import datasets, transforms
from torchvision.models import ResNet50_Weights, resnet50


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = PROJECT_ROOT / "training-data" / "processed"
MODELS_ROOT = PROJECT_ROOT / "models"
EXPECTED_CLASSES = ["logo", "screenshot", "document_scan", "photo", "diagram"]
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train a ResNet50 file-type image classifier.")
    parser.add_argument("--train-dir", default=str(DATA_ROOT / "train"))
    parser.add_argument("--val-dir", default=str(DATA_ROOT / "val"))
    parser.add_argument("--test-dir", default=str(DATA_ROOT / "test"))
    parser.add_argument("--output-dir", default=str(MODELS_ROOT))
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--learning-rate", type=float, default=0.001)
    parser.add_argument("--num-workers", type=int, default=0)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--unfreeze-backbone", action="store_true")
    return parser.parse_args()


def set_seed(seed: int) -> None:
    random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def build_transforms() -> tuple[transforms.Compose, transforms.Compose]:
    train_transform = transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.RandomHorizontalFlip(p=0.5),
            transforms.RandomRotation(degrees=5),
            transforms.ColorJitter(brightness=0.12, contrast=0.12, saturation=0.08),
            transforms.ToTensor(),
            transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
        ]
    )
    eval_transform = transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
        ]
    )
    return train_transform, eval_transform


def load_datasets(args: argparse.Namespace) -> tuple[datasets.ImageFolder, datasets.ImageFolder, datasets.ImageFolder]:
    train_transform, eval_transform = build_transforms()
    train_dataset = datasets.ImageFolder(args.train_dir, transform=train_transform)
    val_dataset = datasets.ImageFolder(args.val_dir, transform=eval_transform)
    test_dataset = datasets.ImageFolder(args.test_dir, transform=eval_transform)

    actual_classes = set(train_dataset.classes)
    expected_classes = set(EXPECTED_CLASSES)
    if actual_classes != expected_classes:
        raise ValueError(
            f"Train classes do not match expected classes. "
            f"expected={sorted(expected_classes)} actual={sorted(actual_classes)}"
        )
    if val_dataset.class_to_idx != train_dataset.class_to_idx:
        raise ValueError("Validation class mapping does not match training class mapping")
    if test_dataset.class_to_idx != train_dataset.class_to_idx:
        raise ValueError("Test class mapping does not match training class mapping")

    return train_dataset, val_dataset, test_dataset


def build_model(num_classes: int, unfreeze_backbone: bool) -> nn.Module:
    weights = ResNet50_Weights.DEFAULT
    model = resnet50(weights=weights)
    if not unfreeze_backbone:
        for param in model.parameters():
            param.requires_grad = False
    model.fc = nn.Linear(model.fc.in_features, num_classes)
    return model


def run_epoch(
    model: nn.Module,
    loader: DataLoader,
    loss_fn: nn.Module,
    device: torch.device,
    optimizer: torch.optim.Optimizer | None = None,
) -> tuple[float, float]:
    is_train = optimizer is not None
    model.train(is_train)
    total_loss = 0.0
    correct = 0
    total = 0

    for images, labels in loader:
        images = images.to(device)
        labels = labels.to(device)

        if is_train:
            optimizer.zero_grad()

        with torch.set_grad_enabled(is_train):
            outputs = model(images)
            loss = loss_fn(outputs, labels)
            if is_train:
                loss.backward()
                optimizer.step()

        total_loss += float(loss.item()) * labels.size(0)
        predictions = outputs.argmax(dim=1)
        correct += int((predictions == labels).sum().item())
        total += labels.size(0)

    avg_loss = total_loss / max(1, total)
    accuracy = correct / max(1, total)
    return avg_loss, accuracy


def save_class_mapping(output_dir: Path, class_to_idx: dict[str, int]) -> None:
    idx_to_class = {str(index): label for label, index in class_to_idx.items()}
    mapping = {
        "class_to_idx": class_to_idx,
        "idx_to_class": idx_to_class,
        "classes": [idx_to_class[str(index)] for index in range(len(idx_to_class))],
    }
    (output_dir / "class_mapping.json").write_text(json.dumps(mapping, indent=2), encoding="utf-8")


def evaluate_confusion_matrix(
    model: nn.Module,
    loader: DataLoader,
    device: torch.device,
    num_classes: int,
) -> list[list[int]]:
    matrix = [[0 for _ in range(num_classes)] for _ in range(num_classes)]
    model.eval()
    with torch.no_grad():
        for images, labels in loader:
            images = images.to(device)
            labels = labels.to(device)
            predictions = model(images).argmax(dim=1)
            for actual, predicted in zip(labels.cpu().tolist(), predictions.cpu().tolist()):
                matrix[actual][predicted] += 1
    return matrix


def save_confusion_matrix(output_dir: Path, matrix: list[list[int]], classes: list[str]) -> None:
    json_payload = {
        "classes": classes,
        "matrix": matrix,
        "rows_are_actual": True,
        "columns_are_predicted": True,
    }
    (output_dir / "confusion_matrix.json").write_text(json.dumps(json_payload, indent=2), encoding="utf-8")

    with (output_dir / "confusion_matrix.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["actual\\predicted", *classes])
        for class_name, row in zip(classes, matrix):
            writer.writerow([class_name, *row])


def save_training_history(output_dir: Path, history: list[dict[str, Any]]) -> None:
    (output_dir / "training_history.json").write_text(json.dumps(history, indent=2), encoding="utf-8")


def main() -> None:
    args = parse_args()
    set_seed(args.seed)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("Loading datasets")
    train_dataset, val_dataset, test_dataset = load_datasets(args)
    print(f"Classes: {train_dataset.class_to_idx}")
    print(f"Train images: {len(train_dataset)}")
    print(f"Validation images: {len(val_dataset)}")
    print(f"Test images: {len(test_dataset)}")

    train_loader = DataLoader(
        train_dataset,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=args.num_workers,
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=args.num_workers,
    )
    test_loader = DataLoader(
        test_dataset,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=args.num_workers,
    )

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    model = build_model(num_classes=len(train_dataset.classes), unfreeze_backbone=args.unfreeze_backbone)
    model.to(device)

    trainable_params = [param for param in model.parameters() if param.requires_grad]
    optimizer = torch.optim.AdamW(trainable_params, lr=args.learning_rate)
    loss_fn = nn.CrossEntropyLoss()

    save_class_mapping(output_dir, train_dataset.class_to_idx)
    best_val_accuracy = -1.0
    best_val_loss = float("inf")
    best_model_path = output_dir / "resnet50_filetype_classifier.pt"
    history: list[dict[str, Any]] = []

    print("Starting training")
    for epoch in range(1, args.epochs + 1):
        train_loss, train_accuracy = run_epoch(model, train_loader, loss_fn, device, optimizer)
        val_loss, val_accuracy = run_epoch(model, val_loader, loss_fn, device)
        row = {
            "epoch": epoch,
            "train_loss": train_loss,
            "train_accuracy": train_accuracy,
            "val_loss": val_loss,
            "val_accuracy": val_accuracy,
        }
        history.append(row)
        print(
            f"Epoch {epoch:03d}/{args.epochs:03d} "
            f"train_loss={train_loss:.4f} train_acc={train_accuracy:.4f} "
            f"val_loss={val_loss:.4f} val_acc={val_accuracy:.4f}"
        )

        is_best = val_accuracy > best_val_accuracy or (
            val_accuracy == best_val_accuracy and val_loss < best_val_loss
        )
        if is_best:
            best_val_accuracy = val_accuracy
            best_val_loss = val_loss
            torch.save(
                {
                    "model_state_dict": model.state_dict(),
                    "class_to_idx": train_dataset.class_to_idx,
                    "labels": train_dataset.classes,
                    "model_version": "custom-resnet50-filetype",
                    "image_size": [224, 224],
                    "imagenet_mean": IMAGENET_MEAN,
                    "imagenet_std": IMAGENET_STD,
                    "epoch": epoch,
                    "val_loss": val_loss,
                    "val_accuracy": val_accuracy,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                },
                best_model_path,
            )
            print(f"Saved new best model: {best_model_path} val_acc={val_accuracy:.4f}")

    save_training_history(output_dir, history)

    print(f"Loading best model for test evaluation: {best_model_path}")
    checkpoint = torch.load(best_model_path, map_location=device)
    model.load_state_dict(checkpoint["model_state_dict"])
    test_loss, test_accuracy = run_epoch(model, test_loader, loss_fn, device)
    print(f"Test loss={test_loss:.4f} test_acc={test_accuracy:.4f}")

    matrix = evaluate_confusion_matrix(model, test_loader, device, len(train_dataset.classes))
    save_confusion_matrix(output_dir, matrix, train_dataset.classes)
    print(f"Saved class mapping: {output_dir / 'class_mapping.json'}")
    print(f"Saved confusion matrix: {output_dir / 'confusion_matrix.json'}")
    print(f"Saved training history: {output_dir / 'training_history.json'}")


if __name__ == "__main__":
    main()
