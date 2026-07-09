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
  if (mime.includes("zip") || mime.includes("rar") || mime.includes("tar")) return "🗜";
  if (mime.includes("word") || mime.includes("document")) return "📝";
  if (mime.startsWith("text/")) return "📄";
  return "📁";
}

function canPreview(mime: string): boolean {
  return mime?.startsWith("image/") || mime === "application/pdf" || mime?.startsWith("text/");
}

type FileItem = {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  is_owner?: boolean;
  owner_name?: string | null;
  owner_email?: string | null;
  secret_required?: boolean;
};

type PreviewState = {
  blobUrl: string;
  mimeType: string;
  filename: string;
};

type PendingAction = {
  fileId: string;
  filename: string;
  mimeType: string;
  purpose: "download" | "preview";
};

export default function SharedPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const secretDialogRef = useRef<HTMLDialogElement>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [secretError, setSecretError] = useState("");
  const [secretSubmitting, setSecretSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/files/list");
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
      setLoading(false);
    })();
  }, []);

  const shared = useMemo(() => files.filter((f) => f.is_owner === false), [files]);

  const openSecretDialog = (action: PendingAction) => {
    setPendingAction(action);
    setSecretError("");
    secretDialogRef.current?.showModal();
  };

  const closeSecretDialog = () => {
    secretDialogRef.current?.close();
    setPendingAction(null);
    setSecretError("");
  };

  const fetchBlob = async (fileId: string, secret: string): Promise<Blob | string> => {
    const res = await fetch(`/api/files/${fileId}/download?secret=${encodeURIComponent(secret)}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return data.error || "Request failed";
    }
    return res.blob();
  };

  const handleSecretSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const secret = String(form.get("secret") || "");
    const action = pendingAction;
    if (!action) return;

    setSecretError("");
    setSecretSubmitting(true);

    if (action.purpose === "download") {
      const result = await fetchBlob(action.fileId, secret);
      setSecretSubmitting(false);
      if (typeof result === "string") { setSecretError(result); return; }
      closeSecretDialog();
      const url = URL.createObjectURL(result);
      const a = document.createElement("a");
      a.href = url;
      a.download = action.filename;
      a.click();
      URL.revokeObjectURL(url);
      setMessage("Downloaded successfully.");
    } else {
      const result = await fetchBlob(action.fileId, secret);
      setSecretSubmitting(false);
      if (typeof result === "string") { setSecretError(result); return; }
      closeSecretDialog();
      const blobUrl = URL.createObjectURL(result);
      setPreviewState({ blobUrl, mimeType: action.mimeType || result.type, filename: action.filename });
    }
  };

  const closePreview = () => {
    if (previewState) URL.revokeObjectURL(previewState.blobUrl);
    setPreviewState(null);
  };

  return (
    <div className="page">
      <div className="page-header">
        <p className="eyebrow">Shared with Me</p>
        <h1 className="page-title">Shared Files</h1>
        <p className="muted">Files that others have shared with you.</p>
      </div>

      <div className="card">
        <div className="card__header">
          <div className="card__title">Your Shared Links</div>
          {shared.length > 0 && <span className="status-tag">{shared.length} file{shared.length !== 1 ? "s" : ""}</span>}
        </div>

        {message && <div className="status-tag" style={{ marginBottom: 12 }}>{message}</div>}

        {loading && <div className="muted">Loading...</div>}
        {!loading && shared.length === 0 && (
          <div className="empty-state">
            <div className="dropzone__icon" style={{ marginBottom: 10 }}>🔗</div>
            <div>No shared files yet</div>
            <div className="muted" style={{ marginTop: 6 }}>Files shared with you will appear here</div>
          </div>
        )}
        {shared.length > 0 && (
          <div className="list-card" style={{ marginTop: 10 }}>
            <div className="list-header list-header--shared">
              <span>Name</span>
              <span>Size</span>
              <span>Shared</span>
              <span>Type</span>
              <span>Access</span>
              <span style={{ textAlign: "right" }}>Actions</span>
            </div>
            {shared.map((f) => (
              <div className="list-row list-row--shared" key={f.id}>
                <div className="list-name">
                  <div className="file-icon">{mimeIcon(f.mime_type)}</div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{f.filename}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Shared by {f.owner_name || f.owner_email || "another user"}
                    </div>
                  </div>
                </div>
                <div>{(f.size_bytes / 1024).toFixed(2)} KB</div>
                <div className="muted">{new Date(f.created_at).toLocaleString()}</div>
                <div><span className="badge">{f.mime_type?.split("/")[1]?.toUpperCase() || "File"}</span></div>
                <div>
                  {f.secret_required
                    ? <span className="chip chip--warning">Secret required</span>
                    : <span className="chip chip--success">Granted</span>}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                  <button
                    className="icon-btn"
                    type="button"
                    onClick={() => openSecretDialog({ fileId: f.id, filename: f.filename, mimeType: f.mime_type, purpose: "preview" })}
                    title="Preview"
                  >
                    👁
                  </button>
                  <button
                    className="icon-btn"
                    type="button"
                    onClick={() => openSecretDialog({ fileId: f.id, filename: f.filename, mimeType: f.mime_type, purpose: "download" })}
                    title="Download"
                  >
                    ⬇
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Secret entry dialog */}
      <dialog
        ref={secretDialogRef}
        className="share-dialog"
        onClick={(e) => { if (e.target === secretDialogRef.current) closeSecretDialog(); }}
      >
        <div className="share-dialog__body">
          <div className="share-dialog__title">
            {pendingAction?.purpose === "preview" ? "Preview file" : "Download file"}
          </div>
          <div className="share-dialog__sub">{pendingAction?.filename}</div>
          <p className="muted" style={{ fontSize: 13, margin: "0 0 16px" }}>
            Enter the shared secret provided by the file owner to continue.
          </p>
          {secretError && (
            <div className="verdict-banner verdict-banner--blocked" style={{ marginBottom: 14 }}>
              <div className="verdict-banner__icon">⚠</div>
              <div>
                <div className="verdict-banner__title">Access denied</div>
                <div className="verdict-banner__sub">{secretError}</div>
              </div>
            </div>
          )}
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
              <button className="button" type="submit" disabled={secretSubmitting}>
                {secretSubmitting ? "Verifying…" : (pendingAction?.purpose === "preview" ? "Preview" : "Download")}
              </button>
              <button className="button ghost" type="button" onClick={closeSecretDialog}>Cancel</button>
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
