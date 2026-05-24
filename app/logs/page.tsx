"use client";
import { useEffect, useState } from "react";

type Log = {
  id: number;
  action: string;
  target_type: string;
  target_id: number;
  metadata: any;
  timestamp: string;
};

export default function MyLogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/logs/me", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to load activity");
          return;
        }
        setLogs(data.logs || []);
      } catch {
        setError("Failed to load activity");
      }
    })();
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <p className="eyebrow">Activity</p>
        <h1 className="page-title">My Activity</h1>
        <p className="muted">Recent actions performed with your account.</p>
      </div>

      {error && <div className="card tag-danger">{error}</div>}

      <div className="card">
        <div className="card__header">
          <div className="card__title">Activity Log</div>
        </div>
        <div className="log-list">
          {logs.length === 0 && <div className="empty-state">No activity yet</div>}
          {logs.map((log) => (
            <div className="log-item" key={log.id}>
              <div className="flex" style={{ justifyContent: "space-between" }}>
                <div style={{ fontWeight: 700 }}>{log.action?.replace(/_/g, " ")}</div>
                <div className="chip">info</div>
              </div>
              <div className="log-meta">
                {log.target_type} #{log.target_id}
              </div>
              {log.metadata && (
                <pre style={{ background: "#eef4ff", padding: 10, borderRadius: 12, overflow: "auto" }}>
                  {typeof log.metadata === "string" ? log.metadata : JSON.stringify(log.metadata)}
                </pre>
              )}
              <div className="muted" style={{ textAlign: "right" }}>{new Date(log.timestamp).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
