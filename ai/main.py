import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from model_registry import ModelLoadError, registry

logger = logging.getLogger("ai-service")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)


class TextIn(BaseModel):
    text: str


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("AI service startup: loading configured models")
    registry.warmup()
    yield


app = FastAPI(title="AI Service", version="0.2.0", lifespan=lifespan)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "models": registry.status(),
    }


@app.post("/scan/malware")
async def scan_malware(request: Request):
    data = await request.body()
    try:
        result = registry.scan_malware(data)
    except ModelLoadError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Malware inference failed")
        raise HTTPException(status_code=500, detail="Malware inference failed") from exc
    return JSONResponse(result)


@app.post("/scan/url-threats")
async def scan_url_threats(request: Request):
    data = await request.body()
    try:
        result = registry.scan_url_threats(data)
    except Exception as exc:
        logger.exception("URL AI scan failed")
        raise HTTPException(status_code=500, detail="URL AI scan failed") from exc
    return JSONResponse(result)


@app.post("/scan/document-threats")
async def scan_document_threats(request: Request):
    data = await request.body()
    try:
        result = registry.scan_document_threats(data)
    except Exception as exc:
        logger.exception("Document threat scan failed")
        raise HTTPException(status_code=500, detail="Document threat scan failed") from exc
    return JSONResponse(result)


@app.post("/scan/image-threats")
async def scan_image_threats(request: Request):
    data = await request.body()
    try:
        result = registry.scan_image_threats(data)
    except Exception as exc:
        logger.exception("Image threat scan failed")
        raise HTTPException(status_code=500, detail="Image threat scan failed") from exc
    return JSONResponse(result)


@app.post("/categorize/text")
async def categorize_text(payload: TextIn):
    try:
        return registry.classify_text(payload.text)
    except ModelLoadError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Text inference failed")
        raise HTTPException(status_code=500, detail="Text inference failed") from exc


@app.post("/classify/text")
async def classify_text(payload: TextIn):
    return await categorize_text(payload)


@app.post("/categorize/image")
async def categorize_image(request: Request):
    data = await request.body()
    try:
        result = registry.classify_image(data)
        result["filetype"] = registry.classify_filetype_image(data)
        return result
    except ModelLoadError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Image inference failed")
        raise HTTPException(status_code=500, detail="Image inference failed") from exc


@app.post("/classify/image")
async def classify_image(request: Request):
    return await categorize_image(request)


@app.post("/classify/filetype-image")
async def classify_filetype_image(request: Request):
    data = await request.body()
    try:
        return registry.classify_filetype_image(data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Filetype classification failed")
        raise HTTPException(status_code=500, detail="Filetype classification failed") from exc


@app.get("/")
async def root():
    return {"status": "ok"}
