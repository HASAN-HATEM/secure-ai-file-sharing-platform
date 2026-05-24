import argparse
from pathlib import Path

import torch
from torch import nn
from torch.utils.data import DataLoader, random_split
from torchvision.datasets import ImageFolder
from torchvision.models import ResNet50_Weights, resnet50


def parse_args():
    parser = argparse.ArgumentParser(description="Fine-tune ResNet50 for app-specific image categories.")
    parser.add_argument("--data-dir", required=True, help="Folder with one subfolder per label.")
    parser.add_argument("--output", default="/app/models/image_classifier.pt", help="Checkpoint output path.")
    parser.add_argument("--epochs", type=int, default=8)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--learning-rate", type=float, default=0.001)
    parser.add_argument("--val-split", type=float, default=0.2)
    parser.add_argument("--unfreeze-backbone", action="store_true")
    return parser.parse_args()


def accuracy(model, loader, device):
    model.eval()
    correct = 0
    total = 0
    with torch.no_grad():
        for images, labels in loader:
            images = images.to(device)
            labels = labels.to(device)
            predictions = model(images).argmax(dim=1)
            correct += int((predictions == labels).sum().item())
            total += labels.numel()
    return correct / total if total else 0.0


def main():
    args = parse_args()
    data_dir = Path(args.data_dir)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    weights = ResNet50_Weights.DEFAULT
    dataset = ImageFolder(str(data_dir), transform=weights.transforms())
    if len(dataset.classes) < 2:
        raise ValueError("Training needs at least two label folders")

    val_size = max(1, int(len(dataset) * args.val_split))
    train_size = len(dataset) - val_size
    if train_size < len(dataset.classes):
        raise ValueError("Not enough images. Add more examples per label before training.")

    train_data, val_data = random_split(
        dataset,
        [train_size, val_size],
        generator=torch.Generator().manual_seed(42),
    )
    train_loader = DataLoader(train_data, batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(val_data, batch_size=args.batch_size)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = resnet50(weights=weights)
    if not args.unfreeze_backbone:
        for param in model.parameters():
            param.requires_grad = False
    model.fc = nn.Linear(model.fc.in_features, len(dataset.classes))
    model.to(device)

    optimizer = torch.optim.AdamW(
        [param for param in model.parameters() if param.requires_grad],
        lr=args.learning_rate,
    )
    loss_fn = nn.CrossEntropyLoss()

    best_accuracy = 0.0
    best_state = None
    for epoch in range(1, args.epochs + 1):
        model.train()
        running_loss = 0.0
        for images, labels in train_loader:
            images = images.to(device)
            labels = labels.to(device)
            optimizer.zero_grad()
            loss = loss_fn(model(images), labels)
            loss.backward()
            optimizer.step()
            running_loss += float(loss.item())

        val_accuracy = accuracy(model, val_loader, device)
        print(
            f"epoch={epoch} loss={running_loss / max(1, len(train_loader)):.4f} "
            f"val_accuracy={val_accuracy:.4f}"
        )
        if val_accuracy >= best_accuracy:
            best_accuracy = val_accuracy
            best_state = {key: value.cpu() for key, value in model.state_dict().items()}

    torch.save(
        {
            "model_state_dict": best_state or model.state_dict(),
            "labels": dataset.classes,
            "model_version": f"custom-resnet50-{len(dataset.classes)}-labels",
            "val_accuracy": best_accuracy,
        },
        output,
    )
    print(f"saved={output} labels={dataset.classes} val_accuracy={best_accuracy:.4f}")


if __name__ == "__main__":
    main()
