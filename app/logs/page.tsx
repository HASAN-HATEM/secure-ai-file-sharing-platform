"use client";
import { useEffect, useState } from "react";

type Log = {
  id: number;
  action: string;
  target_type: string;
  target_id: number | null;
  details: any;
  timestamp: string;
};

function chipClass(action: string): string {
  const a = action?.toLowerCase() || "";
  if (a.includes("delete") || a.includes("quarantine") || a.includes("fail") || a.includes("block")) return "chip chip--danger";
  if (a.includes("restore") || a.includes("upload") || a.includes("create") || a.includes("share") || a.includes("download") || a.includes("login")) return "chip chip--success";
  if (a.includes("warn") || a.includes("scan") || a.includes("flag") || a.includes("role")) return "chip chip--warning";
  return "chip";
}

function actionLabel(action: string): string {
  return action?.replace(/_/g, " ").toLowerCase().replace(/\b\w/, c => c.toUpperCase()) || "Event";
}

function actionIcon(action: string): string {
  const a = action?.toLowerCase() || "";
  if (a.includes("upload")) return "⤴";
  if (a.includes("download")) return "⬇";
  if (a.includes("share")) return "🔗";
  if (a.includes("restore")) return "↩";
  if (a.includes("permanent_delete")) return "💥";
  if (a.includes("delete")) return "🗑";
  if (a.includes("login")) return "🔑";
  if (a.includes("role")) return "👤";
  return "📋";
}

export default function MyLogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/logs/me", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Failed to load activity"); return; }
        setLogs(data.logs || []);
      } catch {
        setError("Failed to load activity");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <p className="eyebrow">Activity</p>
        <h1 className="page-title">My Activity</h1>
        <p className="muted">A record of all actions performed with your account.</p>
      </div>

      {error && (
        <div className="verdict-banner verdict-banner--blocked">
          <div className="verdict-banner__icon">⚠</div>
          <div>
            <div className="verdict-banner__title">Error</div>
            <div className="verdict-banner__sub">{error}</div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card__header">
          <div className="card__title">Event Log</div>
          {logs.length > 0 && (
            <span className="status-tag">{logs.length} event{logs.length !== 1 ? "s" : ""}</span>
          )}
        </div>

        {loading && <div className="muted" style={{ padding: "24px 0" }}>Loading activity...</div>}

        {!loading && logs.length === 0 && !error && (
          <div className="empty-state" style={{ padding: "52px 24px" }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>🧾</div>
            <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>No activity yet</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Actions like uploads, shares, and downloads will appear here.
            </div>
          </div>
        )}

        <div className="log-list">
          {logs.map((log) => {
            const details = log.details;
            const filename = details?.filename || details?.fileId || null;
            return (
              <div className="log-item" key={log.id}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    background: "#e8f1ff", color: "var(--accent)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18
                  }}>
                    {actionIcon(log.action)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700 }}>{actionLabel(log.action)}</span>
                      <span className={chipClass(log.action)} style={{ fontSize: 11 }}>
                        {log.action?.split("_")[0] || "info"}
                      </span>
                    </div>
                    {filename && (
                      <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
                        {filename}
                      </div>
                    )}
                    {details && Object.keys(details).length > 0 && (
                      <pre className="log-pre" style={{ fontSize: 12 }}>
                        {JSON.stringify(details, null, 2)}
                      </pre>
                    )}
                  </div>
                  <div className="muted" style={{ fontSize: 12, flexShrink: 0, paddingTop: 2 }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
