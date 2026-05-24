"use client";
import { useEffect, useState } from "react";

type LogItem = {
  id: number;
  action: string;
  target_type: string;
  target_id: number;
  metadata: any;
  timestamp: string;
  email?: string;
  name?: string;
  user_id?: number;
};

export default function SecurityLogsPage() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/logs");
      if (res.ok) {
        const body = await res.json();
        setLogs(body.logs || []);
        return;
      }
      // fallback to limited activity
      const alt = await fetch("/api/files/list");
      if (alt.ok) {
        const body = await alt.json();
        setLogs(body.activity || []);
      } else {
        setError("Unable to load logs");
      }
    })();
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <p className="eyebrow">Security</p>
        <h1 className="page-title">Security Logs</h1>
        <p className="muted">Monitor system activity and security events.</p>
      </div>

      {error && <div className="tag-danger card">{error}</div>}

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
                {log.target_type} #{log.target_id} • User: {log.email || log.user_id || "unknown"}
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
