"use client";
import { useEffect, useState } from "react";

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

type DeletedFile = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  deletedAt: string;
  createdAt: string;
  categoryLabel: string | null;
};

export default function TrashPage() {
  const [files, setFiles] = useState<DeletedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/trash");
    if (res.ok) {
      const data = await res.json();
      setFiles(data.files || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const restore = async (id: string) => {
    setBusy(id);
    const res = await fetch(`/api/trash/${id}/restore`, { method: "POST" });
    const data = await res.json();
    if (res.ok) { setMessage("File restored to your library."); load(); }
    else setMessage(data.error || "Restore failed");
    setBusy(null);
  };

  const permanentDelete = async (id: string, filename: string) => {
    if (!confirm(`Permanently delete "${filename}"? This cannot be undone.`)) return;
    setBusy(id);
    const res = await fetch(`/api/trash/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) { setMessage("File permanently deleted."); load(); }
    else setMessage(data.error || "Delete failed");
    setBusy(null);
  };

  const emptyTrash = async () => {
    if (files.length === 0) return;
    if (!confirm(`Permanently delete all ${files.length} file(s) in trash? This cannot be undone.`)) return;
    setBusy("all");
    for (const f of files) {
      await fetch(`/api/trash/${f.id}`, { method: "DELETE" });
    }
    setMessage("Trash emptied.");
    load();
    setBusy(null);
  };

  const daysAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86_400_000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    return `${days} days ago`;
  };

  return (
    <div className="page">
      <div className="page-header">
        <p className="eyebrow">Trash</p>
        <h1 className="page-title">Deleted Files</h1>
        <p className="muted">Files moved to trash can be restored or permanently deleted.</p>
      </div>

      {message && (
        <div className="status-tag" style={{ marginBottom: 4 }}>{message}</div>
      )}

      <div className="card">
        <div className="card__header">
          <div>
            <div className="card__title">Trash</div>
            {files.length > 0 && (
              <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                {files.length} file{files.length !== 1 ? "s" : ""} — restore or delete permanently
              </div>
            )}
          </div>
          {files.length > 0 && (
            <button
              className="button danger"
              type="button"
              onClick={emptyTrash}
              disabled={busy === "all"}
              style={{ fontSize: 13 }}
            >
              {busy === "all" ? "Emptying..." : "Empty Trash"}
            </button>
          )}
        </div>

        {loading && <div className="muted" style={{ padding: "24px 0" }}>Loading...</div>}

        {!loading && files.length === 0 && (
          <div className="empty-state" style={{ padding: "52px 24px" }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>🗑</div>
            <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>Trash is empty</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Files you delete will appear here. You can restore them or delete permanently.
            </div>
          </div>
        )}

        {files.length > 0 && (
          <div className="list-card" style={{ marginTop: 14 }}>
            <div className="list-header" style={{ gridTemplateColumns: "1.4fr 0.5fr 0.6fr 0.5fr 0.7fr" }}>
              <span>Name</span>
              <span>Size</span>
              <span>Deleted</span>
              <span>Type</span>
              <span style={{ textAlign: "right" }}>Actions</span>
            </div>
            {files.map((f) => (
              <div
                className="list-row"
                key={f.id}
                style={{ gridTemplateColumns: "1.4fr 0.5fr 0.6fr 0.5fr 0.7fr", opacity: busy === f.id ? 0.5 : 1 }}
              >
                <div className="list-name">
                  <div className="file-icon" style={{ background: "#fdeaea", color: "var(--danger)" }}>
                    {mimeIcon(f.mimeType)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{f.filename}</div>
                    {f.categoryLabel && (
                      <span className="chip" style={{ fontSize: 11, padding: "2px 7px", marginTop: 2 }}>
                        {f.categoryLabel.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="muted">{(f.sizeBytes / 1024).toFixed(1)} KB</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{daysAgo(f.deletedAt)}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{new Date(f.deletedAt).toLocaleDateString()}</div>
                </div>
                <div>
                  <span className="badge">{f.mimeType?.split("/")[1]?.toUpperCase() || "File"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    className="button ghost"
                    type="button"
                    onClick={() => restore(f.id)}
                    disabled={!!busy}
                    style={{ padding: "6px 12px", fontSize: 13 }}
                    title="Restore to library"
                  >
                    ↩ Restore
                  </button>
                  <button
                    className="icon-btn"
                    type="button"
                    onClick={() => permanentDelete(f.id, f.filename)}
                    disabled={!!busy}
                    title="Delete permanently"
                    style={{ color: "var(--danger)", borderColor: "#fdd" }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
