import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = PROJECT_ROOT / "models" / "confusion_matrix.json"
DEFAULT_OUTPUT = PROJECT_ROOT / "models" / "confusion_matrix.png"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render confusion_matrix.json as a PNG heatmap.")
    parser.add_argument("--input", default=str(DEFAULT_INPUT))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    return parser.parse_args()


def color_for(value: int, max_value: int) -> tuple[int, int, int]:
    intensity = value / max(1, max_value)
    red = int(245 - 160 * intensity)
    green = int(248 - 105 * intensity)
    blue = int(255 - 30 * intensity)
    return red, green, blue


def main() -> None:
    args = parse_args()
    payload = json.loads(Path(args.input).read_text(encoding="utf-8"))
    classes = payload["classes"]
    matrix = payload["matrix"]

    cell = 92
    left = 170
    top = 120
    width = left + cell * len(classes) + 40
    height = top + cell * len(classes) + 60
    max_value = max(max(row) for row in matrix)

    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default()
    title = "Confusion Matrix"
    draw.text((20, 20), title, fill=(15, 31, 60), font=font)
    draw.text((left, 60), "Predicted", fill=(70, 85, 110), font=font)
    draw.text((20, top - 35), "Actual", fill=(70, 85, 110), font=font)

    for column, class_name in enumerate(classes):
        x = left + column * cell + 8
        draw.text((x, top - 24), class_name, fill=(15, 31, 60), font=font)

    for row_index, class_name in enumerate(classes):
        y = top + row_index * cell + cell // 2 - 6
        draw.text((20, y), class_name, fill=(15, 31, 60), font=font)
        for column_index, value in enumerate(matrix[row_index]):
            x0 = left + column_index * cell
            y0 = top + row_index * cell
            x1 = x0 + cell - 4
            y1 = y0 + cell - 4
            fill = color_for(value, max_value)
            draw.rectangle((x0, y0, x1, y1), fill=fill, outline=(210, 220, 235))
            text = str(value)
            bbox = draw.textbbox((0, 0), text, font=font)
            text_w = bbox[2] - bbox[0]
            text_h = bbox[3] - bbox[1]
            draw.text(
                (x0 + (cell - text_w) / 2, y0 + (cell - text_h) / 2),
                text,
                fill=(10, 28, 55),
                font=font,
            )

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output)
    print(f"Saved confusion matrix PNG to {output}")


if __name__ == "__main__":
    main()
