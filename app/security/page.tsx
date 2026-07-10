"use client";
import { useEffect, useState } from "react";

type LogItem = {
  id: number;
  action: string;
  target_type: string;
  target_id: number;
  details: any;
  timestamp: string;
  email?: string;
  name?: string;
  actor_user_id?: number;
};

function chipClass(action: string): string {
  const a = action?.toLowerCase() || "";
  if (a.includes("delete") || a.includes("block") || a.includes("quarantine") || a.includes("fail") || a.includes("malicious")) return "chip chip--danger";
  if (a.includes("upload") || a.includes("create") || a.includes("share") || a.includes("download") || a.includes("login")) return "chip chip--success";
  if (a.includes("warn") || a.includes("scan") || a.includes("flag")) return "chip chip--warning";
  return "chip";
}

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
          {logs.length > 0 && <span className="status-tag">{logs.length} event{logs.length !== 1 ? "s" : ""}</span>}
        </div>
        <div className="log-list">
          {logs.length === 0 && <div className="empty-state">No activity yet</div>}
          {logs.map((log) => (
            <div className="log-item" key={log.id}>
              <div className="flex" style={{ justifyContent: "space-between" }}>
                <div style={{ fontWeight: 700 }}>{log.action?.replace(/_/g, " ")}</div>
                <span className={chipClass(log.action)}>{log.action?.replace(/_/g, " ").split(" ")[0] || "info"}</span>
              </div>
              <div className="log-meta">
                {log.target_type} #{log.target_id} · User: {log.email || log.actor_user_id || "unknown"}
              </div>
              {log.details && (
                <pre className="log-pre">
                  {typeof log.details === "string" ? log.details : JSON.stringify(log.details, null, 2)}
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
