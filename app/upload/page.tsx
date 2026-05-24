"use client";
import { useRef, useState } from "react";

export default function UploadPage() {
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const steps = [
    { label: "Preparing", sub: "Creating secure upload ticket" },
    { label: "Checking malware", sub: "AI scanning in progress" },
    { label: "Classifying", sub: "Determining file category" },
    { label: "Completed", sub: "Available in your library" }
  ];

  const percent = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : null;

  const confidenceQuality = (value: unknown) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "unknown confidence";
    if (value >= 0.7) return "high confidence";
    if (value >= 0.4) return "medium confidence";
    return "low confidence";
  };

  const shortenUrl = (url: unknown) => {
    const value = String(url || "");
    if (value.length <= 90) return value;
    return `${value.slice(0, 87)}...`;
  };

  const getMalwareScoreDisplay = (scan: any) => {
    if (!scan) return null;
    const scores = [
      { label: "MalConv score", value: scan.score },
      { label: "Document threat score", value: scan.document_ai?.score },
      { label: "Image threat score", value: scan.image_ai?.score },
      { label: "URL AI malware score", value: scan.url_ai?.max_malware_score, threshold: scan.url_ai?.threshold }
    ].filter((item) => typeof item.value === "number" && Number.isFinite(item.value) && item.value > 0);
    if (scores.length === 0) return null;
    const best = scores.reduce((highest, item) => Number(item.value) > Number(highest.value) ? item : highest, scores[0]);
    const threshold = best.threshold !== undefined ? percent(best.threshold) : null;
    return `${best.label} ${percent(best.value)}${threshold ? `, block threshold ${threshold}` : ""}`;
  };

  const getHighestUrlResult = (scan: any) => {
    const results = scan?.url_ai?.results;
    if (!Array.isArray(results) || results.length === 0) return null;
    return results.reduce((best, item) => {
      const bestScore = typeof best?.malware_score === "number" ? best.malware_score : -1;
      const itemScore = typeof item?.malware_score === "number" ? item.malware_score : -1;
      return itemScore > bestScore ? item : best;
    }, results[0]);
  };

  const featureLabel = (label: unknown) =>
    String(label || "unknown").replace(/_/g, " ");

  const shouldShowUrlScan = (scan: any) => {
    if (!scan?.url_ai) return false;
    if (scan.url_ai.scanned > 0 || scan.url_ai.is_malicious) return true;
    return scan.document_ai?.file_kind === "pdf" || scan.document_ai?.file_kind === "office_zip";
  };

  const shouldShowTextCategory = (classification: any, hasImageFiletype: boolean) => {
    if (!classification || hasImageFiletype) return false;
    const label = String(classification.label || "");
    const confidence = classification.confidence;
    return !(label === "document" && typeof confidence === "number" && confidence <= 0);
  };


  const getClassificationView = (classification: any) => {
    const filetype = classification?.filetype;
    const imagenet = classification?.imagenet;
    const customConfidence = percent(filetype?.confidence ?? classification?.confidence);
    const rawConfidence = percent(filetype?.confidence);
    const imagenetConfidence = percent(imagenet?.confidence);

    return {
      filetype,
      imagenet,
      customConfidence,
      rawConfidence,
      imagenetConfidence,
      imagenetQuality: confidenceQuality(imagenet?.confidence)
    };
  };

  const pickUsableFile = (file: File | null | undefined) => {
    if (!file) return null;
    if (!file.name || file.size <= 0) return null;
    return file;
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResult(null);
    setCurrentStep(0);
    setStatus("Creating upload ticket...");
    const form = new FormData(e.currentTarget);
    const formFile = pickUsableFile(form.get("file") as File | null);
    const file = formFile || pickUsableFile(selectedFile);
    if (!file) {
      setStatus("Select a file before uploading");
      setCurrentStep(-1);
      return;
    }

    try {
      const createRes = await fetch("/api/uploads/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        filename: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size
        })
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        setStatus(createData.error || "Failed to create upload ticket");
        setCurrentStep(-1);
        return;
      }

      setCurrentStep(1);
      setStatus("Uploading and scanning for malware...");
      const uploadForm = new FormData();
      uploadForm.append("fileId", createData.fileId);
      uploadForm.append("tempKey", createData.tempKey);
      uploadForm.append("file", file);
      const putRes = await fetch("/api/uploads/transfer", {
        method: "POST",
        body: uploadForm
      });
      if (!putRes.ok) {
        setStatus(`Upload to storage failed (${putRes.status})`);
        setCurrentStep(-1);
        return;
      }

      setCurrentStep(2);
      setStatus("Finalizing and classifying...");
      const finalizeRes = await fetch("/api/uploads/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: createData.fileId, tempKey: createData.tempKey })
      });
      const finalizeData = await finalizeRes.json();
      if (!finalizeRes.ok) {
        setStatus(finalizeData.message || finalizeData.error || "Finalize failed");
        setResult(finalizeData);
        setCurrentStep(-1);
        return;
      }

      const classificationView = getClassificationView(finalizeData.classification);
      console.info("Upload AI classification display decision", {
        customPredictedType: finalizeData.classification?.filetype?.predicted_type ?? finalizeData.classification?.label,
        customConfidence: finalizeData.classification?.filetype?.confidence ?? finalizeData.classification?.confidence,
        oldImageNetLabel: finalizeData.classification?.imagenet?.label,
        oldImageNetConfidence: finalizeData.classification?.imagenet?.confidence,
        oldImageNetDisplayed: Boolean(finalizeData.classification?.imagenet)
      });
      setResult(finalizeData);
      setCurrentStep(3);
      setStatus("Completed — file saved to your library");
    } catch (error: any) {
      setStatus(error?.message || "Upload failed");
      setCurrentStep(-1);
    }
  };

  const onFilePicked = (file: File | null) => {
    const usableFile = pickUsableFile(file);
    setSelectedFile(usableFile);
    if (usableFile) {
      setStatus(`Ready to upload: ${usableFile.name}`);
      return;
    }
    setStatus("Selected file is empty or unavailable");
  };

  const onDrop = (ev: React.DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
    const file = ev.dataTransfer.files?.[0];
    onFilePicked(file || null);
  };

  return (
    <div className="page">
      <div className="page-header">
        <p className="eyebrow">Upload</p>
        <h1 className="page-title">Upload an encrypted file</h1>
        <p className="muted">Securely upload and encrypt your files with AI-powered scanning.</p>
      </div>

      <div className="card">
        <form onSubmit={onSubmit}>
          <input
            ref={inputRef}
            className="input"
            name="file"
            type="file"
            style={{ display: "none" }}
            onChange={(e) => onFilePicked(e.target.files?.[0] || null)}
          />

          <div
            className="dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <div className="dropzone__inner">
              <div className="dropzone__icon">⤴</div>
              <div className="page-title" style={{ fontSize: 18, margin: 0 }}>Drag &amp; Drop Files Here</div>
              <div className="muted" style={{ marginTop: 4 }}>or click to browse your files</div>
              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    inputRef.current?.click();
                  }}
                >
                  Browse Files
                </button>
              </div>
              {selectedFile && <div style={{ marginTop: 10, color: "var(--ink)", fontWeight: 700 }}>{selectedFile.name}</div>}
            </div>
          </div>

          <div className="button-row">
            <button className="button" type="submit">Upload</button>
            <span className="muted">{status}</span>
          </div>

          <div className="status-flow">
            {steps.map((step, idx) => {
              const active = idx === currentStep;
              const done = currentStep > idx;
              return (
                <div key={step.label} className={`status-step${active ? " active" : ""}${done ? " done" : ""}`}>
                  <div className="status-dot" />
                  <div>
                    <div className="status-label">{step.label}</div>
                    <div className="status-sub">{active ? status || step.sub : step.sub}</div>
                  </div>
                  {active && currentStep < 3 && <div className="spinner" style={{ marginLeft: "auto" }} />}
                  {done && <div style={{ marginLeft: "auto", color: "#2f855a" }}>✓</div>}
                </div>
              );
            })}
          </div>
        </form>
      </div>

      {result && (
        <div className="card">
          <h3>Scan & Classification</h3>
          <p>
            Malware: {result.scan?.is_malicious ? "Blocked" : "Clean"}
            {result.scan && getMalwareScoreDisplay(result.scan) ? ` (${getMalwareScoreDisplay(result.scan)})` : ""}
          </p>
          {shouldShowUrlScan(result.scan) && (
            <>
              {(() => {
                const highestUrl = getHighestUrlResult(result.scan);
                return highestUrl ? (
                  <p>
                    Highest URL: {shortenUrl(highestUrl.url)}
                    {typeof highestUrl.malware_score === "number"
                      ? ` (${(highestUrl.malware_score * 100).toFixed(1)}% malware)`
                      : ""}
                  </p>
                ) : null;
              })()}
              <p>
                URL AI Scan: {result.scan.url_ai.scanned || 0} link{result.scan.url_ai.scanned === 1 ? "" : "s"} scanned
                {typeof result.scan.url_ai.max_malware_score === "number"
                  ? ` (highest score ${(result.scan.url_ai.max_malware_score * 100).toFixed(1)}%)`
                  : ""}
              </p>
            </>
          )}
          {result.scan?.document_ai && (
            <>
              {result.scan.document_ai.is_malicious && (
                <p>
                  Document Threat Scan: suspicious
                  {typeof result.scan.document_ai.score === "number"
                    ? ` (${(result.scan.document_ai.score * 100).toFixed(1)}%)`
                    : ""}
                </p>
              )}
              {Array.isArray(result.scan.document_ai.features) && result.scan.document_ai.features.length > 0 && (
                <p>
                  Detected Features: {result.scan.document_ai.features
                    .map((feature: any) => `${featureLabel(feature.label)}${feature.count ? ` x${feature.count}` : ""}`)
                    .join(", ")}
                </p>
              )}
            </>
          )}
          {result.scan?.image_ai?.applicable && result.scan.image_ai.is_malicious && (
            <>
              <p>
                Image Threat Scan: suspicious
                {typeof result.scan.image_ai.score === "number"
                  ? ` (${(result.scan.image_ai.score * 100).toFixed(1)}%)`
                  : ""}
              </p>
              {Array.isArray(result.scan.image_ai.features) && result.scan.image_ai.features.length > 0 && (
                <p>
                  Detected Image Features: {result.scan.image_ai.features
                    .map((feature: any) => `${featureLabel(feature.label)}${feature.count ? ` x${feature.count}` : ""}`)
                    .join(", ")}
                </p>
              )}
            </>
          )}
          {result.classification && (
            <>
              {(() => {
                const view = getClassificationView(result.classification);
                const hasImageFiletype = Boolean(view.filetype);
                const predictedType =
                  view.filetype?.predicted_type ||
                  result.classification.label ||
                  "unknown";
                return (
                  <>
                    {hasImageFiletype ? (
                      <>
                        <p>
                          File Type: {predictedType}
                          {predictedType !== "uncertain" && view.customConfidence ? ` (${view.customConfidence})` : ""}
                        </p>
                        {view.filetype?.uncertain && (
                          <p>
                            Raw prediction: {view.filetype?.raw_predicted_type || "unknown"}
                            {view.rawConfidence ? ` (${view.rawConfidence})` : ""}
                          </p>
                        )}
                      </>
                    ) : shouldShowTextCategory(result.classification, hasImageFiletype) ? (
                      <p>
                        Text Category: {result.classification.label || "unknown"}
                        {view.customConfidence ? ` (${view.customConfidence})` : ""}
                      </p>
                    ) : null}
                    {view.imagenet && (
                      <p>
                        Detected Content: {view.imagenet.label || "Not available"}
                        {view.imagenetConfidence ? ` (${view.imagenetConfidence}, ${view.imagenetQuality})` : ""}
                      </p>
                    )}
                  </>
                );
              })()}
            </>
          )}
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Upload Guidelines</h3>
        <ul className="guidelines">
          <li className="guideline">✔ All files are automatically scanned for malware before being stored.</li>
          <li className="guideline">✔ Maximum file size: 100 MB per file.</li>
          <li className="guideline">✔ Supported file types: Documents (.pdf, .doc, .docx, .txt), Images (.jpg, .png, .gif), and more.</li>
        </ul>
      </div>
    </div>
  );
}
