# Custom image classifier

Fine-tune ResNet50 when ImageNet labels are too generic for app files such as logos, screenshots, diagrams, and product graphics.

## Dataset layout

Create one folder per label:

```text
ai/training-data/
  logo/
    chip-lab-01.png
    another-logo.jpg
  screenshot/
    dashboard-01.png
  document_scan/
    invoice-01.jpg
  photo/
    product-photo-01.jpg
```

Use at least 30-50 varied images per label for a useful first model. More is better.

## Train

```powershell
docker compose run --rm ai python train_image_classifier.py --data-dir /app/training-data --output /app/models/image_classifier.pt --epochs 8
```

## Enable

Add this to `.env`:

```text
IMAGE_CLASSIFIER_PATH=/app/models/image_classifier.pt
```

Then restart the AI service:

```powershell
docker compose up -d --force-recreate ai
```

The AI health endpoint should still show the image model as loaded:

```powershell
Invoke-RestMethod http://localhost:8000/health
```
