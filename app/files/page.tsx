"use client";
import { useEffect, useMemo, useRef, useState } from "react";

function TextViewer({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    fetch(url)
      .then(r => r.text())
      .then(setText)
      .catch(() => setText('(Failed to load content)'));
  }, [url]);
  if (text === null) return <div className="muted" style={{ padding: 32, textAlign: 'center' }}>Loading...</div>;
  return <pre className="preview-modal__text">{text}</pre>;
}

function mimeIcon(mime: string): string {
  if (!mime) return "📄";
  if (mime.startsWith("image/")) return "🖼";
  if (mime.startsWith("video/")) return "🎬";
  if (mime.startsWith("audio/")) return "🎵";
  if (mime === "application/pdf") return "📕";
  if (mime.includes("zip") || mime.includes("rar") || mime.includes("tar") || mime.includes("gzip")) return "🗜";
  if (mime.includes("word") || mime.includes("document")) return "📝";
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv")) return "📊";
  if (mime.startsWith("text/")) return "📄";
  return "📁";
}

type SecretTarget = {
  fileId: string;
  filename: string;
  mimeType: string;
  purpose: "download" | "preview";
};

type PreviewState = {
  blobUrl: string;
  mimeType: string;
  filename: string;
};

function canPreview(mime: string): boolean {
  return mime?.startsWith("image/") || mime === "application/pdf" || mime?.startsWith("text/");
}

export default function FilesPage() {
  const [files, setFiles] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [view, setView] = useState<"list" | "grid">("list");
  const [shareTarget, setShareTarget] = useState<{ id: string; filename: string } | null>(null);
  const shareDialogRef = useRef<HTMLDialogElement>(null);
  const [secretTarget, setSecretTarget] = useState<SecretTarget | null>(null);
  const secretDialogRef = useRef<HTMLDialogElement>(null);
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = async () => {
    const res = await fetch("/api/files");
    if (res.ok) {
      const data = await res.json();
      setFiles(data.files || []);
    }
  };

  useEffect(() => { load(); }, []);

  const openShare = (id: string, filename: string) => {
    setShareTarget({ id, filename });
    shareDialogRef.current?.showModal();
  };

  const closeShare = () => {
    shareDialogRef.current?.close();
    setShareTarget(null);
  };

  const openSecretDialog = (target: SecretTarget) => {
    setSecretTarget(target);
    secretDialogRef.current?.showModal();
  };

  const closeSecretDialog = () => {
    secretDialogRef.current?.close();
    setSecretTarget(null);
  };

  const fetchBlob = async (fileId: string, secret?: string): Promise<Blob | string> => {
    const q = secret ? `?secret=${encodeURIComponent(secret)}` : "";
    const res = await fetch(`/api/files/${fileId}/download${q}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return data.error || "Request failed";
    }
    return res.blob();
  };

  const download = async (fileId: string, filename: string, isOwner: boolean, secret?: string) => {
    if (!isOwner && secret === undefined) {
      openSecretDialog({ fileId, filename, mimeType: "", purpose: "download" });
      return;
    }
    setMessage("Fetching file...");
    const result = await fetchBlob(fileId, secret);
    if (typeof result === "string") { setMessage(result); return; }
    const url = URL.createObjectURL(result);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setMessage("Downloaded");
  };

  const preview = async (fileId: string, filename: string, mimeType: string, isOwner: boolean, secret?: string) => {
    if (!isOwner && secret === undefined) {
      openSecretDialog({ fileId, filename, mimeType, purpose: "preview" });
      return;
    }
    setPreviewLoading(true);
    const result = await fetchBlob(fileId, secret);
    setPreviewLoading(false);
    if (typeof result === "string") { setMessage(result); return; }
    const blobUrl = URL.createObjectURL(result);
    setPreviewState({ blobUrl, mimeType: mimeType || result.type, filename });
  };

  const closePreview = () => {
    if (previewState) URL.revokeObjectURL(previewState.blobUrl);
    setPreviewState(null);
  };

  const handleSecretSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const secret = String(form.get("secret") || "");
    const t = secretTarget;
    closeSecretDialog();
    if (!t) return;
    if (t.purpose === "download") {
      download(t.fileId, t.filename, false, secret);
    } else {
      preview(t.fileId, t.filename, t.mimeType, false, secret);
    }
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/files/${id}/delete`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) { setMessage("Deleted"); load(); }
    else setMessage(data.error || "Delete failed");
  };

  const share = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!shareTarget) return;
    const form = new FormData(e.currentTarget);
    const recipientEmail = String(form.get("recipient") || "");
    const recipientSecret = String(form.get("secret") || "");
    const res = await fetch(`/api/files/${shareTarget.id}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientEmail, sharedSecret: recipientSecret })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { setMessage("Shared successfully."); closeShare(); }
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
    if (!label) return null;
    return String(label).replace(/_/g, " ");
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
        <p className="muted">{files.length} file{files.length !== 1 ? "s" : ""} stored securely.</p>
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

      {message && <div className="status-tag" style={{ marginBottom: 12 }}>{message}</div>}

      {view === "grid" ? (
        <div className="file-grid">
          {filtered.length === 0 && <div className="empty-state">No files yet</div>}
          {filtered.map((f) => (
            <div className="file-grid-card" key={f.id}>
              <div className="file-grid-card__icon">{mimeIcon(f.mimeType)}</div>
              <div className="file-grid-card__name" title={f.filename}>{f.filename}</div>
              <div className="file-grid-card__meta">{fileTypeLabel(f)} · {(f.sizeBytes / 1024).toFixed(1)} KB</div>
              {!f.isOwner && <span className="chip chip--shared" style={{ alignSelf: "flex-start", fontSize: 11 }}>Shared with you</span>}
              {aiCategoryLabel(f) && <span className="badge" style={{ alignSelf: "flex-start" }}>{aiCategoryLabel(f)}</span>}
              <div className="file-grid-card__actions">
                <button className="icon-btn" type="button" onClick={() => preview(f.id, f.filename, f.mimeType, !!f.isOwner)} title="Preview">👁</button>
                <button className="icon-btn" type="button" onClick={() => download(f.id, f.filename, !!f.isOwner)} title="Download">⬇</button>
                {f.isOwner !== false && (
                  <button className="icon-btn" type="button" onClick={() => openShare(f.id, f.filename)} title="Share">🔗</button>
                )}
                <button className="icon-btn" type="button" onClick={() => remove(f.id)} title="Delete">🗑</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
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
                <div className="file-icon">{mimeIcon(f.mimeType)}</div>
                <div>
                  <div style={{ fontWeight: 700 }}>{f.filename}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                    <div className="muted" style={{ fontSize: 12 }}>{categorise(f.mimeType)}</div>
                    {!f.isOwner && <span className="chip chip--shared" style={{ fontSize: 11, padding: "2px 7px" }}>Shared with you</span>}
                  </div>
                </div>
              </div>
              <div>{(f.sizeBytes / 1024).toFixed(2)} KB</div>
              <div className="muted">{new Date(f.createdAt).toLocaleString()}</div>
              <div><span className="badge">{fileTypeLabel(f)}</span></div>
              <div>
                {aiCategoryLabel(f)
                  ? <span className="badge">{aiCategoryLabel(f)}{typeof f.categoryConfidence === "number" ? ` · ${(f.categoryConfidence * 100).toFixed(0)}%` : ""}</span>
                  : <span className="muted" style={{ fontSize: 12 }}>Not classified</span>
                }
              </div>
              <div className="actions">
                <div className="button-row" style={{ justifyContent: "flex-end" }}>
                  <button className="icon-btn" type="button" onClick={() => preview(f.id, f.filename, f.mimeType, !!f.isOwner)} title="Preview">👁</button>
                  <button className="icon-btn" type="button" onClick={() => download(f.id, f.filename, !!f.isOwner)} title="Download">⬇</button>
                  {f.isOwner !== false && (
                    <button className="icon-btn" type="button" onClick={() => openShare(f.id, f.filename)} title="Share">🔗</button>
                  )}
                  <button className="icon-btn" type="button" onClick={() => remove(f.id)} title="Delete">🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Secret entry dialog */}
      <dialog
        ref={secretDialogRef}
        className="share-dialog"
        onClick={(e) => { if (e.target === secretDialogRef.current) closeSecretDialog(); }}
      >
        <div className="share-dialog__body">
          <div className="share-dialog__title">
            {secretTarget?.purpose === "preview" ? "Preview file" : "Download file"}
          </div>
          <div className="share-dialog__sub">{secretTarget?.filename}</div>
          <p className="muted" style={{ fontSize: 13, margin: "0 0 16px" }}>
            This file is protected. Enter the shared secret provided by the owner to continue.
          </p>
          <form onSubmit={handleSecretSubmit}>
            <label style={{ display: "block", fontWeight: 700, fontSize: 14, color: "var(--muted)", marginBottom: 2 }}>
              Shared secret
            </label>
            <input
              name="secret"
              className="input"
              placeholder="Enter the secret phrase"
              required
              autoFocus
              autoComplete="off"
            />
            <div className="button-row" style={{ marginTop: 8 }}>
              <button className="button" type="submit">
                {secretTarget?.purpose === "preview" ? "Preview" : "Download"}
              </button>
              <button className="button ghost" type="button" onClick={closeSecretDialog}>Cancel</button>
            </div>
          </form>
        </div>
      </dialog>

      {/* Share dialog */}
      <dialog
        ref={shareDialogRef}
        className="share-dialog"
        onClick={(e) => { if (e.target === shareDialogRef.current) closeShare(); }}
      >
        <div className="share-dialog__body">
          <div className="share-dialog__title">Share file</div>
          <div className="share-dialog__sub">{shareTarget?.filename}</div>
          <form onSubmit={share}>
            <label style={{ display: "block", fontWeight: 700, fontSize: 14, color: "var(--muted)", marginBottom: 2 }}>Recipient email</label>
            <input name="recipient" className="input" placeholder="colleague@example.com" required />
            <label style={{ display: "block", fontWeight: 700, fontSize: 14, color: "var(--muted)", marginBottom: 2 }}>Shared secret</label>
            <input name="secret" className="input" placeholder="Secret phrase the recipient will need" required />
            <div className="button-row" style={{ marginTop: 8 }}>
              <button className="button" type="submit">Share</button>
              <button className="button ghost" type="button" onClick={closeShare}>Cancel</button>
            </div>
          </form>
        </div>
      </dialog>

      {/* Preview overlay */}
      {(previewLoading || previewState) && (
        <div className="preview-overlay" onClick={previewState ? closePreview : undefined}>
          <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
            {previewLoading ? (
              <div className="preview-modal__body" style={{ minHeight: 240, alignItems: "center" }}>
                <div className="spinner" />
              </div>
            ) : previewState && (
              <>
                <div className="preview-modal__header">
                  <span className="preview-modal__title">{previewState.filename}</span>
                  <button className="icon-btn" type="button" onClick={closePreview} title="Close">✕</button>
                </div>
                <div className="preview-modal__body">
                  {previewState.mimeType.startsWith("image/") && (
                    <img className="preview-modal__img" src={previewState.blobUrl} alt={previewState.filename} />
                  )}
                  {previewState.mimeType === "application/pdf" && (
                    <iframe
                      className="preview-modal__iframe"
                      src={previewState.blobUrl}
                      title={previewState.filename}
                    />
                  )}
                  {previewState.mimeType.startsWith("text/") && (
                    <TextViewer url={previewState.blobUrl} />
                  )}
                  {!canPreview(previewState.mimeType) && (
                    <div className="preview-unsupported">
                      <div style={{ fontSize: 52 }}>📁</div>
                      <div style={{ fontWeight: 700, color: "var(--ink)" }}>Preview not available</div>
                      <div className="muted" style={{ fontSize: 13 }}>
                        This file type cannot be previewed in the browser. Download it to view.
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
