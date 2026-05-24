"use client";
import { useEffect, useMemo, useState } from "react";

type FileItem = {
  id: number;
  filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  is_owner?: boolean;
};

export default function SharedPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="page">
      <div className="page-header">
        <p className="eyebrow">Shared with Me</p>
        <h1 className="page-title">Shared Files</h1>
        <p className="muted">Manage your shared file links and permissions.</p>
      </div>

      <div className="card">
        <div className="card__header">
          <div className="card__title">Your Shared Links</div>
        </div>
        {loading && <div className="muted">Loading...</div>}
        {!loading && shared.length === 0 && (
          <div className="empty-state">
            <div className="dropzone__icon" style={{ marginBottom: 10 }}>🔗</div>
            <div>No shared files yet</div>
            <div className="muted" style={{ marginTop: 6 }}>Share files from your library to see them here</div>
          </div>
        )}
        {shared.length > 0 && (
          <div className="list-card" style={{ marginTop: 10 }}>
            <div className="list-header">
              <span>Name</span>
              <span>Size</span>
              <span>Shared</span>
              <span>Type</span>
              <span>Access</span>
            </div>
            {shared.map((f) => (
              <div className="list-row" key={f.id}>
                <div className="list-name">
                  <div className="file-icon">📄</div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{f.filename}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{f.mime_type}</div>
                  </div>
                </div>
                <div>{(f.size_bytes / 1024).toFixed(2)} KB</div>
                <div className="muted">{new Date(f.created_at).toLocaleString()}</div>
                <div><span className="badge">Document</span></div>
                <div className="muted">Granted</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
