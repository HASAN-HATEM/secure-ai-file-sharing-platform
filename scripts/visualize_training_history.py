import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = PROJECT_ROOT / "models" / "training_history.json"
DEFAULT_OUTPUT = PROJECT_ROOT / "models" / "training_history.png"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render training history metrics as PNG line charts.")
    parser.add_argument("--input", default=str(DEFAULT_INPUT))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    return parser.parse_args()


def scale_points(values: list[float], x0: int, y0: int, width: int, height: int) -> list[tuple[float, float]]:
    if len(values) == 1:
        return [(x0 + width / 2, y0 + height / 2)]
    low = min(values)
    high = max(values)
    if high == low:
        high = low + 1.0
    points = []
    for index, value in enumerate(values):
        x = x0 + (index / (len(values) - 1)) * width
        y = y0 + height - ((value - low) / (high - low)) * height
        points.append((x, y))
    return points


def draw_chart(
    draw: ImageDraw.ImageDraw,
    font: ImageFont.ImageFont,
    title: str,
    history: list[dict],
    keys: list[tuple[str, tuple[int, int, int]]],
    bounds: tuple[int, int, int, int],
) -> None:
    x0, y0, width, height = bounds
    draw.text((x0, y0 - 26), title, fill=(15, 31, 60), font=font)
    draw.rectangle((x0, y0, x0 + width, y0 + height), outline=(210, 220, 235), fill=(250, 252, 255))
    for offset in range(1, 4):
        y = y0 + offset * height / 4
        draw.line((x0, y, x0 + width, y), fill=(230, 236, 246))

    legend_x = x0 + width - 170
    legend_y = y0 + 12
    for key, color in keys:
        values = [float(row[key]) for row in history]
        points = scale_points(values, x0 + 18, y0 + 18, width - 36, height - 36)
        if len(points) > 1:
            draw.line(points, fill=color, width=3)
        for point in points:
            x, y = point
            draw.ellipse((x - 3, y - 3, x + 3, y + 3), fill=color)
        draw.rectangle((legend_x, legend_y, legend_x + 12, legend_y + 12), fill=color)
        draw.text((legend_x + 18, legend_y), key, fill=(15, 31, 60), font=font)
        legend_y += 18

    epochs = [str(row["epoch"]) for row in history]
    draw.text((x0, y0 + height + 8), f"epoch {epochs[0]}", fill=(70, 85, 110), font=font)
    draw.text((x0 + width - 55, y0 + height + 8), f"epoch {epochs[-1]}", fill=(70, 85, 110), font=font)


def main() -> None:
    args = parse_args()
    history = json.loads(Path(args.input).read_text(encoding="utf-8"))
    image = Image.new("RGB", (980, 680), "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default()
    draw.text((24, 18), "Training History", fill=(15, 31, 60), font=font)

    draw_chart(
        draw,
        font,
        "Loss",
        history,
        [
            ("train_loss", (15, 77, 168)),
            ("val_loss", (209, 63, 76)),
        ],
        (60, 90, 860, 220),
    )
    draw_chart(
        draw,
        font,
        "Accuracy",
        history,
        [
            ("train_accuracy", (47, 133, 90)),
            ("val_accuracy", (180, 110, 20)),
        ],
        (60, 390, 860, 220),
    )

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output)
    print(f"Saved training history PNG to {output}")


if __name__ == "__main__":
    main()
