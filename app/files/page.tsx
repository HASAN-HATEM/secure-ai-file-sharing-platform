"use client";
import { useEffect, useMemo, useState } from "react";

export default function FilesPage() {
  const [files, setFiles] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [view, setView] = useState<"list" | "grid">("list");

  const load = async () => {
    const res = await fetch("/api/files");
    if (res.ok) {
      const data = await res.json();
      setFiles(data.files || []);
    }
  };

  useEffect(() => { load(); }, []);

  const download = async (fileId: string, filename: string, isOwner: boolean) => {
    setMessage("Fetching file...");
    let secretQuery = "";
    if (!isOwner) {
      const secret = window.prompt("Enter shared secret to download this file:");
      if (!secret) {
        setMessage("Download canceled: secret is required.");
        return;
      }
      secretQuery = `?secret=${encodeURIComponent(secret)}`;
    }
    const res = await fetch(`/api/files/${fileId}/download${secretQuery}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Download failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setMessage("Downloaded");
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/files/${id}/delete`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) { setMessage("Deleted"); load(); }
    else setMessage(data.error || "Delete failed");
  };

  const share = async (fileId: string, recipientEmail: string, recipientSecret: string) => {
    const res = await fetch(`/api/files/${fileId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientEmail,
        sharedSecret: recipientSecret
      })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setMessage("Shared successfully.");
    else setMessage(data.error || "Share failed");
  };

  const categorise = (mime: string) => {
    if (mime?.startsWith("image/")) return "Images";
    if (mime?.startsWith("video/")) return "Videos";
    if (mime?.includes("pdf") || mime?.includes("doc")) return "Documents";
    if (mime?.startsWith("text/")) return "Text";
    return "Other";
  };

  const fileTypeLabel = (file: any) => {
    const mime = String(file.mimeType || "");
    const name = String(file.filename || "");
    const ext = name.includes(".") ? name.split(".").pop()?.toUpperCase() : "";
    if (mime === "application/pdf") return "PDF";
    if (mime === "text/plain") return "TXT";
    if (mime.startsWith("image/")) return ext || mime.replace("image/", "").toUpperCase();
    if (mime.includes("wordprocessingml")) return "DOCX";
    if (mime.includes("msword")) return "DOC";
    if (mime === "application/octet-stream") return ext || "Binary";
    return ext || mime || "Unknown";
  };

  const aiCategoryLabel = (file: any) => {
    const label = file.categoryLabel;
    if (!label) return "Not classified";
    return String(label).replace(/_/g, " ");
  };

  const percent = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : null;

  const confidenceQuality = (value: unknown) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "unknown confidence";
    if (value >= 0.7) return "high confidence";
    if (value >= 0.4) return "medium confidence";
    return "low confidence";
  };

  const classificationDisplay = (file: any) => {
    const filetype = file.filetypeClassification;
    const imagenet = file.imagenetClassification;
    const text = file.textClassification;
    return {
      fileTypeLabel: filetype?.label ? String(filetype.label).replace(/_/g, " ") : "Not available",
      fileTypeConfidence: percent(filetype?.confidence),
      detectedLabel: imagenet?.label ? String(imagenet.label).replace(/_/g, " ") : "Not available",
      detectedConfidence: percent(imagenet?.confidence),
      detectedQuality: confidenceQuality(imagenet?.confidence),
      textLabel: text?.label ? String(text.label).replace(/_/g, " ") : null,
      textConfidence: percent(text?.confidence)
    };
  };

  const filtered = useMemo(() => {
    return files.filter((f) => {
      const matchesSearch = f.filename.toLowerCase().includes(search.toLowerCase());
      const cat = categorise(f.mimeType);
      const matchesCat = category === "all" ? true : cat === category;
      return matchesSearch && matchesCat;
    });
  }, [files, search, category]);

  return (
    <div className="page">
      <div className="page-header">
        <p className="eyebrow">Library</p>
        <h1 className="page-title">Your files</h1>
      </div>

      <div className="toolbar">
        <div className="search">
          <span role="img" aria-label="search">🔍</span>
          <input placeholder="Search files..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All Categories</option>
          <option value="Documents">Documents</option>
          <option value="Images">Images</option>
          <option value="Videos">Videos</option>
          <option value="Other">Other</option>
        </select>
        <div className="view-toggle">
          <button type="button" className={`icon-btn${view === "list" ? " active" : ""}`} onClick={() => setView("list")}>☰</button>
          <button type="button" className={`icon-btn${view === "grid" ? " active" : ""}`} onClick={() => setView("grid")}>☷</button>
        </div>
      </div>

      <div className="list-card">
        <div className="list-header">
          <span>Name</span>
          <span>Size</span>
          <span>Modified</span>
          <span>Type</span>
          <span>AI Category</span>
          <span style={{ textAlign: "right" }}>Actions</span>
        </div>
        {filtered.length === 0 && <div className="empty-state">No files yet</div>}
        {filtered.map((f) => (
          <div className="list-row" key={f.id}>
            <div className="list-name">
              <div className="file-icon">📄</div>
              <div>
                <div style={{ fontWeight: 700 }}>{f.filename}</div>
                <div className="muted" style={{ fontSize: 12 }}>{categorise(f.mimeType)}</div>
              </div>
            </div>
            <div>{(f.sizeBytes / 1024).toFixed(2)} KB</div>
            <div className="muted">{new Date(f.createdAt).toLocaleString()}</div>
            <div><span className="badge">{fileTypeLabel(f)}</span></div>
            <div>
              {(() => {
                const display = classificationDisplay(f);
                return (
                  <>
                    <div>
                      <span className="badge">{aiCategoryLabel(f)}</span>
                      {typeof f.categoryConfidence === "number" && (
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          {(f.categoryConfidence * 100).toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                      File Type: {display.fileTypeLabel}
                      {display.fileTypeConfidence ? ` (${display.fileTypeConfidence})` : ""}
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Detected Content: {display.detectedLabel}
                      {display.detectedConfidence ? ` (${display.detectedConfidence}, ${display.detectedQuality})` : ""}
                    </div>
                    {display.textLabel && (
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                        Text Category: {display.textLabel}
                        {display.textConfidence ? ` (${display.textConfidence})` : ""}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            <div className="actions">
              <div className="button-row" style={{ marginTop: 6 }}>
                <button className="icon-btn" type="button" onClick={() => download(f.id, f.filename, !!f.isOwner)} title="Download">⬇</button>
                <button className="icon-btn" type="button" onClick={() => remove(f.id)} title="Delete">🗑</button>
              </div>
              {f.isOwner !== false && (
                <form onSubmit={(e) => { e.preventDefault(); const email = (e.currentTarget as any).recipient.value; const secret = (e.currentTarget as any).secret.value; share(f.id, email, secret); }}>
                  <input name="recipient" className="input" style={{ width: 160 }} placeholder="Recipient email" required />
                  <input name="secret" className="input" style={{ width: 140 }} placeholder="Shared secret" required />
                  <div className="button-row" style={{ marginTop: 6 }}>
                    <button className="icon-btn" type="submit" title="Share">🔗</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="muted">{message}</p>
    </div>
  );
}
